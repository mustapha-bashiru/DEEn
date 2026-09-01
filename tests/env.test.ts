import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  env,
  isAiConfigured,
  isSupabaseConfigured,
  reportEnvIssues,
  validateEnv,
} from '../config/env';

/**
 * In production `__GEMINI_API_KEY__` is replaced at build time by vite.config.ts.
 * vitest.config.ts deliberately omits that define, so the identifier resolves to a
 * plain global here and each case can control it.
 */
const setKey = (value: string | undefined): void => {
  if (value === undefined) {
    delete (globalThis as Record<string, unknown>).__GEMINI_API_KEY__;
  } else {
    (globalThis as Record<string, unknown>).__GEMINI_API_KEY__ = value;
  }
};

/**
 * Vitest loads `.env` files into `import.meta.env` the same way Vite does, so a
 * developer with a populated `.env.local` would otherwise get different results
 * from a clean checkout. Every test starts from an explicitly empty pair.
 */
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

afterEach(() => {
  setKey(undefined);
  vi.unstubAllEnvs();
});

describe('isAiConfigured', () => {
  it('is true for a real key', () => {
    setKey('AIzaSyExample');
    expect(isAiConfigured()).toBe(true);
  });

  it('is false when the variable is absent', () => {
    setKey(undefined);
    expect(isAiConfigured()).toBe(false);
  });

  it('is false for an empty or whitespace-only value', () => {
    setKey('');
    expect(isAiConfigured()).toBe(false);

    setKey('   ');
    expect(isAiConfigured()).toBe(false);
  });
});

describe('env.geminiApiKey', () => {
  it('trims surrounding whitespace, which .env files pick up easily', () => {
    setKey('  AIzaSyExample \n');
    expect(env.geminiApiKey).toBe('AIzaSyExample');
  });

  it('is an empty string rather than undefined when unset', () => {
    setKey(undefined);
    expect(env.geminiApiKey).toBe('');
  });
});

describe('validateEnv', () => {
  it('reports no issues once the key is present', () => {
    setKey('AIzaSyExample');
    expect(validateEnv()).toEqual([]);
  });

  it('flags the missing key as server-only and names the variable', () => {
    setKey(undefined);
    const issues = validateEnv();

    expect(issues).toHaveLength(1);
    expect(issues[0].variable).toBe('GEMINI_API_KEY');
    expect(issues[0].scope).toBe('server-only');
  });
});

// ── Supabase browser variables ───────────────────────────────────────────────

/** An unsigned JWT carrying a role claim. Enough for a decoder, not for Supabase. */
const jwtWithRole = (role: string): string => {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
};

describe('env.supabaseUrl / env.supabaseAnonKey', () => {
  it('reads from import.meta.env and trims', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '  http://127.0.0.1:54321  ');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key\n');

    expect(env.supabaseUrl).toBe('http://127.0.0.1:54321');
    expect(env.supabaseAnonKey).toBe('anon-key');
  });

  it('is an empty string rather than undefined when unset', () => {
    expect(env.supabaseUrl).toBe('');
    expect(env.supabaseAnonKey).toBe('');
  });
});

describe('isSupabaseConfigured', () => {
  it('needs both the URL and the key', () => {
    expect(isSupabaseConfigured()).toBe(false);

    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    expect(isSupabaseConfigured()).toBe(false);

    vi.stubEnv('VITE_SUPABASE_ANON_KEY', jwtWithRole('anon'));
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe('validateEnv — Supabase', () => {
  it('says nothing about absent Supabase variables yet', () => {
    // Nothing in the client calls Supabase until step 3. Warning now would train
    // everyone to ignore this report, and an ignored warning is worse than none.
    setKey('AIzaSyExample');
    expect(validateEnv()).toEqual([]);
  });

  it('flags a URL that is present but not absolute', () => {
    setKey('AIzaSyExample');
    vi.stubEnv('VITE_SUPABASE_URL', '127.0.0.1:54321');

    const issues = validateEnv();
    expect(issues).toHaveLength(1);
    expect(issues[0].variable).toBe('VITE_SUPABASE_URL');
    expect(issues[0].scope).toBe('browser');
  });

  it('accepts a well-formed URL and anon key', () => {
    setKey('AIzaSyExample');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefg.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', jwtWithRole('anon'));

    expect(validateEnv()).toEqual([]);
  });

  it('raises the alarm when the anon slot holds the service_role key', () => {
    // This does not break anything, which is exactly why it needs a check: it
    // works, and publishes a credential that bypasses row-level security to
    // everyone who loads the app.
    setKey('AIzaSyExample');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefg.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', jwtWithRole('service_role'));

    const issues = validateEnv();
    expect(issues).toHaveLength(1);
    expect(issues[0].variable).toBe('VITE_SUPABASE_ANON_KEY');
    expect(issues[0].message).toContain('rotate');
  });

  it('does not guess about the newer non-JWT key format', () => {
    // `sb_publishable_…` carries no readable role claim. Absence of evidence is
    // not evidence of a swap.
    setKey('AIzaSyExample');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_abcdefghijklmnop');

    expect(validateEnv()).toEqual([]);
  });

  it('does not put the key value in the issue message', () => {
    setKey('AIzaSyExample');
    const secret = jwtWithRole('service_role');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', secret);

    expect(JSON.stringify(validateEnv())).not.toContain(secret);
  });
});

describe('reportEnvIssues', () => {
  it('stays silent when there is nothing wrong', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    reportEnvIssues([]);

    expect(error).not.toHaveBeenCalled();
  });

  it('logs every issue in a single grouped message', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    reportEnvIssues([
      { variable: 'GEMINI_API_KEY', scope: 'server-only', message: 'Not set.' },
      { variable: 'OTHER', scope: 'browser', message: 'Also broken.' },
    ]);

    expect(error).toHaveBeenCalledTimes(1);
    const message = error.mock.calls[0][0] as string;
    expect(message).toContain('GEMINI_API_KEY');
    expect(message).toContain('OTHER');
  });
});
