/**
 * Supabase clients for server functions.
 *
 * Two clients, and picking the wrong one is the most consequential mistake
 * available in this codebase:
 *
 *   createUserClient(token)  RLS applies. Every query is scoped to the requesting
 *                            user by the policies in supabase/migrations. This is
 *                            the default and should be used for anything acting on
 *                            behalf of a user.
 *
 *   createServiceClient()    RLS is bypassed entirely. Necessary for the tables
 *                            that deliberately have no policies — audit_logs,
 *                            idempotency_keys, webhook_events, ai_usage — and for
 *                            privileged workflows like role grants. Every use is a
 *                            place where authorisation must be checked in code,
 *                            because the database is no longer checking it.
 *
 * Reach for the user client first. If a query "returns nothing" with it, that is
 * usually a policy doing its job, not a reason to switch.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireServerEnv, serverEnv } from './env';

/*
 * All three flags matter in a serverless function, and the reason is the same for
 * each: Vercel reuses a warm container across requests from different users.
 *
 *   persistSession     would write the session to storage and let the next
 *                      invocation on that container pick up the previous user's
 *                      identity.
 *   autoRefreshToken   would start a background timer in a process that is frozen
 *                      between invocations.
 *   detectSessionInUrl is browser-only behaviour and has no meaning here.
 */
const AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/*
 * TODO(step 2 follow-up): parameterise these as `SupabaseClient<Database>` once
 * `npm run db:types` has been run against a started local stack and
 * `types/database.ts` is committed. The generated file is not hand-written,
 * precisely because the mapping from a column typed `app.sect` in a non-exposed
 * schema to a TypeScript type is a detail worth getting from the generator rather
 * than guessing. Until then queries are untyped — not wrong, just unchecked.
 */
export type Db = SupabaseClient;

/**
 * Acts as an unauthenticated visitor. Row-level security applies with
 * `auth.uid()` null, so this can reach only what has an explicit `anon` policy.
 *
 * Used by the health check and by any endpoint serving public content. Reaching
 * for it to "avoid the token" on a user-scoped route returns empty results, which
 * is the policies working, not a bug to route around.
 */
export const createAnonClient = (): Db => {
  requireServerEnv();

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: AUTH_OPTIONS,
  });
};

/** Acts as the requesting user. Row-level security applies. */
export const createUserClient = (accessToken: string): Db => {
  requireServerEnv();

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: AUTH_OPTIONS,
    global: {
      // This header is what PostgREST reads to populate `auth.uid()`, which is
      // what every policy in the schema is written against.
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
};

/**
 * Bypasses row-level security. Authorisation is the caller's responsibility.
 *
 * Not memoised at module scope: a cached client would outlive the invocation that
 * created it, and the whole point of the auth options above is that nothing
 * survives between requests.
 */
export const createServiceClient = (): Db => {
  requireServerEnv();

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: AUTH_OPTIONS,
  });
};
