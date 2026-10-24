# Tasks

Work in this repo is tracked as **one markdown file per task**. A task's **status is
its parent folder**, so changing status is a file move, not a text edit.

```
tasks/
├── active/        work in progress (at most one task at a time)
├── waiting-on/    blocked on someone/something else
├── someday/       backlog, not started
└── done/          shipped (archive)
```

## Task file

`tasks/<status>/<slug>.md`, where `<slug>` is the kebab-case task slug. The slug is
the task's id and is reused for its branch name (`<type>/<slug>`).

```markdown
---
title: Human readable task title
created: 2026-10-24
completed: 2026-10-24 # only once the file is in done/
---

One short paragraph of context (for a backlog item) or what shipped (for a done item).
```

Status lives **only** in the folder, never in frontmatter, so a move is the single
source of truth for a transition.

## Transitions

```bash
git mv tasks/someday/foo.md tasks/active/foo.md     # promote
git mv tasks/active/foo.md tasks/waiting-on/foo.md  # park
git mv tasks/active/foo.md tasks/done/foo.md        # finish (then add `completed:`)
```

Each folder keeps a `.gitkeep` so the structure survives an empty queue.

## Dashboard

`dashboard.html` is a browser view of this folder: open it and pick the `tasks/`
directory. It renders the four folders as columns, and dragging a card between columns
moves the file. The `task-management` skill (`.claude/skills/task-management/`) owns the
format and the dashboard.
