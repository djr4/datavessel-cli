/**
 * Account commands: `providers` (connected sources) and `usage` (tier/quota).
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
    .description('Show your tier, tool-call quota, and billing period')
    .action(async (_opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      const u = await ctx.client.usage();
      if (ctx.global.json) {
        printJson(u);
        return;
      }
      const rows: string[][] = [
        ['Tier', `${u.tier_name ?? u.tier} (${u.tier})`],
        ['Tool calls', `${u.current_tool_calls} / ${u.tool_call_limit} (${u.usage_percentage}%)`],
        ['Remaining', String(u.remaining_tool_calls)],
        ['Schedules', `${u.schedules_current} / ${u.schedules_limit}`],
        ['Daily agent runs', `${u.daily_agent_runs_current} / ${u.daily_agent_runs_limit}`],
        ['Billing period ends', String(u.billing_period_end ?? '')],
        ['Subscription', String(u.subscription_status ?? '')],
      ];
      info(table(['FIELD', 'VALUE'], rows));
      if (u.upgrade_url) info(`\n${c.yellow('Upgrade:')} ${u.upgrade_url}`);
    });
}
