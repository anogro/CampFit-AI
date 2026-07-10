import { describe, expect, it } from "vitest"
import { programModeProfiles } from "@/lib/campfit/v2/programModeProfiles"

describe("programModeProfiles", () => {
  it("defines all ten program modes with display and fit metadata", () => {
    expect(programModeProfiles).toHaveLength(10)

    for (const profile of programModeProfiles) {
      expect(profile.title.length).toBeGreaterThan(0)
      expect(profile.imageKey.length).toBeGreaterThan(0)
      expect(profile.imageAlt.length).toBeGreaterThan(0)
      expect(profile.imageTheme.length).toBeGreaterThan(0)
      expect(profile.englishExposure).toBeGreaterThanOrEqual(1)
      expect(profile.englishExposure).toBeLessThanOrEqual(5)
      expect(profile.budgetPressure).toBeGreaterThanOrEqual(1)
      expect(profile.budgetPressure).toBeLessThanOrEqual(5)
    }
  })
})
