import { describe, expect, it } from "vitest"
import {
  countCompletedChildRows,
  emptyCampfitV3IntakeDraft,
  intakeDraftFromBasicInfo,
  parseStoredIntakeDraft,
  validateCampfitV3IntakeDraft,
  type CampfitV3IntakeDraft,
} from "@/components/campfit/v3/intakeDraft"

describe("CampFit v3 intake draft", () => {
  it("starts with one blank child row and no confirmed values", () => {
    const validation = validateCampfitV3IntakeDraft(emptyCampfitV3IntakeDraft)
    expect(emptyCampfitV3IntakeDraft.childAges).toEqual([""])
    expect(countCompletedChildRows(emptyCampfitV3IntakeDraft)).toBe(0)
    expect(validation.value).toBeNull()
    expect(validation.errors.childAges[0]).toContain("나이")
    expect(validation.errors.durationWeeks).not.toBeNull()
    expect(validation.errors.budget).not.toBeNull()
    expect(validation.errors.adultCount).not.toBeNull()
  })

  it("accepts the 5 and 12 year age boundaries", () => {
    const draft = completeDraft({ childAges: ["5", "12"] })
    const validation = validateCampfitV3IntakeDraft(draft)
    expect(validation.errors.childAges).toEqual([null, null])
    expect(validation.value?.childAges).toEqual([5, 12])
    expect(validation.value?.childCount).toBe(2)
    expect(countCompletedChildRows(draft)).toBe(2)
  })

  it("rejects ages outside the 5 to 12 year range", () => {
    const draft = completeDraft({ childAges: ["4", "13"] })
    const validation = validateCampfitV3IntakeDraft(draft)
    expect(validation.value).toBeNull()
    expect(validation.errors.childAges).toEqual([
      "만 5세부터 12세까지 입력해 주세요.",
      "만 5세부터 12세까지 입력해 주세요.",
    ])
    expect(countCompletedChildRows(draft)).toBe(0)
  })

  it("derives a valid basic-info payload from every completed child row", () => {
    const validation = validateCampfitV3IntakeDraft(completeDraft({ childAges: ["7", "9", "11"], adultCount: 2 }))
    expect(validation.value).toMatchObject({
      childAges: [7, 9, 11],
      childCount: 3,
      adultCount: 2,
      guardianStaysNearby: true,
    })
  })

  it("round-trips a submitted value back into an editable draft", () => {
    const value = validateCampfitV3IntakeDraft(completeDraft({ childAges: ["6", "10"], budgetMode: "custom", budgetMinManwon: "650", budgetMaxManwon: "900" })).value
    expect(value).not.toBeNull()
    const draft = intakeDraftFromBasicInfo(value!)
    expect(parseStoredIntakeDraft(draft)).toEqual(draft)
    expect(validateCampfitV3IntakeDraft(draft).value).toEqual(value)
  })

  it("keeps an overlong departure as an invalid draft instead of creating a payload", () => {
    const validation = validateCampfitV3IntakeDraft(completeDraft({ departureWindow: "가".repeat(81) }))
    expect(validation.value).toBeNull()
    expect(validation.errors.departureWindow).toContain("80자")
  })
})

function completeDraft(overrides: Partial<CampfitV3IntakeDraft> = {}): CampfitV3IntakeDraft {
  return {
    childAges: ["8"],
    departureWindow: "다음 여름방학",
    durationWeeks: 2,
    budgetMode: "preset-1",
    budgetMinManwon: "",
    budgetMaxManwon: "",
    adultCount: 1,
    ...overrides,
  }
}
