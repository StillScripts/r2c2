---
name: handle-task
description: Run one task end to end, from task to a PR ready for review, by chaining the project skills. Use when asked to "handle this task", "do this task end to end", "take this from task to PR", or /handle-task.
---

# Handle Task

Take one task from idea to a PR ready for review. This skill only sets the order; each
step's rules live in the skill it calls.

## Workflow

### 1. Task

- **Existing task** (the user names one, or it's already in `tasks/`): if it isn't in
  `active/`, move it there with `task-management`.
- **New work:** create it in `active/` with `create-task`.

The task's slug is the id for every step that follows.

### 2. Plan (only if needed)

Small tasks skip this. If the task body isn't enough to start work, run `create-plan` for
the same slug, and wait for the user to approve the plan before building. If the plan
flags `Needs ADR:`, record the decision with `document-decisions` during the work.

### 3. Branch

Run `create-branch`.

### 4. Work

Do the task. Before committing, run `vp test` and any `vp run <script>` the change needs,
and fix what fails; the pre-commit hook runs `vp check`. If the work diverged from the
plan, update the plan.

### 5. Commit the work

Run `commit`. The first commit holds the work plus the new task file (and any plan or
ADR), so the task exists on the branch from its first commit.

### 6. Simplify

Always run the built-in `/simplify` skill on the branch's changes, even when the work
looks clean. If it changed files, run `vp test` again when code changed, then `commit`
those changes on their own, usually as `ref(<scope>): simplify <what>`. If it changed
nothing, there's no commit; say so in the report.

### 7. Open a draft PR

Run `create-pr` to push the branch and open a draft PR.

### 8. Review (not yet)

A review step goes here later: a person or an agent reviews the draft PR and the
feedback is worked through. For now, go straight to step 9.

### 9. Mark the PR ready

Run `mark-pr-ready`. It commits the task's move to `done/` as the third commit, pushes,
and marks the PR ready for review. If something is still outstanding (a follow-up, an
answer from the user), leave the PR as a draft and the task in `active/`, and say why.

### 10. Report

Give the PR link, the commits made (work, simplify if any, task done), and anything
left open. Then stop.

## Boundaries

- One task per run; never commits to the default branch.
- Doesn't watch or fix CI. If checks fail, the user runs `fix-ci` or asks for it.
- Doesn't merge the PR or delete the branch.
- Stops and asks whenever a called skill would.
