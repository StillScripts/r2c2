<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Skills

Use these project skills (in `.claude/skills/`) for each step:

- `handle-task`: run one task end to end, from task to a PR ready for review, chaining the skills below.
- `create-task`: create a task in `tasks/<status>/<slug>.md`.
- `task-management`: track and move tasks in `tasks/`.
- `create-plan`: plan a task in `docs/plans/<slug>.md`.
- `document-decisions`: record a decision as an ADR in `docs/decisions/`.
- `create-branch`: create a branch.
- `commit`: stage the right changes and commit.
- `create-pr`: open a draft pull request, or update one.
- `mark-pr-ready`: move the task to done and mark its draft PR ready for review.
- `fix-ci`: fix failing GitHub Actions checks on a PR.
- `resolve-conflicts`: resolve merge conflicts, including a PR that conflicts with `master`. Use it every time conflicts come up, in or outside a task.
- `find-skills`: find and install new skills.

`.claude/settings.json` allows all of them to run without a permission prompt; add new skills there too.

# Installing Agent Skills

Install skills from [skills.sh](https://skills.sh) at project level for Claude Code only, copying the files into `.claude/skills/`:

```sh
npx skills add <owner/repo> -s <skill-name> -a claude-code --copy -y
```

- `-a claude-code` installs only for Claude Code, so no `.agents/` directory or other agent folders are created.
- `--copy` writes real files into `.claude/skills/` instead of symlinks.
- Do not pass `-g`; skills belong to this project, not the user's global config.
- Commit both `.claude/skills/<skill-name>/` and the updated `skills-lock.json`.

## Adapting a skill

Skills here are usually adapted from others and renamed to short verb-first names. When you change or rename one (see [ADR-001](docs/decisions/ADR-001-adopt-and-adapt-agent-skills.md)):

- Remove its entry from `skills-lock.json` so `npx skills update` doesn't overwrite it. Only unmodified skills stay in the lock file (currently just `find-skills`).
- Credit the original right under the skill's heading with one line: ``> **Source:** adapted from [`owner/repo` › `path`](link), copied <date> (<licence>, see `LICENSE.txt`). **Changes:** <what changed>.``
- Copy the source repository's licence into the skill folder as `LICENSE.txt`.

# Task Tracking

Track work as one markdown file per task under `tasks/<status>/<slug>.md`, where the folder (`active`, `waiting-on`, `someday`, `done`) is the status. See `tasks/README.md` and the `task-management` skill.

The project spec is `SPEC.md`; tasks taken from it link the sections to read before starting.

# Plans and Decisions

The task slug is the shared id: a task, its plan, and its branch all use the same `<slug>`.

- **Plans** live at `docs/plans/<slug>.md`, written by the `create-plan` skill. Frontmatter is `title`, `depth` (`simple` or `detailed`) and `created`, plus `decisions` once a plan has ADRs. A task links to its plan with `plan: docs/plans/<slug>.md`. Small tasks need no plan. Keep a plan up to date if the work diverges from it.
- **Decisions** are ADRs at `docs/decisions/ADR-NNN-<kebab-title>.md`, written by the `document-decisions` skill, numbered in sequence and never deleted. Write one for any choice that is expensive to reverse: a library or framework, a data model, auth, hosting, a public API contract, or a repo-wide convention.
- Plans and ADRs link both ways: an ADR from a plan lists it under `## Related`, and the plan lists the ADR under `decisions:` and in its `## Decisions` section.
- Write `vp` commands (e.g. `vp check`, `vp test`, `vp run <script>`) rather than `npm`/`pnpm` ones in docs, READMEs, and plans.

# Naming Conventions

Sentry's conventions are the reference ([ADR-002](docs/decisions/ADR-002-use-sentry-naming-conventions.md)). `create-branch`, `commit`, and `create-pr` all use them.

- **Types:** `feat`, `fix`, `ref`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `meta`, `license`, `revert`. Use `ref` for restructuring, not `refactor`.
- **Slugs:** kebab-case ASCII, 3–6 words, no leading article. One slug names a task, its plan, and its branch.
- **Branches:** `<type>/<slug>`, with no username prefix.
- **Commit subjects and PR titles:** `<type>(<scope>): <summary>`. The scope is optional and names the workspace or area (`loft`, `ui`, `skills`, `tasks`, `docs`). Imperative mood, lowercase after the colon, no trailing period, at most 72 characters. Add `!` only for a breaking change and explain it in the body.
- **Issue references:** `Fixes #N` closes an issue; `Refs #N` only links it.
- **Attribution:** every commit an agent writes ends with a `Co-Authored-By: <model name> <noreply@anthropic.com>` trailer naming the model, so commits can later be charted by model.
