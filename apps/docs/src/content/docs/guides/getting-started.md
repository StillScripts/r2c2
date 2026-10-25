---
title: Getting started
description: Install the toolchain and run R2C2 locally.
sidebar:
  order: 1
---

R2C2 needs Node 24 and [Vite+](https://viteplus.dev/guide/) (`vp`), which manages pnpm for you.

```bash
vp install   # install every workspace package
vp run dev   # start the Loft
vp check     # format, lint and type check the whole repo
vp test      # run every package's tests
vp run build # build every app
```

Versions are pinned once, in the `catalog` in `pnpm-workspace.yaml`; packages depend on `catalog:`. Internal packages ship as source and are used with `workspace:*`.

## Running these docs

```bash
vp run --filter docs dev
```

The site copies `docs/plans`, `docs/decisions` and `tasks/` into `apps/docs/src/content/` every time it starts or builds, and again whenever one of those files changes in dev. Edit the originals; the copies are ignored by git.
