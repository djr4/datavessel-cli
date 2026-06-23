/**
 * Configuration and credential storage.
 *
 * Two files live under the datavessel config dir (default
 * `~/.config/datavessel`, override with `DATAVESSEL_CONFIG_DIR`):
 *
 *   - config.json      non-secret settings (base URL, default profile, …)
 *   - credentials.json  auth tokens, written with 0600 perms
 *
 * Both support named profiles so a user can keep separate prod / staging /
 * personal credentials. The active profile is chosen by (in order):
 *   `--profile` flag → `DATAVESSEL_PROFILE` env → config `defaultProfile` →
 *   "default".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Production backend API base. Override per-profile or with DATAVESSEL_API_URL. */
export const DEFAULT_BASE_URL = 'https://api.datavessel.io';

/** Web app base, used for the browser login handoff. Override with DATAVESSEL_APP_URL. */
export const DEFAULT_APP_URL = 'https://app.datavessel.io';

export type AuthType = 'bearer' | 'api-key' | 'oauth';

export interface BearerCredential {
  type: 'bearer';
  token: string;
}

export interface ApiKeyCredential {
  type: 'api-key';
  token: string;
}

/**
 * A Supabase session obtained via the browser login flow. `expiresAt` is epoch
 * seconds; `supabaseUrl`/`anonKey` (both public) let the CLI refresh the
 * short-lived access token on its own without re-prompting.
 */
export interface OAuthCredential {
  type: 'oauth';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  supabaseUrl: string;
  anonKey: string;
}

export type Credential = BearerCredential | ApiKeyCredential | OAuthCredential;

interface ProfileConfig {
  baseUrl?: string;
  appUrl?: string;
}

interface ConfigFile {
  defaultProfile?: string;
  profiles?: Record<string, ProfileConfig>;
}

type CredentialsFile = Record<string, Credential>;

export interface ResolvedConfig {
  profile: string;
  baseUrl: string;
  appUrl: string;
  credential?: Credential;
}

export function configDir(): string {
  if (process.env.DATAVESSEL_CONFIG_DIR) return process.env.DATAVESSEL_CONFIG_DIR;
  const base =
    process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.length > 0
      ? process.env.XDG_CONFIG_HOME
      : join(homedir(), '.config');
  return join(base, 'datavessel');
}

const configPath = () => join(configDir(), 'config.json');
const credentialsPath = () => join(configDir(), 'credentials.json');
const catalogPath = () => join(configDir(), 'catalog.json');

export function ensureDir(): void {
  const dir = configDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function readConfig(): ConfigFile {
  return readJson<ConfigFile>(configPath(), {});
}

function readCredentials(): CredentialsFile {
  return readJson<CredentialsFile>(credentialsPath(), {});
}

function writeConfig(cfg: ConfigFile): void {
  ensureDir();
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

function writeCredentials(creds: CredentialsFile): void {
  ensureDir();
  writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2) + '\n', { mode: 0o600 });
  // Defensive: re-assert perms in case the file pre-existed with looser bits.
  try {
    chmodSync(credentialsPath(), 0o600);
  } catch {
    /* best effort */
  }
}

/** The profile name in effect, honouring flag → env → config default. */
export function resolveProfileName(flagProfile?: string): string {
  return (
    flagProfile ||
    process.env.DATAVESSEL_PROFILE ||
    readConfig().defaultProfile ||
    'default'
  );
}

/**
 * Resolve the full active config: base URL and credential for the chosen
 * profile, with env-var overrides applied. The base URL precedence is
 * `DATAVESSEL_API_URL` → per-profile config → built-in default.
 */
export function resolveConfig(flagProfile?: string): ResolvedConfig {
  const profile = resolveProfileName(flagProfile);
  const cfg = readConfig();
  const baseUrl =
    process.env.DATAVESSEL_API_URL ||
    cfg.profiles?.[profile]?.baseUrl ||
    DEFAULT_BASE_URL;
  const appUrl =
    process.env.DATAVESSEL_APP_URL ||
    cfg.profiles?.[profile]?.appUrl ||
    DEFAULT_APP_URL;

  let credential: Credential | undefined = readCredentials()[profile];
  // Env tokens win so CI can inject auth without touching disk.
  if (process.env.DATAVESSEL_TOKEN) {
    credential = { type: 'bearer', token: process.env.DATAVESSEL_TOKEN };
  } else if (process.env.DATAVESSEL_API_KEY) {
    credential = { type: 'api-key', token: process.env.DATAVESSEL_API_KEY };
  }

  return { profile, baseUrl, appUrl, credential };
}

export function setBaseUrl(profile: string, baseUrl: string): void {
  const cfg = readConfig();
  cfg.profiles ??= {};
  cfg.profiles[profile] ??= {};
  cfg.profiles[profile].baseUrl = baseUrl;
  writeConfig(cfg);
}

export function setAppUrl(profile: string, appUrl: string): void {
  const cfg = readConfig();
  cfg.profiles ??= {};
  cfg.profiles[profile] ??= {};
  cfg.profiles[profile].appUrl = appUrl;
  writeConfig(cfg);
}

export function setDefaultProfile(profile: string): void {
  const cfg = readConfig();
  cfg.defaultProfile = profile;
  writeConfig(cfg);
}

export function saveCredential(profile: string, credential: Credential): void {
  const creds = readCredentials();
  creds[profile] = credential;
  writeCredentials(creds);
}

export function clearCredential(profile: string): boolean {
  const creds = readCredentials();
  if (!(profile in creds)) return false;
  delete creds[profile];
  writeCredentials(creds);
  return true;
}

export function listProfiles(): string[] {
  const fromConfig = Object.keys(readConfig().profiles ?? {});
  const fromCreds = Object.keys(readCredentials());
  return [...new Set(['default', ...fromConfig, ...fromCreds])].sort();
}

export const _paths = { configPath, credentialsPath, catalogPath };
