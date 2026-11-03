import { describe, expect, it } from "vite-plus/test"
import { switchView } from "./views"

describe("switchView", () => {
  it("fades out the view being left", () => {
    expect(switchView({ shown: "harbour" }, "coast")).toEqual({
      shown: "coast",
      leaving: "harbour",
    })
  })

  it("drops a view that was already fading when switching again", () => {
    expect(switchView({ shown: "coast", leaving: "harbour" }, "alps")).toEqual({
      shown: "alps",
      leaving: "coast",
    })
  })

  it("keeps the layers when the view hasn't changed", () => {
    const layers = { shown: "alps" as const, leaving: "coast" as const }
    expect(switchView(layers, "alps")).toBe(layers)
  })
})
