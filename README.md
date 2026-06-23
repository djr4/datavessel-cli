# datavessel-cli

Command-line interface for [datavessel](https://datavessel.io) — run 100+
read/write analytics and commerce tools (GA4, Search Console, Google/Meta Ads,
Shopify, WooCommerce, Shopware, …) from your terminal.

**The CLI's commands and help are generated from the live backend tool
catalog.** It fetches `/v1/tools/schemas` and turns each tool's JSON Schema into
flags, help text, and validation — so when a tool is added or changed on the
backend, the CLI picks it up automatically with no release. This mirrors how the
[datavessel MCP server](https://github.com/djr4/datavessel-mcp-public) already
syncs its tools.

## Install

```bash
npm install -g datavessel-cli
```

This puts two commands on your PATH — `datavessel` and the short alias `dv`.
Requires Node.js ≥ 20.11.

The CLI defaults to the hosted backend (`https://api.datavessel.io`) and web app
(`https://app.datavessel.io`); both are configurable (see
[Configuration](#configuration)) if you run datavessel elsewhere.

<details>
<summary>From source (development)</summary>

```bash
git clone https://github.com/djr4/datavessel-cli.git
cd datavessel-cli
npm install
npm run build
npm link                 # exposes `datavessel` and `dv` on your PATH

# or run without building
npm run dev -- tools list
```
</details>

## Quick start

```bash
datavessel login                          # sign in via your browser
datavessel tools list                     # browse the catalog
datavessel tools show run_report          # see a tool's parameters
datavessel run run_report --property-id 123 --metrics sessions --metrics users
datavessel --json run list_sites          # machine-readable output
```

## Authentication

`datavessel login` opens your browser, signs you in with the normal datavessel
Google flow, and hands the session back to the CLI over a localhost loopback.
The backend's authorization server is Supabase; the CLI stores the resulting
**refresh token** and silently refreshes the short-lived access token, so you
log in once.

```bash
datavessel login                 # browser flow (default)
datavessel login --no-browser    # print the URL instead of opening a browser
datavessel whoami
datavessel logout
```

For CI / headless use, supply a static credential instead of the browser flow:

```bash
datavessel login --token "$JWT"            # store a Bearer JWT
DATAVESSEL_TOKEN="$JWT" datavessel whoami   # or pass it per-invocation
```

Credentials are stored per-profile under `~/.config/datavessel/credentials.json`
(mode `0600`). Precedence, highest first:

1. `--token` / `--api-key` flags
2. `DATAVESSEL_TOKEN` / `DATAVESSEL_API_KEY` env vars
3. stored credential for the active profile (browser-login session)

> The browser flow requires the `/cli-auth` page in `datavessel-frontend`. It
> redirects only to `http://127.0.0.1:<port>` (loopback), echoes a random
> `state` the CLI verifies, and requires an explicit "Authorize" click.

### Use with coding agents (Claude Code / Cursor)

This repo ships [`SKILL.md`](./SKILL.md) — a ready-made agent skill describing
how to drive the CLI (discover tools, `--json` output, exit codes, auth). Drop
it into `.claude/skills/datavessel/SKILL.md` for Claude Code, or reference it
from a Cursor rule.

## Commands

| Command | Description |
| --- | --- |
| `login` / `logout` / `whoami` | Manage and inspect authentication |
| `tools list` | List tools (filter with `--provider`, `--access`, `--search`) |
| `tools show <tool>` | Show a tool's description and parameters |
| `run <tool> [--flags…]` | Execute a tool; flags come from its schema |
| `providers` | List providers you've connected |
| `usage` | Show tier, tool-call quota, billing period |
| `sync` | Force-refresh the local tool catalog cache |
| `config show/get/set` | Manage base URL and default profile |

### Running tools

Flags are derived from the tool's `inputSchema`:

- `--flag value` or `--flag=value`
- repeat a flag for arrays: `--metrics sessions --metrics users`
- booleans: `--active` / `--no-active`
- escape hatches that always work:
  - `--param key=value` (repeatable)
  - `--params-json '{"key":"value"}'`

`datavessel run <tool> --help` prints the tool's parameters. Write tools prompt
for confirmation unless `--yes` is passed.

> Global options (`--json`, `--profile`, `--base-url`, …) must come **before**
> the subcommand, e.g. `datavessel --json run <tool>`. This lets `run` pass any
> remaining `--flags` straight to the tool.

## Configuration

```bash
datavessel config show
datavessel config set base-url https://api.datavessel.io
datavessel config set app-url https://app.datavessel.io
datavessel config set default-profile work
datavessel --profile staging config set base-url https://staging-api.datavessel.io
```

Environment overrides: `DATAVESSEL_API_URL`, `DATAVESSEL_APP_URL`,
`DATAVESSEL_PROFILE`, `DATAVESSEL_CONFIG_DIR`, `NO_COLOR`.

The tool catalog is cached at `~/.config/datavessel/catalog.json` and refreshed
when older than 24h, on a base-URL change, or via `datavessel sync`.

## Development

```bash
npm run dev -- <args>   # run from source via tsx
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm test                # node test runner via tsx
npm run build           # emit dist/
```

### Exit codes

`0` ok · `1` error · `2` usage · `3` auth · `4` quota · `5` provider not connected.

## License

Apache-2.0
