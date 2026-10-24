---
title: T07 Build the gateway
created: 2026-10-24
---

Route each request to the right site before it reaches the renderer.

- Normalise the request, read the KV entry, handle unknown host, redirect and coming-soon
- Calls the renderer with `props: { siteId }`

Done when a test proves two sites with an `/about` page never share a cache entry.

Spec: [SPEC §4, §5](../../SPEC.md)
