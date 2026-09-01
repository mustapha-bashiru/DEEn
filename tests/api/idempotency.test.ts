// @vitest-environment node
/**
 * The behaviour under test is a protocol, not a function: what a *second* request
 * carrying the same key gets back. Each case below is one thing the second request
 * might be — an honest retry, a slow duplicate, a client bug, a previous failure —
 * and they must not be confused for one another.
 */
import { describe, expect, it } from 'vitest';
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
  hashRequest,
  readIdempotencyKey,
} from '../../api/_lib/idempotency';
import { ApiError } from '../../api/_lib/errors';
import { createFakeDb } from './_mock';

const CONFLICT = { code: '23505', message: 'duplicate key value violates unique constraint' };
const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 86_400_000).toISOString();

describe('hashRequest', () => {
  it('is stable for the same payload', () => {
    expect(hashRequest({ a: 1 })).toBe(hashRequest({ a: 1 }));
  });

  it('ignores object key order, because JSON serialisation order is not meaningful', () => {
    expect(hashRequest({ a: 1, b: 2 })).toBe(hashRequest({ b: 2, a: 1 }));
  });

  it('ignores key order at every depth', () => {
    const one = { outer: { x: 1, y: { p: 'a', q: 'b' } } };
    const two = { outer: { y: { q: 'b', p: 'a' }, x: 1 } };
    expect(hashRequest(one)).toBe(hashRequest(two));
  });

  it('treats array order as significant, because it is', () => {
    expect(hashRequest({ items: [1, 2] })).not.toBe(hashRequest({ items: [2, 1] }));
  });

  it('distinguishes different values, types, and absent keys', () => {
    expect(hashRequest({ amount: 100 })).not.toBe(hashRequest({ amount: 101 }));
    expect(hashRequest({ amount: 100 })).not.toBe(hashRequest({ amount: '100' }));
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 1, b: null }));
  });

  it('drops undefined properties, matching what was actually serialised and sent', () => {
    expect(hashRequest({ a: 1, b: undefined })).toBe(hashRequest({ a: 1 }));
  });

  it('handles primitives and null without throwing', () => {
    expect(hashRequest(null)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRequest('text')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRequest(undefined)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('claimIdempotencyKey — first attempt', () => {
  it('claims a key nobody holds', async () => {
    const { db, calls } = createFakeDb({ insert: { error: null } });

    const result = await claimIdempotencyKey(
      { scope: 'checkout', key: 'k1', userId: 'user-1', requestHash: 'h1' },
      db,
    );

    expect(result).toEqual({ outcome: 'claimed' });
    expect(calls[0]).toMatchObject({ table: 'idempotency_keys', operation: 'insert' });
    expect(calls[0]?.payload).toMatchObject({
      scope: 'checkout',
      key: 'k1',
      user_id: 'user-1',
      request_hash: 'h1',
      status: 'in_progress',
    });
  });

  it('treats an insert failure that is not a conflict as a real error', async () => {
    const { db } = createFakeDb({
      insert: { error: { code: '42P01', message: 'relation does not exist' } },
    });

    await expect(
      claimIdempotencyKey({ scope: 's', key: 'k', requestHash: 'h' }, db),
    ).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('claimIdempotencyKey — second attempt', () => {
  it('replays the stored response for an honest retry', async () => {
    const { db } = createFakeDb({
      insert: { error: CONFLICT },
      select: {
        data: {
          status: 'completed',
          request_hash: 'h1',
          response_status: 201,
          response_body: { orderId: 'order-9' },
          expires_at: future(),
        },
      },
    });

    const result = await claimIdempotencyKey(
      { scope: 'checkout', key: 'k1', requestHash: 'h1' },
      db,
    );

    expect(result).toEqual({
      outcome: 'replay',
      status: 201,
      body: { orderId: 'order-9' },
    });
  });

  it('rejects the same key with a different payload instead of replaying', async () => {
    // The case that would otherwise silently discard a real second request.
    const { db } = createFakeDb({
      insert: { error: CONFLICT },
      select: {
        data: {
          status: 'completed',
          request_hash: 'hash-of-the-first-request',
          response_status: 200,
          response_body: { ok: true },
          expires_at: future(),
        },
      },
    });

    await expect(
      claimIdempotencyKey(
        { scope: 'checkout', key: 'k1', requestHash: 'hash-of-a-different-request' },
        db,
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rejects a duplicate that arrives while the first is still running', async () => {
    const { db } = createFakeDb({
      insert: { error: CONFLICT },
      select: {
        data: {
          status: 'in_progress',
          request_hash: 'h1',
          response_status: null,
          response_body: null,
          expires_at: future(),
        },
      },
    });

    await expect(
      claimIdempotencyKey({ scope: 'checkout', key: 'k1', requestHash: 'h1' }, db),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('re-claims a key whose first attempt failed', async () => {
    const { db, calls } = createFakeDb({
      insert: { error: CONFLICT },
      select: {
        data: {
          status: 'failed',
          request_hash: 'h1',
          response_status: null,
          response_body: null,
          expires_at: future(),
        },
      },
      update: { error: null },
    });

    const result = await claimIdempotencyKey(
      { scope: 'checkout', key: 'k1', requestHash: 'h1' },
      db,
    );

    expect(result).toEqual({ outcome: 'claimed' });
    // The reset must clear the previous response, or a later completion could
    // replay a stale body.
    expect(calls.find((c) => c.operation === 'update')?.payload).toMatchObject({
      status: 'in_progress',
      response_status: null,
      response_body: null,
      completed_at: null,
    });
  });

  it('re-claims an expired key, since an expired claim protects nothing', async () => {
    const { db } = createFakeDb({
      insert: { error: CONFLICT },
      select: {
        data: {
          status: 'in_progress',
          request_hash: 'h1',
          response_status: null,
          response_body: null,
          expires_at: past(),
        },
      },
      update: { error: null },
    });

    await expect(
      claimIdempotencyKey({ scope: 'checkout', key: 'k1', requestHash: 'h1' }, db),
    ).resolves.toEqual({ outcome: 'claimed' });
  });

  it('asks the client to retry when the conflicting row has since disappeared', async () => {
    const { db } = createFakeDb({
      insert: { error: CONFLICT },
      select: { data: null },
    });

    await expect(
      claimIdempotencyKey({ scope: 'checkout', key: 'k1', requestHash: 'h1' }, db),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('falls back to 200 if a completed row somehow has no response status', async () => {
    // A check constraint prevents this, so the fallback exists only so a
    // hand-edited row cannot produce `undefined` as an HTTP status.
    const { db } = createFakeDb({
      insert: { error: CONFLICT },
      select: {
        data: {
          status: 'completed',
          request_hash: 'h1',
          response_status: null,
          response_body: { ok: true },
          expires_at: future(),
        },
      },
    });

    const result = await claimIdempotencyKey({ scope: 's', key: 'k', requestHash: 'h1' }, db);
    expect(result).toMatchObject({ outcome: 'replay', status: 200 });
  });
});

describe('claimIdempotencyKey — input guards', () => {
  it('blames the client for an empty key and us for an empty scope', async () => {
    const { db } = createFakeDb({ insert: { error: null } });

    // A client-supplied header: 400.
    await expect(
      claimIdempotencyKey({ scope: 'checkout', key: '  ', requestHash: 'h' }, db),
    ).rejects.toMatchObject({ code: 'bad_request' });

    // A scope is hard-coded by the endpoint, so a missing one is our bug: 500.
    await expect(
      claimIdempotencyKey({ scope: '', key: 'k', requestHash: 'h' }, db),
    ).rejects.toMatchObject({ code: 'internal' });
  });

  it('rejects an absurdly long key before it reaches the database', async () => {
    const { db, calls } = createFakeDb({ insert: { error: null } });

    await expect(
      claimIdempotencyKey({ scope: 's', key: 'x'.repeat(256), requestHash: 'h' }, db),
    ).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(0);
  });
});

describe('completeIdempotencyKey', () => {
  it('records the status and body that were sent', async () => {
    const { db, calls } = createFakeDb({ update: { error: null } });

    await completeIdempotencyKey(
      { scope: 'checkout', key: 'k1', responseStatus: 201, responseBody: { id: 'a' } },
      db,
    );

    expect(calls[0]?.payload).toMatchObject({
      status: 'completed',
      response_status: 201,
      response_body: { id: 'a' },
    });
  });

  it('stores null rather than undefined for an empty body', async () => {
    const { db, calls } = createFakeDb({ update: { error: null } });

    await completeIdempotencyKey({ scope: 's', key: 'k', responseStatus: 204 }, db);

    expect((calls[0]?.payload as { response_body: unknown }).response_body).toBeNull();
  });

  it('reports a failure to record, because a silent one breaks every later retry', async () => {
    const { db } = createFakeDb({ update: { error: { message: 'write failed' } } });

    await expect(
      completeIdempotencyKey({ scope: 's', key: 'k', responseStatus: 200 }, db),
    ).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('failIdempotencyKey', () => {
  it('marks the key failed so the client may retry', async () => {
    const { db, calls } = createFakeDb({ update: { error: null } });

    await failIdempotencyKey({ scope: 's', key: 'k' }, db);

    expect(calls[0]?.payload).toMatchObject({ status: 'failed' });
  });

  it('swallows its own error rather than replacing the one being reported', async () => {
    // This runs on an error path. If it threw, the caller's original error — the
    // one that explains what actually went wrong — would be lost. A client that
    // throws on use is the case that actually reaches the catch.
    const throwingDb = {
      from: () => {
        throw new Error('connection lost');
      },
    } as unknown as Parameters<typeof failIdempotencyKey>[1];

    await expect(
      failIdempotencyKey({ scope: 's', key: 'k' }, throwingDb),
    ).resolves.toBeUndefined();
  });
});

describe('readIdempotencyKey', () => {
  it('trims, takes the first of a repeated header, and rejects nothing usable', () => {
    expect(readIdempotencyKey('  key-1  ')).toBe('key-1');
    expect(readIdempotencyKey(['key-1', 'key-2'])).toBe('key-1');
    expect(readIdempotencyKey('   ')).toBeNull();
    expect(readIdempotencyKey(undefined)).toBeNull();
  });
});
