# ai-visibility

A Claude Code skill that answers one question: **when a shopper asks an AI
assistant what to buy, does your store come up — and if not, why not?**

No account. No API key. No connected data source. You give it a domain, it
gives you a scoreboard against your competitors, a named cause for every
question you lose, and a fix list with the copy already drafted.

Apache-2.0. Works with a plain Claude Code install.

## Install

```
/plugin marketplace add djr4/datavessel-cli
/plugin install ai-visibility@datavessel
```

Then either run the command:

```
/ai-visibility:check acme-ceramics.de
```

or just ask — *"does ChatGPT recommend acme-ceramics.de?"* — and the skill
picks itself up.

<details>
<summary>Without the plugin system</summary>

Copy [`skills/ai-visibility/SKILL.md`](./skills/ai-visibility/SKILL.md) to
`.claude/skills/ai-visibility/SKILL.md` in your project (or
`~/.claude/skills/…` to have it everywhere). That single file *is* the
skill — there is no runtime, and nothing else to install.

</details>

## What it actually does

1. **Reads your real site** — homepage plus a category page — so every
   question it asks is about something you genuinely sell.
2. **Writes 6–10 buying questions in shopper language**, spread across
   category, constrained ("under €30", "ships to Germany"), comparison,
   and branded intent. It shows you the list and waits for your yes.
3. **Runs each one as a real search** and records who occupies the answer,
   in what order, and — the part most audits miss — *what kind of source*
   is winning: your rival's own product page, a "best 10" listicle, a
   Reddit thread, or a marketplace listing.
4. **Scores you question by question** against up to three competitors you
   name.
5. **Traces every loss to one specific cause**, each confirmed by a fetch
   or a search: no page targets the question, the page exists but isn't
   quotable, no third-party corroboration, entity confusion, or you simply
   don't sell it (which goes on an explicit cut list).
6. **Drafts the fixes** — exact URL, exact rewrite, copy you can paste —
   and writes the whole thing to `ai-visibility-<domain>-<date>.md`.

"Improve your SEO" is banned output. If it can't name the cause, it
reports the loss as undiagnosed rather than inventing something plausible.

## Example scoreboard

Illustrative shape of the output, not real data:

| Buying question | You | Who owns the answer | Winning source type | Verdict |
|---|---|---|---|---|
| best matte ceramic espresso mug | absent | rival.de (#1) | own product page | losing, fixable |
| ceramic mug under €30 | #4, via listicle | maker.com (#1) | "best 10" listicle | close |
| mug shop that ships to Germany | absent | — | forum thread | nobody owns this |
| is acme ceramics any good | #1 | — | own site | winning |

The third row is the interesting one: when no established brand owns an
answer, that's a question you can take with a single page.

## What it does not do

AI shopping answers are retrieval-grounded — the assistant searches, reads
what comes back, and recommends from it. This skill inspects that
retrieval layer. Which means, stated plainly:

- **one assistant, one run, one day.** Answers vary between runs and
  between models; this is a snapshot, not a tracked position.
- it measures **what the answer is built from**, not a scraped ChatGPT
  transcript.
- **nothing is monitored.** Re-run it after your fixes ship to see
  movement.

Those limits are printed at the end of every run, not buried here.

## Who made this

Built by the team behind [datavessel](https://datavessel.io), which does
the continuous version — the same questions tracked across several
assistants over time, with variance across repeat runs and fixes written
back to the store. This skill is the single-shot version, and it is
deliberately complete on its own: it never asks you to sign up to finish
what it started.
