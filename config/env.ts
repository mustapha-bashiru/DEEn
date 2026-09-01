/**
 * Environment access and startup validation.
 *
 * ⚠️ `GEMINI_API_KEY` here is a deliberate, temporary shim.
 *
 * It is a SERVER-ONLY secret, but until Gemini moves behind Vercel functions
 * (implementation plan step 4) `vite.config.ts` inlines it into the browser bundle
 * so the app keeps working. Anyone loading the app can read it.
 *
 * All access funnels through this module so that step 4 is a single-file change:
 * replace `env.geminiApiKey` with calls to `/api`, then delete the `define` in
 * `vite.config.ts`.
 *
 * The Supabase values are different in kind and are *not* a shim. The project URL
 * and the anon key are designed to be public — the anon key's only power is what
 * row-level security grants it — so they travel through `import.meta.env` like any
 * ordinary Vite variable and need no `define`. The service role key is absent from
 * this file on purpose and must never appear in it; it lives in `api/_lib/env.ts`.
 */

/** Replaced at build time by the `define` block in `vite.config.ts`. */
declare const __GEMINI_API_KEY__: string;

export interface EnvIssue {
  variable: string;
  /** Where the variable must be set. */
  scope: 'browser' | 'server-only';
  message: string;
}

/**
 * Reading through a function keeps the `define` substitution from being hoisted
 * into a module-level constant that survives tree-shaking in unexpected ways,
 * and lets tests stub the global.
 */
const readGeminiApiKey = (): string => {
  try {
    return typeof __GEMINI_API_KEY__ === 'string' ? __GEMINI_API_KEY__.trim() : '';
  } catch {
    return '';
  }
};

/**
 * Read through an index rather than a property so a missing variable is `''`
 * instead of `undefined`, and so the value arrives as `unknown` rather than the
 * `any` that `ImportMetaEnv`'s index signature would hand over.
 */
const readViteEnv = (key: string): string => {
  const value = (import.meta.env as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const env = {
  get geminiApiKey(): string {
    return readGeminiApiKey();
  },
  get supabaseUrl(): string {
    return readViteEnv('VITE_SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return readViteEnv('VITE_SUPABASE_ANON_KEY');
  },
};

/** True when AI features can actually reach Gemini. */
export const isAiConfigured = (): boolean => readGeminiApiKey().length > 0;

/**
 * True when the browser has enough to talk to Supabase. Step 3 gates sign-in on
 * this and falls back to the current local-only identity when it is false.
 */
export const isSupabaseConfigured = (): boolean =>
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;

/**
 * Reads the `role` claim from a JWT without verifying it. This inspects our own
 * configuration; it authenticates nothing.
 *
 * Returns null when the value is not a three-part JWT, which is the normal case
 * for Supabase's newer `sb_publishable_…` keys. Null means "cannot tell".
 */
const readKeyRole = (token: string): string | null => {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64));
    if (typeof payload === 'object' && payload !== null && 'role' in payload) {
      const role = (payload as { role: unknown }).role;
      return typeof role === 'string' ? role : null;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Collects configuration problems instead of throwing, so a missing key degrades
 * the AI features rather than blanking the whole app.
 */
export const validateEnv = (): EnvIssue[] => {
  const issues: EnvIssue[] = [];

  if (!isAiConfigured()) {
    issues.push({
      variable: 'GEMINI_API_KEY',
      scope: 'server-only',
      message:
        'Not set. Chat, Quran lookup, quizzes, briefing, and media generation ' +
        'will fail. Copy .env.example to .env.local and add a key from ' +
        'https://aistudio.google.com/apikey',
    });
  }

  /*
   * Absent Supabase variables are not reported yet. Nothing in the client calls
   * Supabase until step 3, so warning about them now would train everyone to
   * ignore this report — and a warning people ignore is worse than no warning.
   * Step 3 promotes the missing case to an issue when sign-in starts depending on
   * it. What *is* checked now is a value that is present and wrong, because that
   * is a live fault today rather than a future one.
   */
  const supabaseUrl = env.supabaseUrl;
  if (supabaseUrl.length > 0 && !/^https?:\/\//.test(supabaseUrl)) {
    issues.push({
      variable: 'VITE_SUPABASE_URL',
      scope: 'browser',
      message: `Must be an absolute http(s) URL. Got "${supabaseUrl}". Run \`npm run db:start\` and copy the API URL it prints.`,
    });
  }

  /*
   * The one that matters. The service role key bypasses row-level security
   * entirely, so pasting it here does not fail — it works, and publishes a
   * full-access database credential to every visitor. It has to be loud.
   */
  const anonKey = env.supabaseAnonKey;
  if (anonKey.length > 0 && readKeyRole(anonKey) === 'service_role') {
    issues.push({
      variable: 'VITE_SUPABASE_ANON_KEY',
      scope: 'browser',
      message:
        'This is the service_role key, which bypasses row-level security and is ' +
        'now readable by anyone loading the app. Replace it with the anon key and ' +
        'rotate the service_role key immediately.',
    });
  }

  return issues;
};

/** Logs issues as one grouped, actionable message at startup. */
export const reportEnvIssues = (issues: EnvIssue[]): void => {
  if (issues.length === 0) return;

  const lines = issues.map((i) => `  • ${i.variable} (${i.scope}): ${i.message}`);
  console.error(
    `SebilLink: ${issues.length} environment problem(s) detected.\n${lines.join('\n')}`,
  );
};

/** Logs issues as one grouped, actionable message at startup. */
export const reportEnvIssues = (issues: EnvIssue[]): void => {
  if (issues.length === 0) return;

  const lines = issues.map((i) => `  • ${i.variable} (${i.scope}): ${i.message}`);
  console.error(
    `SebilLink: ${issues.length} environment problem(s) detected.\n${lines.join('\n')}`,
  );
};
