import type { BudgetEstimate, ConsultingProfile, RegionGroup } from "@/types/campfitV2"

export function numberValue(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === "number" ? value : undefined
}

export function stringValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

export function stringArrayValue(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

export function regionArrayValue(record: Record<string, unknown>, key: string): readonly RegionGroup[] {
  return stringArrayValue(record, key).filter(isRegionGroup)
}

export function childAge(profile: ConsultingProfile): number {
  return numberValue(profile.hardConstraints, "childAgeAtStart") ?? 8
}

export function durationBounds(profile: ConsultingProfile): {
  readonly min?: number
  readonly max?: number
} {
  const min = numberValue(profile.hardConstraints, "durationWeeksMin")
  const max = numberValue(profile.hardConstraints, "durationWeeksMax")
  return {
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  }
}

export function preferredRegions(profile: ConsultingProfile): readonly RegionGroup[] {
  const regions = regionArrayValue(profile.strongPreferences, "preferredRegionGroups")
  return regions.length > 0 ? regions : regionArrayValue(profile.softPreferences, "detectedRegions")
}

export function preferredProgramTypes(profile: ConsultingProfile): readonly string[] {
  const dynamicValues = stringArrayValue(profile.softPreferences, "preferred_program_types")
  const detectedValues = stringArrayValue(profile.strongPreferences, "detectedProgramTypes")
  return dynamicValues.length > 0 ? dynamicValues : detectedValues
}

export function parentAccompanimentMode(profile: ConsultingProfile): string {
  return stringValue(profile.hardConstraints, "parentAccompanimentMode") ?? "undecided"
}

export function koreanSupportNeed(profile: ConsultingProfile): string {
  return stringValue(profile.hardConstraints, "koreanSupportNeed") ?? "undecided"
}

export function riskSignals(profile: ConsultingProfile): readonly string[] {
  return stringArrayValue(profile.riskProfile, "riskSignals")
}

export function avoidConditions(profile: ConsultingProfile): readonly string[] {
  return stringArrayValue(profile.riskProfile, "avoid_conditions")
}

export function budgetEstimateForRegion(
  profile: ConsultingProfile,
  regionGroup: RegionGroup,
): BudgetEstimate | undefined {
  return profile.budgetEstimates.find((estimate) => estimate.regionGroup === regionGroup)
}

function isRegionGroup(value: string): value is RegionGroup {
  switch (value) {
    case "southeast_asia":
    case "oceania":
    case "north_america":
    case "europe":
    case "domestic":
    case "no_preference":
    case "undecided":
      return true
    default:
      return false
  }
}
