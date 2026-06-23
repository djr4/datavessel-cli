import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ApiClient, ToolSchema } from '../src/api.js';

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'dv-cli-cat-'));
  process.env.DATAVESSEL_CONFIG_DIR = dir;
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATAVESSEL_CONFIG_DIR;
});

function fakeClient(baseUrl: string, tools: ToolSchema[], counter: { n: number }): ApiClient {
  return {
    baseUrl,
    async listToolSchemas() {
      counter.n++;
      return tools;
    },
  } as unknown as ApiClient;
}

const tools: ToolSchema[] = [
  {
    provider: 'google_analytics',
    toolName: 'run_report',
    description: 'Run a report',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: null,
    annotations: null,
    access: 'read',
  },
];

// Each test uses a distinct base URL so the on-disk cache (shared across the
// suite) doesn't leak fresh entries between cases.
test('getCatalog fetches once then serves from cache', async () => {
  const cat = await import('../src/catalog.js');
  const counter = { n: 0 };
  const client = fakeClient('https://cache.test', tools, counter);

  const first = await cat.getCatalog(client);
  const second = await cat.getCatalog(client);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(counter.n, 1, 'second call should hit the cache');
});

test('forceRefresh re-fetches', async () => {
  const cat = await import('../src/catalog.js');
  const counter = { n: 0 };
  const client = fakeClient('https://refresh.test', tools, counter);
  await cat.getCatalog(client);
  await cat.getCatalog(client, { forceRefresh: true });
  assert.equal(counter.n, 2);
});

test('different base URL invalidates the cache', async () => {
  const cat = await import('../src/catalog.js');
  const counter = { n: 0 };
  await cat.getCatalog(fakeClient('https://diff-a.test', tools, counter));
  await cat.getCatalog(fakeClient('https://diff-b.test', tools, counter));
  assert.equal(counter.n, 2);
});

test('zero TTL treats cache as stale', async () => {
  const cat = await import('../src/catalog.js');
  const counter = { n: 0 };
  const client = fakeClient('https://ttl.test', tools, counter);
  await cat.getCatalog(client);
  await cat.getCatalog(client, { ttlMs: 0 });
  assert.equal(counter.n, 2);
});
