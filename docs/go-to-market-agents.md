# Go-to-market: the datavessel agent hierarchy

Working plan for launching the agent hierarchy shipped with `datavessel-cli`
(plugin v0.2.0). Owner: djr4. Status: draft.

## Positioning

**One-liner:** *A team of agents for your store and your analytics — install,
add a key, and it configures itself. Reads run free. Writes ask first.*

What's actually new (vs. "another AI integration"):

1. **Hierarchy, not a chatbot.** Four purpose-built agents with a division of
   labour: autonomous read agents that fan out in parallel, a write agent that
   requires per-change human approval, and a verifier that independently
   confirms every change landed.
2. **Structural safety, not prompt promises.** Read agents are tool-restricted
   to `access: read` — "autonomous" never means "can refund an order."
3. **Zero-config activation.** `datavessel init --api-key <key>` (or
   `/datavessel:setup` in Claude Code) signs in, syncs the catalog, and
   reports what's connected in one shot. No YAML, no per-tool setup.
4. **Always current.** Agents discover tools from the live catalog — new
   backend tools appear without a plugin or CLI release.

Message discipline (matches the site): "Reads run free. Writes ask first.",
"You pilot. Agents do the work.", "bring your own AI key", **200+** tools
(never 100+).

## Who it's for

| Persona | Entry point | First win |
| --- | --- | --- |
| Dev/technical founder running a shop | Claude Code plugin | "Compare last month's traffic, search, and sales" answered in one ask |
| Agency / freelancer managing client stores | CLI + profiles | Same question across N clients via parallel read agents |
| Ops engineer automating reporting | `init --api-key` in CI | Scheduled cross-source report with zero token babysitting |
| Existing datavessel MCP/web users | `/datavessel:setup` | Store *operations* (refunds/fulfillments) with approval flow — beyond what chat UIs make comfortable |

## Install & setup (the story we tell everywhere)

**Claude Code (flagship path):**

```
/plugin marketplace add djr4/datavessel-cli
/plugin install datavessel@datavessel
/datavessel:setup        ← give it your API key; it does the rest
```

**Terminal / anywhere:**

```bash
npm i -g datavessel-cli
datavessel init --api-key <key>    # or `datavessel login` for the browser flow
```

**Cursor / other agents:** SKILL.md as a rule (portable knowledge layer; the
hierarchy itself is Claude-Code-specific — say so honestly).

**Headless / Agent SDK / CI:** shell tool + `DATAVESSEL_TOKEN` +
`datavessel --json init` for a machine-readable readiness report.

Activation funnel to instrument: install → `init` success → first read tool
call → ≥1 provider connected → first approved write. `init` is the funnel's
single most important event; everything upstream of it should be one command.

## Channels & launch sequence

**Phase 0 — ship (prereqs, this branch):**
- [ ] Publish `datavessel-cli@0.2.0` to npm (includes refresh-lock fix)
- [ ] Tag the repo so the plugin marketplace serves v0.2.0
- [ ] Landing live: `/cli` hierarchy + setup sections, `/agents` cross-link
- [ ] 60–90s screen capture: install → `/datavessel:setup` → parallel read
      fan-out → an approved refund → verifier confirmation. This clip is the
      campaign asset; everything links to it.

**Phase 1 — owned & developer channels (launch week):**
- Blog post on blog.datavessel.io: "An agent hierarchy for your store" —
  the safety architecture is the story (approval-gated writes, verifier,
  tool-restricted autonomy), not the agent count.
- GitHub release notes + README badges; npm keywords (`claude-code`,
  `claude-plugin`, `agents`).
- Claude Code plugin marketplace listing; MCP/agent directories where the
  MCP server is already listed.
- Email existing datavessel users: "your account now comes with a team of
  agents — here's the one command."

**Phase 2 — communities & proof (weeks 2–4):**
- Show HN / Product Hunt with the demo clip; lead with the refund-with-
  approval flow (it's the demo people don't expect to be safe).
- r/shopify, r/ecommerce, WooCommerce & Shopware dev communities: focus on
  order-desk pain (refund choreography done right), not AI hype.
- 2–3 recorded real-workflow case studies with agency users (they multiply
  reach: one agency = many stores).

**Phase 3 — compounding:**
- SEO pages per workflow ("automate Shopify refunds safely", "GA4 + Search
  Console + orders in one report") reusing use-cases page machinery.
- Partner/agency program; template packs of orchestrator prompts.

## Pricing tie-in

No new SKU. The hierarchy is free, open-source (Apache-2.0) distribution that
drives paid usage: tool calls draw on existing tier quotas, and BYOK ("bring
your own AI key") stays the model for the LLM side. Watch whether parallel
fan-out pushes light users into quota — if so, that's the upgrade prompt
(exit code 4 already surfaces it in-agent).

## Metrics

- npm weekly downloads; plugin installs
- `init` completions (headless vs. browser) — activation
- % of tool calls arriving via CLI user-agent; read:write ratio
- Write approvals per week (proxy for trust) and verifier mismatch rate
  (proxy for reliability — should be ~0)
- Providers connected per activated user

## Risks & honest caveats

- **Hierarchy is Claude Code-only today.** Cursor gets the skill, not the
  agents. Don't blur this in copy.
- **Write safety is currently client-side** (agent prompts + confirmation
  flow). The strong version is backend-enforced read-only scoped keys so
  autonomy is enforced server-side. That's the top follow-up feature and a
  second launch ("read-only keys for autonomous agents").
- **Quota stampedes:** parallel fan-out multiplies call volume; messaging and
  agent prompts must keep surfacing exit code 4 gracefully.

## Backlog spawned by this launch

1. Backend: mint read-only scoped API keys (`access: read` enforced
   server-side); surface in app settings.
2. `datavessel init --create-key` handshake so setup never pastes a raw JWT.
3. Scheduled/recurring runs from the CLI (ties into existing schedules tier
   limits).
4. Windows/pnpm install validation for the plugin path.
