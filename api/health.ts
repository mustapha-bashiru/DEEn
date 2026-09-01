/**
 * GET /api/health
 *
 * The first endpoint, and the one that proves the pipeline works end to end:
 * environment validation, a Supabase client, RLS with a real policy, the error
 * envelope, and correlation ids.
 *
 * What it deliberately does *not* do is explain itself to the caller. This route is
 * unauthenticated and reachable from anywhere, so the body is coarse — `ok` or not,
 * per check — while which variable is missing and what Postgres said go to the
 * server log against the correlation id. "Database unreachable: could not connect
 * to host db.abcdefg.supabase.co" is a useful log line and a reconnaissance gift.
 *
 * It returns 200 when healthy and 503 when not, so an uptime monitor needs to read
 * only the status code.
 */
import { withHandler } from './_lib/handler';
import { validateServerEnv } from './_lib/env';
import { createAnonClient } from './_lib/supabase';

/** Bounded so a hanging database produces a fast 503 rather than a timeout. */
const DB_TIMEOUT_MS = 3_000;

interface CheckResult {
  ok: boolean;
  /** Server-side only. Never placed in the response body. */
  detail?: string;
}

const checkDatabase = async (): Promise<CheckResult> => {
  try {
    // `supported_markets` is the right probe: it is tiny, it has a public read
    // policy, and reading it with the anon key exercises the URL, the key,
    // PostgREST, and policy evaluation in one call. A query against a table with
    // no anon policy would return empty and look like a failure.
    const { error } = await createAnonClient()
      .from('supported_markets')
      .select('country_code')
      .limit(1)
      .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS));

    if (error !== null) {
      return { ok: false, detail: `${error.code ?? 'unknown'}: ${error.message}` };
    }
    return { ok: true };
  } catch (error) {
    // Reaching here means the request never completed — a bad URL, a stopped
    // container, or the abort above firing. `requireServerEnv` also throws here
    // when configuration is missing, which the environment check already reports.
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
};

export default withHandler({
  methods: ['GET'],
  auth: 'none',
  handler: async ({ res, correlationId }) => {
    const envIssues = validateServerEnv();
    const environment: CheckResult = {
      ok: envIssues.length === 0,
      detail: envIssues.map((issue) => `${issue.variable} — ${issue.message}`).join('; '),
    };

    // Skipped when the environment is broken: the client cannot be constructed, so
    // the result would be a second report of the same fault.
    const database: CheckResult = environment.ok
      ? await checkDatabase()
      : { ok: false, detail: 'skipped: environment invalid' };

    const healthy = environment.ok && database.ok;

    if (!healthy) {
      console.error(
        `health check failed cid=${correlationId} environment=${environment.detail || 'ok'} database=${database.detail ?? 'ok'}`,
      );
    }

    const body = {
      status: healthy ? 'ok' : 'degraded',
      checks: {
        environment: environment.ok,
        database: database.ok,
      },
      correlationId,
      // Not `Date.now()`: the client types use epoch millis, but a health probe is
      // read by humans and by monitors, and ISO-8601 is unambiguous to both.
      checkedAt: new Date().toISOString(),
    };

    // Written here rather than returned because an unhealthy result needs 503, and
    // `withHandler` sends a returned value with 200. It detects the finished
    // response and logs the real status.
    res.status(healthy ? 200 : 503).json(body);
  },
});
