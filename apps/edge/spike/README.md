# Workers Cache spike (T05)

A throwaway Worker that checks the three Workers Cache behaviours SPEC §10 depends on. It mirrors the real edge: a gateway calls a `Renderer` entrypoint with `props: { siteId }`, and the renderer sets `cache-control` and `cache-tag` and purges with `ctx.cache.purge`.

```bash
cd apps/edge
vp exec wrangler login                         # once
vp run spike:deploy                            # prints the workers.dev URL
vp run spike:check -- https://r2c2-cache-spike.<you>.workers.dev
vp run spike:delete                            # remove it afterwards
```

`spike:check` prints PASS/FAIL lines, then a JSON blob to paste into the chat. That result becomes the ADR choosing Workers Cache or the Cache API fallback.

The check runs from one location, so "purge clears every location" is only checked where you are. Running it again from a different region (a VPN, say) covers the rest.
