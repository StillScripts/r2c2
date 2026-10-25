const encoder = new TextEncoder()

export const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")

export const sha256Hex = async (data: string | Uint8Array<ArrayBuffer>) =>
  toHex(
    await crypto.subtle.digest(
      "SHA-256",
      typeof data === "string" ? encoder.encode(data) : data
    )
  )
