import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'dv-cli-test-'));
  process.env.DATAVESSEL_CONFIG_DIR = dir;
  delete process.env.DATAVESSEL_TOKEN;
  delete process.env.DATAVESSEL_API_KEY;
  delete process.env.DATAVESSEL_API_URL;
  delete process.env.DATAVESSEL_PROFILE;
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATAVESSEL_CONFIG_DIR;
});

test('round-trips credentials and base url per profile', async () => {
  const cfg = await import('../src/config.js');
  cfg.saveCredential('default', { type: 'bearer', token: 'abc' });
  cfg.setBaseUrl('default', 'https://example.test');

  const resolved = cfg.resolveConfig();
  assert.equal(resolved.profile, 'default');
  assert.equal(resolved.baseUrl, 'https://example.test');
  assert.equal(resolved.credential?.token, 'abc');
});

test('credentials file is written with 0600 perms', async () => {
  const cfg = await import('../src/config.js');
  cfg.saveCredential('default', { type: 'bearer', token: 'secret' });
  const mode = statSync(cfg._paths.credentialsPath()).mode & 0o777;
  assert.equal(mode, 0o600);
});

test('env token overrides stored credential', async () => {
  const cfg = await import('../src/config.js');
  process.env.DATAVESSEL_TOKEN = 'env-token';
  const resolved = cfg.resolveConfig();
  assert.equal(resolved.credential?.type, 'bearer');
  assert.equal(resolved.credential?.token, 'env-token');
  delete process.env.DATAVESSEL_TOKEN;
});

test('clearCredential removes the stored token', async () => {
  const cfg = await import('../src/config.js');
  cfg.saveCredential('default', { type: 'bearer', token: 'abc' });
  assert.equal(cfg.clearCredential('default'), true);
  assert.equal(cfg.resolveConfig().credential, undefined);
});
