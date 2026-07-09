import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { RequiredIntakeSchema } from "@/lib/campfit/v2/schemas"

const migrationPath = path.join(process.cwd(), "supabase", "migrations", "202607070001_campfit_v2_schema.sql")

const baseRequiredIntake = {
  childAgeAtStart: 8,
  departureWindow: "summer_break",
  durationWeeksMin: 2,
  durationWeeksMax: 4,
  totalBudgetAllInKrwMin: 5000000,
  totalBudgetAllInKrwMax: 8000000,
  budgetScope: "family_total",
  travelerCounts: {
    child: 1,
    parent: 1,
    sibling: 0,
  },
  preferredRegionGroups: ["oceania"],
  regionPriority: "strong",
  parentAccompanimentMode: "parent_can_stay",
  koreanSupportNeed: "daily_korean_communication",
  accommodationPreferences: ["parent_stay", "hotel_resort"],
} as const

describe("CampFit v2 schemas", () => {
  it("Given required intake When child age is missing Then parsing fails", () => {
    const { childAgeAtStart: _childAgeAtStart, ...input } = baseRequiredIntake

    const parsed = RequiredIntakeSchema.safeParse(input)

    expect(parsed.success).toBe(false)
  })

  it("Given required intake When a school-year field is present Then parsing fails", () => {
    const parsed = RequiredIntakeSchema.safeParse({ ...baseRequiredIntake, schoolGrade: "초2" })

    expect(parsed.success).toBe(false)
  })

  it("Given required intake When a separate flight-inclusion field is present Then parsing fails", () => {
    const parsed = RequiredIntakeSchema.safeParse({ ...baseRequiredIntake, budgetIncludesFlight: true })

    expect(parsed.success).toBe(false)
  })

  it("Given required intake When total all-in budget is negative Then parsing fails", () => {
    const parsed = RequiredIntakeSchema.safeParse({ ...baseRequiredIntake, totalBudgetAllInKrwMin: -1 })

    expect(parsed.success).toBe(false)
  })

  it("Given required intake When duration is negative Then parsing fails", () => {
    const parsed = RequiredIntakeSchema.safeParse({ ...baseRequiredIntake, durationWeeksMax: -1 })

    expect(parsed.success).toBe(false)
  })
})

describe("CampFit v2 question bank seed", () => {
  it("Given seed SQL When scanned Then no school-year question key exists", () => {
    const sql = readFileSync(migrationPath, "utf8")

    expect(sql).not.toMatch(/\b(?:grade|school_grade|schoolGrade|grade_level|gradeLevel)\b/i)
  })

  it("Given seed SQL When scanned Then no separate flight-inclusion question key exists", () => {
    const sql = readFileSync(migrationPath, "utf8")

    expect(sql).not.toMatch(/\b(?:budget_includes_flight|budgetIncludesFlight|flightIncludedInBudget)\b/)
  })
})
