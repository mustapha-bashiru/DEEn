/**
 * Error envelope for every `/api` response.
 *
 * The rule this module exists to enforce: a message reaches the client only if a
 * developer wrote it here. Provider SDKs put useful things in error text — a
 * Postgres error naming a column and constraint, a Gemini error quoting the
 * prompt that tripped a safety filter, a connection failure carrying the database
 * host and credentials. Forwarding `error.message` to the browser leaks all of it.
 *
 * So `toErrorBody` has exactly two paths: an `ApiError`, whose message was
 * authored deliberately and is safe to send, and anything else, which becomes a
 * fixed generic string. The real error goes to the server log with the
 * correlation id, which is how it gets found again.
 */

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'unprocessable'
  | 'rate_limited'
  | 'internal'
  | 'unavailable';

const STATUS_BY_CODE: Readonly<Record<ApiErrorCode, number>> = {
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

export interface ApiErrorOptions {
  /**
   * Structured, client-safe detail — field validation errors, a retry-after
   * hint. Must not contain provider text; the same leak rule applies.
   */
  details?: unknown;
  /** The underlying error. Logged, never serialised to the client. */
  cause?: unknown;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options.details;
  }
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    /** Quote this in a bug report; it ties the response to the server log. */
    correlationId: string;
  };
}

/**
 * The one message an unrecognised failure is allowed to produce. Deliberately
 * says nothing about what broke.
 */
const GENERIC_MESSAGE =
  'The request could not be completed. Quote the correlation id if you report this.';

export const toErrorBody = (
  error: unknown,
  correlationId: string,
): { status: number; body: ApiErrorBody } => {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
          correlationId,
        },
      },
    };
  }

  return {
    status: 500,
    body: { error: { code: 'internal', message: GENERIC_MESSAGE, correlationId } },
  };
};

/**
 * What to write to the server log for an error.
 *
 * Returns a string rather than logging directly so the caller controls the sink
 * and so this is testable. Includes the stack for unknown errors — that is the
 * whole point of the log line — but the caller must never put the result in a
 * response body.
 */
export const describeErrorForLog = (error: unknown): string => {
  if (error instanceof ApiError) {
    const cause = error.cause instanceof Error ? ` cause=${error.cause.stack ?? error.cause.message}` : '';
    return `ApiError[${error.code}] ${error.message}${cause}`;
  }
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return `Non-error thrown: ${String(error)}`;
};
