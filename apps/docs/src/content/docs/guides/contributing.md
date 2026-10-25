---
title: Contributing
description: How work is tracked, planned, and shipped in this repo.
sidebar:
  order: 3
---

:::note
This guide is a stub. Until it grows, `AGENTS.md` at the repo root is the source of truth.
:::

## How work flows

1. **Task.** Every piece of work is a Markdown file in `tasks/<status>/<slug>.md`. The folder is the status: `active`, `waiting-on`, `someday` or `done`. The [roadmap](/roadmap/) shows them.
2. **Plan.** Work too big for its task body gets a plan in `docs/plans/<slug>.md`, with the same slug.
3. **Decision.** A choice that is expensive to reverse gets an ADR in `docs/decisions/`.
4. **Branch, commit, PR.** The branch is `<type>/<slug>`, commits and PR titles are `<type>(<scope>): <summary>`, following [Sentry's conventions](/decisions/adr-002-use-sentry-naming-conventions/).

## Before you push

```bash
vp check
vp test
vp run build
```
