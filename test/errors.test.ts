import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBackendError, ExitCode, CliError } from '../src/errors.js';

test('maps oauth_token_not_found to NOT_CONNECTED with hint', () => {
  const e = mapBackendError(404, { error: { code: 'oauth_token_not_found', message: 'x' } });
  assert.ok(e instanceof CliError);
  assert.equal(e.exitCode, ExitCode.NOT_CONNECTED);
  assert.match(e.hint ?? '', /web app/);
});

test('maps rate_limit_exceeded to QUOTA with usage detail', () => {
  const e = mapBackendError(429, {
    error: {
      code: 'rate_limit_exceeded',
      message: 'too many',
      details: { current: 100, limit: 100, tier: 'free', billingPeriodEnd: '2026-07-01' },
    },
  });
  assert.equal(e.exitCode, ExitCode.QUOTA);
  assert.match(e.message, /100\/100/);
  assert.match(e.message, /2026-07-01/);
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
