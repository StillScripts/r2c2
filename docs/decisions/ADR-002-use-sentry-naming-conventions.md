# ADR-002: Use Sentry's naming conventions for branches, commits, and PRs

## Status

Accepted

## Date

2026-10-24

## Context

The skills adopted under [ADR-001](ADR-001-adopt-and-adapt-agent-skills.md) came from
different authors and disagreed on naming:

- `commit` (from `juliusbrussee/caveman`) used `refactor` and had no `meta` or `license`
  types, while `create-branch` and `create-pr` (from `getsentry/skills`) used `ref`, `meta`,
  and `license`. A restructuring change would get `ref/...` as its branch but
  `refactor: ...` as its commit.
- `create-branch` had no `revert` type; `create-pr` and `commit` did.
- `commit` closed issues with `Closes #N`; `create-pr` used `Fixes #N`.
- Capitalisation after the colon and title length were set in `commit` but not in
  `create-pr`.
- Slug rules differed: `create-plan` and `create-branch` said 3–6 kebab-case words, while
  `task-management` and its dashboard put no limit on length.

A task's slug, branch, commits, and PR title should read as one consistent set.

## Decision

Use Sentry's conventions as the single reference, written once in `AGENTS.md` and repeated
in each skill that needs them:

- **Types:** `feat`, `fix`, `ref`, `perf`, `docs`, `test`, `build`, `ci`, `chore`,
  `style`, `meta`, `license`, `revert`.
- **Branches:** `<type>/<slug>`, with no username prefix.
- **Commit subjects and PR titles:** `<type>(<scope>): <summary>`, lowercase after the
  colon, no trailing period, at most 72 characters; `!` for breaking changes.
- **Issue references:** `Fixes #N` to close, `Refs #N` to link.
- **Slugs:** kebab-case ASCII, 3–6 words, no leading article, shared by a task, its
  plan, and its branch.

The `Co-Authored-By` trailer is our own addition and sits alongside these rules.

## Alternatives Considered

### Standard Conventional Commits (`refactor`, no `meta` or `license`)

- Pros: the most widely recognised list
- Cons: two of the three skills that use types already follow Sentry
- Rejected: aligning on Sentry changed one skill instead of two

### Let each skill keep its own rules

- Pros: no changes to adapted skills
- Cons: a restructuring change gets `ref/` as its branch and `refactor:` as its commit,
  and a future `handle-task` skill can't map one onto the other
- Rejected: the workflow chains these skills, so they must agree

## Consequences

- Commits made before this decision used `refactor`; history stays as it is.
- `commit`, `create-branch`, `create-pr`, `task-management`, and the task dashboard were
  updated to match.
- A new skill that names branches, commits, or PRs should take its rules from the
  Naming Conventions section of `AGENTS.md`.
