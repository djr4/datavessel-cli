/**
 * CLI version, read from package.json, and the User-Agent derived from it.
 */

import { readFileSync } from 'node:fs';

export function cliVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const USER_AGENT = `datavessel-cli/${cliVersion()}`;
