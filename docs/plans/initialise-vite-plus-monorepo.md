---
title: T01 Initialise the monorepo
depth: simple
created: 2026-10-25
---

# T01 Initialise the monorepo

Bring the existing Vite+ workspace in line with SPEC §2 and §3 so every later task starts
from the same base: pnpm 12 with every version pinned once in the catalog, TypeScript 7,
one root `vite.config.ts` that formats, lints, type checks and tests the whole repo, and
the empty packages the spec lays out. `vp` replaces turbo and the per-package ESLint.

## Scope

- In: `pnpm-workspace.yaml`, root `package.json`, `vite.config.ts`, `tsconfig.json` and
  `.gitignore`; `apps/loft` and `packages/ui` dependencies and scripts; new empty
  `packages/core`, `packages/html`, `packages/elements` and `packages/backend`; README
  commands; fixing the two files `vp check` already flags.
- Out: `apps/edge` (T04), `sites/r2c2` (T22), Convex, auth and any dependency only a
  later task needs (they add their own catalog entries), CI (T02).

## Action items

- [x] Move to pnpm 12 (`packageManager`), and in `pnpm-workspace.yaml` set the catalog
      to exact pins for what the repo uses today (react, react-dom, TanStack Start and
      Router, Tailwind, `@vitejs/plugin-react`, Base UI, TypeScript 7.0.2,
      `@types/*`), plus the overrides, peer rules and `allowBuilds` from SPEC §2.
- [x] Point every workspace dependency at `catalog:`, removing `latest`, `^` ranges and
      the unused starter packages (`@turbo/gen`, ESLint, `zod` in `packages/ui`; T03
      adds `zod` to `packages/core`). `cn` and `shadcn` stay: the button and
      `globals.css` import them.
- [x] Remove turbo (`turbo.json`, root scripts) and ESLint in `packages/ui`
      (`eslint.config.*`, `tsconfig.lint.json`, `@tanstack/eslint-config`); root scripts
      become `vp run` ones and per-package `lint`/`format`/`typecheck` scripts go, since
      `vp check` covers them from the root. The npm-only `.npmrc` and the
      `.prettierignore` that duplicated `fmt.ignorePatterns` go too.
- [x] Set Node 24 in `engines`, and make the root `tsconfig.json` the shared base that
      each package extends.
- [x] Add a `test` block to the root `vite.config.ts` with `projects` over `apps/*` and
      `packages/*`, passing when there are no tests yet.
- [x] Add `packages/core`, `html`, `elements` and `backend`, each a private
      `@workspace/<name>` package whose `exports` point at `src/index.ts`, with a
      one-line README of what will live there.
- [x] Fix the formatting `vp check` reports (`routeTree.gen.ts` via an ignore, since it's
      generated; `globals.css`) and update README commands.
- [x] Verify on a clean clone: `vp install`, `vp check`, `vp test` and `vp build` in
      `apps/loft` all pass, and the dev server still serves the Loft.

New packages are named `@workspace/<name>` to match `@workspace/ui`.
