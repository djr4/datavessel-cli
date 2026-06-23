import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthUrl, parseHandoff } from '../src/oauth.js';

test('buildAuthUrl encodes port and state', () => {
  const url = new URL(buildAuthUrl('https://app.datavessel.io', 51234, 'st-1'));
  assert.equal(url.pathname, '/cli-auth');
  assert.equal(url.searchParams.get('port'), '51234');
  assert.equal(url.searchParams.get('state'), 'st-1');
});

test('buildAuthUrl trims a trailing slash on the app URL', () => {
  const url = buildAuthUrl('https://app.datavessel.io/', 1, 's');
  assert.match(url, /datavessel\.io\/cli-auth\?/);
});

const good = {
  state: 'st-1',
  access_token: 'a',
  refresh_token: 'r',
  supabase_url: 'https://p.supabase.co',
  anon_key: 'k',
  expires_at: '9999999999',
};

test('parseHandoff accepts a valid payload', () => {
  const cred = parseHandoff(good, 'st-1');
  assert.equal(cred.type, 'oauth');
  assert.equal(cred.accessToken, 'a');
  assert.equal(cred.refreshToken, 'r');
  assert.equal(cred.supabaseUrl, 'https://p.supabase.co');
  assert.equal(cred.anonKey, 'k');
  assert.equal(cred.expiresAt, 9999999999);
});

test('parseHandoff rejects a state mismatch', () => {
  assert.throws(() => parseHandoff(good, 'other'), /state validation/);
});

test('parseHandoff rejects missing fields', () => {
  const { refresh_token: _omit, ...partial } = good;
  void _omit;
  assert.throws(() => parseHandoff(partial, 'st-1'), /missing required fields/);
});

test('parseHandoff defaults expiresAt when absent', () => {
  const { expires_at: _omit, ...partial } = good;
  void _omit;
  const cred = parseHandoff(partial, 'st-1');
  assert.ok(cred.expiresAt > Math.floor(Date.now() / 1000));
});
