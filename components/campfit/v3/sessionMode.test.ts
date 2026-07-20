import { describe, expect, it } from "vitest"
import {
  shouldDiscardStoredCampfitV3Session,
  shouldRefreshStoredCampfitV3Result,
} from "@/components/campfit/v3/sessionMode"

describe("CampFit v3 session mode isolation", () => {
  it("separates demo and production sessions", () => {
    expect(shouldDiscardStoredCampfitV3Session(true, false)).toBe(true)
    expect(shouldDiscardStoredCampfitV3Session(true, undefined)).toBe(true)
    expect(shouldDiscardStoredCampfitV3Session(false, true)).toBe(true)
  })

  it("keeps sessions when the requested mode matches", () => {
    expect(shouldDiscardStoredCampfitV3Session(true, true)).toBe(false)
    expect(shouldDiscardStoredCampfitV3Session(false, false)).toBe(false)
    expect(shouldDiscardStoredCampfitV3Session(false, undefined)).toBe(false)
  })

  it("refreshes a matching demo session that only contains an empty result", () => {
    expect(shouldRefreshStoredCampfitV3Result({
      demoRequested: true,
      savedDemoMode: true,
      savedStage: "result",
      destinationCount: 0,
      programCount: 0,
    })).toBe(true)
    expect(shouldRefreshStoredCampfitV3Result({
      demoRequested: true,
      savedDemoMode: true,
      savedStage: "result",
      destinationCount: 3,
      programCount: 6,
    })).toBe(false)
    expect(shouldRefreshStoredCampfitV3Result({
      demoRequested: false,
      savedDemoMode: true,
      savedStage: "result",
      destinationCount: 0,
      programCount: 0,
    })).toBe(false)
  })
})
