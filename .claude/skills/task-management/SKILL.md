---
name: task-management
description: File-per-task tracking in a tasks/ folder where status is the parent folder. Reference this when the user asks about their tasks, wants to add/complete tasks, or needs help tracking commitments.
user-invocable: false
---

# Task Management

Tasks are tracked as **one markdown file per task** under a `tasks/` folder at the repo
root. A task's **status is its parent folder**, so changing status is a file move, not a
text edit.

> **Source:** adapted from [`anthropics/knowledge-work-plugins` › `productivity/skills/task-management`](https://github.com/anthropics/knowledge-work-plugins/tree/main/productivity/skills/task-management), copied 2026-10-24 (Apache-2.0, see `LICENSE.txt`). **Changes:** one file per task in status folders instead of a single `TASKS.md`; `plan:` links; dashboard reworked for the folder layout. Arrived by way of [`StillScripts/now`](https://github.com/StillScripts/now).

## Layout

```
tasks/
├── active/        work in progress (at most one task at a time)
├── waiting-on/    blocked on someone/something else
├── someday/       backlog, not started
└── done/          shipped (archive)
```

- Always use the `tasks/` folder at the repo root.
- If it doesn't exist, create the four subfolders (each with a `.gitkeep` so the
  structure survives an empty queue) and a `tasks/README.md` describing the model.
- See `tasks/README.md` for the on-disk contract.

## Task file

`tasks/<status>/<slug>.md`, where `<slug>` is the kebab-case task slug. The slug is the
task's canonical id; reuse it for the branch name (`<type>/<slug>`) and any related docs.

```markdown
---
title: Human readable task title
created: YYYY-MM-DD
completed: YYYY-MM-DD # present ONLY when the file is in done/
plan: docs/plans/<slug>.md # present ONLY when the task has a plan
---

One short paragraph of context (for a backlog item) or what shipped (for a done item).
Sub-points as a bullet list if useful.
```

Status is **never** stored in frontmatter; the folder is the single source of truth.
`completed:` is stamped only when a task lands in `done/`.

## Plans

A task that needs more than its own body to explain the work gets a plan at
`docs/plans/<slug>.md`, written by the `create-plan` skill with the **same slug** as the
task. The task links to it with `plan: docs/plans/<slug>.md`; the plan's path never
changes, so the link survives every status move. Small tasks ("change the button
colour") need no plan: the body is enough. Decisions a plan settles are recorded as ADRs
in `docs/decisions/` and linked from the plan, not from the task.

## Transitions

Move the file between folders (prefer `git mv` so history follows; use plain `mv` for a
file that isn't tracked yet):

```bash
git mv tasks/someday/foo.md tasks/active/foo.md      # promote to active
git mv tasks/active/foo.md tasks/waiting-on/foo.md   # park
git mv tasks/active/foo.md tasks/done/foo.md         # finish, then add `completed: YYYY-MM-DD`
```

**One Active task at a time.** Before promoting a task into `active/`, check that
`active/` holds no other task file (ignoring `.gitkeep`). If it does, ask the user
whether to park or finish the current one first.

## Dashboard

A visual dashboard is available. **On first interaction with tasks:**

1. Check if `dashboard.html` exists at the repo root.
2. If not, copy it from this skill's directory: `.claude/skills/task-management/dashboard.html`.
3. Tell the user: "I've added the dashboard. Open `dashboard.html` in your browser and
   pick the `tasks/` folder to use the drag-and-drop task board."

The task board:

- Reads the `tasks/` folder (one card per file; columns are the four subfolders).
- Dragging a card to another column moves the file between subfolders.
- Adding a task creates a file; clicking a card edits its body.

## How to Interact

**"what's on my plate" / "my tasks":**

- List the files in `tasks/active/` and `tasks/waiting-on/`; read their titles.
- Highlight anything overdue or urgent.

**"add a task" / "remind me to":**

- Create `tasks/someday/<slug>.md` (or `active/` if starting now, after the one-active
  check) with the frontmatter above.
- Include context in the body if provided.
- If a plan for the same slug already exists in `docs/plans/`, add the `plan:` line.

**"done with X" / "finished X":**

- Move the file to `tasks/done/` and add `completed: YYYY-MM-DD` to its frontmatter.

**"what am I waiting on":**

- List `tasks/waiting-on/`; note how long each has been waiting (from `created:`).

## Conventions

- One file per task; the **folder** is the status. Never duplicate status into frontmatter.
- `title` is the human-readable line; the **filename slug** is the canonical id, shared
  by the task, its plan, and its branch.
- Use "for [person]" in the body for commitments; "due [date]" for deadlines.
- Keep `done/` as the archive. It is the historical log, so there's no need to prune it.

## Extracting Tasks

When summarizing meetings or conversations, offer to add extracted tasks (commitments,
action items, follow-ups) as files in `tasks/someday/`. Ask before adding; don't auto-add.
