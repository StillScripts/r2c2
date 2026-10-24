---
name: create-task
description: Create a new task file in tasks/<status>/<slug>.md, choosing its status (active, waiting-on, or someday) from context and linking any related plan or decision. Use when asked to "create a task", "add a task", "track this", "remind me to", "add to the backlog", or when starting work that has no task yet.
---

# Create Task

Create one task file following the `task-management` format. This skill owns **creating**
a task; `task-management` owns the format, moving tasks between statuses, and the
dashboard. If `tasks/` doesn't exist yet, set it up as `task-management` describes first.

## Workflow

### 1. Check it doesn't already exist

Look for the same work before creating anything:

```bash
ls tasks/*/
```

If a task already covers it, don't create a duplicate. Report the existing file, and
offer to move it (e.g. `someday/` → `active/`) using `task-management`.

### 2. Name it

- **Title:** a short, human-readable line in imperative mood, e.g. "Add dark mode toggle".
- **Slug:** kebab-case ASCII, 3–6 words, no leading article (`add-dark-mode-toggle`).
  The same slug will name the plan (`docs/plans/<slug>.md`) and branch
  (`<type>/<slug>`), so it must read cleanly as a branch name.
- If `tasks/*/<slug>.md` is taken by a different task, pick a more specific slug. Never
  overwrite.

### 3. Pick the status

Choose the folder from context. When nothing points elsewhere, use `someday/`.

| Status        | When                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| `active/`     | Work starts now: the user says to start, or the task is created to do it in this session   |
| `waiting-on/` | It can't start until someone or something else acts (a review, an answer, an upstream fix) |
| `someday/`    | Everything else: an idea, a follow-up, a backlog item                                      |

**One active task at a time.** Before creating in `active/`, check `tasks/active/` for
another task file (ignore `.gitkeep`). If there is one, ask the user whether to park it
in `waiting-on/`, finish it, or create the new task in `someday/` instead.

### 4. Find related plans and decisions

- **Plan:** if `docs/plans/<slug>.md` exists, or the user points to a plan for this
  work, add `plan: docs/plans/<slug>.md` to the frontmatter. Don't write a plan here; if
  the work looks too big for the task body alone, offer `create-plan` afterwards.
- **Decisions:** an ADR in `docs/decisions/` that this task carries out or revisits goes
  in the body under `Related:`. When the task has a plan, the plan also lists its ADRs.
- **Issues and PRs:** a GitHub issue or PR the task comes from also goes under
  `Related:`, as `#N` or a link.

Only link things that exist. Don't invent plan paths or ADR numbers.

### 5. Write the file

Get today's date with `date +%F`, then write `tasks/<status>/<slug>.md`:

```markdown
---
title: Add dark mode toggle
created: 2026-10-24
plan: docs/plans/add-dark-mode-toggle.md # only when a plan exists
---

One short paragraph: what needs doing and why.

- Waiting on: <who or what>, since <date> # waiting-on/ only
- For <person>; due <date> # only if given

Related: [ADR-003](../../docs/decisions/ADR-003-use-tailwind.md), #42
```

- Never put status in the frontmatter; the folder is the status. Never add `completed:`
  here; `task-management` stamps it when a task moves to `done/`.
- Keep the body short. Detail belongs in a plan.
- Leave out any line that doesn't apply.

### 6. Report

Say the path, the status and why it was chosen, and what it links to. If the task went
to `active/`, the next step is usually `create-branch`, which takes its slug from the
active task.

## Boundaries

- Creates one task file. Doesn't write plans or ADRs, create branches, or commit; those
  are `create-plan`, `document-decisions`, `create-branch`, and `commit`.
- Doesn't move existing tasks; that's `task-management`.
- When extracting several tasks from a conversation or meeting, list them and ask before
  creating them.
