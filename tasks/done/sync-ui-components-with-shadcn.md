---
title: Sync hand-written UI components with the shadcn registry
created: 2026-10-25
completed: 2026-10-27
---

`Input`, `Label` and `AlertDialog` in `packages/ui/src/components/` were written by hand in agent sessions, because the shadcn registry (`ui.shadcn.com`) was blocked there. They copy `Button`'s `base-rhea` style but may differ from what the registry ships.

Run this locally, where the registry is reachable:

- Re-add each with `vp dlx shadcn@latest add input label alert-dialog -c apps/loft`, overwriting the hand-written files
- Compare the diffs, keep anything the Loft relies on (for example `AlertDialog`'s exported parts used by the editor and History page), and fix the call sites if the registry's API differs
- Check the sign-in page, the page editor's Publish dialog and the History page still look and behave right

Done when the three components match the registry output and `vp check`, `vp test` and `vp run build` pass.

Related: `scaffold-loft-app`, `add-pages-and-html-editor`, `add-versions-and-history-ui`
