# ADR-001: Adopt and adapt agent skills under our own names

## Status

Accepted

## Date

2026-10-24

## Context

This repo drives its workflow through Claude Code skills: tracking tasks, planning,
recording decisions, branching, committing, opening PRs, and fixing CI. Good skills for
most of these already exist on [skills.sh](https://skills.sh), and the `StillScripts/now`
repo had earlier versions that worked well in practice.

Installed as-is, they didn't fit together:

- Names came from their authors (`caveman-commit`, `pr-writer`, `gh-fix-ci`,
  `documentation-and-adrs`) rather than describing the action, so there was no
  predictable way to know which skill does what.
- Behaviour didn't match how the repo works. `caveman-commit` only wrote a message and
  never staged or committed; `documentation-and-adrs` covered READMEs, changelogs, and
  comments when the repo only needed it for decisions; `gh-fix-ci` called `python`,
  which doesn't exist on macOS.
- `npx skills update` overwrites any skill listed in `skills-lock.json`, so local changes
  to a tracked skill would be silently lost.

The repo is public, and these skills are other people's work under Apache-2.0 and MIT
licences, so their origin should stay visible after we change them.

## Decision

Adopt good public skills, then adapt and rename them freely, with credit:

1. **Names are short and verb-first**, describing the action: `commit`, `create-branch`,
   `create-plan`, `create-pr`, `document-decisions`, `fix-ci`. Skills that cover a domain
   rather than one action keep noun names: `task-management`, `find-skills`.
2. **Each adapted skill credits its source** with one line under its heading: source
   repo and path, when it was copied (or the commit), the licence, and what changed. The
   source repo's licence is copied into the skill folder as `LICENSE.txt`.
3. **Adapted skills leave `skills-lock.json`.** Only unmodified skills stay there, so
   `npx skills update` can't overwrite our changes.
4. **All project skills are allowed in `.claude/settings.json`** so they run without a
   permission prompt.
5. **`AGENTS.md` lists which skill handles which step.**

| Skill                | Source                                                             | Licence    | Change                                       |
| -------------------- | ------------------------------------------------------------------ | ---------- | -------------------------------------------- |
| `commit`             | `juliusbrussee/caveman` › `caveman-commit`                         | Apache-2.0 | Renamed; now stages and commits              |
| `create-branch`      | `getsentry/skills` › `create-branch`                               | Apache-2.0 | Credit only                                  |
| `create-plan`        | `openai/skills` › `create-plan` (commit `a5119697`, since removed) | Apache-2.0 | Saves to `docs/plans/`, two depths           |
| `create-pr`          | `getsentry/skills` › `pr-writer`                                   | Apache-2.0 | Renamed                                      |
| `document-decisions` | `addyosmani/agent-skills` › `documentation-and-adrs`               | MIT        | Renamed; decisions only; repo conventions    |
| `fix-ci`             | `openai/skills` › `gh-fix-ci`                                      | Apache-2.0 | Renamed; `python3`; Codex-only files dropped |
| `task-management`    | `anthropics/knowledge-work-plugins` › `task-management`, via `now` | Apache-2.0 | One file per task in status folders          |
| `find-skills`        | `vercel-labs/skills` › `find-skills`                               | MIT        | Unchanged; still in `skills-lock.json`       |

## Alternatives Considered

### Use skills unchanged and update them with the CLI

- Pros: upstream fixes arrive with `npx skills update`
- Cons: names and behaviour don't fit the repo, and repo conventions can't be added
- Rejected: consistency across the workflow matters more than automatic updates

### Write every skill from scratch

- Pros: full control, no licences to track
- Cons: throws away tested wording and ideas from people who've iterated on them
- Rejected: adapting is faster and gives credit where it's due

### Change behaviour but keep upstream names

- Pros: easy to trace each skill to its source
- Cons: names become misleading (a `caveman-commit` that commits, a `gh-` prefix that
  says nothing useful)
- Rejected: the source line keeps traceability without the misleading name

### Record the source only in frontmatter metadata

- Pros: keeps the skill body shorter
- Cons: easy to miss for people browsing the repo
- Rejected: a visible line under the heading is clearer for people and agents

## Consequences

- Adapted skills don't get upstream fixes automatically; check their sources by hand
  now and then.
- Skill names are predictable, so a future `handle-task` skill can chain them.
- Every adapted skill carries its licence and a source line, so credit can be audited.
- Allowed skills run without a prompt, but the commands they run still go through the
  normal permission checks.
