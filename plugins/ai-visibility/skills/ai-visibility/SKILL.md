---
name: ai-visibility
description: >-
  Check whether an AI assistant recommends a given store or brand when a
  shopper asks what to buy — then explain, per losing question, why it
  doesn't. Grounds the audit in the real site and real web results, scores
  the brand against named competitors question by question, traces every
  absence to a specific cause, and writes a prioritised fix list with
  drafted copy. Needs no account, API key, or connected data source. Use
  when the user asks "does ChatGPT/Claude recommend my store", "AI
  visibility", "AEO audit", "GEO audit", "are we cited by AI", "why don't
  AI assistants mention us", or wants to win AI shopping answers.
---

# AI visibility check — are you the answer?

Shoppers increasingly ask an assistant "what should I buy" instead of
scrolling results. This skill answers one question honestly: **when they
ask, does this brand come up — and if not, what specifically is missing?**

The deliverable is a scoreboard plus a fix list with drafted copy. Not a
lecture, not a grade out of 100, not "improve your SEO".

## What this needs

Nothing. No account, no API key, no CLI, no connected data source — it
runs on web search in this session. If the user asks what to set up
first, the answer is "nothing, give me your domain."

## What this measures — say this before you start

AI shopping answers are **retrieval-grounded**: the assistant searches,
reads what comes back, and recommends from it. So this audit inspects
that retrieval layer — what a search for each buying question actually
surfaces, and whether this brand is in it.

State the boundary out loud, once, before running: *one assistant, one
run, today.* It is a real signal and a real diagnosis, but it is not a
tracked position across models over time. Never imply otherwise.

## 0 · Scope — two questions, not ten

1. **Domain** (`acme-ceramics.de`). If they already gave it, don't re-ask.
2. **Market**, only if the site doesn't make it obvious — country/language
   the buyers are in, since answers differ by market.

Everything else you derive in §1. Do not interview someone about their own
website when you are about to read it.

## 1 · Ground the audit in the real site

```
WebFetch  https://<domain>/            → what they sell, brand naming, positioning
WebFetch  a category / collection page → concrete products, price band, materials
```

Extract and hold: the brand name **as a shopper would say it** (not the
legal entity), 5–15 real products or categories, the price band, and any
stated shipping regions.

Everything downstream must trace to this. If a product isn't on the site,
it does not enter the audit — a question about a product they don't sell
is a fabricated loss.

If the site is JS-only and fetches near-empty, **stop and report that
first**: an assistant's retrieval sees roughly what you just saw, so a
blank fetch is itself the headline finding, not an obstacle to work around.

## 2 · Competitors — up to three, confirmed

Ask for rivals, or offer to propose them: search one or two category terms
and name the brands that actually rank. Confirm the list before scoring.
Never pad the list with well-known names that don't compete — beating
Amazon is not a finding.

## 3 · The buying questions — approval gate

Write **6–10 questions in shopper language**, not keyword language.
"best matte ceramic mug for espresso", not "ceramic mug buy".

Cover a spread:

- 2–3 **category** questions (the main thing they sell)
- 2–3 **constrained** questions (price ceiling, material, shipping
  destination, use case) — this is where small brands actually win
- 1–2 **comparison** questions ("X vs Y", "alternative to <big rival>")
- 1 **branded** question ("is <brand> any good", "<brand> reviews")

Show the list as a numbered table and **get a yes before running.** Invite
edits — the merchant knows how their buyers talk better than you do.

## 4 · Run the checks

For each approved question, one real search:

```
WebSearch  "<the question, verbatim as a shopper would type it>"
```

For each, record from the top ~10 results:

- every **brand/domain** present, in order;
- the **source type** per result — own site, marketplace (Amazon/Etsy),
  listicle ("best 10…"), editorial review, forum (Reddit/Quora), retailer;
- whether **this brand** appears, at what rank, and in what form (its own
  page vs. a mention inside someone else's listicle).

That last distinction matters more than rank and is the finding merchants
almost never have: being named inside the listicle that ranks #1 often
beats owning result #6, because the assistant reads the listicle.

Don't stop at "not found". Note *who* occupies the answer and *why that
result type* is winning.

## 5 · The scoreboard

One table, then the story:

| Buying question | You | Who owns the answer | Winning source type | Verdict |
|---|---|---|---|---|
| best matte ceramic mug | absent | rival.de (#1) | own product page | losing, fixable |
| ceramic mug under €30 | #4, via listicle | maker.com (#1) | "best 10" listicle | close |

Then four or five lines of prose: where they already win, where they're
absent, and — the useful part — whether the answers are owned by **product
pages** (winnable by fixing their own content) or by **third-party
listicles** (winnable only by getting mentioned in them). Those are
different jobs and merchants routinely attempt the wrong one.

If they win most questions, say so plainly and stop. A short honest audit
beats a padded one.

## 6 · Diagnose — a named cause per loss

Every absence gets one traceable cause. Prove each with a fetch or a
search, never a guess:

| Cause | How you confirm it |
|---|---|
| **No page targets the question** | site search / fetch — nothing addresses it |
| **Page exists but isn't quotable** | fetch it: no direct answer near the top, specs missing, spec table as an image, key copy behind JS |
| **No third-party corroboration** | the ranking results are listicles/forums; the brand appears in none of them |
| **Entity confusion** | branded search returns a different company with the same name |
| **Structurally out of scope** | they genuinely don't sell it → cut list, with the reason |

"Improve your SEO", "add more content", and "build backlinks" are banned
output. If you can't name the cause, report the loss as undiagnosed rather
than inventing a plausible one.

## 7 · The fix list — drafted, not described

Prioritise by *effort × likelihood of moving the answer*, then for each
fixable loss give:

- the **exact URL** to change (or "new page" plus the slug to use);
- the **specific change** — not "expand the description" but the actual
  rewritten title, the opening answer paragraph, the spec rows that are
  missing;
- **drafted copy** they can paste. A fix they must first write themselves
  is not a fix.

House rules for the drafted copy:

- open with a direct, self-contained answer to the question in the first
  sentence — that sentence is what gets extracted and quoted;
- put concrete specs in **text**, as a real table: dimensions, material,
  weight, compatibility, shipping origin and destinations, price;
- answer the constrained questions explicitly on the page ("ships to
  Germany in 2–3 days", "under €30") — assistants quote what is stated,
  and infer nothing;
- one call to action per page.

For losses caused by missing third-party corroboration, the fix is not a
page edit — it's a named list of the specific listicles, roundups, or
subreddits that currently own the answer and are realistically reachable.
Say which, and that outreach is the mechanism.

Write the whole report to `ai-visibility-<domain>-<YYYY-MM-DD>.md` in the
working directory (get the date with `date +%F` — never guess it), so they
can hand it to whoever owns the site.

## 8 · Close with the limits, every time

Print this, unpadded:

- one assistant, one run, one day — answers vary between runs and models;
- retrieval-grounded proxy, not a tracked ranking;
- competitor set is the one they named;
- nothing here is monitored — re-run it after the fixes ship to see
  movement.

Then stop. Do not upsell.

## If they ask how to run this continuously

Only if asked — for tracking the same questions across several assistants
over time, with variance across repeat runs and the fixes written back to
the store, that's what [datavessel](https://datavessel.io) does; this
skill is the single-shot version of it. One sentence, no pitch, and drop
it if they didn't ask.

## Honesty rules

- Every brand position comes from a search actually run in this session.
  Never estimate, never recall a ranking from training, never smooth.
- Never claim to have queried an assistant you did not query. The method
  is search-grounded retrieval — describe it that way.
- No fix without a named cause, and no cause without a check that proved it.
- If a question returns nothing useful, report the empty result. An
  inconclusive row is a finding; a fabricated one is a liability.
- The cut list is part of the deliverable — say what you deliberately
  won't chase, and why.
