---
name: builder-team
description: >-
  Run the Store Expansion Builder — datavessel's server-side team that builds
  new surface for an EXISTING store: SEO landing pages and CMS/campaign pages
  (executes on Shopware, draft-by-default), catalogue content depth, clean SEO
  URLs; on Shopify/WooCommerce it delivers copy-ready build plans. Use this
  when the user asks to "run the builder team", build landing/campaign pages,
  expand a category or market, or deepen product content. Dispatches the team
  lead via the datavessel CLI, waits, surfaces approvals, presents one report.
---

# Store Expansion Builder

You are driving a **server-side team**: the `store_expansion_builder_team`
lead runs in the datavessel backend. It expands stores that already trade —
grounded in demand data — via Shopware page/CMS builders, SEO specialists,
and catalogue content refreshers.

Shared ground rules come from the `datavessel` skill in this plugin. Flow is
identical to the other teams — find the lead named
`store_expansion_builder_team`, dispatch with a goal, wait with
`wait_seconds`, surface approvals, present the report:

```bash
datavessel --json whoami
datavessel --json run datavessel_recall --params-json '{"tags":["business-profile","setup"],"limit":1}'   # offer /datavessel:setup if empty
datavessel --json run datavessel_list_agents --params-json '{"type":"official"}'
datavessel --json run datavessel_run_agent --yes --params-json \
  '{"agent_id":"<id>","template_inputs":{"goal":"<goal or auto>","max_member_runs":"3","mode":"autopilot"}}'
datavessel --json run datavessel_get_run_output --params-json '{"run_id":"<runId>","wait_seconds":120}'   # repeat while running
```

Good goals: "build landing pages for our top rising search queries", "expand
the <category> line with campaign pages", "deepen the weakest product pages",
`"auto"`.

## Builder-specific expectations (be honest up front)

1. **Existing stores only.** The team grounds every build in traffic and
   sales data. If the user has no trading store connected, say the team can't
   help yet — don't improvise a from-scratch store build.
2. **Shopware executes; Shopify/Woo advise.** On Shopware the team creates
   real CMS/landing pages (always `active: false` — a human publishes). On
   Shopify/WooCommerce there are no page/collection/theme write tools yet, so
   those lanes return a concrete, copy-ready build plan. Present it as the
   deliverable it is, clearly labelled — never attempt those writes through
   escape hatches.
3. **Draft-by-default is non-negotiable.** If the user asks the team to
   publish live unattended, explain that publishing is a human step by
   design.
