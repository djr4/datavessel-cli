/**
 * Account commands: `providers` (connected sources) and `usage` (plan and writes this period).
 */

import { Command } from 'commander';
import { buildContext } from '../context.js';
import { printJson, table, info, c } from '../output.js';

export function registerAccountCommands(program: Command): void {
  program
    .command('providers')
    .description('List providers you have connected (OAuth/credentials)')
    .action(async (_opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      const { providers } = await ctx.client.connectedSources();
      if (ctx.global.json) {
        printJson(providers);
        return;
      }
      if (providers.length === 0) {
        info('No connected providers.');
        info(c.dim('Connect accounts in the web app: https://app.datavessel.io/settings'));
        return;
      }
      for (const p of providers.sort()) info(`${c.green('●')} ${p}`);
    });

  program
    .command('usage')
    .description('Show your plan, writes used this period, and billing period')
    .action(async (_opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      const u = await ctx.client.usage();
      if (ctx.global.json) {
        printJson(u);
        return;
      }
      const rows: string[][] = [
        ['Tier', `${u.tier_name ?? u.tier} (${u.tier})`],
        ['Writes this period', `${u.writes_current} / ${u.writes_limit} (${u.usage_percentage}%)`],
        ['Writes remaining', String(u.writes_remaining)],
        ['Reads', 'unlimited'],
        ['Scheduled agents', `${u.schedules_current} active`],
        ['Billing period ends', String(u.billing_period_end ?? '')],
        ['Subscription', String(u.subscription_status ?? '')],
      ];
      info(table(['FIELD', 'VALUE'], rows));
      if (u.upgrade_url) info(`\n${c.yellow('Upgrade:')} ${u.upgrade_url}`);
    });
}
