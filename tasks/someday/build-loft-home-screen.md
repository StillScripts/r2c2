---
title: Build the Loft home screen
created: 2026-10-28
---

The screen you land on: a greeting by time of day and a one-line summary of what happened since your last visit. Below that, the big talk-or-type input (behind a flag until the conversation ships) and live suggestion chips. Then "Lately", built from `auditLog` and new enquiries, and your sites. This needs `lastSeenAt` on the user's preferences.

Done when Home shows real activity for R2C2 ("2 new enquiries", "Published /pricing") with no actor or tool names.

Related: [Loft design spec §8](../../docs/design/loft.md#8-screens), [§9](../../docs/design/loft.md#9-behaviour), [reskin-loft-in-views-shell](reskin-loft-in-views-shell.md)
