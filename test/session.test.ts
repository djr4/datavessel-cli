import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { needsRefresh, refreshOAuth } from '../src/session.js';
import type { OAuthCredential } from '../src/config.js';

const base: OAuthCredential = {
  type: 'oauth',
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: 0,
  supabaseUrl: 'https://proj.supabase.co',
  anonKey: 'anon-key',
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('needsRefresh is true for an expired token', () => {
  assert.equal(needsRefresh({ ...base, expiresAt: 0 }), true);
});

test('needsRefresh is false for a token comfortably in the future', () => {
  assert.equal(needsRefresh({ ...base, expiresAt: Math.floor(Date.now() / 1000) + 3600 }), false);
});

test('needsRefresh honours the skew window', () => {
  const soon = Math.floor(Date.now() / 1000) + 30;
  assert.equal(needsRefresh({ ...base, expiresAt: soon }, 60), true);
});

test('refreshOAuth posts the refresh token and returns rotated tokens', async () => {
  let capturedUrl = '';
  let capturedBody: unknown;
  let capturedHeaders: Record<string, string> = {};
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedBody = JSON.parse(String(init.body));
    capturedHeaders = init.headers as Record<string, string>;
    return new Response(
      JSON.stringify({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_at: 9999999999,
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const next = await refreshOAuth(base);
  assert.match(capturedUrl, /\/auth\/v1\/token\?grant_type=refresh_token$/);
  assert.deepEqual(capturedBody, { refresh_token: 'old-refresh' });
  assert.equal(capturedHeaders.apikey, 'anon-key');
  assert.equal(next.accessToken, 'new-access');
  assert.equal(next.refreshToken, 'new-refresh');
  assert.equal(next.expiresAt, 9999999999);
  assert.equal(next.supabaseUrl, base.supabaseUrl); // preserved
});

test('refreshOAuth throws an auth error on failure', async () => {
  globalThis.fetch = (async () =>
    new Response('{"error":"invalid"}', { status: 400 })) as typeof fetch;
  await assert.rejects(refreshOAuth(base), /expired and could not be refreshed/);
});

test('refreshOAuth keeps the old refresh token when none is returned', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ access_token: 'a', expires_in: 3600 }), {
      status: 200,
    })) as typeof fetch;
  const next = await refreshOAuth(base);
  assert.equal(next.refreshToken, 'old-refresh');
  assert.ok(next.expiresAt > Math.floor(Date.now() / 1000));
});
