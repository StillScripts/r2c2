# R2C2

React + R2, Convex + Cloudflare. See `SPEC.md` for what we're building and `tasks/` for the work.

## Getting started

Needs Node 24 and [Vite+](https://viteplus.dev/guide/) (`vp`), which manages pnpm for you.

```bash
vp install   # install every workspace package
vp run dev   # start the Loft
vp run --filter docs dev # start the docs site
vp check     # format, lint and type check the whole repo
vp test      # run every package's tests
vp run build # build every app
```

Versions are pinned once, in the `catalog` in `pnpm-workspace.yaml`; packages depend on
`catalog:`. Internal packages ship as source and are used with `workspace:*`.

## Adding components

To add shadcn components for the Loft, run this from the repo root:

```bash
vp dlx shadcn@latest add button -c apps/loft
```

This puts the components in `packages/ui/src/components`. Import them from the `ui`
package:

```tsx
import { Button } from "@workspace/ui/components/button"
```

## License

[MIT](LICENSE)
