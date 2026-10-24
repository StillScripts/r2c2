---
name: mark-pr-ready
description: Finish a task's draft PR — move its task to done in one last commit, push, and mark the PR ready for review. Use when asked to "mark the PR ready", "ready for review", "this PR is good to go", or /mark-pr-ready.
---

# Mark PR Ready

The last step for a task's draft PR: once the work is final, record the task as done on
the branch and take the PR out of draft. Run it on the PR's branch.

## Workflow

### 1. Check the PR is ready

```bash
git status --short
gh pr view --json number,url,isDraft,headRefName
gh pr checks
```

- **Uncommitted changes:** stop and ask; they belong in a `commit` first.
- **No PR:** stop; open one with `create-pr`.
- **Failing checks:** stop and suggest `fix-ci`. No checks at all is fine.
- **Open review feedback:** stop until it's addressed. (There's no review step yet;
  when there is, it runs before this skill.)

### 2. Move the task to done

Find the task by the branch's slug (`<type>/<slug>` → `tasks/*/<slug>.md`). If it isn't
already in `done/`, move it there with `task-management` and `commit` that alone as
`chore(tasks): complete <slug>`. If there's no task for the slug, say so and carry on.

### 3. Push and mark ready

```bash
git push
gh pr ready
```

If the PR is already ready (`isDraft` is false), skip `gh pr ready`.

### 4. Report

Give the PR link, the task commit (or why there wasn't one), and that the PR is ready
for review.

## Boundaries

- Doesn't review, approve, or merge the PR.
- Doesn't refresh the PR title or body; that's `create-pr`.
