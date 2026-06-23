/**
 * Authentication commands: login, logout, whoami.
 *
 * The execute endpoint authenticates with a Bearer JWT (issued by the
 * datavessel auth server / web app) or a session cookie; API keys are accepted
 * by API-key endpoints. `login` stores a token for the active profile after
 * verifying it against `/v1/auth/me`. Tokens can also be supplied per-command
 * via `--token` or the `DATAVESSEL_TOKEN` / `DATAVESSEL_API_KEY` env vars.
 */

import { Command } from 'commander';
import { buildContext, globalOpts } from '../context.js';
import { ApiClient } from '../api.js';
import {
  clearCredential,
  resolveProfileName,
  saveCredential,
  type AuthType,
  type Credential,
} from '../config.js';
import { CliError, ExitCode } from '../errors.js';
import { isInteractive, promptSecret } from '../prompt.js';
import { printJson, success, info, c } from '../output.js';

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Authenticate by storing an access token for the active profile')
    .option('--token <jwt>', 'Bearer access token (JWT) from the datavessel web app')
    .option('--api-key <key>', 'API key (for API-key endpoints) instead of a Bearer token')
    .option('--no-verify', 'Skip verifying the token against the backend')
    .action(async (opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const profile = resolveProfileName(global.profile);

      let credential: Credential | undefined;
      if (opts.apiKey) {
        credential = { type: 'api-key', token: String(opts.apiKey) };
      } else if (opts.token) {
        credential = { type: 'bearer', token: String(opts.token) };
      } else {
        if (!isInteractive()) {
          throw new CliError(
            'No token provided and not running interactively.',
            ExitCode.USAGE,
            'Pass --token <jwt>, or set DATAVESSEL_TOKEN. Get a token from https://app.datavessel.io',
          );
        }
        info(
          `Paste an access token for profile ${c.cyan(profile)}.\n` +
            `Get one from the datavessel web app (Settings → API): ${c.dim('https://app.datavessel.io')}`,
        );
        const type: AuthType = 'bearer';
        const token = (await promptSecret('Token: ')).trim();
        if (!token) throw new CliError('No token entered.', ExitCode.USAGE);
        credential = { type, token };
      }

      if (opts.verify !== false) {
        const ctx = buildContext(cmd);
        const client = new ApiClient({ baseUrl: ctx.config.baseUrl, credential });
        const me = await client.me();
        saveCredential(profile, credential);
        success(`Logged in as ${c.bold(me.email)} (profile: ${profile})`);
        return;
      }

      saveCredential(profile, credential);
      success(`Saved credential for profile ${c.cyan(profile)} (unverified).`);
    });

  program
    .command('logout')
    .description('Remove the stored credential for the active profile')
    .action((_opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const profile = resolveProfileName(global.profile);
      const removed = clearCredential(profile);
      if (removed) success(`Logged out of profile ${c.cyan(profile)}.`);
      else info(`No stored credential for profile ${c.cyan(profile)}.`);
    });

  program
    .command('whoami')
    .description('Show the currently authenticated user')
    .action(async (_opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      const me = await ctx.client.me();
      if (ctx.global.json) {
        printJson(me);
        return;
      }
      info(`${c.bold(me.name || me.email)}`);
      info(`${c.dim('email:')}   ${me.email}`);
      info(`${c.dim('id:')}      ${me.id}`);
      if (me.role) info(`${c.dim('role:')}    ${me.role}`);
      info(`${c.dim('profile:')} ${ctx.config.profile}`);
      info(`${c.dim('api:')}     ${ctx.config.baseUrl}`);
    });
}
