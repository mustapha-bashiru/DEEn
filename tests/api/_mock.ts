/**
 * Test doubles for the `/api` layer.
 *
 * Handlers are invoked directly with these rather than through a running server.
 * That is a deliberate choice made in the step 2 plan: a local HTTP harness would
 * be a second runtime to keep in agreement with Vercel's, and it would test the
 * harness as much as the code. What these fakes assert instead is the part that is
 * ours — status codes, headers, and response bodies — with `vercel dev` as the
 * documented path for exercising the real runtime.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Db } from '../../api/_lib/supabase';

export interface MockRequestInit {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[]>;
  body?: unknown;
}

/**
 * Node lower-cases inbound header names before handlers ever see them, so the mock
 * does too. Skipping that makes a test pass against a header name that would never
 * match in production.
 */
export const createMockRequest = (init: MockRequestInit = {}): VercelRequest => {
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    headers[key.toLowerCase()] = value;
  }

  return {
    method: init.method ?? 'GET',
    url: init.url ?? '/api/test',
    headers,
    query: init.query ?? {},
    body: init.body,
    cookies: {},
  } as unknown as VercelRequest;
};

export interface MockResponse {
  res: VercelResponse;
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  ended: boolean;
}

export const createMockResponse = (): MockResponse => {
  const state: MockResponse = {
    // Replaced below; declared first so the closures can refer to `state`.
    res: undefined as unknown as VercelResponse,
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
  };

  const res = {
    // `writableEnded` is a getter on a real ServerResponse and `withHandler` reads
    // it to decide whether a handler already replied. A plain mutable property here
    // would let a test pass while the real check never fires.
    get writableEnded(): boolean {
      return state.ended;
    },
    get statusCode(): number {
      return state.statusCode;
    },
    setHeader(name: string, value: string | number | string[]): VercelResponse {
      state.headers[name.toLowerCase()] = Array.isArray(value)
        ? value.join(', ')
        : String(value);
      return res as unknown as VercelResponse;
    },
    getHeader(name: string): string | undefined {
      return state.headers[name.toLowerCase()];
    },
    status(code: number): VercelResponse {
      state.statusCode = code;
      return res as unknown as VercelResponse;
    },
    json(payload: unknown): VercelResponse {
      state.body = payload;
      state.ended = true;
      return res as unknown as VercelResponse;
    },
    send(payload: unknown): VercelResponse {
      state.body = payload;
      state.ended = true;
      return res as unknown as VercelResponse;
    },
    end(): VercelResponse {
      state.ended = true;
      return res as unknown as VercelResponse;
    },
  };

  state.res = res as unknown as VercelResponse;
  return state;
};

// ── Supabase ─────────────────────────────────────────────────────────────────

export interface QueryResult {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}

export interface FakeDbCall {
  table: string;
  operation: 'insert' | 'select' | 'update' | 'delete';
  payload?: unknown;
}

export interface FakeDb {
  db: Db;
  calls: FakeDbCall[];
}

/**
 * A chainable stand-in for PostgREST's builder.
 *
 * The builder is awaitable at any point *and* has further methods, because the code
 * under test does both: `completeIdempotencyKey` awaits after `.eq()`, while the
 * reclaim path continues with `.in()` first. A `then` alongside the chain methods is
 * what supports both shapes.
 */
const makeBuilder = (result: QueryResult) => {
  const settled = Promise.resolve({ data: result.data ?? null, error: result.error ?? null });

  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    limit: () => builder,
    order: () => builder,
    abortSignal: () => builder,
    maybeSingle: () => settled,
    single: () => settled,
    then: <TResult>(
      onFulfilled?: (value: { data: unknown; error: unknown }) => TResult,
      onRejected?: (reason: unknown) => TResult,
    ) => settled.then(onFulfilled, onRejected),
  };

  return builder;
};

/**
 * Results are keyed by operation, so one fake can serve a whole flow — an insert
 * that conflicts, the select that reads the existing row, and the update that
 * re-claims it — without the test having to script call order.
 */
export const createFakeDb = (
  results: Partial<Record<FakeDbCall['operation'], QueryResult>> = {},
): FakeDb => {
  const calls: FakeDbCall[] = [];

  const db = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          calls.push({ table, operation: 'insert', payload });
          return makeBuilder(results.insert ?? {});
        },
        select(payload?: unknown) {
          calls.push({ table, operation: 'select', payload });
          return makeBuilder(results.select ?? {});
        },
        update(payload: unknown) {
          calls.push({ table, operation: 'update', payload });
          return makeBuilder(results.update ?? {});
        },
        delete() {
          calls.push({ table, operation: 'delete' });
          return makeBuilder(results.delete ?? {});
        },
      };
    },
  };

  return { db: db as unknown as Db, calls };
};
