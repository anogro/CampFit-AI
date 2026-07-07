import type { Camp, CampfitInput } from "@/types/campfit"
import { countryRegion } from "@/lib/campfit/destinationFit"

export function narrowCandidatesByExplicitPreferences(
  candidates: readonly Camp[],
  input: CampfitInput,
): readonly Camp[] {
  const hasDestinationPreference = input.destinationPreference !== "no_preference"
  const hasProgramPreference = input.preferredProgramType !== "unsure"

  if (!hasDestinationPreference && !hasProgramPreference) {
    return candidates
  }

  const regionCandidates = hasDestinationPreference
    ? candidates.filter((camp) => countryRegion(camp.country) === input.destinationPreference)
    : candidates
  const programCandidates = hasProgramPreference
    ? candidates.filter((camp) => camp.programType === input.preferredProgramType)
    : candidates

  if (hasDestinationPreference && hasProgramPreference) {
    const regionProgramCandidates = regionCandidates.filter((camp) => camp.programType === input.preferredProgramType)
    if (regionProgramCandidates.length > 0) {
      return regionProgramCandidates
    }
  }

  if (hasDestinationPreference && regionCandidates.length > 0) {
    return regionCandidates
  }

  if (hasProgramPreference && programCandidates.length > 0) {
    return programCandidates
  }

  return candidates
}
