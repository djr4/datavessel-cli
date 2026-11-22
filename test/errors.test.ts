import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBackendError, ExitCode, CliError } from '../src/errors.js';

test('maps oauth_token_not_found to NOT_CONNECTED with hint', () => {
  const e = mapBackendError(404, { error: { code: 'oauth_token_not_found', message: 'x' } });
  assert.ok(e instanceof CliError);
  assert.equal(e.exitCode, ExitCode.NOT_CONNECTED);
  assert.match(e.hint ?? '', /web app/);
});

test('an expired provider connection is not a login problem', () => {
  // The backend answers 401 for it; the CLI must not send the user to `datavessel login`.
  const e = mapBackendError(401, { error: { code: 'oauth_token_expired', message: 'Meta access token has expired. Please reconnect your Meta account.' } });
  assert.equal(e.exitCode, ExitCode.NOT_CONNECTED);
  assert.match(e.message, /Meta access token has expired/);
  assert.match(e.hint ?? '', /Reconnect/);
  assert.doesNotMatch(`${e.message} ${e.hint}`, /datavessel login/);
  // A 401 with no such code is still the CLI's own session.
  assert.equal(mapBackendError(401, { error: { code: 'unauthorized', message: 'x' } }).exitCode, ExitCode.AUTH);
  assert.equal(mapBackendError(401, undefined).exitCode, ExitCode.AUTH);
});

test('maps rate_limit_exceeded (writes) to QUOTA with the facts the agent needs', () => {
  const e = mapBackendError(429, {
    error: {
      code: 'rate_limit_exceeded',
      message: 'too many',
      details: { kind: 'writes', current: 50, limit: 50, tier: 'free', resetsAt: '2026-12-01T00:00:00.000Z', upgradeUrl: 'https://app.datavessel.io/settings?section=plan' },
    },
  });
  assert.equal(e.exitCode, ExitCode.QUOTA);
  assert.match(e.message, /50 of 50 writes/);
  assert.match(e.message, /Reads keep working/);
  assert.match(e.message, /2026-12-01/);
  assert.match(e.message, /settings\?section=plan/);
});

test('maps unauthorized and bare 401 to AUTH', () => {
  assert.equal(
    mapBackendError(401, { error: { code: 'unauthorized', message: 'no' } }).exitCode,
    ExitCode.AUTH,
  );
  assert.equal(mapBackendError(401, undefined).exitCode, ExitCode.AUTH);
});

test('falls back to generic message for unknown codes', () => {
  const e = mapBackendError(500, { error: { code: 'boom', message: 'kaboom' } });
  assert.equal(e.exitCode, ExitCode.ERROR);
  assert.match(e.message, /boom.*kaboom/);
});
