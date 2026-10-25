---
name: resolve-conflicts
description: Resolve Git merge conflicts by understanding why each side changed, extracting only the conflicted hunks instead of loading whole files, and validating before pushing. Use when a PR has merge conflicts, when bringing the default branch into a branch, when a merge, rebase, cherry-pick, or stash pop stops on conflicts, when `git status` shows unmerged paths, or when files contain conflict markers.
---

# Resolve Conflicts

> **Source:** adapted from [`warpdotdev/common-skills` › `.agents/skills/resolve-merge-conflicts`](https://github.com/warpdotdev/common-skills/tree/main/.agents/skills/resolve-merge-conflicts), copied 2026-10-25 (MIT, see `LICENSE.txt`). **Changes:** renamed from `resolve-merge-conflicts`; script path points at `.claude/skills/`; adds bringing the default branch into a PR by merge, never rebase; adds reading each side's intent before resolving and never dropping behaviour (an idea from Matt Pocock's `resolving-merge-conflicts`); adds rules for this repo's lockfile, generated Convex API and task files; validates with `vp` and names the merge commit to match ADR-002.

Resolve conflicts so that both sides' intended behaviour survives. Keep context small: start with a summary, then work through one conflicted file at a time, and open a whole file only when the compact view isn't enough.

## Workflow

### 1. Start the merge

To bring the default branch into a PR branch, merge it. Never rebase, amend or force-push a branch that's already pushed: a merge commit keeps everyone's checkout valid.

```bash
git fetch origin master
git merge origin/master
```

If the merge stopped on another operation (rebase, cherry-pick, stash pop), carry on from step 2 with that operation instead.

### 2. Understand both sides

Before editing anything, learn what each side was trying to do:

```bash
git log --oneline --merge
git log --oneline HEAD..MERGE_HEAD
```

Read the commits, and the PR or task they came from, that touched the conflicted files. A conflict is two intents colliding; resolving it means keeping both, not picking whichever looks newer.

### 3. Summarise the conflicts

```bash
python3 .claude/skills/resolve-conflicts/scripts/extract_conflict_context.py
```

This lists the unresolved files, their index stages, and how many text hunks each has. It also covers index-only conflicts such as add/add or modify/delete.

### 4. Resolve one file at a time

```bash
python3 .claude/skills/resolve-conflicts/scripts/extract_conflict_context.py --file path/to/file
```

This prints nearby context, the `ours` / `base` / `theirs` sections for each hunk, and a compact diff between `ours` and `theirs`. Then:

- Take one side wholesale with `git checkout --ours -- <file>` or `git checkout --theirs -- <file>` only when the other side's change is already included or no longer applies.
- Otherwise edit the file to combine both changes and remove the markers.
- Don't invent new behaviour while resolving. If both sides changed the same logic and any resolution loses one side's behaviour, stop and ask the user, showing both versions.

### 5. Repo rules

| File                                                           | Resolution                                                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm-lock.yaml`                                               | Never hand-edit. Take either side (`git checkout --theirs -- pnpm-lock.yaml`), resolve `package.json` and `pnpm-workspace.yaml`, then run `vp install` to regenerate it. |
| `packages/backend/convex/_generated/*`                         | Keep both sides' modules and components. These are hand-edited until `convex dev` regenerates them.                                                                      |
| `tasks/**`, `docs/plans/**`, `docs/decisions/**`               | Keep both sides' entries. If both added an ADR with the same number, renumber this branch's ADR to the next free number and update links to it.                          |
| `skills-lock.json`, `.claude/settings.json`, `AGENTS.md` lists | Keep both sides' entries, in alphabetical order where the list already is.                                                                                               |

### 6. Check nothing is left

```bash
python3 .claude/skills/resolve-conflicts/scripts/extract_conflict_context.py
git diff --name-only --diff-filter=U
git grep -nE '^(<<<<<<<|=======|>>>>>>>)( |$)' -- . ':!*.md'
```

No unmerged paths and no markers may remain. The `git grep` skips Markdown, where `=======` can be a heading underline; check conflicted Markdown files by eye.

### 7. Validate and commit

- Run `vp install` if any `package.json`, `pnpm-workspace.yaml` or the lockfile changed.
- Run `vp check`, `vp test` and `vp run build`, and fix what fails. A failure in code neither side touched is still caused by the merge if it passes on both parents.
- Stage the resolved files and finish the merge with `git commit`, using the subject `chore: merge master into <branch>` and the `commit` skill's attribution trailer. The body lists each conflicted file and how it was resolved, in one line each.
- Push with `git push`.

## Script options

| Command                        | Output                                  |
| ------------------------------ | --------------------------------------- |
| no arguments                   | summary only                            |
| `--file <path>`                | detailed view for one file              |
| `--all`                        | detailed view for every conflicted file |
| `--json`                       | JSON instead of text                    |
| `--context N`, `--max-lines N` | tune how much context each hunk shows   |

The script needs Python 3 and only runs local `git` commands.
