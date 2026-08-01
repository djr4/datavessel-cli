---
description: Set up datavessel end-to-end — install the CLI, add a key, verify, sync, and report what's ready
---

Set up datavessel for this user so the agent hierarchy can start working. Walk
through these steps, fixing what you can and reporting anything that needs the
user:

1. **Install** — if `datavessel --version` fails (exit 127), run
   `npm i -g datavessel-cli`. Requires Node ≥ 20.11.
2. **Authenticate** — run `datavessel --json whoami`.
   - Exit 0: already signed in; continue.
   - Exit 3: if the user provided a key or token in their message, run
     `datavessel init --api-key <key>` (or `--token <jwt>`). Otherwise ask the
     user to either paste an API key or run `datavessel login` in their own
     terminal (it opens a browser — you cannot complete that for them). Never
     echo the key back in your reply.
3. **Self-configure** — run `datavessel --json init`. It verifies the
   credential, syncs the tool catalog, and reports connected providers, tier,
   and quota in one JSON payload.
4. **Report** — summarize for the user:
   - who they're signed in as, tier, remaining tool-call quota
   - which providers are connected, and that anything missing can be
     connected at https://app.datavessel.io/settings
   - which agents are now available: `dv-analytics` and `dv-commerce-reader`
     (autonomous reads), `dv-verifier` (post-write checks), and
     `dv-commerce-ops` (store changes, always with per-change approval)
   - one example ask, e.g. "compare last month's traffic, search clicks, and
     sales" or "refund order 1042".

If any step fails, show the exact error and the fix (exit 4 = quota, exit 5 =
provider not connected) rather than a generic apology.
