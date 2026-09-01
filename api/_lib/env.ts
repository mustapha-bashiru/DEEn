/**
 * Server-side environment access and validation.
 *
 * Deliberately a sibling of `config/env.ts` rather than an import of it. That
 * module is browser code — it reads a value that `vite.config.ts` inlines into the
 * client bundle — and importing across the boundary in either direction is how
 * secrets end up shipped. The duplication of the `EnvIssue` shape is the price of
 * that separation and is worth paying; `eslint.config.js` enforces the boundary.
 *
 * Same philosophy as the browser module: collect problems rather than throwing at
 * import time, so a misconfigured deploy returns a clean 503 from the endpoints
 * that need the missing value instead of crashing every function including the
 * health check that would have told you why.
 */
import { ApiError } from './errors';

export interface ServerEnvIssue {
  variable: string;
  message: string;
}

const read = (name: string): string => (process.env[name] ?? '').trim();

/**
 * Vercel keeps server and client environment variables in separate namespaces, but
 * a local `.env.local` usually defines only the `VITE_`-prefixed pair. Falling
 * back means one file works for both `npm run dev` and `vercel dev`.
 *
 * Only safe for the URL and the anon key — both are public. The service role key
 * has no `VITE_` fallback and must never acquire one.
 */
const readWithViteFallback = (name: string): string => {
  const direct = read(name);
  return direct.length > 0 ? direct : read(`VITE_${name}`);
};

/**
 * Extracts the `role` claim without verifying the signature — this inspects our
 * own configuration, it does not authenticate anything.
 *
 * Returns null when the value is not a JWT at all, which is the normal case for
 * Supabase's newer `sb_secret_…` / `sb_publishable_…` key format. A null result
 * means "cannot tell", never "wrong".
 */
const readKeyRole = (token: string): string | null => {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload === 'object' && payload !== null && 'role' in payload) {
      const role = (payload as { role: unknown }).role;
      return typeof role === 'string' ? role : null;
    }
    return null;
  } catch {
    return null;
  }
};

export const serverEnv = {
  get supabaseUrl(): string {
    return readWithViteFallback('SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return readWithViteFallback('SUPABASE_ANON_KEY');
  },
  get supabaseServiceRoleKey(): string {
    return read('SUPABASE_SERVICE_ROLE_KEY');
  },
};

/**
 * Never returns a key value, only variable names and advice. These issues are
 * logged, and a log that quotes a secret is a leaked secret.
 */
export const validateServerEnv = (): ServerEnvIssue[] => {
  const issues: ServerEnvIssue[] = [];

  const url = serverEnv.supabaseUrl;
  const anonKey = serverEnv.supabaseAnonKey;
  const serviceKey = serverEnv.supabaseServiceRoleKey;

  if (url.length === 0) {
    issues.push({
      variable: 'SUPABASE_URL',
      message: 'Not set. Run `npm run db:start` and copy the API URL it prints.',
    });
  } else if (!/^https?:\/\//.test(url)) {
    issues.push({
      variable: 'SUPABASE_URL',
      message: 'Must be an absolute http(s) URL.',
    });
  }

  if (anonKey.length === 0) {
    issues.push({
      variable: 'SUPABASE_ANON_KEY',
      message: 'Not set. Required to call the database as the requesting user.',
    });
  }

  if (serviceKey.length === 0) {
    issues.push({
      variable: 'SUPABASE_SERVICE_ROLE_KEY',
      message: 'Not set. Required for privileged server operations.',
    });
  }

  /*
   * The two swaps worth catching, because neither produces an obvious failure.
   *
   * Anon key in the service slot: every privileged operation silently returns
   * empty result sets, because RLS is being applied where the code assumes it is
   * not — reads look like "no data" and writes like "nothing to update".
   *
   * Service key in the anon slot: far worse. It works perfectly, and hands a
   * full-access credential to the browser.
   */
  if (serviceKey.length > 0 && readKeyRole(serviceKey) === 'anon') {
    issues.push({
      variable: 'SUPABASE_SERVICE_ROLE_KEY',
      message:
        'This is the anon key. Privileged operations will silently return nothing. ' +
        'Copy the service_role key instead.',
    });
  }

  if (anonKey.length > 0 && readKeyRole(anonKey) === 'service_role') {
    issues.push({
      variable: 'SUPABASE_ANON_KEY',
      message:
        'This is the service_role key, which bypasses row-level security. It is ' +
        'exposed to the browser. Replace it with the anon key and rotate the ' +
        'service_role key immediately.',
    });
  }

  return issues;
};

export const isServerEnvValid = (): boolean => validateServerEnv().length === 0;

/**
 * Fails closed. A handler that needs Supabase calls this first, so a
 * misconfiguration is a 503 naming the variables rather than an unhandled
 * exception thrown from inside the client library.
 */
export const requireServerEnv = (): void => {
  const issues = validateServerEnv();
  if (issues.length === 0) return;

  throw new ApiError('unavailable', 'The server is not configured correctly.', {
    // Variable names only. The advice text is written above and is safe, but it
    // stays server-side: a browser has no use for it and an attacker does.
    cause: new Error(
      `Environment problems: ${issues.map((i) => `${i.variable} — ${i.message}`).join('; ')}`,
    ),
    details: { missing: issues.map((i) => i.variable) },
  });
};
