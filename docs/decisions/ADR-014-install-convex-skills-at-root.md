# ADR-014: Install Convex skills at the repo root

## Status

Accepted

## Date

2026-10-25

## Context

Agents working on Convex code lean on training data, which lags the APIs. Convex
publishes current guidance in three forms:

- `npx convex ai-files install`, run in the package that depends on `convex`
  (`packages/backend`), writes `convex/_generated/ai/guidelines.md`, a Convex section in
  that package's `AGENTS.md` and `CLAUDE.md`, and by default copies the skills from
  `convex/agent-skills` into that package's `.agents/skills/` and `.claude/skills/`.
- The same skills can be installed anywhere with `npx skills add convex/agent-skills`.
- The `convex@claude-plugins-official` Claude Code plugin bundles a subset of them,
  plus an MCP server and hooks that run on every edit.

Agents run from the repo root. Claude Code only loads `packages/backend/.claude/skills/`
once it touches a file in that folder, never from `apps/loft` (which also calls
Convex), and other agents look for skills at the root.

## Decision

1. Install the Convex skills at the root, like any other skills.sh skill
   ([ADR-001](ADR-001-adopt-and-adapt-agent-skills.md)):
   `npx skills add convex/agent-skills --skill '*' -a claude-code --copy -y`. They stay
   unmodified in `skills-lock.json`, so `npx skills update` refreshes them.
2. Keep only the generated files in `packages/backend`. `convex.json` sets
   `aiFiles.skills.agents` to `[]`, so `npx convex ai-files install` writes
   `guidelines.md` and its `AGENTS.md`/`CLAUDE.md` sections but no skill copies.
3. The root `AGENTS.md` names the Convex skills in one line, separate from the workflow
   skills: read `guidelines.md` and use the `convex-*` skills when working on Convex
   code, and ignore them otherwise.
4. Keep the Convex files out of `vp fmt`, so formatting doesn't drift them from what
   Convex wrote.
5. Leave the plugin to each developer's user settings.

## Alternatives Considered

### Keep the skills where `ai-files install` puts them

- Pros: one Convex command refreshes everything
- Cons: skills are invisible from the root until a backend file is opened, and never
  loaded for `apps/loft`
- Rejected: agents run from the root

### List every Convex skill in `AGENTS.md`

- Pros: agents see each skill's purpose up front
- Cons: `AGENTS.md` loads on every session, and most work isn't Convex work; the skill
  descriptions already say when each applies
- Rejected: one pointer is enough

### Rely on the plugin alone

- Pros: nothing committed
- Cons: covers fewer skills, needs a per-person install, and adds an MCP server and
  edit hooks to every session
- Rejected: committed skills reach every clone and cloud session

## Consequences

- `.claude/skills/` holds the workflow skills and the `convex-*` skills side by side;
  `AGENTS.md` separates them.
- `guidelines.md` is refreshed with `npx convex ai-files update` in `packages/backend`;
  the skills with `npx skills update` at the root.
- Developers with the plugin installed see overlapping skills from both sources.
