/**
 * Cross-process file lock for the credential store.
 *
 * Supabase rotates the refresh token on every refresh, so two `dv` processes
 * refreshing concurrently race: the loser presents an already-consumed refresh
 * token and the stored session is invalidated. Agent workflows fan `dv` calls
 * out across parallel subagents, which makes that race likely — so refreshes
 * are serialized through an exclusive on-disk lock. `mkdir` is atomic on every
 * platform we support, which makes a directory the simplest portable lock.
 * Locks abandoned by a crashed process are stolen once older than `staleMs`.
 */

import { mkdirSync, rmdirSync, statSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

export interface FileLockOptions {
  /** Steal a lock whose directory is older than this. Default 30s. */
  staleMs?: number;
  /** Give up waiting after this long and run unlocked. Default 20s. */
  timeoutMs?: number;
  /** Delay between acquisition attempts. Default 100ms. */
  pollMs?: number;
}

function tryAcquire(lockDir: string): boolean {
  try {
    mkdirSync(lockDir, { recursive: false });
    return true;
  } catch {
    return false;
  }
}

function stealIfStale(lockDir: string, staleMs: number): void {
  try {
    const age = Date.now() - statSync(lockDir).mtimeMs;
    if (age > staleMs) rmdirSync(lockDir);
  } catch {
    // Raced with the holder releasing it — the next acquire attempt decides.
  }
}

function release(lockDir: string): void {
  try {
    rmdirSync(lockDir);
  } catch {
    // Already gone (stolen as stale); nothing to release.
  }
}

/**
 * Run `fn` while holding an exclusive lock at `lockDir`.
 *
 * If the lock cannot be acquired within `timeoutMs`, `fn` runs anyway: a
 * wedged lock must never brick the CLI, and the unlocked path merely degrades
 * to the pre-lock behaviour.
 */
export async function withFileLock<T>(
  lockDir: string,
  fn: () => Promise<T>,
  opts: FileLockOptions = {},
): Promise<T> {
  const staleMs = opts.staleMs ?? 30_000;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const pollMs = opts.pollMs ?? 100;

  const deadline = Date.now() + timeoutMs;
  let acquired = tryAcquire(lockDir);
  while (!acquired && Date.now() < deadline) {
    stealIfStale(lockDir, staleMs);
    acquired = tryAcquire(lockDir);
    if (!acquired) await sleep(pollMs);
  }

  try {
    return await fn();
  } finally {
    if (acquired) release(lockDir);
  }
}
