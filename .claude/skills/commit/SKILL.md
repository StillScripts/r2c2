---
name: commit
description: >
  Stage the changes that belong together, write a terse Conventional Commits
  message, and run git commit. Use for "commit", "commit this", "make a
  commit", "write a commit", "commit message", or /commit.
---

# Commit

> **Source:** adapted from [`juliusbrussee/caveman` › `skills/caveman-commit`](https://github.com/juliusbrussee/caveman/tree/main/skills/caveman-commit), copied 2026-10-24 (Apache-2.0, see `LICENSE.txt`). **Changes:** renamed from `caveman-commit`; now stages and commits instead of only writing the message; follows the project's attribution rule.

Stage only what belongs in this commit, write the message, and commit. Terse and exact.
Conventional Commits format. No fluff. Why over what.

## Workflow

1. **Inspect.**

   ```bash
   git status --short
   git diff
   git diff --cached
   ```

2. **Decide what belongs.** One commit = one logical change: the work the user asked
   for in this session.
   - **Already staged?** If the user staged files, they chose the commit's contents.
     Commit exactly what is staged; mention anything else that's modified but don't add it.
   - **Nothing staged?** Stage the files that belong to this change, by explicit path:
     `git add <path> <path>`. Never `git add -A` or `git add .`.
   - **Leave out**, and list in the report:
     - drift: files this work didn't touch (unrelated formatting churn, stray edits,
       lockfile changes no dependency change caused);
     - secrets and local config: `.env*`, keys, credentials, `*.local.*` settings;
     - build output, logs, large binaries, and scratch or temp files;
     - leftovers: debug prints, commented-out code, `TODO`s added by this session.
   - **A file mixes related and unrelated changes?** Ask the user rather than guessing.
     Interactive `git add -p` isn't available to agents.
   - **Two unrelated changes both belong?** Make two commits, each with its own message.
   - **Nothing to commit?** Say so and stop.

3. **Write the message** using the rules below.

4. **Commit.** Pass the message with a heredoc so newlines survive:

   ```bash
   git commit -F - <<'EOF'
   <message>
   EOF
   ```

   - Never use `--no-verify`. If a hook fails, fix the cause, re-stage, and run
     `git commit` again as a new attempt.
   - If a hook reformats staged files, check `git status` afterwards and make sure the
     commit holds the formatted version.
   - Don't `--amend` unless the user asks.

5. **Report** the short hash and subject, and anything you left unstaged and why.

## Message rules

**Subject line:**

- `<type>(<scope>): <imperative summary>` — `<scope>` optional
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`
- Imperative mood: "add", "fix", "remove" — not "added", "adds", "adding"
- ≤50 chars when possible, hard cap 72
- No trailing period
- Match project convention for capitalization after the colon

**Body (only if needed):**

- Skip entirely when subject is self-explanatory
- Add body only for: non-obvious _why_, breaking changes, migration notes, linked issues
- Wrap at 72 chars
- Bullets `-` not `*`
- Reference issues/PRs at end: `Closes #42`, `Refs #17`

**Trailers:**

- Follow the project's attribution rule. In this repo, every commit an agent writes ends
  with `Co-Authored-By: <model name> <noreply@anthropic.com>` naming the model that
  wrote the change, after a blank line.
- "As requested by..." never goes in the body; credit people with a `Co-authored-by` trailer.

**What NEVER goes in:**

- "This commit does X", "I", "we", "now", "currently" — the diff says what
- "Generated with Claude Code" or similar prose in the subject or body
- Emoji (unless project convention requires)
- Restating the file name when scope already says it

## Examples

Diff: new endpoint for user profile with body explaining the why

- ❌ "feat: add a new endpoint to get user profile information from the database"
- ✅

  ```
  feat(api): add GET /users/:id/profile

  Mobile client needs profile data without the full user payload
  to reduce LTE bandwidth on cold-launch screens.

  Closes #128
  ```

Diff: breaking API change

- ✅

  ```
  feat(api)!: rename /v1/orders to /v1/checkout

  BREAKING CHANGE: clients on /v1/orders must migrate to /v1/checkout
  before 2026-06-01. Old route returns 410 after that date.
  ```

## Auto-Clarity

Always include body for: breaking changes, security fixes, data migrations, anything
reverting a prior commit. Never compress these into subject-only — future debuggers need
the context.

## Boundaries

- Commits locally only. Does not push, open PRs, rebase, or rewrite history.
- If the user asks only for a message ("just write the message"), output it as a code
  block and stop.
- Commits on whatever branch is checked out. Creating a branch is the `create-branch`
  skill's job.
