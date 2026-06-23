/**
 * Builds the per-invocation context (resolved config + API client) from the
 * program's global options, applying flag overrides on top of stored config.
 */

import { Command } from 'commander';
import { ApiClient } from './api.js';
import { resolveConfig, saveCredential, type Credential, type ResolvedConfig } from './config.js';

export interface GlobalOptions {
  profile?: string;
  baseUrl?: string;
  appUrl?: string;
  token?: string;
  apiKey?: string;
  json?: boolean;
  yes?: boolean;
}

export interface Context {
  global: GlobalOptions;
  config: ResolvedConfig;
  client: ApiClient;
}

/** Read the root program's global options regardless of nesting depth. */
export function globalOpts(cmd: Command): GlobalOptions {
  let root: Command = cmd;
  while (root.parent) root = root.parent;
  return root.opts<GlobalOptions>();
}

export function buildContext(cmd: Command): Context {
  const global = globalOpts(cmd);
  const config = resolveConfig(global.profile);

  // Flag overrides take precedence over stored/env config.
  if (global.baseUrl) config.baseUrl = global.baseUrl;
  let credential: Credential | undefined = config.credential;
  let fromStore = true;
  if (global.token) {
    credential = { type: 'bearer', token: global.token };
    fromStore = false;
  } else if (global.apiKey) {
    credential = { type: 'api-key', token: global.apiKey };
    fromStore = false;
  }
  config.credential = credential;

  // Persist rotated OAuth tokens only when the credential came from disk (not
  // from an ephemeral --token / env override).
  const onRefresh =
    fromStore && credential?.type === 'oauth'
      ? (c: Credential) => saveCredential(config.profile, c)
      : undefined;

  const client = new ApiClient({ baseUrl: config.baseUrl, credential, onRefresh });
  return { global, config, client };
}
