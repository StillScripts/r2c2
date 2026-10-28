---
title: Add the Harbour, Coast and Alps views
created: 2026-10-28
---

Add a `LoftView` component that draws the chosen view behind the Loft (the scene SVG, the vignette and, on desktop, the window frame). Add a view switcher in the header and a per-user preference in Convex, so the choice follows you across devices. New users get Harbour.

Done when switching views cross-fades, the choice survives a reload and a second device, and screen readers skip the view.

Related: [Loft design spec §5](../../docs/design/loft.md#5-views), [ADR-017](../../docs/decisions/ADR-017-call-loft-scenes-views.md), [add-loft-glass-design-tokens](add-loft-glass-design-tokens.md)
