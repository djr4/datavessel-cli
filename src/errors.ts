/**
 * Error types and backend-error mapping.
 *
 * The backend returns errors as `{ error: { code, message, statusCode,
 * details } }` (see execute.controller.ts). We translate the codes the MCP
 * server already special-cases into actionable, human-readable guidance so the
 * CLI behaves consistently with the rest of the product.
 */

/** Process exit codes. Kept small and stable so scripts can branch on them. */
export const ExitCode = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  AUTH: 3,
  QUOTA: 4,
  NOT_CONNECTED: 5,
} as const;

export class CliError extends Error {
  readonly exitCode: number;
  readonly hint?: string;

  constructor(message: string, exitCode: number = ExitCode.ERROR, hint?: string) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.hint = hint;
  }
}

export interface BackendError {
  code: string;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

/**
 * Map a backend error payload (and/or HTTP status) to a CliError with the
 * right exit code and a helpful hint. Mirrors the handling in the MCP server's
 * `execute_tool` so users get the same guidance everywhere.
 */
export function mapBackendError(
  status: number,
  body: { error?: BackendError } | undefined,
): CliError {
  const err = body?.error;
  const code = err?.code;
  const message = err?.message ?? `Backend request failed (HTTP ${status})`;

  switch (code) {
    case 'oauth_token_not_found':
      return new CliError(
        'No connection found for this provider.',
        ExitCode.NOT_CONNECTED,
        'Connect your account in the web app first: https://app.datavessel.io/settings',
      );
    case 'oauth_token_refresh_failed':
      return new CliError(
        'Failed to refresh the OAuth token for this provider.',
        ExitCode.NOT_CONNECTED,
        'Reconnect your account in the web app: https://app.datavessel.io/settings',
      );
    case 'rate_limit_exceeded': {
      // Plans count writes: a successful tool call that changes a connected
      // shop, feed, ads, analytics or tag resource. Reads are never limited.
      const d = err?.details ?? {};
      const current = d.current ?? '?';
      const limit = d.limit ?? '?';
      const tier = d.tier ?? 'your current plan';
      const resets = d.resetsAt ? String(d.resetsAt).slice(0, 10) : '';
      const upgrade = d.upgradeUrl ? String(d.upgradeUrl) : 'https://app.datavessel.io/settings?section=plan';
      const lines =
        d.kind === 'writes'
          ? [
              `Write allowance reached: ${current} of ${limit} writes used this period on the ${tier} plan, no pack writes left.`,
              'Reads keep working; this write did not run.',
              `Writes resume ${resets ? `on ${resets}` : 'at the next period'}, with a write pack, or on a bigger plan: ${upgrade}`,
            ]
          : [`Plan limit reached on the ${tier} plan (${current}/${limit}).`, `Pick a plan at ${upgrade}`];
      return new CliError(lines.join('\n'), ExitCode.QUOTA);
    }
    case 'unauthorized':
      return new CliError(
        'Authentication failed or session expired.',
        ExitCode.AUTH,
        'Run `datavessel login` to authenticate again.',
      );
  }

  // Fall back to HTTP status when no recognised code is present.
  if (status === 401) {
    return new CliError(
      'Authentication failed or session expired.',
      ExitCode.AUTH,
      'Run `datavessel login` to authenticate again.',
    );
  }
  if (status === 429) {
    return new CliError(
      'A plan limit was reached. Reads are never limited; writes resume at the next period or on a bigger plan.',
      ExitCode.QUOTA,
      'Pick a plan at https://app.datavessel.io/settings?section=plan',
    );
  }

  return new CliError(
    code ? `Backend error (${code}): ${message}` : message,
    ExitCode.ERROR,
  );
}
