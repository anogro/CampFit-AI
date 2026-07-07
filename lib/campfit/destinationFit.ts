import type { Camp, CampfitInput, DestinationPreference } from "@/types/campfit"

export function calculateDestinationFit(camp: Camp, preference: DestinationPreference): number {
  if (preference === "no_preference") {
    return 0.72
  }

  return countryRegion(camp.country) === preference ? 1 : 0.42
}

export function calculateTravelFit(camp: Camp, readiness: CampfitInput["travelReadiness"]): number {
  const region = countryRegion(camp.country)

  switch (readiness) {
    case "short_flight_care":
      return region === "southeast_asia" ? 1 : region === "oceania" ? 0.52 : 0.34
    case "moderate_distance":
      return region === "north_america" ? 0.58 : 0.78
    case "long_flight_independent":
      return region === "southeast_asia" ? 0.62 : 1
  }
}

export function countryRegion(country: string): Exclude<DestinationPreference, "no_preference"> {
  switch (country) {
    case "Philippines":
    case "Singapore":
    case "Malaysia":
      return "southeast_asia"
    case "Australia":
    case "New Zealand":
      return "oceania"
    case "Canada":
    case "USA":
      return "north_america"
    default:
      return "southeast_asia"
  }
}
