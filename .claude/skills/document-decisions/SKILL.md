---
name: document-decisions
description: Record an architecture decision as an ADR in docs/decisions/. Use when a choice is expensive to reverse (a library or framework, a data model, auth, hosting, a public API contract, a repo-wide convention), when a plan flags "Needs ADR", when an earlier decision is replaced, or when the user asks to document why something was chosen.
---

# Document Decisions

> **Source:** adapted from [`addyosmani/agent-skills` › `skills/documentation-and-adrs`](https://github.com/addyosmani/agent-skills/tree/main/skills/documentation-and-adrs), copied 2026-10-24 (MIT, see `LICENSE.txt`). **Changes:** renamed from `documentation-and-adrs`; narrowed to decisions only (dropped the code-comment, API-doc, README, and changelog sections); added this repo's file naming and plan links.

## Overview

Document decisions, not just code. The most valuable documentation captures the _why_ —
the context, constraints, and trade-offs that led to a decision. Code shows _what_ was
built; an ADR explains _why it was built this way_ and _what alternatives were
considered_. This context is essential for future humans and agents working in the
codebase, and it stops settled questions being re-decided.

## When to Write an ADR

- Choosing a framework, library, or major dependency
- Designing a data model or database schema
- Selecting an authentication strategy
- Deciding on an API architecture (REST vs. GraphQL vs. tRPC)
- Choosing between build tools, hosting platforms, or infrastructure
- Setting a convention the whole repo follows
- Any decision that would be expensive to reverse

**When NOT to:** routine implementation choices, anything easy to change later, and
things the code already makes obvious.

## In This Repo

- **Location and name:** `docs/decisions/ADR-NNN-<kebab-title>.md`, numbered in sequence
  with three digits (`ADR-001-use-tanstack-start.md`). Look at the existing files for the
  next number; never reuse or restart one. Create `docs/decisions/` if it doesn't exist.
- **Never delete an ADR.** When a decision changes, write a new one that supersedes it,
  and set the old one's status to `Superseded by ADR-NNN`.
- **Links to plans:** plans live at `docs/plans/<slug>.md` (see the `create-plan` skill).
  When an ADR comes from a plan:
  - list the plan under the ADR's `## Related`;
  - add the ADR's path to the plan's `decisions:` frontmatter, and replace the plan's
    `Needs ADR: …` line with a link.
- **Status:** `Proposed` while the work is still being planned or built; `Accepted` once
  it ships or the user confirms the decision.

## ADR Template

```markdown
# ADR-001: Use PostgreSQL for primary database

## Status

Proposed | Accepted | Superseded by ADR-XXX | Deprecated

## Date

2025-01-15

## Context

We need a primary database for the task management application. Key requirements:

- Relational data model (users, tasks, teams with relationships)
- ACID transactions for task state changes
- Support for full-text search on task content
- Managed hosting available (for small team, limited ops capacity)

## Decision

Use PostgreSQL with Prisma ORM.

## Alternatives Considered

### MongoDB

- Pros: Flexible schema, easy to start with
- Cons: Our data is inherently relational; would need to manage relationships manually
- Rejected: Relational data in a document store leads to complex joins or data duplication

### SQLite

- Pros: Zero configuration, embedded, fast for reads
- Cons: Limited concurrent write support, no managed hosting for production
- Rejected: Not suitable for multi-user web application in production

## Consequences

- Prisma provides type-safe database access and migration management
- We can use PostgreSQL's full-text search instead of adding Elasticsearch
- Team needs PostgreSQL knowledge (standard skill, low risk)

## Related

- Plan: docs/plans/add-task-storage.md
- Supersedes: ADR-000 (if any)
```

Drop `## Related` when there's nothing to link.

## ADR Lifecycle

```
PROPOSED → ACCEPTED → (SUPERSEDED or DEPRECATED)
```

- Don't delete old ADRs. They capture historical context.
- When a decision changes, write a new ADR that references and supersedes the old one.

## Prose Review

After checking the technical content, review the prose for the people who will use it.
Clearer wording must not change the decision or its limits.

1. Mark the details that must survive the edit: names, numbers and units, commands,
   paths, links, conditions, trade-offs, and uncertainty. Check them against the
   available code and decision context; flag anything you cannot substantiate.
2. Replace stock introductions, promotional adjectives, and repeated summaries with the
   concrete information the reader needs. Do not replace an unsupported claim with an
   invented example or a stronger guarantee. Keep necessary technical repetition and the
   project's established terminology.
3. Compare the edited document with the original and its sources. Restore any lost
   qualifier or caveat, and explain any unresolved factual question rather than
   polishing it away.

## Common Rationalizations

| Rationalization                  | Reality                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| "The code is self-documenting"   | Code shows what. It doesn't show why, what alternatives were rejected, or what constraints apply.             |
| "ADRs are overhead"              | A 10-minute ADR prevents a 2-hour debate about the same decision six months later.                            |
| "Nobody reads docs"              | Agents do. Future engineers do. Your 3-months-later self does.                                                |
| "We'll write it once it settles" | The reasoning is freshest now. A `Proposed` ADR can be updated; a forgotten rationale can't be reconstructed. |

## Red Flags

- Architectural decisions with no written rationale
- An ADR with no alternatives considered
- A decision reversed without a superseding ADR
- A plan with a `Needs ADR` line that never got one

## Verification

- [ ] The file is `docs/decisions/ADR-NNN-<kebab-title>.md` with the next free number
- [ ] Status, date, context, decision, alternatives, and consequences are filled in
- [ ] Any related plan and the ADR link to each other
- [ ] A superseded ADR has its status updated
- [ ] Prose edits preserve source details, trade-offs, and qualifiers without adding unsupported guarantees
