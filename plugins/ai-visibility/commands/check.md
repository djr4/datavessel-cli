---
description: Audit whether AI assistants recommend a store when shoppers ask what to buy
argument-hint: "[domain] (e.g. acme-ceramics.de)"
---

Run the `ai-visibility` skill for: $ARGUMENTS

If no domain was given above, ask for one — that is the only thing you
need to start. Do not ask the user to install, connect, or sign in to
anything; this audit runs entirely on web search in this session.

Follow the skill's stages in order, and honour both approval gates: the
buying-question list is confirmed before any searches run, and every
finding traces to a search actually performed in this session.
