import { describe, expect, it } from "vite-plus/test"
import { hashContent, sha256Hex } from "./hash"

describe("sha256Hex", () => {
  it("hashes strings and bytes the same way", async () => {
    const expected =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    expect(await sha256Hex("hello")).toBe(expected)
    expect(await sha256Hex(new TextEncoder().encode("hello"))).toBe(expected)
  })
})

describe("hashContent", () => {
  it("keeps the first 16 hex characters", async () => {
    expect(await hashContent("hello")).toBe("2cf24dba5fb0a30e")
  })
})
