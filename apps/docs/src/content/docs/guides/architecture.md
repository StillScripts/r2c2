---
title: Architecture
description: How the pieces of R2C2 fit together.
sidebar:
  order: 2
---

:::note
This guide is a stub. The full reference for now is [`SPEC.md`](https://github.com/StillScripts/r2c2/blob/master/SPEC.md).
:::

R2C2 runs many websites from one Cloudflare Worker. Pages are written in the Loft, frozen to plain HTML in R2 at publish time, and served from Cloudflare's edge, so a visit almost never runs our code. Convex holds sites, drafts, versions and enquiries, but it is never in the path that serves a page.

| Workspace           | What it is                                                    |
| ------------------- | ------------------------------------------------------------- |
| `apps/loft`         | The Loft, a TanStack Start app where staff manage their sites |
| `apps/edge`         | The Cloudflare Worker that serves every published page        |
| `apps/docs`         | This site                                                     |
| `packages/backend`  | Convex schema, functions and the publish pipeline             |
| `packages/core`     | Shared contracts: zod schemas for anything crossing a network |
| `packages/elements` | Custom elements shipped to public pages, like `<site-form>`   |
| `packages/html`     | The HTML pipeline that cleans and freezes pages               |
| `packages/ui`       | shadcn components on Base UI, shared by the Loft              |
