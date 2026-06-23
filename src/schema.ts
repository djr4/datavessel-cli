/**
 * JSON Schema → CLI flags.
 *
 * This is what makes the CLI self-updating: each tool's `inputSchema` (a JSON
 * Schema object served by the backend) is turned into command-line options,
 * help text, value coercion, and required-field validation. Adding a tool on
 * the backend makes it appear here with no CLI code change.
 */

import { Command, Option } from 'commander';
import { CliError, ExitCode } from './errors.js';
import { c } from './output.js';

type JsonType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

interface PropSchema {
  type?: JsonType | JsonType[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: PropSchema;
  format?: string;
}

export interface ObjectSchema {
  type?: string;
  properties?: Record<string, PropSchema>;
  required?: string[];
}

export interface ParamDescriptor {
  prop: string;
  flag: string; // kebab-case long flag, no leading dashes
  attr: string; // key commander assigns on the opts object
  type: JsonType;
  itemType: JsonType;
  required: boolean;
  description: string;
  enum?: unknown[];
  default?: unknown;
}

export function toKebab(name: string): string {
  return name
    .replace(/_/g, '-')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2') // HTTPServer -> HTTP-Server
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // propertyId -> property-Id
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toCamel(flag: string): string {
  return flag.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

/** Pick a single primary type from a schema's `type` (which may be an array). */
function primaryType(t: PropSchema['type']): JsonType {
  if (Array.isArray(t)) {
    const real = t.find((x) => x !== 'null');
    return (real ?? 'string') as JsonType;
  }
  return (t ?? 'string') as JsonType;
}

/** Turn an object input schema into an ordered list of parameter descriptors. */
export function schemaToParams(input: ObjectSchema | null | undefined): ParamDescriptor[] {
  const props = input?.properties ?? {};
  const required = new Set(input?.required ?? []);
  return Object.entries(props).map(([prop, schema]) => {
    const flag = toKebab(prop);
    const type = primaryType(schema.type);
    return {
      prop,
      flag,
      attr: toCamel(flag),
      type,
      itemType: type === 'array' ? primaryType(schema.items?.type) : 'string',
      required: required.has(prop),
      description: schema.description ?? '',
      enum: schema.enum,
      default: schema.default,
    };
  });
}

/** Register each descriptor as a commander option on the given command. */
export function registerOptions(cmd: Command, params: ParamDescriptor[]): void {
  for (const p of params) {
    const label = p.required ? `${p.description} ${c.dim('(required)')}` : p.description;
    if (p.type === 'boolean') {
      // Boolean flags get a negatable form so `--no-foo` can send false.
      cmd.addOption(new Option(`--${p.flag}`, label || `Set ${p.prop}`));
      cmd.addOption(new Option(`--no-${p.flag}`, `Set ${p.prop} to false`).hideHelp());
      continue;
    }
    const placeholder = p.type === 'array' ? '<value...>' : `<${p.type}>`;
    const opt = new Option(`--${p.flag} ${placeholder}`, label || `Set ${p.prop}`);
    if (p.type === 'array') {
      opt.argParser((val: string, prev: string[] = []) => [...prev, val]);
    }
    if (p.enum && p.type !== 'array') opt.choices(p.enum.map(String));
    cmd.addOption(opt);
  }
}

function coerceScalar(raw: string, type: JsonType, prop: string): unknown {
  switch (type) {
    case 'integer': {
      const n = Number(raw);
      if (!Number.isInteger(n)) {
        throw new CliError(`--${toKebab(prop)} must be an integer, got "${raw}"`, ExitCode.USAGE);
      }
      return n;
    }
    case 'number': {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        throw new CliError(`--${toKebab(prop)} must be a number, got "${raw}"`, ExitCode.USAGE);
      }
      return n;
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'object':
    case 'array':
      try {
        return JSON.parse(raw);
      } catch {
        throw new CliError(`--${toKebab(prop)} must be valid JSON, got "${raw}"`, ExitCode.USAGE);
      }
    default:
      return raw;
  }
}

/**
 * Collect coerced parameters from parsed commander options. `extra` holds
 * values supplied via the generic escape hatches (`--param`, `--params-json`)
 * and takes precedence so power users can always override.
 */
export function collectParams(
  params: ParamDescriptor[],
  opts: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...extra };

  for (const p of params) {
    if (p.prop in out) continue; // escape-hatch override wins
    const raw = opts[p.attr];
    if (raw === undefined) continue;

    if (p.type === 'boolean') {
      out[p.prop] = Boolean(raw);
    } else if (p.type === 'array') {
      const arr = Array.isArray(raw) ? raw : [raw];
      out[p.prop] = arr.map((v) => coerceScalar(String(v), p.itemType, p.prop));
    } else {
      out[p.prop] = coerceScalar(String(raw), p.type, p.prop);
    }
  }

  const missing = params.filter((p) => p.required && !(p.prop in out)).map((p) => `--${p.flag}`);
  if (missing.length > 0) {
    throw new CliError(`Missing required option(s): ${missing.join(', ')}`, ExitCode.USAGE);
  }
  return out;
}

/** Human-readable description of a tool's inputs, for `tools show`. */
export function describeSchema(params: ParamDescriptor[]): string {
  if (params.length === 0) return c.dim('  (no parameters)');
  return params
    .map((p) => {
      const type = p.type === 'array' ? `${p.itemType}[]` : p.type;
      const req = p.required ? c.red('required') : c.dim('optional');
      const head = `  ${c.cyan('--' + p.flag)} ${c.dim(type)}  ${req}`;
      const lines = [head];
      if (p.description) lines.push(`      ${p.description}`);
      if (p.enum) lines.push(`      ${c.dim('choices:')} ${p.enum.map(String).join(', ')}`);
      if (p.default !== undefined) {
        lines.push(`      ${c.dim('default:')} ${JSON.stringify(p.default)}`);
      }
      return lines.join('\n');
    })
    .join('\n');
}
