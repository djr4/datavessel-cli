/**
 * `datavessel init` — one-shot self-configuration.
 *
 * Point of the command: "add a key and it starts working". It optionally
 * stores a supplied credential (so it doubles as a headless login), verifies
 * it against the backend, force-syncs the tool catalog, and reports connected
 * providers and quota — everything an agent or a human needs before the first
 * real call, in one invocation with one machine-readable output.
 */

import { Command } from 'commander';
import { buildContext, globalOpts } from '../context.js';
import { refreshCatalog } from '../catalog.js';
import { resolveProfileName, saveCredential } from '../config.js';
import { CliError, ExitCode } from '../errors.js';
import { printJson, success, info, warn, c } from '../output.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description(
      'Verify auth, sync the tool catalog, and report what is ready to use ' +
        '(pass --api-key or --token to sign in first)',
    )
    .option('--api-key <key>', 'Store an API key for this profile, then configure')
    .option('--token <jwt>', 'Store a Bearer token for this profile, then configure')
    .action(async (opts, cmd: Command) => {
      const global = globalOpts(cmd);
      const profile = resolveProfileName(global.profile);

      // A supplied credential is stored up front so init works headlessly in
      // CI and agent environments where the browser login flow is impossible.
      if (opts.apiKey) {
        saveCredential(profile, { type: 'api-key', token: String(opts.apiKey) });
      } else if (opts.token) {
        saveCredential(profile, { type: 'bearer', token: String(opts.token) });
      }

      const ctx = buildContext(cmd);
      if (!ctx.config.credential) {
        throw new CliError(
          'Not authenticated.',
          ExitCode.AUTH,
          'Run `datavessel login` (browser), or `datavessel init --api-key <key>` for headless setup.',
        );
      }

      const me = await ctx.client.me();
      const tools = await refreshCatalog(ctx.client);
      const { providers } = await ctx.client.connectedSources();
      let usage: Record<string, unknown> | undefined;
      try {
        usage = await ctx.client.usage();
      } catch {
        usage = undefined; // non-fatal: quota display is a nicety, not a gate
      }

      const readCount = tools.filter((t) => t.access === 'read').length;
      const writeCount = tools.length - readCount;

      if (ctx.global.json) {
        printJson({
          ok: true,
          profile,
          baseUrl: ctx.config.baseUrl,
          user: { id: me.id, email: me.email, name: me.name },
          catalog: { total: tools.length, read: readCount, write: writeCount },
          providers,
          usage: usage ?? null,
        });
        return;
      }

      success(`Signed in as ${c.bold(me.email)} (profile: ${profile})`);
      success(`Catalog synced: ${tools.length} tools (${readCount} read / ${writeCount} write)`);
      if (providers.length > 0) {
        success(`Providers connected: ${providers.sort().join(', ')}`);
      } else {
        warn('No providers connected yet.');
        info(c.dim('  Connect GA4, Search Console, Shopify, … at https://app.datavessel.io/settings'));
      }
      if (usage) {
        info(
          `  Tier: ${usage.tier_name ?? usage.tier} — ${usage.remaining_tool_calls} tool calls remaining`,
        );
      }
      info('');
      info('Ready. Try:');
      info(c.dim('  datavessel --json tools list --search "report"'));
      info(c.dim('  datavessel --json run <tool> --help'));
      info('');
      info(`Using Claude Code? Install the plugin (skill + agent hierarchy):`);
      info(c.dim('  /plugin marketplace add djr4/datavessel-cli'));
      info(c.dim('  /plugin install datavessel@datavessel'));
    });
}
