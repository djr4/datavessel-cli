import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withFileLock } from '../src/lock.js';

const scratch = () => mkdtempSync(join(tmpdir(), 'dv-lock-'));

test('withFileLock runs the function and releases the lock', async () => {
  const lockDir = join(scratch(), 'refresh.lock');
  const result = await withFileLock(lockDir, async () => {
    assert.ok(existsSync(lockDir), 'lock held while fn runs');
    return 42;
  });
  assert.equal(result, 42);
  assert.ok(!existsSync(lockDir), 'lock released after fn');
});

test('withFileLock releases the lock when the function throws', async () => {
  const lockDir = join(scratch(), 'refresh.lock');
  await assert.rejects(
    withFileLock(lockDir, async () => {
      throw new Error('boom');
    }),
    /boom/,
  );
  assert.ok(!existsSync(lockDir));
});

test('concurrent holders are serialized', async () => {
  const lockDir = join(scratch(), 'refresh.lock');
  const events: string[] = [];
  const hold = (name: string, ms: number) =>
    withFileLock(
      lockDir,
      async () => {
        events.push(`${name}:start`);
        await new Promise((r) => setTimeout(r, ms));
        events.push(`${name}:end`);
      },
      { pollMs: 10 },
    );
  await Promise.all([hold('a', 50), hold('b', 50)]);
  // Whichever ran first must have finished before the other started.
  assert.deepEqual(events.slice(0, 2), [`${events[0].split(':')[0]}:start`, `${events[0].split(':')[0]}:end`]);
});

test('a stale lock is stolen', async () => {
  const lockDir = join(scratch(), 'refresh.lock');
  mkdirSync(lockDir);
  const old = new Date(Date.now() - 60_000);
  utimesSync(lockDir, old, old);
  let ran = false;
  await withFileLock(
    lockDir,
    async () => {
      ran = true;
    },
    { staleMs: 30_000, pollMs: 10 },
  );
  assert.ok(ran);
  assert.ok(!existsSync(lockDir));
});

test('a wedged fresh lock degrades to running unlocked after the timeout', async () => {
  const lockDir = join(scratch(), 'refresh.lock');
  mkdirSync(lockDir); // held by a "live" process that never releases
  let ran = false;
  await withFileLock(
    lockDir,
    async () => {
      ran = true;
    },
    { staleMs: 60_000, timeoutMs: 200, pollMs: 20 },
  );
  assert.ok(ran, 'fn still runs after timeout');
  assert.ok(existsSync(lockDir), 'foreign lock is left in place');
});
