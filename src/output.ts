/**
 * Terminal output helpers: colours, tables, and structured printing.
 *
 * No runtime dependencies — a tiny ANSI helper that disables itself when output
 * is not a TTY or when NO_COLOR is set (https://no-color.org).
 */

const colorEnabled =
  process.env.NO_COLOR === undefined &&
  process.env.DATAVESSEL_NO_COLOR === undefined &&
  process.stdout.isTTY === true;

function wrap(code: number, close: number) {
  return (s: string): string => (colorEnabled ? `\x1b[${code}m${s}\x1b[${close}m` : s);
}

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

/** Visible width of a string, ignoring ANSI escape sequences. */
function visibleWidth(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function pad(s: string, width: number): string {
  const diff = width - visibleWidth(s);
  return diff > 0 ? s + ' '.repeat(diff) : s;
}

/** Render a simple left-aligned columnar table with a dim header row. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(visibleWidth(h), ...rows.map((r) => visibleWidth(r[i] ?? ''))),
  );
  const headerLine = headers.map((h, i) => c.dim(pad(h, widths[i]))).join('  ');
  const body = rows.map((r) => r.map((cell, i) => pad(cell ?? '', widths[i])).join('  '));
  return [headerLine, ...body].join('\n');
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

export function info(msg: string): void {
  process.stderr.write(msg + '\n');
}

export function success(msg: string): void {
  process.stderr.write(c.green('✓ ') + msg + '\n');
}

export function warn(msg: string): void {
  process.stderr.write(c.yellow('! ') + msg + '\n');
}

export function errorLine(msg: string): void {
  process.stderr.write(c.red('✗ ') + msg + '\n');
}
