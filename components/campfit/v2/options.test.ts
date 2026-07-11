import { describe, expect, it } from "vitest"
import { initialRequiredIntake } from "@/components/campfit/v2/options"
import { canContinueRequiredIntake } from "@/components/campfit/v2/RequiredIntakeForm"

describe("CampFit v2 required intake defaults", () => {
  it("Given the first survey page When it opens Then no tile option is preselected", () => {
    expect(initialRequiredIntake.preferredRegionGroups).toEqual([])
    expect(initialRequiredIntake.accommodationPreferences).toEqual([])
  })

  it("Given no preferred region When checking progression Then the next step is unavailable", () => {
    expect(canContinueRequiredIntake(initialRequiredIntake)).toBe(false)
    expect(canContinueRequiredIntake({ ...initialRequiredIntake, preferredRegionGroups: ["undecided"] })).toBe(true)
  })
})
