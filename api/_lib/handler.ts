/**
 * The wrapper every `/api` endpoint goes through.
 *
 * Centralising this is what stops each endpoint from re-deciding how to reject a
 * wrong method, where validation errors go, whether an error body leaks provider
 * text, and whether a response may be cached. Those decisions are made once here.
 *
 * Order matters and is deliberate:
 *
 *   1. correlation id, and set the response header immediately — a request that
 *      fails in step 3 still needs to be findable in the logs
 *   2. no-store and nosniff
 *   3. OPTIONS and method check, with a spec-required `Allow` header
 *   4. input validation
 *   5. authentication
 *   6. the handler
 *
 * Validation precedes authentication so that a malformed request gets 422 rather
 * than 401. The alternative leads to bug reports about expired sessions that are
 * actually typos in a payload.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError, type ZodType, type z } from 'zod';
import { CORRELATION_HEADER, readCorrelationId } from './correlation';
import { ApiError, describeErrorForLog, toErrorBody } from './errors';
import { authenticate, type AuthContext } from './auth';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthMode = 'required' | 'optional' | 'none';

/** `required` guarantees a context; the others may not have one. */
type AuthFor<TMode extends AuthMode> = TMode extends 'required'
  ? AuthContext
  : AuthContext | null;

type BodyFor<TSchema extends ZodType | undefined> = TSchema extends ZodType
  ? z.infer<TSchema>
  : undefined;

export interface HandlerContext<TInput, TAuth> {
  req: VercelRequest;
  res: VercelResponse;
  correlationId: string;
  /** The validated input. `req.query` for GET and DELETE, `req.body` otherwise. */
  input: TInput;
  auth: TAuth;
}

export interface HandlerOptions<
  TSchema extends ZodType | undefined,
  TAuthMode extends AuthMode,
> {
  methods: HttpMethod[];
  /**
   * Validates `req.query` for GET and DELETE, and `req.body` for the methods that
   * carry one. Chosen per request from the actual method, so one endpoint serving
   * both reads the right place each time.
   */
  schema?: TSchema;
  auth?: TAuthMode;
  /**
   * Return a value to send as JSON with 200, or nothing for 204. Throw an
   * `ApiError` for any deliberate failure.
   */
  handler: (
    ctx: HandlerContext<BodyFor<TSchema>, AuthFor<TAuthMode>>,
  ) => Promise<unknown>;
}

const METHODS_WITHOUT_BODY = new Set<string>(['GET', 'HEAD', 'DELETE']);

const zodIssuesToDetails = (error: ZodError): unknown => ({
  // Paths, codes, and our own schema's messages. No submitted values are echoed
  // back: a validation error on a password field should not quote the password.
  issues: error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  })),
});

export const withHandler = <
  TSchema extends ZodType | undefined = undefined,
  TAuthMode extends AuthMode = 'none',
>(
  options: HandlerOptions<TSchema, TAuthMode>,
) => {
  const { methods, schema, auth: authMode = 'none' as TAuthMode, handler } = options;
  const allow = [...methods, 'OPTIONS'].join(', ');

  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const startedAt = Date.now();
    const correlationId = readCorrelationId(req.headers[CORRELATION_HEADER]);

    res.setHeader(CORRELATION_HEADER, correlationId);
    // No API response is ever cacheable. The service worker already excludes
    // /api from its navigation fallback; this covers every other intermediary.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const finish = (status: number): void => {
      // One line per request: enough to spot a failing endpoint or a slow one,
      // with no request or response content in it.
      console.info(
        `api ${req.method ?? '?'} ${req.url ?? '?'} ${status} ${Date.now() - startedAt}ms cid=${correlationId}`,
      );
    };

    try {
      if (req.method === 'OPTIONS') {
        res.setHeader('Allow', allow);
        res.status(204).end();
        finish(204);
        return;
      }

      if (!methods.includes(req.method as HttpMethod)) {
        res.setHeader('Allow', allow);
        throw new ApiError('method_not_allowed', `This endpoint accepts ${allow}.`);
      }

      let input: unknown = undefined;
      if (schema !== undefined) {
        const raw = METHODS_WITHOUT_BODY.has(req.method ?? '')
          ? req.query
          : // Vercel leaves `body` undefined for an empty request. An object
            // schema would report "expected object, received undefined", which
            // is a confusing way to say "you sent nothing".
            (req.body ?? {});
        input = schema.parse(raw);
      }

      let authContext: AuthContext | null = null;
      if (authMode === 'required') {
        authContext = await authenticate(req.headers.authorization);
      } else if (authMode === 'optional') {
        // A bad token on an optional route is treated as no token: the route works
        // for anonymous callers, so an expired session should degrade to the guest
        // experience rather than becoming a 401 the client did not ask for.
        try {
          authContext = await authenticate(req.headers.authorization);
        } catch {
          authContext = null;
        }
      }

      const result = await handler({
        req,
        res,
        correlationId,
        input: input as BodyFor<TSchema>,
        auth: authContext as AuthFor<TAuthMode>,
      });

      // A handler that has already written the response (a stream, a redirect)
      // must not have a second one appended.
      if (res.writableEnded) {
        finish(res.statusCode);
        return;
      }

      if (result === undefined) {
        res.status(204).end();
        finish(204);
        return;
      }

      res.status(200).json(result);
      finish(200);
    } catch (error) {
      const normalised =
        error instanceof ZodError
          ? new ApiError('unprocessable', 'The request payload is not valid.', {
              details: zodIssuesToDetails(error),
              cause: error,
            })
          : error;

      const { status, body } = toErrorBody(normalised, correlationId);

      // The full error — including the cause a client never sees — goes here.
      console.error(`api error cid=${correlationId}: ${describeErrorForLog(normalised)}`);

      if (!res.writableEnded) {
        res.status(status).json(body);
      }
      finish(status);
    }
  };
};
