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
      const d = err?.details ?? {};
      const current = d.current ?? '?';
      const limit = d.limit ?? '?';
      const tier = d.tier ?? 'your current plan';
      const end = d.billingPeriodEnd ? String(d.billingPeriodEnd) : '';
      const lines = [
        `API quota exceeded: ${current}/${limit} calls used this month on ${tier}.`,
        'To continue you can:',
        '  1. Upgrade your plan at https://app.datavessel.io/settings',
        '  2. Contact sales at contact@datavessel.io for enterprise options',
      ];
      if (end) lines.push(`  3. Wait until your quota resets on ${end}`);
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
      'API quota exceeded.',
      ExitCode.QUOTA,
      'Upgrade your plan at https://app.datavessel.io/settings',
    );
  }

  return new CliError(
    code ? `Backend error (${code}): ${message}` : message,
    ExitCode.ERROR,
  );
}
