// @vitest-environment node
/**
 * The interesting cases here are not the missing variables — those fail loudly on
 * their own. They are the two swaps, where the wrong key in the right slot produces
 * behaviour that looks nothing like a configuration error.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isServerEnvValid, requireServerEnv, serverEnv, validateServerEnv } from '../../api/_lib/env';

const KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

let saved: Record<string, string | undefined> = {};

/** An unsigned JWT with the given role. Not valid to Supabase; valid to a decoder. */
const jwtWithRole = (role: string): string => {
  const encode = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, iss: 'supabase' })}.signature`;
};

beforeEach(() => {
  saved = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const configureValid = (): void => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_ANON_KEY = jwtWithRole('anon');
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwtWithRole('service_role');
};

const variables = (): string[] => validateServerEnv().map((issue) => issue.variable);

describe('serverEnv', () => {
  it('trims values, because a trailing newline from a copy-paste is invisible', () => {
    process.env.SUPABASE_URL = '  http://127.0.0.1:54321\n';
    expect(serverEnv.supabaseUrl).toBe('http://127.0.0.1:54321');
  });

  it('falls back to the VITE_ prefixed pair so one .env.local serves both runtimes', () => {
    process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

    expect(serverEnv.supabaseUrl).toBe('http://127.0.0.1:54321');
    expect(serverEnv.supabaseAnonKey).toBe('anon-key');
  });

  it('prefers the unprefixed value when both are set', () => {
    process.env.SUPABASE_URL = 'http://server';
    process.env.VITE_SUPABASE_URL = 'http://browser';
    expect(serverEnv.supabaseUrl).toBe('http://server');
  });

  it('gives the service role key no VITE_ fallback', () => {
    // A fallback here would mean a browser-scoped variable could supply the
    // credential that bypasses row-level security.
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = jwtWithRole('service_role');
    expect(serverEnv.supabaseServiceRoleKey).toBe('');
    delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  });
});

describe('validateServerEnv', () => {
  it('reports every missing variable at once rather than the first', () => {
    expect(variables()).toEqual([
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });

  it('passes a correctly configured environment', () => {
    configureValid();
    expect(validateServerEnv()).toEqual([]);
    expect(isServerEnvValid()).toBe(true);
  });

  it('rejects a URL that is not absolute', () => {
    configureValid();
    process.env.SUPABASE_URL = '127.0.0.1:54321';
    expect(variables()).toEqual(['SUPABASE_URL']);
  });

  it('catches the anon key pasted into the service role slot', () => {
    // Symptom without this check: every privileged read returns an empty set and
    // every privileged write reports zero rows affected, because RLS is being
    // applied where the code assumes it is not.
    configureValid();
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwtWithRole('anon');

    const issues = validateServerEnv();
    expect(issues.map((i) => i.variable)).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
    expect(issues[0]?.message).toContain('anon key');
  });

  it('catches the service role key pasted into the anon slot', () => {
    // The dangerous one: nothing breaks, and a credential that bypasses row-level
    // security is handed to the browser.
    configureValid();
    process.env.SUPABASE_ANON_KEY = jwtWithRole('service_role');

    const issues = validateServerEnv();
    expect(issues.map((i) => i.variable)).toEqual(['SUPABASE_ANON_KEY']);
    expect(issues[0]?.message).toContain('rotate');
  });

  it('accepts the newer non-JWT key format instead of guessing about it', () => {
    // `sb_secret_…` and `sb_publishable_…` carry no readable role claim. Absence of
    // evidence is not evidence of a swap, so these must not be flagged.
    configureValid();
    process.env.SUPABASE_ANON_KEY = 'sb_publishable_abcdefghijklmnop';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_abcdefghijklmnop';

    expect(validateServerEnv()).toEqual([]);
  });

  it('never puts a key value in an issue message', () => {
    configureValid();
    const secret = jwtWithRole('anon');
    process.env.SUPABASE_SERVICE_ROLE_KEY = secret;

    const serialised = JSON.stringify(validateServerEnv());
    expect(serialised).not.toContain(secret);
  });
});

describe('requireServerEnv', () => {
  it('does nothing when the environment is valid', () => {
    configureValid();
    expect(() => requireServerEnv()).not.toThrow();
  });

  it('throws a 503 listing variable names only', () => {
    let thrown: unknown;
    try {
      requireServerEnv();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'unavailable', status: 503 });
    expect((thrown as { details: { missing: string[] } }).details.missing).toContain(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    // The advice text is useful in a log and useless to a browser, so it is kept on
    // the cause rather than in the details a client will see.
    expect(JSON.stringify((thrown as { details: unknown }).details)).not.toContain('Copy');
  });
});
