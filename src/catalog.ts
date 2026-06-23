/**
 * Local cache of the backend tool catalog.
 *
 * The CLI's commands and help are generated from `/v1/tools/schemas`. To keep
 * `--help` fast and avoid a network round-trip on every invocation we cache the
 * catalog on disk, scoped to the base URL it was fetched from, and refresh it
 * when older than the TTL (or on explicit `datavessel sync`).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ApiClient, type ToolSchema } from './api.js';
import { ensureDir, _paths } from './config.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CatalogCache {
  fetchedAt: number;
  baseUrl: string;
  tools: ToolSchema[];
}

function read(): CatalogCache | undefined {
  const path = _paths.catalogPath();
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as CatalogCache;
  } catch {
    return undefined;
  }
}

function write(cache: CatalogCache): void {
  ensureDir();
  writeFileSync(_paths.catalogPath(), JSON.stringify(cache, null, 2) + '\n', { mode: 0o600 });
}

function isFresh(cache: CatalogCache, baseUrl: string, ttlMs: number): boolean {
  return cache.baseUrl === baseUrl && Date.now() - cache.fetchedAt < ttlMs;
}

/** Force a refresh from the backend and update the cache. */
export async function refreshCatalog(client: ApiClient): Promise<ToolSchema[]> {
  const tools = await client.listToolSchemas();
  write({ fetchedAt: Date.now(), baseUrl: client.baseUrl, tools });
  return tools;
}

/**
 * Return the catalog, fetching from the backend when the cache is missing,
 * stale, or for a different base URL. Pass `forceRefresh` to always re-fetch.
 */
export async function getCatalog(
  client: ApiClient,
  opts: { forceRefresh?: boolean; ttlMs?: number } = {},
): Promise<ToolSchema[]> {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  if (!opts.forceRefresh) {
    const cache = read();
    if (cache && isFresh(cache, client.baseUrl, ttlMs)) return cache.tools;
  }
  return refreshCatalog(client);
}

/** Catalog from cache only (no network); undefined when absent. */
export function getCachedCatalog(baseUrl: string): ToolSchema[] | undefined {
  const cache = read();
  return cache && cache.baseUrl === baseUrl ? cache.tools : undefined;
}

export function findTool(tools: ToolSchema[], name: string): ToolSchema | undefined {
  return tools.find((t) => t.toolName === name);
}
