/**
 * `config` and `sync` commands.
 *
 * `config` manages non-secret per-profile settings (base URL, default
 * profile). `sync` force-refreshes the local tool catalog cache.
 */

import { Command } from 'commander';
import { buildContext, globalOpts } from '../context.js';
import { refreshCatalog } from '../catalog.js';
import {
  DEFAULT_BASE_URL,
  configDir,
  listProfiles,
  resolveConfig,
  resolveProfileName,
  setBaseUrl,
  setDefaultProfile,
} from '../config.js';
import { CliError, ExitCode } from '../errors.js';
import { printJson, success, info, table, c } from '../output.js';

export function registerConfigCommands(program: Command): void {
  const config = program.command('config').description('Manage CLI configuration');

  config
    .command('show')
    .description('Show the resolved configuration for the active profile')
    .action((_opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const resolved = resolveConfig(global.profile);
      const data = {
        profile: resolved.profile,
        baseUrl: resolved.baseUrl,
        authenticated: Boolean(resolved.credential),
        authType: resolved.credential?.type ?? null,
        configDir: configDir(),
        profiles: listProfiles(),
      };
      if (global.json) {
        printJson(data);
        return;
      }
      info(
        table(
          ['FIELD', 'VALUE'],
          [
            ['profile', data.profile],
            ['base-url', data.baseUrl],
            ['authenticated', String(data.authenticated)],
            ['auth-type', String(data.authType ?? '-')],
            ['config-dir', data.configDir],
            ['profiles', data.profiles.join(', ')],
          ],
        ),
      );
    });

  config
    .command('get <key>')
    .description("Get a config value. Keys: base-url, default-profile")
    .action((key: string, _opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const resolved = resolveConfig(global.profile);
      switch (key) {
        case 'base-url':
          info(resolved.baseUrl);
          break;
        case 'default-profile':
          info(resolveProfileName());
          break;
        default:
          throw new CliError(`Unknown config key: ${key}`, ExitCode.USAGE, 'Keys: base-url, default-profile');
      }
    });

  config
    .command('set <key> <value>')
    .description('Set a config value. Keys: base-url, default-profile')
    .action((key: string, value: string, _opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const profile = resolveProfileName(global.profile);
      switch (key) {
        case 'base-url':
          setBaseUrl(profile, value);
          success(`Set base-url for profile ${c.cyan(profile)} to ${value}`);
          break;
        case 'default-profile':
          setDefaultProfile(value);
          success(`Default profile set to ${c.cyan(value)}`);
          break;
        default:
          throw new CliError(`Unknown config key: ${key}`, ExitCode.USAGE, 'Keys: base-url, default-profile');
      }
    });

  config
    .command('reset-base-url')
    .description(`Reset base-url to the default (${DEFAULT_BASE_URL})`)
    .action((_opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const profile = resolveProfileName(global.profile);
      setBaseUrl(profile, DEFAULT_BASE_URL);
      success(`Reset base-url for profile ${c.cyan(profile)} to ${DEFAULT_BASE_URL}`);
    });

  program
    .command('sync')
    .description('Force-refresh the local tool catalog from the backend')
    .action(async (_opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      const tools = await refreshCatalog(ctx.client);
      if (ctx.global.json) {
        printJson({ tools: tools.length, baseUrl: ctx.client.baseUrl });
        return;
      }
      success(`Synced ${tools.length} tools from ${ctx.client.baseUrl}`);
    });
}
