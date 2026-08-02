/**
 * Thin HTTP client for the datavessel backend.
 *
 * Wraps `fetch` with auth headers, JSON encoding, a request timeout, and
 * backend-error mapping. Endpoints used here are documented in the backend
 * controllers (tools, providers/execute, auth, integrations, tiers).
 */

import { CliError, ExitCode, mapBackendError, type BackendError } from './errors.js';
import type { Credential, OAuthCredential } from './config.js';
import { needsRefresh, refreshOAuth, refreshOAuthLocked } from './session.js';
import { USER_AGENT } from './version.js';

export interface ToolSchema {
  provider: string;
  toolName: string;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
  access: 'read' | 'write';
}

export interface ClientOptions {
  baseUrl: string;
  credential?: Credential;
  timeoutMs?: number;
  /** Called when an OAuth credential is refreshed, so callers can persist it. */
  onRefresh?: (credential: Credential) => void;
  /**
   * Cross-process refresh coordination for on-disk credentials: `lockDir`
   * serializes refreshes across dv processes and `reload` re-reads the stored
   * credential once the lock is held (a sibling may have refreshed already).
   */
  refreshLock?: { lockDir: string; reload: () => Credential | undefined };
}

/**
 * Request timeout for a tool execution. Long-poll tools (e.g.
 * datavessel_get_run_output) take a `wait_seconds` parameter that holds the
 * request open server-side; the client must outlast it or the poll dies with
 * a spurious timeout. The declared wait rides on top of the normal request
 * budget, clamped to 10 minutes so a typo can't hang the CLI indefinitely.
 */
export function executeTimeoutMs(defaultMs: number, params: Record<string, unknown>): number {
  const wait = Number(params.wait_seconds);
  if (!Number.isFinite(wait) || wait <= 0) return defaultMs;
  return defaultMs + Math.min(wait, 600) * 1000;
}

export class ApiClient {
  readonly baseUrl: string;
  private credential?: Credential;
  private readonly timeoutMs: number;
  private readonly onRefresh?: (credential: Credential) => void;
  private readonly refreshLock?: ClientOptions['refreshLock'];
  private refreshing?: Promise<OAuthCredential>;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.credential = opts.credential;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.onRefresh = opts.onRefresh;
    this.refreshLock = opts.refreshLock;
  }

  /** Refresh once, persisting the rotation; serialized across processes. */
  private doRefresh(cred: OAuthCredential): Promise<OAuthCredential> {
    if (this.refreshLock) {
      const { lockDir, reload } = this.refreshLock;
      return refreshOAuthLocked(cred, {
        lockDir,
        reload: () => {
          const stored = reload();
          return stored?.type === 'oauth' ? stored : undefined;
        },
        persist: (c) => this.onRefresh?.(c),
      });
    }
    return refreshOAuth(cred).then((next) => {
      this.onRefresh?.(next);
      return next;
    });
  }

  /**
   * Build auth headers, transparently refreshing an expired OAuth access token
   * first and persisting the rotated credential via `onRefresh`. Concurrent
   * requests within this process share one in-flight refresh.
   */
  private async authHeaders(): Promise<Record<string, string>> {
    let cred = this.credential;
    if (!cred) return {};
    if (cred.type === 'oauth' && needsRefresh(cred)) {
      this.refreshing ??= this.doRefresh(cred).finally(() => {
        this.refreshing = undefined;
      });
      cred = await this.refreshing;
      this.credential = cred;
    }
    if (cred.type === 'api-key') return { 'X-API-Key': cred.token };
    if (cred.type === 'oauth') return { Authorization: `Bearer ${cred.accessToken}` };
    return { Authorization: `Bearer ${cred.token}` };
  }

  private requireAuth(): void {
    if (!this.credential) {
      throw new CliError(
        'Not authenticated.',
        ExitCode.AUTH,
        'Run `datavessel login` or set DATAVESSEL_TOKEN.',
      );
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { body?: unknown; auth?: boolean; timeoutMs?: number } = {},
  ): Promise<T> {
    if (opts.auth) this.requireAuth();
    const authHeaders = opts.auth ? await this.authHeaders() : {};

    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          // Identifies the CLI (vs MCP/web) in backend logs for channel attribution.
          'User-Agent': USER_AGENT,
          ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...authHeaders,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new CliError(`Request timed out after ${timeoutMs}ms: ${method} ${path}`);
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new CliError(
        `Could not reach the backend at ${this.baseUrl}: ${reason}`,
        ExitCode.ERROR,
        'Check your network and the base URL (`datavessel config get base-url`).',
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        if (!res.ok) {
          throw new CliError(`Backend error (HTTP ${res.status}): ${text.slice(0, 500)}`);
        }
        throw new CliError('Backend returned a non-JSON response.');
      }
    }

    if (!res.ok) {
      throw mapBackendError(res.status, parsed as { error?: BackendError } | undefined);
    }
    return parsed as T;
  }

  // --- Catalog (public, no auth) ---

  /** Full tool catalog with input/output schemas. Public endpoint. */
  listToolSchemas(): Promise<ToolSchema[]> {
    return this.request<ToolSchema[]>('GET', '/v1/tools/schemas');
  }

  // --- Execution (requires auth) ---

  /** Execute a tool by name. Returns the unwrapped `data` payload. */
  async execute(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    const res = await this.request<{ data: unknown }>('POST', '/v1/providers/execute', {
      body: { tool_name: toolName, params },
      auth: true,
      timeoutMs: executeTimeoutMs(this.timeoutMs, params),
    });
    return res.data;
  }

  // --- Account (requires auth) ---

  me(): Promise<{ id: string; email: string; name: string; role?: string }> {
    return this.request('GET', '/v1/auth/me', { auth: true });
  }

  connectedSources(): Promise<{ providers: string[] }> {
    return this.request('GET', '/v1/integrations/connected-sources', { auth: true });
  }

  usage(): Promise<Record<string, unknown>> {
    return this.request('GET', '/v1/users/me/usage', { auth: true });
  }
}
