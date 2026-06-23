/**
 * `datavessel run <tool> [--flags…]` — execute any catalog tool.
 *
 * Flags are validated against the tool's `inputSchema` from the catalog. Two
 * escape hatches always work for power users / odd schemas:
 *   --param key=value     (repeatable) set one parameter as a raw string
 *   --params-json '<json>'  merge a full JSON object of parameters
 *
 * Write tools prompt for confirmation unless `--yes` (global) is set.
 * Global options (e.g. `--json`) must precede `run`: `datavessel --json run …`.
 */

import { Command } from 'commander';
import { buildContext } from '../context.js';
import { getCatalog, findTool } from '../catalog.js';
import {
  schemaToParams,
  collectParams,
  describeSchema,
  type ObjectSchema,
  type ParamDescriptor,
} from '../schema.js';
import { CliError, ExitCode } from '../errors.js';
import { printJson, info, success, warn, c } from '../output.js';
import { confirm, isInteractive } from '../prompt.js';

interface ParsedFlags {
  flags: Record<string, string[] | boolean>;
  params: Record<string, unknown>; // from --param / --params-json escape hatches
  wantsHelp: boolean;
}

/** Parse the raw token stream after `<tool>` into flags + escape-hatch params. */
export function parseRawFlags(tokens: string[]): ParsedFlags {
  const flags: Record<string, string[] | boolean> = {};
  const params: Record<string, unknown> = {};
  let wantsHelp = false;

  const addFlag = (name: string, value: string) => {
    const prev = flags[name];
    if (Array.isArray(prev)) prev.push(value);
    else flags[name] = [value];
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === '--help' || tok === '-h') {
      wantsHelp = true;
      continue;
    }
    if (!tok.startsWith('--')) {
      throw new CliError(`Unexpected argument: ${tok}`, ExitCode.USAGE);
    }
    let name = tok.slice(2);
    let inlineValue: string | undefined;
    const eq = name.indexOf('=');
    if (eq !== -1) {
      inlineValue = name.slice(eq + 1);
      name = name.slice(0, eq);
    }

    // Escape hatches.
    if (name === 'params-json') {
      const raw = inlineValue ?? tokens[++i];
      if (raw === undefined) throw new CliError('--params-json requires a value', ExitCode.USAGE);
      let obj: unknown;
      try {
        obj = JSON.parse(raw);
      } catch {
        throw new CliError('--params-json must be valid JSON', ExitCode.USAGE);
      }
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        throw new CliError('--params-json must be a JSON object', ExitCode.USAGE);
      }
      Object.assign(params, obj);
      continue;
    }
    if (name === 'param') {
      const raw = inlineValue ?? tokens[++i];
      if (raw === undefined) throw new CliError('--param requires key=value', ExitCode.USAGE);
      const kv = raw.indexOf('=');
      if (kv === -1) throw new CliError(`--param expects key=value, got "${raw}"`, ExitCode.USAGE);
      params[raw.slice(0, kv)] = raw.slice(kv + 1);
      continue;
    }

    // Boolean negation: --no-foo
    if (name.startsWith('no-')) {
      flags[name.slice(3)] = false;
      continue;
    }

    if (inlineValue !== undefined) {
      addFlag(name, inlineValue);
      continue;
    }
    // Look ahead: a following non-flag token is this flag's value; otherwise
    // it's a boolean switch.
    const next = tokens[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      addFlag(name, next);
      i++;
    } else {
      flags[name] = true;
    }
  }

  return { flags, params, wantsHelp };
}

/** Map parsed kebab-flags onto the commander-style opts object keyed by attr. */
function flagsToOpts(
  parsed: ParsedFlags,
  params: ParamDescriptor[],
): { opts: Record<string, unknown>; unknown: string[] } {
  const byFlag = new Map(params.map((p) => [p.flag, p]));
  const opts: Record<string, unknown> = {};
  const unknown: string[] = [];

  for (const [flag, value] of Object.entries(parsed.flags)) {
    const desc = byFlag.get(flag);
    if (!desc) {
      // Unknown flag: keep as a raw string param so schemaless tools still work.
      if (!(flag in parsed.params)) {
        parsed.params[flag] = Array.isArray(value) ? value[value.length - 1] : value;
      }
      unknown.push(flag);
      continue;
    }
    if (desc.type === 'array') {
      opts[desc.attr] = Array.isArray(value) ? value : [value];
    } else if (Array.isArray(value)) {
      opts[desc.attr] = value[value.length - 1]; // last wins for scalars
    } else {
      opts[desc.attr] = value;
    }
  }
  return { opts, unknown };
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Execute a tool by name (flags are derived from its schema)')
    .argument('<tool>', 'Tool name, e.g. get_account_summaries')
    .argument('[params...]', 'Tool parameters as --flag value (see `tools show <tool>`)')
    .passThroughOptions()
    .allowUnknownOption()
    .addHelpText(
      'after',
      '\nExamples:\n' +
        '  datavessel run get_account_summaries\n' +
        '  datavessel run run_report --property-id 123 --metrics sessions --metrics users\n' +
        "  datavessel run some_tool --params-json '{\"a\":1}'\n" +
        '  datavessel --json run list_sites\n',
    )
    .action(async (toolName: string, rawParams: string[], _opts, cmd: Command) => {
      const ctx = buildContext(cmd);
      const catalog = await getCatalog(ctx.client);
      const tool = findTool(catalog, toolName);
      if (!tool) {
        throw new CliError(
          `Unknown tool: ${toolName}`,
          ExitCode.USAGE,
          'Run `datavessel tools list` to see available tools.',
        );
      }

      const descriptors = schemaToParams(tool.inputSchema as ObjectSchema | null);
      const parsed = parseRawFlags(rawParams);

      if (parsed.wantsHelp) {
        info(`${c.bold(tool.toolName)}  ${c.dim(`(${tool.provider}, ${tool.access})`)}`);
        if (tool.description) info(`\n${tool.description}`);
        info(`\n${c.bold('Parameters:')}`);
        info(describeSchema(descriptors));
        return;
      }

      const { opts, unknown } = flagsToOpts(parsed, descriptors);
      if (unknown.length > 0 && descriptors.length > 0) {
        warn(
          `Unknown flag(s) sent as raw string params: ${unknown
            .map((f) => '--' + f)
            .join(', ')}. See \`datavessel tools show ${toolName}\`.`,
        );
      }
      const params = collectParams(descriptors, opts, parsed.params);

      // Guard destructive/write tools behind a confirmation.
      if (tool.access === 'write' && !ctx.global.yes) {
        if (!isInteractive()) {
          throw new CliError(
            `'${toolName}' is a write tool; refusing to run non-interactively without --yes.`,
            ExitCode.USAGE,
          );
        }
        const ok = await confirm(
          `${c.yellow('!')} '${toolName}' modifies data. Continue?`,
          false,
        );
        if (!ok) {
          info('Aborted.');
          process.exitCode = ExitCode.OK;
          return;
        }
      }

      const result = await ctx.client.execute(toolName, params);

      if (ctx.global.json) {
        printJson(result);
      } else if (typeof result === 'string') {
        process.stdout.write(result + '\n');
      } else {
        printJson(result);
      }
      success(`Executed ${toolName}`);
    });
}
