---
title: T03 Add shared contracts
created: 2026-10-24
---

Build `packages/core`, the helpers and contracts the edge and backend share.

- Host and path normalisation, tracking-param stripping, R2 key helpers, routing entry types, header builders, cache tag helpers
- Request signing: `sign()` and `verify()` with Web Crypto, 60-second window
- zod schema for the enquiry API

Done when unit tests cover every path rule, key helper and signing case, including expired and tampered signatures.

Spec: [SPEC §5](../../SPEC.md)
