import { R2 } from "@convex-dev/r2"
import { components } from "./_generated/api"
import { type ActionCtx, internalAction } from "./_generated/server"

export const r2 = new R2(components.r2)

/** Write an object to the sites bucket under a key from `@workspace/core`. */
export const putObject = (
  ctx: ActionCtx,
  key: string,
  body: string | Uint8Array<ArrayBuffer>,
  contentType: string
) =>
  r2.store(ctx, new Blob([body], { type: contentType }), {
    key,
    type: contentType,
  })

async function step<T>(name: string, run: () => Promise<T>) {
  try {
    return await run()
  } catch (error) {
    throw new Error(`R2 check failed at ${name}: ${String(error)}`)
  }
}

/** Prove the deployment can write, read and delete in R2: `vp run --filter @workspace/backend r2:check`. */
export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    const key = `_check/${crypto.randomUUID()}.txt`
    const body = `r2c2 check ${new Date().toISOString()}`
    await step("write", () => putObject(ctx, key, body, "text/plain"))
    const read = await step("read", async () => {
      const response = await fetch(await r2.getUrl(key))
      if (!response.ok) throw new Error(`GET ${response.status}`)
      return response.text()
    })
    await step("delete", () => r2.deleteObject(ctx, key))
    if (read !== body) throw new Error("R2 check read back different content")
    return { ok: true }
  },
})
