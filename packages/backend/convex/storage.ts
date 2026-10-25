import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { R2 } from "@convex-dev/r2"
import { components } from "./_generated/api"
import { internalAction } from "./_generated/server"

export const r2 = new R2(components.r2)

/**
 * Write an object to the sites bucket under a key from `@workspace/core`. It goes
 * straight to S3, not through the component's `store`: that can't set custom metadata,
 * and it refuses to rewrite a key it already tracks, which republishing does.
 */
export async function putObject(
  key: string,
  body: string | Uint8Array<ArrayBuffer>,
  contentType: string,
  metadata?: Record<string, string>
) {
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    })
  )
  return key
}

export async function objectExists(key: string) {
  try {
    await r2.client.send(
      new HeadObjectCommand({ Bucket: r2.config.bucket, Key: key })
    )
    return true
  } catch (error) {
    if (error instanceof NotFound) return false
    throw error
  }
}

export async function getObjectText(key: string) {
  const response = await fetch(await r2.getUrl(key))
  if (!response.ok) throw new Error(`R2 GET ${key}: ${response.status}`)
  return response.text()
}

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
  handler: async () => {
    const key = `_check/${crypto.randomUUID()}.txt`
    const body = `r2c2 check ${new Date().toISOString()}`
    await step("write", () => putObject(key, body, "text/plain"))
    const read = await step("read", () => getObjectText(key))
    await step("delete", () =>
      r2.client.send(
        new DeleteObjectCommand({ Bucket: r2.config.bucket, Key: key })
      )
    )
    if (read !== body) throw new Error("R2 check read back different content")
    return { ok: true }
  },
})
