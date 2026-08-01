---
description: Set up datavessel end-to-end — install, add a key, connect sources, and teach the agents your stack by asking a few questions
---

Set up datavessel for this user so the agents and teams can start working with
zero further configuration. Work through these steps, fixing what you can and
asking the user only what discovery can't answer:

1. **Install** — if `datavessel --version` fails (exit 127), run
   `npm i -g datavessel-cli`. Requires Node ≥ 20.11.
2. **Authenticate** — run `datavessel --json whoami`.
   - Exit 0: signed in; continue.
   - Exit 3: if the user provided a key or token, run
     `datavessel init --api-key <key>` (or `--token <jwt>`). Otherwise ask
     them to paste an API key or run `datavessel login` in their own terminal
     (browser flow — you cannot complete it for them). Never echo the key back.
3. **Sync & check connections** — run `datavessel --json init`, then
   `datavessel --json providers`. For core sources that aren't connected
   (google_analytics, google_search_console, their store platform, slack),
   give the user the URL — https://app.datavessel.io/settings — say in one
   line what each source powers, and wait for them to tell you they've
   connected before re-checking. You cannot connect sources for them.
4. **Discover, then ask** — figure out as much as possible yourself and ask
   only to disambiguate:
   - GA4: `datavessel --json run get_account_summaries` → if several
     properties, ask which is the default; note its numeric property_id.
   - Search Console: `datavessel --json run list_sites` → if several sites,
     ask which; note the exact siteUrl (may be `sc-domain:`).
   - Store: infer the platform from connected providers; ask for the store
     URL if you need it and can't discover it.
   - Slack: ask which channel team reports should go to (suggest #ecommerce).
   - Ask one open question: "Anything your agents should always know about
     the business?"
5. **Persist for the teams** — save one team-memory entry so every team lead
   finds it on its first recall. First check for an existing one:
   `datavessel --json run datavessel_recall --params-json '{"tags":["business-profile","setup"],"limit":1}'`
   - If an entry exists, update it:
     `datavessel --json run datavessel_update_entry --yes --params-json '{"id":"<id>","content":"<profile>"}'`
   - Else create it:
     `datavessel --json run datavessel_remember --yes --params-json '{"content":"<profile>","type":"note","tags":["business-profile","setup","team:operator","team:marketing","team:builder"]}'`
   The content should name facts the way member inputs do, e.g.:
   `Business setup profile: Store platform: shopware; Store URL (shop_url): …; GA4 property_id: …; Search Console site_url: …; Slack report channel: …; Notes: …`
   (These two writes are part of setup the user asked for — `--yes` is
   appropriate here and only here.)
6. **Report** — summarize: who they're signed in as, tier and remaining
   quota, which sources are connected (and where to connect the rest), what
   was saved for the teams, and which agents are ready: `dv-analytics` and
   `dv-commerce-reader` (autonomous reads), `dv-verifier` (post-write
   checks), `dv-commerce-ops` (store changes, per-change approval). Suggest a
   first ask: "compare last month's traffic, search clicks, and sales" — or
   running the Ecommerce Operator Team from the app with goal "auto".

If any step fails, show the exact error and the fix (exit 4 = quota, exit 5 =
provider not connected) rather than a generic apology.
