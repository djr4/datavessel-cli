# datavessel-cli

Command-line interface for [datavessel](https://datavessel.io) — run 100+
read/write analytics and commerce tools (GA4, Search Console, Google/Meta Ads,
Shopify, WooCommerce, Shopware, …) from your terminal.

**The CLI's commands and help are generated from the live backend tool
catalog.** It fetches `/v1/tools/schemas` and turns each tool's JSON Schema into
flags, help text, and validation — so when a tool is added or changed on the
backend, the CLI picks it up automatically with no release. This mirrors how the
[datavessel MCP server](../) already syncs its tools.

> Status: initial scaffold. It builds, type-checks, lints, and is unit-tested
> against the documented backend contracts. The default API base URL
> (`https://api.datavessel.io`) and the login token source should be confirmed
> against your environment — both are configurable (see below).

## Install

```bash
# from this directory
npm install
npm run build
npm link        # exposes `datavessel` and `dv` on your PATH

# or run without building, during development
npm run dev -- tools list
```

## Quick start

```bash
datavessel login                          # paste an access token (or --token)
datavessel tools list                     # browse the catalog
datavessel tools show run_report          # see a tool's parameters
datavessel run run_report --property-id 123 --metrics sessions --metrics users
datavessel --json run list_sites          # machine-readable output
```

## Authentication

The execute endpoint authenticates with a **Bearer JWT** issued by the
datavessel web app (or a session cookie); API-key endpoints accept an
**API key**. Get a token from <https://app.datavessel.io> (Settings → API).

Credentials are stored per-profile under `~/.config/datavessel/credentials.json`
(mode `0600`). Precedence, highest first:

1. `--token` / `--api-key` flags
2. `DATAVESSEL_TOKEN` / `DATAVESSEL_API_KEY` env vars
3. stored credential for the active profile

```bash
datavessel login --token "$JWT"           # non-interactive
DATAVESSEL_TOKEN="$JWT" datavessel whoami  # CI-friendly
datavessel logout
```

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
datavessel config set default-profile work
datavessel --profile staging config set base-url https://staging-api.datavessel.io
```

Environment overrides: `DATAVESSEL_API_URL`, `DATAVESSEL_PROFILE`,
`DATAVESSEL_CONFIG_DIR`, `NO_COLOR`.

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
