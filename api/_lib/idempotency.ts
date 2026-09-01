/**
 * Idempotency: making a retried write safe.
 *
 * The problem is not hypothetical. A client on a Ghanaian mobile network loses the
 * response to a checkout POST and retries. Without this module, the retry is a
 * second order. With it, the retry returns the first response.
 *
 * The protocol, and why each part is there:
 *
 *   claim   Insert `(scope, key)`. The primary key is the lock — Postgres decides
 *           the winner, not application code, so two concurrent requests cannot
 *           both believe they claimed it.
 *   work    Only the claimer runs the operation.
 *   complete Store the status and body that were actually sent.
 *
 * The request hash is what separates a retry from a bug. Same key, same payload is
 * a retry and gets a replay. Same key, *different* payload is a client defect, and
 * replaying the first response would hide it while silently dropping the second
 * request — so that case is a 409.
 *
 * Uses the service client: `idempotency_keys` has RLS enabled and no policies at
 * all, which is deliberate. Bookkeeping about a request is not the requester's to
 * read or write.
 */
import { createHash } from 'node:crypto';
import { ApiError } from './errors';
import { createServiceClient, type Db } from './supabase';

export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export interface IdempotencyClaim {
  scope: string;
  key: string;
  userId?: string | null;
  requestHash: string;
}

export type ClaimResult =
  /** This request owns the key. Do the work, then call `completeIdempotencyKey`. */
  | { outcome: 'claimed' }
  /** An earlier identical request already finished. Send this instead of working. */
  | { outcome: 'replay'; status: number; body: unknown };

interface KeyRow {
  status: string;
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
  expires_at: string;
}

/**
 * Canonical JSON: object keys sorted at every depth, so two payloads that differ
 * only in key order hash the same. Array order is preserved — `[1,2]` and `[2,1]`
 * are genuinely different requests.
 *
 * `undefined` inside an object is dropped (matching `JSON.stringify`) but inside an
 * array becomes `null`, again matching, so the hash agrees with what was sent.
 */
const canonicalise = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalise).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(',')}}`;
};

export const hashRequest = (payload: unknown): string =>
  createHash('sha256').update(canonicalise(payload)).digest('hex');

/** Rejects the empty and the absurd before either reaches the database. */
const validateKey = (scope: string, key: string): void => {
  if (scope.trim().length === 0) {
    throw new ApiError('internal', 'An idempotency scope is required.');
  }
  if (key.trim().length === 0) {
    throw new ApiError('bad_request', 'The Idempotency-Key header must not be empty.');
  }
  if (key.length > 255) {
    throw new ApiError('bad_request', 'The Idempotency-Key header is too long.');
  }
};

/**
 * Attempts to take ownership of a key.
 *
 * Returns `claimed` when the caller should proceed, `replay` when a completed
 * response is available, and throws 409 when a concurrent request holds the key or
 * the payload does not match the original.
 */
export const claimIdempotencyKey = async (
  claim: IdempotencyClaim,
  client?: Db,
): Promise<ClaimResult> => {
  const { scope, key, userId = null, requestHash } = claim;
  validateKey(scope, key);

  const db = client ?? createServiceClient();

  const { error: insertError } = await db.from('idempotency_keys').insert({
    scope,
    key,
    user_id: userId,
    request_hash: requestHash,
    status: 'in_progress',
  });

  if (insertError === null) {
    return { outcome: 'claimed' };
  }

  // 23505 is the only error that means "someone else got here first". Anything
  // else is a real failure and must not be mistaken for contention.
  if (insertError.code !== '23505') {
    throw new ApiError('internal', 'Could not record the request for safe retry.', {
      cause: insertError,
    });
  }

  const { data: existing, error: selectError } = await db
    .from('idempotency_keys')
    .select('status, request_hash, response_status, response_body, expires_at')
    .eq('scope', scope)
    .eq('key', key)
    .maybeSingle<KeyRow>();

  if (selectError !== null) {
    throw new ApiError('internal', 'Could not read the state of a retried request.', {
      cause: selectError,
    });
  }

  // Lost to a concurrent reaper between the insert and the select. Vanishingly
  // rare, and asking the client to retry is honest about what happened.
  if (existing === null) {
    throw new ApiError('conflict', 'This request is already being processed. Retry shortly.');
  }

  if (existing.request_hash !== requestHash) {
    throw new ApiError(
      'conflict',
      'This Idempotency-Key was already used with a different request body. Use a new key.',
    );
  }

  if (existing.status === 'completed') {
    return {
      outcome: 'replay',
      // The check constraint guarantees a completed row has a response status;
      // the fallback exists so a hand-edited row cannot produce `undefined` here.
      status: existing.response_status ?? 200,
      body: existing.response_body,
    };
  }

  /*
   * A failed attempt is retryable, and an expired one is effectively absent. Both
   * are re-claimed rather than rejected — the alternative burns the key for a
   * client whose first attempt never produced any effect worth preserving.
   */
  const expired = Date.parse(existing.expires_at) <= Date.now();
  if (existing.status === 'failed' || expired) {
    const { error: reclaimError } = await db
      .from('idempotency_keys')
      .update({
        status: 'in_progress',
        request_hash: requestHash,
        response_status: null,
        response_body: null,
        completed_at: null,
      })
      .eq('scope', scope)
      .eq('key', key)
      // Guards against re-claiming a row that a concurrent request completed
      // between our select and this update.
      .in('status', ['failed', 'in_progress']);

    if (reclaimError !== null) {
      throw new ApiError('internal', 'Could not reset a failed request for retry.', {
        cause: reclaimError,
      });
    }
    return { outcome: 'claimed' };
  }

  // status is 'in_progress' and unexpired: a genuine concurrent duplicate.
  throw new ApiError('conflict', 'An identical request is still in progress.');
};

/**
 * Records the response that was sent, so a later retry replays it.
 *
 * Call this after the work succeeds and *before* responding. Failing to call it
 * leaves the key `in_progress`, which blocks retries until it expires — noisy, but
 * safe in the right direction.
 */
export const completeIdempotencyKey = async (
  args: {
    scope: string;
    key: string;
    responseStatus: number;
    responseBody?: unknown;
  },
  client?: Db,
): Promise<void> => {
  const db = client ?? createServiceClient();

  const { error } = await db
    .from('idempotency_keys')
    .update({
      status: 'completed',
      response_status: args.responseStatus,
      response_body: args.responseBody ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('scope', args.scope)
    .eq('key', args.key);

  if (error !== null) {
    throw new ApiError('internal', 'Could not record the result of the request.', {
      cause: error,
    });
  }
};

/**
 * Marks a claimed key as failed so the client may retry with the same key.
 *
 * Swallows its own errors on purpose: this runs on an error path, and a failure to
 * write the bookkeeping must not replace the original error the caller is about to
 * report. The key expiring is the fallback.
 */
export const failIdempotencyKey = async (
  args: { scope: string; key: string; reason?: string },
  client?: Db,
): Promise<void> => {
  try {
    const db = client ?? createServiceClient();
    await db
      .from('idempotency_keys')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('scope', args.scope)
      .eq('key', args.key);
  } catch {
    // Intentionally ignored. See above.
  }
};

export const IDEMPOTENCY_HEADER = 'idempotency-key';

export const readIdempotencyKey = (header: string | string[] | undefined): string | null => {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};
