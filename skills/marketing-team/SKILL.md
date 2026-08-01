---
name: marketing-team
description: >-
  Run the Ecommerce Marketing Team — datavessel's server-side team for growth:
  SEO (autopilots + audits), AEO (AI-answer visibility monitoring and fix-it),
  catalogue content refresh, paid-search hygiene (waste/winners — optimization
  only), lifecycle email, and social listening. Use this when the user asks to
  "run the marketing team", grow traffic, improve AI/LLM visibility, refresh
  product content, audit ads spend, or get a marketing report. Dispatches the
  team lead via the datavessel CLI, waits, surfaces approvals, presents one
  report.
---

# Ecommerce Marketing Team

You are driving a **server-side team**: the `ecommerce_marketing_team` lead
runs in the datavessel backend and commands SEO, AEO, content, paid-hygiene,
lifecycle, and listening specialists. From the CLI you brief it, start it,
wait, relay approvals, and present its report.

Shared ground rules come from the `datavessel` skill in this plugin. The flow
is identical to the operator team — only the lead name and expectations
differ:

## Flow

```bash
datavessel --json whoami
datavessel --json run datavessel_recall --params-json '{"tags":["business-profile","setup"],"limit":1}'   # offer /datavessel:setup if empty
datavessel --json run datavessel_list_agents --params-json '{"type":"official"}'   # find "ecommerce_marketing_team"
datavessel --json run datavessel_run_agent --yes --params-json \
  '{"agent_id":"<id>","template_inputs":{"goal":"<goal or auto>","max_member_runs":"3","mode":"autopilot"}}'
datavessel --json run datavessel_get_run_output --params-json '{"run_id":"<runId>","wait_seconds":120}'   # repeat while running
```

Good goals: "grow organic traffic to the product pages", "why aren't we cited
by AI assistants?", "audit ads spend for waste", "refresh the weakest product
descriptions", `"auto"`.

Approvals: same rule as everywhere — `awaiting_approval` → show the pending
actions and the `approvalUrl`, keep polling, never bypass.

## Marketing-specific expectations (set them honestly)

- **AEO is a real lane** — the team monitors and fixes AI-answer visibility.
  Lean into it; it's differentiated.
- **Paid search is hygiene, not creation.** The specialists optimize existing
  campaigns (budgets, statuses, negatives, waste/winners). If the user asks
  to CREATE campaigns or ads, say that lane currently delivers a written,
  copy-ready recommendation — creation tools ship later. Do not attempt ad
  creation through other tools.
- **Content execution is platform-dependent**: WordPress and Shopware publish
  directly; Shopify has no blog tool yet (content comes back as drafts to
  paste).
- SEO/content writes are draft-by-default; publishing live is a human call.
