---
name: datavessel
description: >-
  Use the datavessel CLI (`datavessel` / `dv`) to run 200+ analytics and commerce
  tools — GA4, Google Search Console, Google/Meta Ads, Shopify, WooCommerce,
  Shopware — from the terminal: reads, and order operations (fulfillments,
  refunds, cancellations, order edits, product creation). Use this whenever the
  user wants to query or modify data in a connected datavessel source, inspect
  available tools, or check account usage. The tool catalog and per-tool flags
  are generated from the live backend, so prefer discovering tools at runtime
  over hardcoding tool names.
---

# datavessel CLI skill

The `datavessel` CLI is a thin, self-describing client over the datavessel
backend. **Its commands and tool flags are generated from the live tool
catalog**, so always discover capabilities at runtime rather than assuming them.

This file doubles as a Claude Code skill (the YAML frontmatter above) and a
Cursor rule (point Cursor at it, or copy into `.cursor/rules/datavessel.mdc`).

## Install

The CLI is published on npm. If `datavessel` is not on PATH (commands fail with
`command not found` / exit code 127), install it once:

```bash
npm i -g datavessel-cli   # installs the `datavessel` and `dv` commands; needs Node >= 20
```

Then verify:

```bash
datavessel --version
```

If a global install isn't possible (no permissions, no global npm), fall back to
`npx datavessel-cli <args>` — but prefer the global install so subsequent calls
are fast.

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
# 0. Ensure the CLI is installed (skip if `datavessel --version` works)
command -v datavessel >/dev/null || npm i -g datavessel-cli

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

## Gathering data in parallel (subagents)

When a task needs data from **several independent sources** — e.g. GA4 sessions
*and* Search Console clicks *and* Shopify orders for the same period — fan the
work out across parallel subagents instead of running the calls one after
another in your own context. Each subagent owns one scoped slice, runs its own
`discover → show → run` against the CLI, and returns a **distilled summary, not
the raw JSON**. The bulky tool output stays in the subagent; only the conclusion
comes back to you. This is both faster (calls overlap) and far cheaper on tokens
(the orchestrator never sees the raw dumps).

```text
Orchestrator: "Compare last month's traffic, search, and sales."
  ├─ subagent A → datavessel --json run run_report …            → "Sessions: 48,210 (+6%)"
  ├─ subagent B → datavessel --json run query_search_analytics… → "Clicks: 12,034 (+2%)"
  └─ subagent C → datavessel --json run list_orders …           → "Orders: 1,118 ($92,400)"
Orchestrator merges the three one-line results.
```

Rules for fanning out:

1. **Warm auth once, then fan out.** Run a single `datavessel --json whoami`
   (or any one call) in the orchestrator *before* spawning subagents. The
   session's access token is short-lived and **the refresh rotates it** — if
   many `dv` processes refresh at once they stampede and can corrupt the stored
   session. One warm-up call refreshes the on-disk token so the parallel
   children all reuse it without refreshing.
2. **Only parallelize independent reads.** If step B needs step A's output
   (e.g. list sites → then query each site), keep those sequential; parallelize
   only across the independent fan-out (e.g. one subagent per site).
3. **Never parallelize writes.** Write tools (`access: write`) need explicit
   per-change approval and must run deliberately, one at a time — not fanned out.
4. **Mind the shared quota.** Parallel calls draw down the same tool-call quota
   faster. If any subagent hits exit code 4, stop fanning out and surface it.
5. **Each subagent uses `--json` and returns only what's needed** — a number, a
   short table, a verdict. Don't pass raw catalog or tool output back up.

## Passing parameters to `run`

Flags are derived from each tool's JSON Schema:

- Scalars: `--property-id 123` or `--property-id=123`
- Repeat for arrays: `--metrics sessions --metrics users`
- Booleans: `--active` / `--no-active`
- Always-available escape hatches (handy when building params programmatically):
  - `--param key=value` (repeatable)
  - `--params-json '{"propertyId":"123","metrics":["sessions"]}'`

`datavessel run <tool> --help` prints the tool's parameters.

## Order operations (money-moving writes)

Shopify, WooCommerce and Shopware expose the full order lifecycle — fulfill,
refund, cancel, edit, create products. These are `access: write` tools with
real-world consequences, so on top of the golden rules:

1. **Refunds are two-step on Shopify.** `calculate_refund` is a READ (dry-run):
   it returns the exact suggested amounts and the `transactions` array. Show
   those numbers to the user, then pass them to `create_refund`. Never compute
   refund amounts yourself.
2. **Fulfillment needs fulfillment orders on Shopify.** `get_fulfillment_orders`
   (read) first — `create_fulfillment` takes fulfillment_order ids, not bare
   line items.
3. **Shopware order ops are state transitions.** `sw_admin_get_order_transitions`
   (read) returns the delivery/transaction ids and which transitions are legal
   right now — only propose those. A Shopware "refund" transitions the payment
   state; whether money moves depends on the shop's payment provider. Say so.
4. **WooCommerce refunds move gateway money** when `--api-refund` is true (the
   default). Check `wc_get_refunds` first so you never double-refund.
5. **Never invent tracking numbers, amounts, or addresses.** They come from the
   order data or the user — nowhere else.
6. **Products create as drafts** (Shopify `status: draft`, Woo `status: draft`,
   Shopware `active: false`) unless the user explicitly asks to publish live.

Example — a safe refund conversation on Shopify:

```bash
datavessel --json run get_order_details --order-id 1042
datavessel --json run calculate_refund --order-id 1042 \
  --params-json '{"refund_line_items":[{"line_item_id":"111","quantity":1,"restock_type":"return"}],"shipping":{"full_refund":true}}'
# ...show the user the calculated total and transactions, get their OK...
datavessel --json run create_refund --order-id 1042 --yes \
  --params-json '{"refund_line_items":[...],"shipping":{"full_refund":true},"transactions":[...from calculate...]}'
```

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
| 127 | `datavessel` not found | install it: `npm i -g datavessel-cli` (see Install) |
| 1 | other error | read stderr; surface to user |

## Don'ts

- Don't hardcode the tool list — it's served from the backend and grows over time.
- Don't add `--yes` to write tools unless the user explicitly approved the change.
- Don't parse human-readable tables; use `--json`.
