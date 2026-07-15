import { describe, expect, it } from "vitest"
import { shouldDiscardStoredCampfitV3Session } from "@/components/campfit/v3/sessionMode"

describe("CampFit v3 session mode isolation", () => {
  it("discards a production session when demo mode is requested", () => {
    expect(shouldDiscardStoredCampfitV3Session(true, false)).toBe(true)
    expect(shouldDiscardStoredCampfitV3Session(true, undefined)).toBe(true)
  })

  it("discards a demo session when production mode is requested", () => {
    expect(shouldDiscardStoredCampfitV3Session(false, true)).toBe(true)
  })

  it("keeps sessions when the requested mode matches", () => {
    expect(shouldDiscardStoredCampfitV3Session(true, true)).toBe(false)
    expect(shouldDiscardStoredCampfitV3Session(false, false)).toBe(false)
    expect(shouldDiscardStoredCampfitV3Session(false, undefined)).toBe(false)
  })
})
