---
title: Make the Loft conversation-first
created: 2026-10-24
---

A typed conversation that creates new pages and updates existing ones as drafts. Replies say in plain words what changed ("What I did") and end with a result card holding a preview and a Publish button. Drafts pass the house rules before you see them, missing facts become placeholders like `[PRICE]`, and multi-step requests show a plan first. The AI never publishes: Publish uses the existing publish action. Write the AI's tools as plain backend functions with zod inputs. Each conversation gets its own route so it can be resumed.

- Consider `@convex-dev/agent` for threads, streaming and tool calls. The choice needs an ADR.

Done when you can ask for a new page and for a change to an existing one, preview both, and publish them from the conversation.

Related: [Loft design spec §7](../../docs/design/loft.md#7-components), [§9](../../docs/design/loft.md#9-behaviour), [SPEC §11](../../SPEC.md#11-later-specs-outlines), [add-loft-ai-editing](add-loft-ai-editing.md), [build-loft-home-screen](build-loft-home-screen.md)
