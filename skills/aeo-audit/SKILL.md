---
name: aeo-audit
description: >-
  Run a full AEO (AI-answer visibility) audit for an e-commerce store from
  the terminal: interview the merchant (shop domain, focus, competitors),
  derive the buying questions shoppers actually ask ChatGPT/Claude, run
  visibility checks against competitors, present a scoreboard of who owns
  each answer, then propose concrete product-content fixes behind the
  user's sign-off — and remember the setup so the next audit is one line.
  Use this when the user asks for an "AEO audit", "AI visibility check",
  "are we cited by ChatGPT/Claude", "why don't AI assistants recommend my
  store", or wants to win AI answers for their products.
---

# AEO audit — is your store the answer?

You are running a merchant-facing audit: when shoppers ask ChatGPT or
Claude what to buy, is this store in the answer — and if not, what fixes
that? The deliverable is a scoreboard plus fixes waiting for sign-off,
not a lecture.

Shared ground rules come from the `datavessel` skill in this plugin —
especially: **discover before calling** (`tools show <name>` for exact
flags/enums), `--json` for anything you parse, and **writes ask first**
(never `--yes` on a write unless the user explicitly approved that
specific change).

## 0 · Session + memory

```bash
datavessel --json whoami                                   # exit 3 → user must `datavessel login`
datavessel --json run datavessel_recall --params-json \
  '{"tags":["aeo-audit","business-profile","setup"],"limit":3}'
```

If a prior aeo-audit profile exists (domain, competitors, queries), show
it and ask only "same as last time?". If nothing is stored, offer
`/datavessel:setup` for the basics, then interview.

## 1 · Interview — three questions, no more

1. **Shop domain** (e.g. `acme-ceramics.de`) — this is the brand the
   audit scores.
2. **Focus** — bestsellers / one category / "paste your own questions".
3. **Competitor shops** — up to 3 domains; or offer "find them for me"
   (from the store's categories, propose likely rivals and confirm —
   never invent obscure ones).

## 2 · Derive the buying questions

If a store is connected, ground the questions in the real catalog:

```bash
datavessel --json tools show get_products        # discover flags first
datavessel --json run get_products --limit 20    # names, categories, bestsellers if available
```

Write ~6–10 **shopper-phrased** queries — how a buyer talks, not SEO
keywords: "best matte ceramic mug", "minimalist coffee mug shop that
ships to Germany", "linen tote bag under €40". Mix product-level and
category-level. **Show the list and get a yes before running** — each
query costs real LLM runs.

## 3 · Run the visibility checks

```bash
datavessel --json tools show aeo_check_visibility   # exact enums for llms/runs
# then, per confirmed query:
datavessel --json run aeo_check_visibility --params-json \
  '{"query":"best matte ceramic mug","brands":["<shop>","<rival1>","<rival2>"],"llms":[...],"runs":...}'
```

Use the schema's defaults unless the user asked for depth; tell the user
how many total runs you're about to spend (queries × llms × runs) before
starting. Also check `aeo_get_rankings` / `aeo_get_query_detail` for any
existing tracked history worth folding into the report.

## 4 · The scoreboard

Present one table, then the story:

| Buying question | You | Best rival | Verdict |
|---|---|---|---|
| best matte ceramic mug | cited #2 | rival.de #1 | close — fixable |
| linen tote bag germany | absent | rival.de #1 | losing this answer |

Then three lines, plain language: where the store wins, where it's
absent, which absences look fixable (product-content problems) vs.
structural (no product in that category). Never pad; if the store wins
everything, say so and stop.

## 5 · Fixes — behind sign-off, always

For each losing/absent query that traces to product content:

```bash
datavessel --json run aeo_list_recommendations   # discover flags first
datavessel --json run get_product_details ...    # read the current page
```

Propose the concrete rewrite (title, description, specs/FAQ — the
content AI assistants actually quote). Show the diff-style before/after
in the terminal, then — only on an explicit yes per product —

```bash
datavessel --json run update_product ...         # write: confirmation flow, never blanket --yes
```

The audit ends with fixes executed or queued for sign-off, not with a
report file.

## 6 · Remember + schedule

```bash
datavessel --json tools list --search "remember"           # discover the memory write tool
# store: domain, competitors, confirmed queries, date, wins/losses summary — tag "aeo-audit"
datavessel --json tools show datavessel_create_schedule    # offer weekly re-run (e.g. Mondays)
```

Close by offering: "Want this to run every Monday and only ping you when
a position changes?"

## Honesty rules

- Positions come from real runs — never estimate or smooth results.
- If an AI's answers vary across runs, report the spread, not the best.
- No fix without a named cause; "improve your SEO" is banned output.
- Costs are the user's LLM spend — state run counts before spending.
