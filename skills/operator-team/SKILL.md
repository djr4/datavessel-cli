---
name: operator-team
description: >-
  Run the Ecommerce Operator Team — a store's day handled in one command:
  platform operations (Shopify/WooCommerce/Shopware), support resolution,
  revenue protection (checkout recovery, disputes), and reporting. Use this
  when the user asks to "run the operator team", handle daily store ops,
  clear the support queue, prep for a weekend/sale, or get an operations
  report. YOU are the team lead: you pick the specialists from the live
  datavessel roster, dispatch them, relay approvals, and synthesize one report.
---

# Ecommerce Operator Team

**You are the team lead.** datavessel provides the specialist agents; you
decide which of them serve the user's goal, run them, watch them, and write
the one report at the end. Every decision you make is visible in this
conversation — that is the point. (The old server-side `*_team` lead agents
are retired; do not look for them.)

Shared ground rules (auth, `--json`, exit codes, discovery) come from the
`datavessel` skill in this plugin — follow it.

## 1. Preconditions (fast checks)

```bash
datavessel --json whoami                     # exit 3 → user must log in
datavessel --json run datavessel_recall --params-json '{"tags":["business-profile","setup"],"limit":1}'
```

If no setup profile exists, offer to run `/datavessel:setup` first — the run
works without it, but burns turns rediscovering context (store URLs, brand).

## 2. Read the roster, pick your specialists

```bash
datavessel --json run datavessel_list_agents --params-json '{}'
```

Match by `name` against the live roster — prefer these for operator work,
picking **2–3 that serve the goal** (more burns quota without adding signal):

- `order_desk_shopify` / `order_desk_woocommerce` / `order_desk_shopware` —
  the daily order sweep: fulfillments, refunds, cancellations, address fixes
- `support_resolution_shopify` / `support_resolution_woocommerce` — tickets
  resolved against real order data (needs Gorgias connected)
- `checkout_recovery_shopify` — abandoned checkouts into the recovery flow
- `dispute_evidence_shopify` — chargeback evidence packages
- `csat_rescue` — bad satisfaction scores, rescued (needs Gorgias)
- `shopify_revenue_alert` / `woocommerce_revenue_alert` — is revenue off?
- `ga_traffic_health_check` / `client_report` — the numbers and the report

Names drift; if one is missing, match by title/category from the roster
instead of failing. Pick per the user's platform (their connected stores are
in the setup profile or `datavessel --json run datavessel_list_agents` output
categories).

## 3. Dispatch — sequentially or in bounded parallel

```bash
datavessel --json run datavessel_run_agent --yes --params-json \
  '{"agent_id":"<id>","instructions":"<the user's goal, in one line>","template_inputs":{...}}'
```

- Fill `template_inputs` from the setup profile (store URLs etc. — each
  agent's inputs are in the roster entry; ask the user only for what you
  truly cannot infer).
- Independent specialists may be started together; **never more than 3
  concurrent runs** — member runs draw the daily quota.
- `--yes` approves *starting the run* (the user asked for this). It approves
  nothing the agent does.

## 4. Wait without burning turns

```bash
datavessel --json run datavessel_get_run_output --params-json '{"run_id":"<runId>","wait_seconds":120}'
```

Poll each run while `running`. Cycles take minutes — tell the user it's
working, don't spam progress.

## 5. Approvals are the user's, always

`awaiting_approval` → the response carries `pendingApprovals` and an
`approvalUrl`. Show exactly what wants to execute (tool, amounts, ids) and
the link — approvals happen in the app/phone, not in your session. Keep
polling after. **Never suggest flipping `auto_approve_writes`** to skip a
money-moving approval; the sign-off model is the product.

## 6. Synthesize the one report

You write it — that's the lead's job. For each specialist: what it did /
what waits on approval / what it advises, with run ids. One coherent
markdown report; keep the raw JSON out of the conversation.

## Caveats

- Member runs draw the daily agent-run quota; if you stop early because of
  it, say so plainly.
- If a needed platform isn't connected (e.g. Gorgias for support), say which
  lane is unavailable instead of improvising around it.
