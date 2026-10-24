---
name: handle-task
description: Run one task end to end by chaining the project skills — create or pick the task, branch, do the work, commit, run /simplify and commit its changes, move the task to done, then open a draft PR. Use when asked to "handle this task", "do this task end to end", "take this from task to PR", or /handle-task.
---

# Handle Task

Take one task from idea to draft PR. This skill only sequences the other skills; each
step's rules live in the skill it calls, so follow that skill rather than repeating it
here. Naming follows the Naming Conventions in `AGENTS.md`.

```
create-task → (create-plan) → create-branch → work → commit
  → /simplify → commit → move task to done → commit → push → create-pr
```

## Workflow

### 1. Task

- **Existing task** (the user names one, or it's already in `tasks/`): if it isn't in
  `active/`, move it there with `task-management`, including the one-active check.
- **New work:** create it in `active/` with `create-task`.

The task's slug is the id for every step that follows.

### 2. Plan (only if needed)

Small tasks skip this. If the task body isn't enough to start work, run `create-plan` for
the same slug, and wait for the user to approve the plan before building. If the plan
flags `Needs ADR:`, record the decision with `document-decisions` during the work.

### 3. Branch

Run `create-branch`. It takes its name from the active task: `<type>/<slug>`. If the
current branch is already the task's branch, keep it.

### 4. Work

Do the task. Before committing:

- Run `vp check` and `vp test` (and any `vp run <script>` the change needs). Fix what
  they report; don't commit red.
- If the work diverged from the plan, update the plan.

### 5. Commit the work

Run `commit`. The first commit holds the work plus the new task file (and any plan or
ADR), so the task exists on the branch from its first commit.

### 6. Simplify

Run the built-in `/simplify` skill on the branch's changes. Then:

- **It changed files:** run `vp check` and `vp test` again, then `commit` the changes on
  their own, usually as `ref(<scope>): simplify <what>`.
- **Nothing changed:** no commit; say so in the report.

Always run this step, even when the work looks clean.

### 7. Move the task to done

If the task's work is complete, move it with `task-management`
(`git mv tasks/active/<slug>.md tasks/done/<slug>.md`, then add `completed: <today>`),
and `commit` that alone as `chore(tasks): complete <slug>`.

If something is still outstanding (a follow-up in this PR, an answer from the user),
leave the task in `active/` and say why.

### 8. Push and open the PR

```bash
git push -u origin HEAD
```

Then run `create-pr` to open a draft PR. It covers the whole branch, not just the last
commit.

### 9. Report

Give the PR link, the commits made (work, simplify if any, task done), and anything
left open. Then stop.

## Boundaries

- One task per run. Never commits to the default branch; step 3 makes sure of it.
- Doesn't watch or fix CI. If checks fail, the user runs `fix-ci` or asks for it.
- Doesn't merge, mark the PR ready for review, or delete the branch.
- Stops and asks when a step's skill would ask: an unclear task, a second active task, a
  file that mixes related and unrelated changes, or a failing check it can't fix.
