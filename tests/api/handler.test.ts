// @vitest-environment node
/**
 * `withHandler` is the only thing between a thrown error and the browser, so these
 * tests are mostly about what does *not* come out: no provider text, no submitted
 * values, no cacheable response. The happy paths are cheap to assert and included
 * for completeness, but the leak tests are the reason this file exists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { withHandler } from '../../api/_lib/handler';
import { ApiError } from '../../api/_lib/errors';
import { CORRELATION_HEADER } from '../../api/_lib/correlation';
import { createMockRequest, createMockResponse } from './_mock';

let infoLog: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The handler logs one line per request by design. Captured rather than silenced,
  // because two tests below assert on what reaches the log.
  infoLog = vi.spyOn(console, 'info').mockImplementation(() => {});
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const loggedText = (spy: ReturnType<typeof vi.spyOn>): string =>
  spy.mock.calls.map((call) => call.join(' ')).join('\n');

describe('withHandler — method routing', () => {
  const handler = withHandler({
    methods: ['POST'],
    handler: async () => ({ ok: true }),
  });

  it('rejects a method the endpoint does not declare', async () => {
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET' }), res.res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({ error: { code: 'method_not_allowed' } });
  });

  it('names the accepted methods in Allow, which a 405 is required to carry', async () => {
    const res = createMockResponse();
    await handler(createMockRequest({ method: 'DELETE' }), res.res);

    expect(res.headers.allow).toBe('POST, OPTIONS');
  });

  it('answers OPTIONS without running the handler', async () => {
    const ran = vi.fn();
    const optionsHandler = withHandler({
      methods: ['POST'],
      handler: async () => {
        ran();
        return null;
      },
    });

    const res = createMockResponse();
    await optionsHandler(createMockRequest({ method: 'OPTIONS' }), res.res);

    expect(res.statusCode).toBe(204);
    expect(res.headers.allow).toBe('POST, OPTIONS');
    expect(ran).not.toHaveBeenCalled();
  });
});

describe('withHandler — headers', () => {
  const handler = withHandler({ methods: ['GET'], handler: async () => ({ ok: true }) });

  it('marks every response no-store', async () => {
    const res = createMockResponse();
    await handler(createMockRequest(), res.res);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('honours an inbound correlation id so a client trace survives', async () => {
    const res = createMockResponse();
    await handler(
      createMockRequest({ headers: { [CORRELATION_HEADER]: 'trace-abc-123' } }),
      res.res,
    );

    expect(res.headers[CORRELATION_HEADER]).toBe('trace-abc-123');
  });

  it('strips control characters from an inbound id rather than logging them', async () => {
    const res = createMockResponse();
    await handler(
      createMockRequest({
        headers: { [CORRELATION_HEADER]: 'abc\r\nFAKE LOG LINE: admin logged in' },
      }),
      res.res,
    );

    const id = res.headers[CORRELATION_HEADER] ?? '';
    expect(id).not.toContain('\n');
    expect(id).not.toContain(' ');
    // The log line is a single line, which is the whole point of sanitising.
    expect(loggedText(infoLog).split('\n')).toHaveLength(1);
  });

  it('generates an id when the client sends none', async () => {
    const res = createMockResponse();
    await handler(createMockRequest(), res.res);

    expect(res.headers[CORRELATION_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets the header even when the request fails, so the failure is findable', async () => {
    const failing = withHandler({
      methods: ['GET'],
      handler: async () => {
        throw new Error('boom');
      },
    });

    const res = createMockResponse();
    await failing(createMockRequest(), res.res);

    expect(res.statusCode).toBe(500);
    expect(res.headers[CORRELATION_HEADER]).toBeTruthy();
    expect((res.body as { error: { correlationId: string } }).error.correlationId).toBe(
      res.headers[CORRELATION_HEADER],
    );
  });
});

describe('withHandler — input validation', () => {
  const bodySchema = z.object({ name: z.string().min(2), age: z.number().int() });

  it('reads the body for POST', async () => {
    const handler = withHandler({
      methods: ['POST'],
      schema: bodySchema,
      handler: async ({ input }) => input,
    });

    const res = createMockResponse();
    await handler(
      createMockRequest({ method: 'POST', body: { name: 'Amina', age: 31 } }),
      res.res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ name: 'Amina', age: 31 });
  });

  it('reads the query string for GET', async () => {
    const handler = withHandler({
      methods: ['GET'],
      schema: z.object({ surah: z.string() }),
      handler: async ({ input }) => input,
    });

    const res = createMockResponse();
    await handler(createMockRequest({ method: 'GET', query: { surah: '18' } }), res.res);

    expect(res.body).toEqual({ surah: '18' });
  });

  it('treats a missing POST body as an empty object, not as undefined', async () => {
    const handler = withHandler({
      methods: ['POST'],
      schema: z.object({ note: z.string().optional() }),
      handler: async ({ input }) => ({ received: input }),
    });

    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST' }), res.res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: {} });
  });

  it('returns 422 with field paths a client can act on', async () => {
    const handler = withHandler({
      methods: ['POST'],
      schema: bodySchema,
      handler: async () => ({ ok: true }),
    });

    const res = createMockResponse();
    await handler(
      createMockRequest({ method: 'POST', body: { name: 'x', age: 'not a number' } }),
      res.res,
    );

    expect(res.statusCode).toBe(422);
    const body = res.body as {
      error: { code: string; details: { issues: { path: string }[] } };
    };
    expect(body.error.code).toBe('unprocessable');
    expect(body.error.details.issues.map((i) => i.path).sort()).toEqual(['age', 'name']);
  });

  it('does not echo the submitted value back in a validation error', async () => {
    const handler = withHandler({
      methods: ['POST'],
      schema: z.object({ password: z.string().min(20) }),
      handler: async () => ({ ok: true }),
    });

    const res = createMockResponse();
    await handler(
      createMockRequest({ method: 'POST', body: { password: 'hunter2-in-a-bug-report' } }),
      res.res,
    );

    expect(res.statusCode).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('validates before authenticating, so a typo is not reported as a session problem', async () => {
    const handler = withHandler({
      methods: ['POST'],
      schema: bodySchema,
      auth: 'required',
      handler: async () => ({ ok: true }),
    });

    const res = createMockResponse();
    // No Authorization header at all, and an invalid body.
    await handler(createMockRequest({ method: 'POST', body: {} }), res.res);

    expect(res.statusCode).toBe(422);
  });
});

describe('withHandler — authentication', () => {
  const handler = withHandler({
    methods: ['GET'],
    auth: 'required',
    handler: async ({ auth }) => ({ userId: auth.userId }),
  });

  it('returns 401 when no bearer token is present', async () => {
    const res = createMockResponse();
    await handler(createMockRequest(), res.res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('returns 401 for an Authorization header that is not a bearer token', async () => {
    const res = createMockResponse();
    await handler(
      createMockRequest({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }),
      res.res,
    );

    expect(res.statusCode).toBe(401);
  });

  it('leaves auth null for a route that does not require it', async () => {
    const open = withHandler({
      methods: ['GET'],
      auth: 'none',
      handler: async ({ auth }) => ({ authenticated: auth !== null }),
    });

    const res = createMockResponse();
    await open(createMockRequest(), res.res);

    expect(res.body).toEqual({ authenticated: false });
  });
});

describe('withHandler — responses', () => {
  it('sends 204 when the handler returns nothing', async () => {
    const handler = withHandler({
      methods: ['POST'],
      handler: async () => undefined,
    });

    const res = createMockResponse();
    await handler(createMockRequest({ method: 'POST' }), res.res);

    expect(res.statusCode).toBe(204);
    expect(res.body).toBeUndefined();
  });

  it('does not append a second response when the handler wrote its own', async () => {
    const handler = withHandler({
      methods: ['GET'],
      handler: async ({ res }) => {
        res.status(503).json({ status: 'degraded' });
      },
    });

    const res = createMockResponse();
    await handler(createMockRequest(), res.res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ status: 'degraded' });
  });
});

describe('withHandler — error handling', () => {
  it('passes an ApiError through with its own status and message', async () => {
    const handler = withHandler({
      methods: ['GET'],
      handler: async () => {
        throw new ApiError('not_found', 'No such surah.');
      },
    });

    const res = createMockResponse();
    await handler(createMockRequest(), res.res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'not_found', message: 'No such surah.' },
    });
  });

  it('replaces an unexpected error with a generic message and logs the real one', async () => {
    const leaky =
      'connection to server at "db.abcdefghijk.supabase.co" failed: password=hunter2';
    const handler = withHandler({
      methods: ['GET'],
      handler: async () => {
        throw new Error(leaky);
      },
    });

    const res = createMockResponse();
    await handler(createMockRequest(), res.res);

    expect(res.statusCode).toBe(500);

    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('supabase.co');
    expect(serialised).toContain('correlationId');

    // The detail is not lost — it goes where only an operator can read it.
    expect(loggedText(errorLog)).toContain('hunter2');
  });

  it('survives a thrown non-Error', async () => {
    const handler = withHandler({
      methods: ['GET'],
      handler: async () => {
        throw 'a bare string';
      },
    });

    const res = createMockResponse();
    await handler(createMockRequest(), res.res);

    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('a bare string');
  });

  it('logs one line per request, with no body content in it', async () => {
    const handler = withHandler({
      methods: ['POST'],
      schema: z.object({ secret: z.string() }),
      handler: async () => ({ ok: true }),
    });

    const res = createMockResponse();
    await handler(
      createMockRequest({ method: 'POST', url: '/api/test', body: { secret: 'do-not-log-me' } }),
      res.res,
    );

    const logged = loggedText(infoLog);
    expect(logged.split('\n')).toHaveLength(1);
    expect(logged).toContain('/api/test');
    expect(logged).toContain('200');
    expect(logged).not.toContain('do-not-log-me');
  });
});
