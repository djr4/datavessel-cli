/**
 * Assembles the commander program: global options + all subcommands.
 */

import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerToolsCommands } from './commands/tools.js';
import { registerRunCommand } from './commands/run.js';
import { registerAccountCommands } from './commands/account.js';
import { registerConfigCommands } from './commands/config.js';

function version(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('datavessel')
    .description(
      'datavessel CLI — run 100+ analytics & commerce tools.\n' +
        'Commands and tool help are generated from the live backend catalog.',
    )
    .version(version(), '-v, --version', 'Print the CLI version')
    .option('-p, --profile <name>', 'Configuration profile to use')
    .option('--base-url <url>', 'Override the backend API base URL')
    .option('--token <jwt>', 'Override the Bearer token for this invocation')
    .option('--api-key <key>', 'Override the API key for this invocation')
    .option('--json', 'Output machine-readable JSON', false)
    .option('-y, --yes', 'Skip confirmation prompts (for write tools)', false)
    // Global options must precede the subcommand; required for `run` pass-through.
    .enablePositionalOptions()
    .showHelpAfterError('(add --help for usage)');

  registerAuthCommands(program);
  registerToolsCommands(program);
  registerRunCommand(program);
  registerAccountCommands(program);
  registerConfigCommands(program);

  program.addHelpText(
    'after',
    '\nQuick start:\n' +
      '  datavessel login                 Authenticate (paste a token)\n' +
      '  datavessel tools list            Browse available tools\n' +
      '  datavessel tools show <tool>     See a tool\'s parameters\n' +
      '  datavessel run <tool> --flag v   Execute a tool\n' +
      '  datavessel --json run <tool>     Machine-readable output\n' +
      '\nEnvironment:\n' +
      '  DATAVESSEL_TOKEN     Bearer token (overrides stored credential)\n' +
      '  DATAVESSEL_API_KEY   API key\n' +
      '  DATAVESSEL_API_URL   Backend base URL\n' +
      '  DATAVESSEL_PROFILE   Active profile\n',
  );

  return program;
}
