---
name: create-plan
description: Create a plan for a coding task and save it to docs/plans/<slug>.md, at simple depth (scope + checklist) or detailed depth (adds context, approach, alternatives, testing, risks, decisions, and a fresh-reader check). Use when the user asks for a plan, wants to think through a task before building it, or a task is big enough that its own description isn't enough to start work. A detailed plan can also upgrade an existing simple one in place.
metadata:
  short-description: Create a plan
---

# Create Plan

> **Source:** adapted from [`openai/skills` › `skills/.experimental/create-plan`](https://github.com/openai/skills/tree/a5119697b819090e00e5d11ee1d86834d7c1043a/skills/.experimental/create-plan), at commit `a5119697` (since removed upstream) (Apache-2.0, see `LICENSE.txt`). **Changes:** saves plans to `docs/plans/`, adds a detailed depth and a reader test.

## Goal

Turn a request into **one actionable plan file** at `docs/plans/<slug>.md`, at the
lightest depth that does the job.

## Depth

| Depth        | Use when                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **simple**   | Default. The approach is clear and fits in one PR.                                                                                                                  |
| **detailed** | Any of: new or changed data model/schema; auth, security, or payments; a new dependency or architecture choice; work spanning several PRs; no obvious approach yet. |

If the user names a depth, use it. If a task is a one-line change ("change the button
colour"), say a plan isn't needed and stop, unless the user asked for one anyway.

## Workflow

Never edit code. The only files this skill writes are the plan and, if one exists, the
matching task file's `plan:` line.

1. **Resolve the slug.**
   - If a task file exists for this work (`tasks/*/<slug>.md`), reuse its slug.
   - Otherwise derive one: kebab-case, ASCII, 3–6 words, no leading articles
     (e.g. `add-dark-mode-toggle`). It must read cleanly as a branch name.
   - If `docs/plans/<slug>.md` already exists, update that file rather than creating a
     second one. Upgrading simple → detailed means expanding it in place and changing
     `depth:`.

2. **Scan context quickly.**
   - Read `AGENTS.md`, `README.md`, and anything relevant in `docs/` (including existing
     ADRs in `docs/decisions/` that touch this area; respect them).
   - Skim the files most likely to change. Note constraints: frameworks, the `vp`
     commands for checking and testing, deployment shape.

3. **Ask only blocking questions.**
   - simple: at most 2. detailed: at most 5 (product decisions often live only in the
     user's head).
   - Prefer multiple choice. If unsure but not blocked, make a reasonable assumption and
     list it under Open questions.

4. **Write the plan** to `docs/plans/<slug>.md` using the template for its depth (below).
   Create `docs/plans/` if it doesn't exist.

5. **Link the task.** If `tasks/*/<slug>.md` exists and has no `plan:` line, add
   `plan: docs/plans/<slug>.md` to its frontmatter. Don't create a task; that is the
   `task-management` skill's job.

6. **Reader test (detailed only).** Hand the plan to a fresh agent that has no context
   from this conversation (in Claude Code, the Agent tool with only the plan's path).
   Ask it to report: what it would build first, anything ambiguous, missing, or
   contradictory, and any question it would need answered before starting. Fix real gaps
   in the plan; move genuine unknowns to Open questions. One round only. If no subagent
   is available, skip this step and say so.

7. **Report.** Give the path. For a simple plan, show the plan. For a detailed plan, give
   a 2–3 line summary, any decisions flagged for an ADR, and the reader-test outcome.

## Frontmatter

```yaml
---
title: <Human readable title, matching the task's title if there is one>
depth: simple | detailed
created: YYYY-MM-DD
decisions: # detailed only, and only once an ADR exists
  - docs/decisions/ADR-001-<title>.md
---
```

Status is not stored in the plan. The task's folder says where the work is.

## Simple template

```markdown
# <Title>

<1–3 sentences: what we're doing, why, and the high-level approach.>

## Scope

- In:
- Out:

## Action items

- [ ] <Step 1>
- [ ] <Step 2>
- [ ] ...

## Open questions

- <Question>
```

6–10 action items. Drop Open questions if there are none.

## Detailed template

```markdown
# <Title>

<1–3 sentences: what we're doing, why, and the high-level approach.>

## Context

<Why now, what exists today (point to modules/files), and the constraints that shape
the work.>

## Approach

<The chosen design in prose: components, data shapes, interfaces, flows. A small Mermaid
diagram only if it explains something prose can't.>

## Alternatives considered

- <Option>: <why not>

## Scope

- In:
- Out:

## Action items

### <Phase or PR 1>

- [ ] <Step>

### <Phase or PR 2>

- [ ] <Step>

## Testing

<What proves it works: which `vp test` suites or new tests, manual checks, edge cases.>

## Risks

- <Risk>: <mitigation>

## Decisions

- Needs ADR: <decision that is expensive to reverse>
- <or a link to an existing ADR>

## Open questions

- <Question>
```

Use phases only when the work spans several PRs; otherwise a single flat checklist.
Drop any section that would only say "none".

## Decisions

When a plan settles something expensive to reverse (a library or framework, a data
model, auth, hosting, a public API contract), list it under **Decisions** as
`Needs ADR: <decision>`. Recording it is the `document-decisions` skill's job; once
the ADR exists, replace the line with a link and add its path to `decisions:` in the
frontmatter. Plans say _what we'll do_; ADRs say _why we chose it_ and outlive the plan.

## Checklist item guidance

Good items:

- Are verb-first and atomic: "Add…", "Refactor…", "Verify…".
- Run in order: discovery → changes → tests → rollout.
- Point to likely files or modules: `apps/web/src/routes/...`, `packages/ui/...`.
- Name concrete validation: "Run `vp check` and `vp test`", "Add a test for X".
- Include at least one item for tests and one for edge cases or risk when relevant.

Avoid:

- Vague steps ("handle backend", "do auth").
- Micro-steps ("open the file").
- Code snippets. Keep the plan about decisions, not implementation.

## Keeping plans true

If the work meaningfully diverges from the plan, update the plan on the same branch. An
out-of-date plan is worse than none. Tick action items off as they're done.
