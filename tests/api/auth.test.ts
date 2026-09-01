// @vitest-environment node
/**
 * Only `readBearerToken` is covered here. The rest of `authenticate` is a call to
 * `db.auth.getUser`, and a test that mocks that call proves the mock works rather
 * than that the token is verified — the pgTAP suite and `vercel dev` cover the real
 * thing. What is worth testing in isolation is the parser, because a lenient one
 * accepts something Supabase never issued.
 */
import { describe, expect, it } from 'vitest';
import { readBearerToken } from '../../api/_lib/auth';

describe('readBearerToken', () => {
  it('extracts the token from a well-formed header', () => {
    expect(readBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('accepts any capitalisation of the scheme, as the HTTP spec requires', () => {
    expect(readBearerToken('bearer abc')).toBe('abc');
    expect(readBearerToken('BEARER abc')).toBe('abc');
  });

  it('tolerates surrounding and internal whitespace', () => {
    expect(readBearerToken('  Bearer   abc  ')).toBe('abc');
  });

  it('takes the first value when the header is repeated', () => {
    expect(readBearerToken(['Bearer first', 'Bearer second'])).toBe('first');
  });

  it('rejects a scheme that is not Bearer', () => {
    // Basic credentials are a username and password, not an access token. Accepting
    // them here would send them to Supabase as a JWT and log the failure.
    expect(readBearerToken('Basic dXNlcjpwYXNzd29yZA==')).toBeNull();
    expect(readBearerToken('Token abc')).toBeNull();
  });

  it('rejects a scheme with no token', () => {
    expect(readBearerToken('Bearer')).toBeNull();
    expect(readBearerToken('Bearer ')).toBeNull();
    expect(readBearerToken('Bearer    ')).toBeNull();
  });

  it('rejects a bare token with no scheme', () => {
    expect(readBearerToken('abc.def.ghi')).toBeNull();
  });

  it('rejects an absent or non-string header', () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken([])).toBeNull();
  });
});
