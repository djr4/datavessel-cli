/**
 * `datavessel setup` — interactive first-run wizard.
 *
 * The promise: run one command, answer a few questions, and every agent and
 * team knows your stack. The wizard signs you in, tells you exactly which
 * sources still need connecting (with the URL), discovers the rest by asking
 * — which GA4 property, which Search Console site, which store — and persists
 * the answers as a team-memory entry tagged for all three team leads, whose
 * first phase is a recall of exactly those tags. After setup, a team run needs
 * nothing but a goal.
 *
 * Headless environments should use `datavessel init` instead; this command
 * requires a TTY and says so.
 */

import { Command } from 'commander';
import { ApiClient } from '../api.js';
import { buildContext, globalOpts } from '../context.js';
import { refreshCatalog } from '../catalog.js';
import { resolveConfig, resolveProfileName, saveCredential, type Credential } from '../config.js';
import { CliError, ExitCode } from '../errors.js';
import { loginViaBrowser } from '../oauth.js';
import { confirm, isInteractive, prompt, promptSecret } from '../prompt.js';
import { info, success, warn, c } from '../output.js';
import {
  parseChoice,
  parseGaProperties,
  parseGscSites,
  buildSetupMemoryContent,
  SETUP_MEMORY_TAGS,
  type SetupAnswers,
} from '../setup-profile.js';

/** Providers the wizard cares about, in the order we mention them. */
const CORE_PROVIDERS = [
  'google_analytics',
  'google_search_console',
  'shopify',
  'woocommerce',
  'shopware',
  'slack',
];

const STORE_PROVIDERS = ['shopify', 'woocommerce', 'shopware'];

async function pickFromList(
  question: string,
  options: string[],
): Promise<number | undefined> {
  info('');
  info(question);
  options.forEach((opt, i) => info(`  ${c.bold(String(i + 1))}. ${opt}`));
  const answer = await prompt(c.dim('  Number (Enter to skip): '));
  return parseChoice(answer, options.length);
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description(
      'Interactive first-run wizard: sign in, connect sources, and teach your agents the stack by answering a few questions',
    )
    .action(async (_opts, cmd: Command) => {
      if (!isInteractive()) {
        throw new CliError(
          '`datavessel setup` is interactive and needs a terminal.',
          ExitCode.USAGE,
          'For CI/headless environments use `datavessel init --api-key <key>`.',
        );
      }

      const global = globalOpts(cmd);
      const profile = resolveProfileName(global.profile);
      const resolved = resolveConfig(global.profile);
      const appUrl = global.appUrl || resolved.appUrl;

      // ---- 1. Authenticate -------------------------------------------------
      let ctx = buildContext(cmd);
      let signedIn = false;
      if (ctx.config.credential) {
        try {
          const me = await ctx.client.me();
          success(`Signed in as ${c.bold(me.email)} (profile: ${profile})`);
          signedIn = true;
        } catch {
          warn('Stored credential no longer works — let’s sign in again.');
        }
      }
      if (!signedIn) {
        info('');
        info('How would you like to sign in?');
        info(`  ${c.bold('1')}. Browser (recommended)`);
        info(`  ${c.bold('2')}. Paste an API key`);
        const choice = parseChoice(await prompt(c.dim('  Number: ')), 2) ?? 0;
        let credential: Credential;
        if (choice === 1) {
          const key = await promptSecret('API key: ');
          if (!key) throw new CliError('No API key entered.', ExitCode.AUTH);
          credential = { type: 'api-key', token: key };
        } else {
          credential = await loginViaBrowser({ appUrl, open: true });
        }
        const client = new ApiClient({ baseUrl: ctx.config.baseUrl, credential });
        const me = await client.me();
        saveCredential(profile, credential);
        success(`Signed in as ${c.bold(me.email)} (profile: ${profile})`);
        ctx = buildContext(cmd); // rebuild with the stored credential
      }

      // ---- 2. Sync the catalog --------------------------------------------
      const tools = await refreshCatalog(ctx.client);
      const toolNames = new Set(tools.map((t) => t.toolName));
      success(`Catalog synced: ${tools.length} tools`);

      // ---- 3. Connections: show what's live, link what's missing ----------
      let providers = (await ctx.client.connectedSources()).providers;
      const missing = () => CORE_PROVIDERS.filter((p) => !providers.includes(p));
      if (providers.length > 0) {
        success(`Connected: ${providers.slice().sort().join(', ')}`);
      }
      while (missing().length > 0) {
        info('');
        info(`Not connected yet: ${c.yellow(missing().join(', '))}`);
        info(`Connect them here: ${c.cyan(`${appUrl}/settings`)}`);
        info(c.dim('(Analytics + Search Console power reporting; your store platform powers operations; Slack receives team reports.)'));
        const again = await confirm('Re-check connections now?', true);
        if (!again) break;
        providers = (await ctx.client.connectedSources()).providers;
        const stillMissing = missing();
        if (stillMissing.length === 0) success('All core sources connected.');
        else success(`Connected so far: ${providers.slice().sort().join(', ') || '(none)'}`);
      }

      // ---- 4. Discovery Q&A ------------------------------------------------
      // Every step is optional and failure-tolerant: a discovery read that
      // errors is skipped with a warning, never fatal.
      const answers: SetupAnswers = {};

      if (providers.includes('google_analytics') && toolNames.has('get_account_summaries')) {
        try {
          const data = await ctx.client.execute('get_account_summaries', {});
          const props = parseGaProperties(data);
          if (props.length === 1) {
            answers.ga4PropertyId = props[0].id;
            success(`GA4 property: ${props[0].label} (${props[0].id})`);
          } else if (props.length > 1) {
            const idx = await pickFromList(
              'Which GA4 property should agents report on by default?',
              props.map((p) => `${p.label} ${c.dim(`(${p.id})`)}`),
            );
            if (idx !== undefined) answers.ga4PropertyId = props[idx - 1].id;
          }
        } catch {
          warn('Could not list GA4 properties — skipping (set it later by re-running setup).');
        }
      }

      if (providers.includes('google_search_console') && toolNames.has('list_sites')) {
        try {
          const data = await ctx.client.execute('list_sites', {});
          const sites = parseGscSites(data);
          if (sites.length === 1) {
            answers.gscSiteUrl = sites[0];
            success(`Search Console site: ${sites[0]}`);
          } else if (sites.length > 1) {
            const idx = await pickFromList(
              'Which Search Console site should agents use by default?',
              sites,
            );
            if (idx !== undefined) answers.gscSiteUrl = sites[idx - 1];
          }
        } catch {
          warn('Could not list Search Console sites — skipping.');
        }
      }

      const connectedStores = STORE_PROVIDERS.filter((p) => providers.includes(p));
      if (connectedStores.length === 1) {
        answers.storePlatform = connectedStores[0];
      } else if (connectedStores.length > 1) {
        const idx = await pickFromList(
          'Multiple store platforms are connected. Which is the primary one?',
          connectedStores,
        );
        if (idx !== undefined) answers.storePlatform = connectedStores[idx - 1];
      }
      if (answers.storePlatform) {
        const url = (
          await prompt(`Store URL for ${answers.storePlatform} (Enter to skip): `)
        ).trim();
        if (url) answers.storeUrl = url;
      }

      if (providers.includes('slack')) {
        const channel = (
          await prompt('Slack channel for team reports [#ecommerce]: ')
        ).trim();
        answers.slackChannel = channel || '#ecommerce';
      }

      const notes = (
        await prompt('Anything agents should always know about your business? (Enter to skip): ')
      ).trim();
      if (notes) answers.notes = notes;

      // ---- 5. Persist as team memory --------------------------------------
      // One entry carrying every team tag: leads recall `tags: ["team:<x>"]`
      // and recall matches entries whose tags are a superset, so all three
      // leads find this on their first PHASE 1 recall. Re-running setup
      // updates the existing entry instead of stacking duplicates.
      const content = buildSetupMemoryContent(answers);
      try {
        const existing = (await ctx.client.execute('datavessel_recall', {
          tags: ['business-profile', 'setup'],
          limit: 1,
        })) as { entries?: Array<{ id?: string }> } | Array<{ id?: string }> | null;
        const entries = Array.isArray(existing) ? existing : (existing?.entries ?? []);
        const existingId = entries[0]?.id;
        if (existingId) {
          await ctx.client.execute('datavessel_update_entry', { id: existingId, content });
          success('Updated your saved setup profile (team memory).');
        } else {
          await ctx.client.execute('datavessel_remember', {
            content,
            type: 'note',
            tags: [...SETUP_MEMORY_TAGS],
          });
          success('Saved your setup profile to team memory.');
        }
      } catch {
        warn('Could not save the setup profile to team memory — agents will discover context themselves.');
      }

      // ---- 6. Done ---------------------------------------------------------
      info('');
      success(c.bold('Setup complete.'));
      info('Your agent teams will recall this profile automatically. Try:');
      info(c.dim(`  • In the app: ${appUrl} → Agents → Teams → run the Operator with goal "auto"`));
      info(c.dim('  • Here:       datavessel --json tools list --search report'));
      info(c.dim('  • Claude Code: /plugin install datavessel@datavessel  →  /datavessel:setup'));
    });
}
