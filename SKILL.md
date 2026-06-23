---
name: datavessel
description: >-
  Use the datavessel CLI (`datavessel` / `dv`) to run 100+ analytics and commerce
  tools — GA4, Google Search Console, Google/Meta Ads, Shopify, WooCommerce,
  Shopware — from the terminal. Use this whenever the user wants to query or
  modify data in a connected datavessel source, inspect available tools, or check
  account usage. The tool catalog and per-tool flags are generated from the live
  backend, so prefer discovering tools at runtime over hardcoding tool names.
---

# datavessel CLI skill

The `datavessel` CLI is a thin, self-describing client over the datavessel
backend. **Its commands and tool flags are generated from the live tool
catalog**, so always discover capabilities at runtime rather than assuming them.

This file doubles as a Claude Code skill (the YAML frontmatter above) and a
Cursor rule (point Cursor at it, or copy into `.cursor/rules/datavessel.mdc`).

## Golden rules for agents

1. **Discover, don't guess.** List/inspect tools before calling them; tool names
   and parameters can change.
2. **Use `--json` for anything you parse.** Put it *before* the subcommand:
   `datavessel --json run <tool> …`. Human-readable output goes to stdout/stderr
   and is not stable.
3. **Check auth first** with `datavessel whoami`. If it fails with exit code 3,
   the user must run `datavessel login` (opens a browser) — you cannot complete
   that for them.
4. **Write tools modify data.** They are marked `access: write` and require
   confirmation. Only pass `--yes` when the user has clearly asked to make the
   change.

## Core workflow

```bash
# 1. Confirm who we are (exit 3 => not logged in)
datavessel --json whoami

# 2. Find the right tool
datavessel --json tools list --search "search console"
datavessel --json tools list --provider google_analytics --access read

# 3. Inspect its parameters (names, types, required)
datavessel --json tools show run_report

# 4. Run it (flags come from the tool's schema; --json for parseable output)
datavessel --json run run_report --property-id 123 --metrics sessions --metrics users --limit 10
```

## Passing parameters to `run`

Flags are derived from each tool's JSON Schema:

- Scalars: `--property-id 123` or `--property-id=123`
- Repeat for arrays: `--metrics sessions --metrics users`
- Booleans: `--active` / `--no-active`
- Always-available escape hatches (handy when building params programmatically):
  - `--param key=value` (repeatable)
  - `--params-json '{"propertyId":"123","metrics":["sessions"]}'`

`datavessel run <tool> --help` prints the tool's parameters.

## Auth, profiles, environments

- Login is browser-based: `datavessel login`. For CI, pass `--token <jwt>` or set
  `DATAVESSEL_TOKEN`. Sessions auto-refresh; you normally log in once.
- `datavessel providers` lists which sources the user has connected. If a tool
  fails with exit code 5 (`not connected`), tell the user to connect that
  provider at https://app.datavessel.io/settings — you can't connect it for them.
- `datavessel usage` shows tier and remaining tool-call quota (exit code 4 =
  quota exceeded).
- Override targets with `--profile <name>`, `DATAVESSEL_API_URL`,
  `DATAVESSEL_APP_URL`.

## Exit codes (branch on these in scripts)

| Code | Meaning | Agent action |
| --- | --- | --- |
| 0 | success | continue |
| 2 | usage error (bad/missing flag) | fix flags; run `tools show <tool>` |
| 3 | not authenticated | ask user to run `datavessel login` |
| 4 | quota exceeded | stop; tell user to upgrade/wait |
| 5 | provider not connected | ask user to connect the source |
| 1 | other error | read stderr; surface to user |

## Don'ts

- Don't hardcode the tool list — it's served from the backend and grows over time.
- Don't add `--yes` to write tools unless the user explicitly approved the change.
- Don't parse human-readable tables; use `--json`.
