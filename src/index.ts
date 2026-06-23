#!/usr/bin/env node
/**
 * CLI entry point. Parses argv and maps thrown errors to clean messages and
 * stable exit codes (see errors.ts).
 */

import { buildProgram } from './cli.js';
import { CliError } from './errors.js';
import { errorLine, c } from './output.js';

async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  if (err instanceof CliError) {
    errorLine(err.message);
    if (err.hint) process.stderr.write(c.dim('  → ' + err.hint) + '\n');
    process.exit(err.exitCode);
  }
  // Commander raises CommanderError for its own flows (help/version/parse).
  // It carries an exitCode and has already written output; just honour it.
  const maybe = err as { code?: string; exitCode?: number; message?: string };
  if (maybe && typeof maybe.exitCode === 'number' && maybe.code?.startsWith('commander.')) {
    process.exit(maybe.exitCode);
  }
  errorLine(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
