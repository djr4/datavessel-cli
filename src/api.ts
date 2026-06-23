/**
 * Thin HTTP client for the datavessel backend.
 *
 * Wraps `fetch` with auth headers, JSON encoding, a request timeout, and
 * backend-error mapping. Endpoints used here are documented in the backend
 * controllers (tools, providers/execute, auth, integrations, tiers).
 */

import { CliError, ExitCode, mapBackendError, type BackendError } from './errors.js';
import type { Credential } from './config.js';

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
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly credential?: Credential;
  private readonly timeoutMs: number;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.credential = opts.credential;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  private authHeaders(): Record<string, string> {
    if (!this.credential) return {};
    return this.credential.type === 'api-key'
      ? { 'X-API-Key': this.credential.token }
      : { Authorization: `Bearer ${this.credential.token}` };
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
    opts: { body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    if (opts.auth) this.requireAuth();

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(opts.auth ? this.authHeaders() : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new CliError(`Request timed out after ${this.timeoutMs}ms: ${method} ${path}`);
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
