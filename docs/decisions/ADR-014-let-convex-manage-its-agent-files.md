# ADR-014: Let Convex manage its own agent files

## Status

Proposed

## Date

2026-10-25

## Context

Agents working on `packages/backend` lean on training data for Convex, which lags the
APIs. Convex publishes current guidance in two forms:

- `npx convex ai-files install` writes `convex/_generated/ai/guidelines.md`, a
  `skills-lock.json`, its skills from `get-convex/agent-skills` (copied into both
  `.agents/skills/` and `.claude/skills/`), and a marked section in `AGENTS.md` and
  `CLAUDE.md` pointing at the guidelines. `npx convex ai-files update` refreshes them.
- The `convex@claude-plugins-official` Claude Code plugin adds overlapping skills, a
  reviewer and expert agent, and lint and typecheck hooks.

[ADR-001](ADR-001-adopt-and-adapt-agent-skills.md) and `AGENTS.md` say skills are
installed with `npx skills add` into the root `.claude/skills/`, with no `.agents/`
folder, and are adapted and renamed. Following that for Convex's skills would break
`convex ai-files update` and fork skills we have no reason to change.

## Decision

Treat Convex's AI files as vendor-managed, like `convex/_generated`:

1. Run `npx convex ai-files install` in `packages/backend` and commit everything it
   writes, in place. Never edit those files by hand; refresh them with
   `npx convex ai-files update`.
2. Exclude them from `vp fmt`, so formatting doesn't drift them from Convex's hashes.
   Hand-written backend notes go elsewhere, not in its `AGENTS.md` or `CLAUDE.md`.
3. Leave the plugin to each developer's user settings. It starts an MCP server and runs
   hooks on every edit, which frontend-only sessions don't need.

## Alternatives Considered

### Copy the skills into the root `.claude/skills/` and adapt them (ADR-001)

- Pros: one skills folder, consistent names
- Cons: forks to maintain by hand; `convex ai-files update` no longer works
- Rejected: we don't need to change them, so adapting buys nothing

### Rely on the plugin alone

- Pros: nothing committed; updates arrive with the plugin
- Cons: no `guidelines.md` in the repo, and agents without the plugin get nothing
- Rejected: the committed files work for every agent; the plugin adds hooks on top

### Install the files locally and gitignore them

- Pros: a smaller diff
- Cons: fresh clones and cloud sessions start without them; `version.convex.dev` is
  blocked in cloud sessions, so they can't always be reinstalled there
- Rejected: committed files are always present

## Consequences

- `packages/backend` has a second `AGENTS.md`, `CLAUDE.md` and `skills-lock.json`,
  owned by the Convex CLI.
- With the plugin installed, its skills overlap the committed ones; both come from Convex.
- Skills under `packages/backend` are only picked up when an agent works in that folder,
  not from `apps/loft`, which also calls Convex.
