/**
 * Authentication commands: login, logout, whoami.
 *
 * `login` defaults to a browser handoff that yields a refreshable Supabase
 * session (see oauth.ts), then verifies it against `/v1/auth/me`. For CI a
 * static credential can be supplied via `--token` / `--api-key` or the
 * `DATAVESSEL_TOKEN` / `DATAVESSEL_API_KEY` env vars.
 */

import { Command } from 'commander';
import { buildContext, globalOpts } from '../context.js';
import { ApiClient } from '../api.js';
import {
  clearCredential,
  resolveConfig,
  resolveProfileName,
  saveCredential,
  type Credential,
} from '../config.js';
import { loginViaBrowser } from '../oauth.js';
import { printJson, success, info, c } from '../output.js';

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Sign in via your browser (or pass --token / --api-key for CI)')
    .option('--token <jwt>', 'Use a Bearer access token instead of the browser flow')
    .option('--api-key <key>', 'Use an API key instead of the browser flow')
    .option('--no-browser', "Print the login URL instead of opening a browser")
    .option('--no-verify', 'Skip verifying the credential against the backend')
    .action(async (opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const profile = resolveProfileName(global.profile);
      const resolved = resolveConfig(global.profile);

      let credential: Credential;
      if (opts.apiKey) {
        credential = { type: 'api-key', token: String(opts.apiKey) };
      } else if (opts.token) {
        credential = { type: 'bearer', token: String(opts.token) };
      } else {
        // Default: browser-based OAuth handoff. Yields a refreshable session.
        credential = await loginViaBrowser({
          appUrl: global.appUrl || resolved.appUrl,
          open: opts.browser !== false,
        });
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
