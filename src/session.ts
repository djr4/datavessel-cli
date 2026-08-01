/**
 * Supabase session refresh.
 *
 * The web app authenticates with Supabase (the backend's authorization
 * server). Access tokens are short-lived (~1h), so the CLI refreshes them on
 * its own using the stored refresh token. `supabaseUrl`/`anonKey` are captured
 * during login (both are public values) so no secrets are baked into the CLI.
 */

import { CliError, ExitCode } from './errors.js';
import type { OAuthCredential } from './config.js';
import { withFileLock } from './lock.js';

/** True when the access token is expired or within `skewSec` of expiring. */
export function needsRefresh(cred: OAuthCredential, skewSec = 60): boolean {
  return Date.now() / 1000 >= cred.expiresAt - skewSec;
}

interface GoTrueTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
}

/**
 * Exchange the refresh token for a fresh access token via Supabase GoTrue.
 * Supabase rotates the refresh token, so the returned credential supersedes the
 * old one and must be persisted.
 */
export async function refreshOAuth(cred: OAuthCredential): Promise<OAuthCredential> {
  const url = `${cred.supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=refresh_token`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: cred.anonKey,
        Authorization: `Bearer ${cred.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: cred.refreshToken }),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(`Could not reach the auth server to refresh the session: ${reason}`);
  }

  if (!res.ok) {
    throw new CliError(
      'Your session has expired and could not be refreshed.',
      ExitCode.AUTH,
      'Run `datavessel login` to sign in again.',
    );
  }

  const body = (await res.json()) as GoTrueTokenResponse;
  if (!body.access_token) {
    throw new CliError('Auth server returned no access token on refresh.', ExitCode.AUTH);
  }
  const expiresAt =
    body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600);
  return {
    ...cred,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? cred.refreshToken,
    expiresAt,
  };
}

export interface LockedRefreshOptions {
  /** Directory used as the exclusive lock (shared by all dv processes). */
  lockDir: string;
  /** Re-read the stored credential after the lock is held. */
  reload: () => OAuthCredential | undefined;
  /** Persist the rotated credential before the lock is released. */
  persist: (cred: OAuthCredential) => void;
}

/**
 * Refresh with cross-process single-flight semantics.
 *
 * Because Supabase rotates the refresh token, concurrent refreshes from
 * parallel `dv` processes invalidate each other. Under the lock we re-read the
 * stored credential first: if a sibling process already refreshed, its rotated
 * session is simply adopted and no network call is made. Only the process that
 * finds the stored token still stale actually refreshes, and it persists the
 * rotation before releasing the lock so every waiter sees it.
 */
export async function refreshOAuthLocked(
  cred: OAuthCredential,
  opts: LockedRefreshOptions,
): Promise<OAuthCredential> {
  return withFileLock(opts.lockDir, async () => {
    const stored = opts.reload() ?? cred;
    if (!needsRefresh(stored)) return stored;
    const next = await refreshOAuth(stored);
    opts.persist(next);
    return next;
  });
}
