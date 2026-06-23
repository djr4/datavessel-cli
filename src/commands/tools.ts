/**
 * Tool catalog commands: `tools list` and `tools show <name>`.
 *
 * Both read the catalog from the local cache (refreshing from the backend when
 * stale). `tools show` renders the dynamically-derived flags for a tool — the
 * same flags `datavessel run <tool>` accepts.
 */

import { Command } from 'commander';
import { buildContext } from '../context.js';
import { getCatalog, findTool } from '../catalog.js';
import { schemaToParams, describeSchema, type ObjectSchema } from '../schema.js';
import { CliError, ExitCode } from '../errors.js';
import { printJson, table, info, c } from '../output.js';

export function registerToolsCommands(program: Command): void {
  const tools = program.command('tools').description('Browse the available tool catalog');

  tools
    .command('list')
    .description('List all available tools')
    .option('-p, --provider <name>', 'Filter by provider (e.g. google_analytics)')
    .option('-a, --access <type>', "Filter by access: 'read' or 'write'")
    .option('-s, --search <text>', 'Filter by substring in name or description')
    .option('--refresh', 'Force-refresh the catalog from the backend')
    .action(async (opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      let catalog = await getCatalog(ctx.client, { forceRefresh: Boolean(opts.refresh) });

      if (opts.provider) catalog = catalog.filter((t) => t.provider === opts.provider);
      if (opts.access) catalog = catalog.filter((t) => t.access === opts.access);
      if (opts.search) {
        const q = String(opts.search).toLowerCase();
        catalog = catalog.filter(
          (t) =>
            t.toolName.toLowerCase().includes(q) ||
            (t.description ?? '').toLowerCase().includes(q),
        );
      }
      catalog = [...catalog].sort(
        (a, b) => a.provider.localeCompare(b.provider) || a.toolName.localeCompare(b.toolName),
      );

      if (ctx.global.json) {
        printJson(catalog);
        return;
      }
      if (catalog.length === 0) {
        info('No matching tools.');
        return;
      }
      const rows = catalog.map((t) => [
        t.access === 'write' ? c.yellow(t.toolName) : t.toolName,
        t.provider,
        t.access,
        truncate(t.description ?? '', 60),
      ]);
      info(table(['TOOL', 'PROVIDER', 'ACCESS', 'DESCRIPTION'], rows));
      info('');
      info(c.dim(`${catalog.length} tool(s). Run \`datavessel tools show <name>\` for details.`));
    });

  tools
    .command('show <name>')
    .description('Show a tool description and its parameters')
    .option('--refresh', 'Force-refresh the catalog from the backend')
    .action(async (name: string, opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      const catalog = await getCatalog(ctx.client, { forceRefresh: Boolean(opts.refresh) });
      const tool = findTool(catalog, name);
      if (!tool) {
        throw new CliError(
          `Unknown tool: ${name}`,
          ExitCode.USAGE,
          'Run `datavessel tools list` to see available tools.',
        );
      }
      if (ctx.global.json) {
        printJson(tool);
        return;
      }
      const params = schemaToParams(tool.inputSchema as ObjectSchema | null);
      info(`${c.bold(tool.toolName)}  ${c.dim(`(${tool.provider}, ${tool.access})`)}`);
      if (tool.description) info(`\n${tool.description}`);
      info(`\n${c.bold('Parameters:')}`);
      info(describeSchema(params));
      info(`\n${c.dim('Run with:')} datavessel run ${tool.toolName} ${params
        .filter((p) => p.required)
        .map((p) => `--${p.flag} <…>`)
        .join(' ')}`);
    });
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}
