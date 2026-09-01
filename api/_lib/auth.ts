/**
 * Request authentication.
 *
 * The access token is verified by Supabase (`auth.getUser`), not decoded locally.
 * A local decode would read the claims of an unverified token, which is exactly as
 * trustworthy as reading a user id out of a query parameter — and the mistake
 * looks like working code, because a valid token decodes correctly either way.
 *
 * Roles are then read through the *user's own* client rather than the service
 * client. `user_roles` has a self-read policy, so this works, and it means an
 * authorisation lookup cannot accidentally return someone else's roles: the
 * database is enforcing the scope rather than a `.eq('user_id', …)` that a future
 * edit could drop.
 */
import { ApiError } from './errors';
import { createUserClient, type Db } from './supabase';

export type AppRole = 'consumer' | 'moderator' | 'admin';

export interface AuthContext {
  userId: string;
  email: string | null;
  roles: AppRole[];
  /** The verified bearer token, for handlers that need to make further calls as this user. */
  accessToken: string;
  /** A Supabase client scoped to this user, with RLS applied. */
  db: Db;
  hasRole: (role: AppRole) => boolean;
  /** Throws 403 when the role is absent. */
  requireRole: (role: AppRole) => void;
}

const BEARER = /^Bearer\s+(.+)$/i;

export const readBearerToken = (header: string | string[] | undefined): string | null => {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') return null;

  const match = BEARER.exec(raw.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
};

const isAppRole = (value: unknown): value is AppRole =>
  value === 'consumer' || value === 'moderator' || value === 'admin';

export const authenticate = async (
  authorizationHeader: string | string[] | undefined,
): Promise<AuthContext> => {
  const accessToken = readBearerToken(authorizationHeader);
  if (accessToken === null) {
    throw new ApiError('unauthorized', 'A bearer token is required.');
  }

  const db = createUserClient(accessToken);

  const { data, error } = await db.auth.getUser(accessToken);
  if (error !== null || data.user === null) {
    // The provider message is attached as a cause for the log and deliberately
    // not surfaced: it distinguishes "expired" from "malformed" from "revoked",
    // which is useful to us and useful to someone probing tokens.
    throw new ApiError('unauthorized', 'The session is invalid or has expired.', {
      cause: error ?? new Error('getUser returned no user'),
    });
  }

  const user = data.user;

  const { data: roleRows, error: roleError } = await db
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (roleError !== null) {
    throw new ApiError('internal', 'Could not load your account permissions.', {
      cause: roleError,
    });
  }

  const roles = (roleRows ?? [])
    .map((row: { role: unknown }) => row.role)
    .filter(isAppRole);

  const hasRole = (role: AppRole): boolean => roles.includes(role);

  return {
    userId: user.id,
    email: user.email ?? null,
    roles,
    accessToken,
    db,
    hasRole,
    requireRole: (role: AppRole): void => {
      if (!hasRole(role)) {
        // Says what is required but not who does have it, and returns 403 rather
        // than 404 because the caller is authenticated — pretending the route does
        // not exist would only obscure a legitimate permissions problem.
        throw new ApiError('forbidden', `This action requires the ${role} role.`);
      }
    },
  };
};
