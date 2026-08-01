---
name: operator-team
description: >-
  Run the Ecommerce Operator Team — datavessel's server-side team that runs a
  store's day: platform operations (Shopify/WooCommerce/Shopware), support
  resolution, revenue protection (checkout recovery, disputes), back office,
  and reporting. Use this when the user asks to "run the operator team",
  handle daily store ops, clear the support queue, prep for a weekend/sale, or
  get an operations report. Dispatches the team lead agent via the datavessel
  CLI, waits for the cycle, surfaces write approvals, and presents one report.
---

# Ecommerce Operator Team

You are driving a **server-side team**: the `ecommerce_operator_team` lead
agent runs in the datavessel backend, dispatches its own specialist agents
(ops autopilot, support resolution, checkout recovery, dispute evidence,
invoicing, reporting), and synthesizes one report. Your job from the CLI is to
brief it, start it, wait, relay approvals, and present the result.

Shared ground rules (auth, `--json`, exit codes, discovery) come from the
`datavessel` skill in this plugin — follow it. Team-specific flow:

## 1. Preconditions (fast checks)

```bash
datavessel --json whoami                     # exit 3 → user must log in
datavessel --json run datavessel_recall --params-json '{"tags":["business-profile","setup"],"limit":1}'
```

If no setup profile exists, offer to run `/datavessel:setup` (or
`datavessel setup`) first — the team will still run without it, but will burn
turns discovering context.

## 2. Find the lead and brief it

```bash
datavessel --json run datavessel_list_agents --params-json '{"type":"official"}'
# → find the agent named "ecommerce_operator_team"; note its id
datavessel --json run datavessel_run_agent --yes --params-json \
  '{"agent_id":"<id>","template_inputs":{"goal":"<the user's goal, or auto>","max_member_runs":"3","mode":"autopilot"}}'
```

Good goals are outcome-shaped: "prep the weekend: clear support, recover
carts, protect disputes", "why did revenue dip this week?", `"auto"` to let
the lead pick. `--yes` here approves *dispatching the team* (the user asked
for the run) — never anything else.

## 3. Wait without burning turns

```bash
datavessel --json run datavessel_get_run_output --params-json '{"run_id":"<runId>","wait_seconds":120}'
```

Repeat while status is `running`. A team cycle can take several minutes —
tell the user it's working, don't spam progress.

## 4. Approvals are the user's, always

If status is `awaiting_approval`, the response includes `pendingApprovals`
and an `approvalUrl`. Show the user exactly what wants to execute (tool,
amounts, ids) and the link — approvals happen in the app/phone, not in your
session. Then keep polling. Never suggest flipping `auto_approve_writes` to
skip a money-moving approval.

## 5. Present the report

When `completed`, the run `content` is the lead's synthesized markdown
report. Present it faithfully — done / pending approval / advisory — and
keep the raw JSON out of the conversation.

## Caveats

- Member runs draw the daily agent-run quota (exit/status shows it). If the
  lead reports it stopped early on quota, say so plainly.
- GBP review-ops may be listed but gated (Google API approval) — the lead
  knows; don't retry it.
