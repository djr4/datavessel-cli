---
name: topical-authority
description: >-
  Build or repair a site's topical structure from real Search Console data:
  audit queries and pages, group demand by intent, propose a topical map
  (pillars + clusters with an explicit do-not-chase list), then — after the
  user approves the map — write, publish, interlink, verify, and baseline the
  content via the connected WordPress or Shopware CMS. Use this when the user
  asks to "build topical authority", "make a topical map", "fix our content
  structure", "do pillar and cluster content", "improve our blog SEO", or has
  scattered posts that earn impressions but no clicks.
---

# Topical authority — from scattered posts to owned topics

You are running the workflow that turns a content graveyard into
pillar-and-cluster wheels: demand audit → topical map → (approval gate) →
build → publish → verify → measure. The deliverable is live, interlinked
content plus a baseline file — not a strategy deck.

Shared ground rules come from the `datavessel` skill in this plugin —
especially: **discover before calling** (`tools show <name>` for exact
flags), `--json` for anything you parse, and **writes ask first** (never
`--yes` on a write unless the user approved that specific change).

## 0 · Session + memory

```bash
datavessel --json whoami                                   # exit 3 → user must `datavessel login`
datavessel --json run datavessel_recall --params-json \
  '{"tags":["topical-authority","business-profile","setup"],"limit":3}'
```

A prior topical map profile (property, platform, pillars, baselines) means
this is a **maintenance run**: skip to §2, diff against the stored
baseline, and propose only deltas (new clusters, retitles, refreshes).

## 1 · Interview — four questions, no more

1. **Search Console property** (`sc-domain:example.com` — offer
   `list_search_console_sites`).
2. **Publishing surface** — WordPress (`wp_*` tools) or Shopware CMS
   (`sw_admin_*`). Shopify has no blog tool: deliverable becomes
   copy-ready drafts, say so up front.
3. **What does the business sell, to whom?** One sentence — it anchors
   intent classification and the cut list.
4. **Protected pages** — anything currently earning clicks that must not
   be restructured. Also derive this yourself in §2; union both lists.

## 2 · Audit — read-only, four pulls

```bash
datavessel --json run get_top_queries        --params-json '{"site_url":"<prop>","days":90,"limit":100}'
datavessel --json run get_top_pages          --params-json '{"site_url":"<prop>","days":90,"limit":50}'
datavessel --json run get_rising_queries     --params-json '{"siteUrl":"<prop>","days":28,"minImpressions":5}'
datavessel --json run analyze_keyword_opportunities --params-json '{"site_url":"<prop>","days":90,"min_impressions":30}'
```

Classify into four buckets and show the user all four:

- **Demand pools** — query families with impressions but poor positions
  (pages 3–8). These become pillars/clusters.
- **Click-earners** — pages that already convert impressions to clicks.
  These get *protected*: minimal edits, never a slug or opening-paragraph
  change.
- **Intent traps** — volume that belongs to a different audience (check
  sibling queries: a "productivity" query surrounded by call-center terms
  is not your buyer). These go on the do-not-chase list *with the reason*.
- **Fan-out noise** — verbose machine-generated queries at high position
  with ~0% CTR. Report them as AI-retrieval signal; never build for them.

## 3 · The map — MANDATORY approval gate

Propose the topical map as a table the user can veto line by line:

- **Pillars** (usually 1–3): head term, target ~2,000+ words, one
  paragraph per subtopic, links out to every cluster.
- **Clusters** (6–8 per pillar, 800–1,200 words): ONE long-tail question
  each ("how much does X cost", "is X worth it", "why did my X drop").
- **Existing posts mapped in** as clusters via retrofit links — never
  rewritten wholesale.
- **Cannibalization check**: before assigning any target query, list live
  slugs (`wp_list_posts`) — if a live URL already owns the query, the new
  page takes an adjacent head term and the live page becomes the cluster.
- **The cut list**, with reasons, so the user knows what you deliberately
  won't build.

**Stop here.** Publishing a content program is a strategy decision. Do not
write a word until the user approves the map (edits welcome). Store the
approved map before continuing.

## 4 · Build — drafts only

Author every post to the template, then create as **drafts**:

- Opening paragraph = a direct, bolded, self-contained answer (structured
  for AI-citation extraction). Never buried.
- Every cluster links its pillar **in the first 100 words** with an
  exact-match anchor of the pillar's head term.
- Pillar links every cluster from body text; sibling links only where
  genuinely relevant; exactly **one** product CTA per post.
- Tables with 3+ columns ship wrapped:
  `<div style="overflow-x:auto">` + `border-collapse` + bordered, padded
  cells (themes rarely style tables; phones crush them).
- Featured image per post (`datavessel_search_stock_images` →
  `wp_upload_media` → set `featured_media`), alt text carrying the
  keyphrase.

```bash
datavessel --json run wp_create_post --params-json \
  '{"title":"…","slug":"<exact-slug-from-map>","status":"draft","excerpt":"<meta description>","content":"<html>"}'
```

## 5 · Publish — gated, ordered

With the user's go: pillar first, then its clusters (a pillar pointing at
404s for months wastes crawl signal; days are fine). Retrofit links into
live posts are **additive only** — insert after the opening paragraph,
never reword it, never touch a slug, and on click-earners change nothing
else. Each publish/retrofit is a write: confirmation flow applies.

## 6 · Verify — the graph, not vibes

Fetch every touched post and assert: all statuses correct; pillar body
contains every cluster slug; every cluster's first ~900 chars contain the
pillar slug; retrofit links present; no slug changed. Report the edge
list. A missing edge is a bug to fix now, not a note.

## 7 · Baseline + schedule

```bash
datavessel --json tools list --search "remember"           # discover the memory write tool
# store: property, platform, map (pillars/clusters/slugs), per-query baseline
# positions, cut list, date — tag "topical-authority"
datavessel --json tools show datavessel_create_schedule    # offer a monthly re-run
```

Close with the loop: re-pull §2 monthly; retitle anything with
impressions and ~0% CTR at position ≤ 20; propose new clusters only for
queries that actually appear. Offer: "Want this re-audited monthly, with
only the deltas surfaced?"

## Honesty rules

- Positions and impressions come from real pulls — never estimated,
  never extrapolated into promises ("this will rank #1" is banned).
- The do-not-chase list is part of the deliverable: volume without a
  path to this business's buyer is named and skipped, with the reason.
- Word counts are checked, not eyeballed; a 1,400-word "pillar" is
  reported as under target, not rounded up.
- Every claim in authored content that states a price, plan, or product
  fact is read from the live source (pricing page, catalog), not memory.
- Costs are the user's LLM spend — state the post count before writing
  20 posts.
