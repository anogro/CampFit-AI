import { describe, expect, it } from "vitest"
import { findForbiddenLegacyField, StrictCreateV2SessionSchema } from "@/lib/campfit/v2/apiSchemas"

const validPayload = {
  requiredIntake: {
    childAgeAtStart: 8,
    departureWindow: "summer_break",
    durationWeeksMin: 2,
    durationWeeksMax: 2,
    totalBudgetAllInKrwMin: 5_000_000,
    totalBudgetAllInKrwMax: 8_000_000,
    budgetScope: "family_total",
    travelerCounts: { child: 1, parent: 1, sibling: 0 },
    preferredRegionGroups: ["oceania"],
    regionPriority: "strong",
    parentAccompanimentMode: "parent_can_stay",
    koreanSupportNeed: "daily_korean_communication",
    accommodationPreferences: ["parent_stay"],
  },
  naturalInput: {
    situationText: "호주나 뉴질랜드 스쿨링이 좋아 보이지만 영어 초급이라 걱정돼요.",
  },
} as const

describe("CampFit v2 API schemas", () => {
  it("Given valid v2 session payload When parsed Then it succeeds", () => {
    const parsed = StrictCreateV2SessionSchema.safeParse(validPayload)

    expect(parsed.success).toBe(true)
  })

  it("Given grade field When scanning payload Then forbidden field is detected", () => {
    const forbidden = findForbiddenLegacyField({ ...validPayload, requiredIntake: { ...validPayload.requiredIntake, grade: "초2" } })

    expect(forbidden).toBe("grade")
  })

  it("Given budgetIncludesFlight field When scanning payload Then forbidden field is detected", () => {
    const forbidden = findForbiddenLegacyField({ ...validPayload, budgetIncludesFlight: true })

    expect(forbidden).toBe("budgetIncludesFlight")
  })
})
