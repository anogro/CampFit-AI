import { demoCostEstimateForCity } from "@/data/campfit/v3/demoCostEstimates"
import { calculateTotalTripCost } from "@/lib/campfit/v3/cost/calculateTotalTripCost"
import type { V3Catalog } from "@/lib/campfit/v3/catalogRepository"
import type { CampfitV3BasicInfo, CampfitV3RecommendationResult } from "@/types/campfitV3"

export function attachTripCosts(input: {
  readonly result: CampfitV3RecommendationResult
  readonly catalog: V3Catalog
  readonly basicInfo: CampfitV3BasicInfo
  readonly calculatedAt: string
}): CampfitV3RecommendationResult {
  const programById = new Map(input.catalog.programs.map((program) => [program.id, program]))
  const cityByKey = new Map(input.catalog.cities.map((city) => [cityKey(city.name, city.country), city]))
  const costsByProgramId = new Map<string, ReturnType<typeof calculateTotalTripCost>>()
  const programCandidates = input.result.programCandidates.map((candidate) => {
    const program = programById.get(candidate.programId)
    const city = program ? cityByKey.get(cityKey(program.city, program.country)) : undefined
    if (!program || !city) return candidate
    const tripCost = calculateTotalTripCost({
      basicInfo: input.basicInfo,
      program,
      city,
      estimateProfile: input.catalog.source === "demo" ? demoCostEstimateForCity(city.name) : null,
      calculatedAt: input.calculatedAt,
    })
    costsByProgramId.set(candidate.programId, tripCost)
    return { ...candidate, tripCost }
  })
  const destinationRecommendations = input.result.destinationRecommendations.map((destination) => {
    let tripCost = programCandidates.find((candidate) => candidate.cityName === destination.cityName)?.tripCost
    if (!tripCost) {
      const program = input.catalog.programs.find((p) => cityKey(p.city, p.country) === cityKey(destination.cityName, destination.countryName))
      const city = program ? cityByKey.get(cityKey(program.city, program.country)) : undefined
      if (program && city) {
        tripCost = calculateTotalTripCost({
          basicInfo: input.basicInfo,
          program,
          city,
          estimateProfile: input.catalog.source === "demo" ? demoCostEstimateForCity(city.name) : null,
          calculatedAt: input.calculatedAt,
        })
      }
    }
    return tripCost ? { ...destination, tripCost } : destination
  })
  return { ...input.result, destinationRecommendations, programCandidates }
}

function cityKey(city: string, country: string): string {
  return `${city.trim().toLowerCase()}|${country.trim().toLowerCase()}`
}
