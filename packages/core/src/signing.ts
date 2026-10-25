import { sha256Hex, toHex } from "./hash"

export const SIGNATURE_HEADER = "x-r2c2-signature"
export const SITE_HEADER = "x-r2c2-site"
export const SIGNATURE_WINDOW_SECONDS = 60

export type SignedRequest = {
  siteId: string
  method: string
  path: string
  body: string | Uint8Array<ArrayBuffer>
}

const encoder = new TextEncoder()

const fromHex = (hex: string) =>
  Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16))

const keys = new Map<string, Promise<CryptoKey>>()

function importKey(secret: string) {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    )
    keys.set(secret, key)
  }
  return key
}

const prepare = (secret: string, request: SignedRequest, timestamp: number) =>
  Promise.all([importKey(secret), canonical(request, timestamp)])

async function canonical(request: SignedRequest, timestamp: number) {
  const bodyHash = await sha256Hex(request.body)
  return encoder.encode(
    [
      timestamp,
      request.siteId,
      request.method.toUpperCase(),
      request.path,
      bodyHash,
    ].join("\n")
  )
}

const nowSeconds = (now: number) => Math.floor(now / 1000)

export async function sign(
  secret: string,
  request: SignedRequest,
  now = Date.now()
): Promise<string> {
  const timestamp = nowSeconds(now)
  const [key, message] = await prepare(secret, request, timestamp)
  const signature = await crypto.subtle.sign("HMAC", key, message)
  return `t=${timestamp},v1=${toHex(signature)}`
}

export async function signedHeaders(
  secret: string,
  request: SignedRequest,
  now = Date.now()
): Promise<Record<string, string>> {
  return {
    [SIGNATURE_HEADER]: await sign(secret, request, now),
    [SITE_HEADER]: request.siteId,
  }
}

export async function verify(
  secret: string,
  request: SignedRequest,
  header: string | null | undefined,
  now = Date.now()
): Promise<boolean> {
  const match = header?.match(/^t=(\d+),v1=([0-9a-f]{64})$/)
  if (!match) return false

  const timestamp = Number(match[1])
  if (Math.abs(nowSeconds(now) - timestamp) > SIGNATURE_WINDOW_SECONDS) {
    return false
  }
  const [key, message] = await prepare(secret, request, timestamp)
  return crypto.subtle.verify("HMAC", key, fromHex(match[2]), message)
}

/** Verify a signed request from its headers, returning the site it was signed for. */
export async function verifyRequest(
  secret: string,
  request: Request,
  body: Uint8Array<ArrayBuffer>,
  now = Date.now()
): Promise<string | null> {
  const siteId = request.headers.get(SITE_HEADER) ?? ""
  const { pathname: path } = new URL(request.url)
  const signed = await verify(
    secret,
    { siteId, method: request.method, path, body },
    request.headers.get(SIGNATURE_HEADER),
    now
  )
  return signed ? siteId : null
}
