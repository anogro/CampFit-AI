import { describe, expect, it } from "vitest"
import { campfitRedirectPath } from "@/app/campfit/redirectToCampfit"

describe("campfitRedirectPath", () => {
  it("redirects legacy routes to the canonical CampFit path", () => {
    expect(campfitRedirectPath()).toBe("/campfit")
  })

  it("preserves demo and embedded query parameters", () => {
    expect(campfitRedirectPath({ demo: "1", embedded: "1" })).toBe("/campfit?demo=1&embedded=1")
  })

  it("preserves repeated query parameters and omits undefined values", () => {
    expect(campfitRedirectPath({ tag: ["one", "two"], empty: undefined })).toBe("/campfit?tag=one&tag=two")
  })
})
