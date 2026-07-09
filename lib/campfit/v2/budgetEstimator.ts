import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import { regionGroups } from "@/types/campfitV2"
import type { BudgetEstimate, RegionGroup, RequiredIntake } from "@/types/campfitV2"

export type TravelCostAssumption = {
  readonly regionGroup: RegionGroup
  readonly countryCode?: string
  readonly countryName?: string
  readonly season: string
  readonly flightPerPersonKrwMin?: number
  readonly flightPerPersonKrwMax?: number
  readonly visaInsuranceKrwMin?: number
  readonly visaInsuranceKrwMax?: number
  readonly localTransportKrwMin?: number
  readonly localTransportKrwMax?: number
  readonly parentStayPerWeekKrwMin?: number
  readonly parentStayPerWeekKrwMax?: number
  readonly contingencyBufferRate: number
}

type BudgetEstimatorInput = {
  readonly requiredIntake: RequiredIntake
  readonly assumptions?: readonly TravelCostAssumption[]
}

const TravelCostAssumptionRowSchema = z
  .object({
    region_group: z.enum(regionGroups),
    country_code: z.string().nullable(),
    country_name: z.string().nullable(),
    season: z.string(),
    flight_per_person_krw_min: z.number().int().min(0).nullable(),
    flight_per_person_krw_max: z.number().int().min(0).nullable(),
    visa_insurance_krw_min: z.number().int().min(0).nullable(),
    visa_insurance_krw_max: z.number().int().min(0).nullable(),
    local_transport_krw_min: z.number().int().min(0).nullable(),
    local_transport_krw_max: z.number().int().min(0).nullable(),
    parent_stay_per_week_krw_min: z.number().int().min(0).nullable(),
    parent_stay_per_week_krw_max: z.number().int().min(0).nullable(),
    contingency_buffer_rate: z.number().min(0),
  })
  .strict()

export async function getTravelCostAssumptions(): Promise<readonly TravelCostAssumption[]> {
  const client = createServerSupabaseClient()
  if (client === null) {
    return []
  }

  const { data, error } = await client
    .from("campfit_v2_travel_cost_assumptions")
    .select(
      "region_group,country_code,country_name,season,flight_per_person_krw_min,flight_per_person_krw_max,visa_insurance_krw_min,visa_insurance_krw_max,local_transport_krw_min,local_transport_krw_max,parent_stay_per_week_krw_min,parent_stay_per_week_krw_max,contingency_buffer_rate",
    )
    .eq("active", true)

  if (error) {
    console.error("CampFit v2 travel cost assumptions load failed", error.message)
    return []
  }

  return z.array(TravelCostAssumptionRowSchema).parse(data ?? []).map(mapTravelCostAssumptionRow)
}

export function estimateAvailableProgramBudget(input: BudgetEstimatorInput): readonly BudgetEstimate[] {
  const targetRegions = input.requiredIntake.preferredRegionGroups.filter(
    (region) => region !== "undecided" && region !== "no_preference",
  )
  const fallbackRegions: readonly RegionGroup[] = ["undecided"]
  const regions = targetRegions.length > 0 ? targetRegions : fallbackRegions

  return regions.map((regionGroup) => {
    const assumption = input.assumptions?.find((candidate) => candidate.regionGroup === regionGroup)
    return calculateRegionBudgetEstimate({
      requiredIntake: input.requiredIntake,
      regionGroup,
      ...(assumption === undefined ? {} : { assumption }),
    })
  })
}

export function calculateRegionBudgetEstimate(input: {
  readonly requiredIntake: RequiredIntake
  readonly regionGroup: RegionGroup
  readonly assumption?: TravelCostAssumption
}): BudgetEstimate {
  const minBudget = input.requiredIntake.totalBudgetAllInKrwMin
  const maxBudget = input.requiredIntake.totalBudgetAllInKrwMax
  if (input.assumption === undefined || minBudget === undefined || maxBudget === undefined) {
    return {
      regionGroup: input.regionGroup,
      flags: ["unknown_cost_assumption", "needs_consultation_check"],
      note: "지역별 항공권/부대비 비교용 추정치가 없어 예산 판정은 상담 전 확인이 필요합니다.",
    }
  }

  const travelCost = calculateTravelCostRange(input.requiredIntake, input.assumption)
  const availableProgramBudgetKrwMin = Math.max(0, minBudget - travelCost.max)
  const availableProgramBudgetKrwMax = Math.max(0, maxBudget - travelCost.min)

  return {
    regionGroup: input.regionGroup,
    availableProgramBudgetKrwMin,
    availableProgramBudgetKrwMax,
    flags: ["comparison_estimate", "needs_consultation_check"],
    note: "항공권 포함 총예산에서 지역별 예상 범위의 항공권/부대비를 뺀 비교용 추정입니다. 실제 견적은 상담 전 확인이 필요합니다.",
  }
}

function calculateTravelCostRange(
  requiredIntake: RequiredIntake,
  assumption: TravelCostAssumption,
): { readonly min: number; readonly max: number } {
  const travelerCount = billableTravelerCount(requiredIntake)
  const durationWeeksMin = requiredIntake.durationWeeksMin ?? requiredIntake.durationWeeksMax ?? 0
  const durationWeeksMax = requiredIntake.durationWeeksMax ?? requiredIntake.durationWeeksMin ?? 0
  const minBeforeBuffer =
    perPersonCostMin(assumption) * travelerCount +
    (assumption.parentStayPerWeekKrwMin ?? 0) * requiredIntake.travelerCounts.parent * durationWeeksMin
  const maxBeforeBuffer =
    perPersonCostMax(assumption) * travelerCount +
    (assumption.parentStayPerWeekKrwMax ?? 0) * requiredIntake.travelerCounts.parent * durationWeeksMax

  return {
    min: Math.round(minBeforeBuffer * (1 + assumption.contingencyBufferRate)),
    max: Math.round(maxBeforeBuffer * (1 + assumption.contingencyBufferRate)),
  }
}

function billableTravelerCount(requiredIntake: RequiredIntake): number {
  switch (requiredIntake.budgetScope) {
    case "child_only":
      return requiredIntake.travelerCounts.child
    case "child_plus_one_parent":
      return requiredIntake.travelerCounts.child + Math.min(1, requiredIntake.travelerCounts.parent)
    case "family_total":
    case "unknown":
      return (
        requiredIntake.travelerCounts.child +
        requiredIntake.travelerCounts.parent +
        requiredIntake.travelerCounts.sibling
      )
  }
}

function perPersonCostMin(assumption: TravelCostAssumption): number {
  return (
    (assumption.flightPerPersonKrwMin ?? 0) +
    (assumption.visaInsuranceKrwMin ?? 0) +
    (assumption.localTransportKrwMin ?? 0)
  )
}

function perPersonCostMax(assumption: TravelCostAssumption): number {
  return (
    (assumption.flightPerPersonKrwMax ?? 0) +
    (assumption.visaInsuranceKrwMax ?? 0) +
    (assumption.localTransportKrwMax ?? 0)
  )
}

function mapTravelCostAssumptionRow(row: z.infer<typeof TravelCostAssumptionRowSchema>): TravelCostAssumption {
  return {
    regionGroup: row.region_group,
    ...(row.country_code === null ? {} : { countryCode: row.country_code }),
    ...(row.country_name === null ? {} : { countryName: row.country_name }),
    season: row.season,
    ...(row.flight_per_person_krw_min === null ? {} : { flightPerPersonKrwMin: row.flight_per_person_krw_min }),
    ...(row.flight_per_person_krw_max === null ? {} : { flightPerPersonKrwMax: row.flight_per_person_krw_max }),
    ...(row.visa_insurance_krw_min === null ? {} : { visaInsuranceKrwMin: row.visa_insurance_krw_min }),
    ...(row.visa_insurance_krw_max === null ? {} : { visaInsuranceKrwMax: row.visa_insurance_krw_max }),
    ...(row.local_transport_krw_min === null ? {} : { localTransportKrwMin: row.local_transport_krw_min }),
    ...(row.local_transport_krw_max === null ? {} : { localTransportKrwMax: row.local_transport_krw_max }),
    ...(row.parent_stay_per_week_krw_min === null
      ? {}
      : { parentStayPerWeekKrwMin: row.parent_stay_per_week_krw_min }),
    ...(row.parent_stay_per_week_krw_max === null
      ? {}
      : { parentStayPerWeekKrwMax: row.parent_stay_per_week_krw_max }),
    contingencyBufferRate: row.contingency_buffer_rate,
  }
}
