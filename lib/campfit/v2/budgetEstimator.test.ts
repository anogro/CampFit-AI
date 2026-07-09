import { describe, expect, it } from "vitest"
import { estimateAvailableProgramBudget, type TravelCostAssumption } from "@/lib/campfit/v2/budgetEstimator"
import type { RequiredIntake } from "@/types/campfitV2"

const requiredIntake: RequiredIntake = {
  childAgeAtStart: 8,
  departureWindow: "summer_break",
  durationWeeksMin: 2,
  durationWeeksMax: 3,
  totalBudgetAllInKrwMin: 5_000_000,
  totalBudgetAllInKrwMax: 8_000_000,
  budgetScope: "family_total",
  travelerCounts: { child: 1, parent: 1, sibling: 0 },
  preferredRegionGroups: ["oceania"],
  regionPriority: "strong",
  parentAccompanimentMode: "parent_can_stay",
  koreanSupportNeed: "daily_korean_communication",
  accommodationPreferences: ["parent_stay"],
}

const assumption: TravelCostAssumption = {
  regionGroup: "oceania",
  season: "default",
  flightPerPersonKrwMin: 1_000_000,
  flightPerPersonKrwMax: 1_500_000,
  visaInsuranceKrwMin: 100_000,
  visaInsuranceKrwMax: 200_000,
  localTransportKrwMin: 100_000,
  localTransportKrwMax: 200_000,
  parentStayPerWeekKrwMin: 300_000,
  parentStayPerWeekKrwMax: 500_000,
  contingencyBufferRate: 0.1,
}

describe("estimateAvailableProgramBudget", () => {
  it("Given no travel cost assumption When estimating Then marks unknown and avoids forced budget values", () => {
    const estimates = estimateAvailableProgramBudget({ requiredIntake, assumptions: [] })

    expect(estimates[0]?.flags).toContain("unknown_cost_assumption")
    expect(estimates[0]?.availableProgramBudgetKrwMin).toBeUndefined()
    expect(estimates[0]?.note).toContain("상담 전 확인")
  })

  it("Given parent count and assumption When estimating Then subtracts parent stay cost", () => {
    const withParent = estimateAvailableProgramBudget({ requiredIntake, assumptions: [assumption] })
    const withoutParent = estimateAvailableProgramBudget({
      requiredIntake: { ...requiredIntake, travelerCounts: { child: 1, parent: 0, sibling: 0 } },
      assumptions: [assumption],
    })

    expect(withParent[0]?.availableProgramBudgetKrwMax).toBeLessThan(
      withoutParent[0]?.availableProgramBudgetKrwMax ?? Number.POSITIVE_INFINITY,
    )
    expect(withParent[0]?.flags).toContain("comparison_estimate")
  })

  it("Given estimator output When serialized Then separate flight-inclusion concept is absent", () => {
    const estimates = estimateAvailableProgramBudget({ requiredIntake, assumptions: [assumption] })

    expect(JSON.stringify(estimates)).not.toMatch(/\bbudgetIncludesFlight\b/)
  })
})
