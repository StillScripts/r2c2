---
title: Run long Loft jobs in the background
created: 2026-10-28
---

Work that takes more than about 10 seconds, like translating a page or checking every link, becomes a job. That means a jobs table with progress, run through the Convex scheduler or the workflow component. Jobs show in the header pill and the "In the background" panel, and report back in their conversation when done.

Done when a long request moves to the background, shows live progress, can be stopped, and posts its result when it finishes.

Related: [Loft design spec §7](../../docs/design/loft.md#7-components), [§9](../../docs/design/loft.md#9-behaviour), [build-conversation-first-loft](build-conversation-first-loft.md)
