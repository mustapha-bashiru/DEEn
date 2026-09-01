// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError, describeErrorForLog, toErrorBody } from '../../api/_lib/errors';

describe('ApiError', () => {
  it('maps each code to its HTTP status', () => {
    const expected: Record<string, number> = {
      bad_request: 400,
      unauthorized: 401,
      forbidden: 403,
      not_found: 404,
      method_not_allowed: 405,
      conflict: 409,
      unprocessable: 422,
      rate_limited: 429,
      internal: 500,
      unavailable: 503,
    };

    for (const [code, status] of Object.entries(expected)) {
      expect(new ApiError(code as never, 'x').status).toBe(status);
    }
  });

  it('keeps the cause available for logging without exposing it', () => {
    const cause = new Error('postgres: relation "profiles" does not exist');
    const error = new ApiError('internal', 'Something went wrong.', { cause });

    expect(error.cause).toBe(cause);
    expect(error.message).not.toContain('profiles');
  });
});

describe('toErrorBody', () => {
  it('sends an authored ApiError message verbatim', () => {
    const { status, body } = toErrorBody(
      new ApiError('forbidden', 'This action requires the admin role.'),
      'cid-1',
    );

    expect(status).toBe(403);
    expect(body.error).toEqual({
      code: 'forbidden',
      message: 'This action requires the admin role.',
      correlationId: 'cid-1',
    });
  });

  it('includes details when present and omits the key entirely when not', () => {
    const withDetails = toErrorBody(
      new ApiError('rate_limited', 'Slow down.', { details: { retryAfter: 30 } }),
      'cid-2',
    );
    expect(withDetails.body.error.details).toEqual({ retryAfter: 30 });

    const without = toErrorBody(new ApiError('not_found', 'Gone.'), 'cid-3');
    expect('details' in without.body.error).toBe(false);
  });

  it('replaces any other error with a fixed message', () => {
    const cases: unknown[] = [
      new Error('ECONNREFUSED 127.0.0.1:54322'),
      new TypeError('cannot read property of undefined'),
      'a bare string',
      { code: 'PGRST301', message: 'JWT expired' },
      null,
      undefined,
    ];

    for (const error of cases) {
      const { status, body } = toErrorBody(error, 'cid-4');
      expect(status).toBe(500);
      expect(body.error.code).toBe('internal');
      expect(body.error.message).toBe(
        'The request could not be completed. Quote the correlation id if you report this.',
      );
      // The one property that must hold for every unknown error: nothing from the
      // original reaches the client.
      expect(JSON.stringify(body)).not.toContain('54322');
      expect(JSON.stringify(body)).not.toContain('PGRST301');
    }
  });

  it('does not leak an ApiError cause into the response', () => {
    const { body } = toErrorBody(
      new ApiError('unavailable', 'The server is not configured correctly.', {
        cause: new Error('SUPABASE_SERVICE_ROLE_KEY — Not set'),
      }),
      'cid-5',
    );

    expect(JSON.stringify(body)).not.toContain('SERVICE_ROLE');
  });
});

describe('describeErrorForLog', () => {
  it('includes the code, the message, and the cause stack', () => {
    const cause = new Error('underlying failure');
    const described = describeErrorForLog(new ApiError('internal', 'Wrapped.', { cause }));

    expect(described).toContain('ApiError[internal]');
    expect(described).toContain('Wrapped.');
    expect(described).toContain('underlying failure');
  });

  it('prefers the stack for a plain Error', () => {
    const described = describeErrorForLog(new Error('plain'));
    expect(described).toContain('plain');
    expect(described).toContain('at ');
  });

  it('describes a thrown non-Error rather than returning nothing', () => {
    expect(describeErrorForLog(42)).toBe('Non-error thrown: 42');
    expect(describeErrorForLog(null)).toBe('Non-error thrown: null');
  });
});
