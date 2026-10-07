import type { CityRegionGroup } from "@/types/campfitCity"

const southeastAsiaCountries = ["Philippines", "Malaysia", "Singapore", "Thailand", "Vietnam", "Indonesia", "Taiwan", "Japan"] as const
const oceaniaCountries = ["Australia", "New Zealand"] as const
const northAmericaCountries = ["USA", "United States", "Canada"] as const
const europeCountries = ["UK", "United Kingdom", "Ireland", "Malta", "France", "Germany", "Spain", "Portugal", "Denmark", "Netherlands"] as const
const domesticCountries = ["Korea", "South Korea", "Republic of Korea"] as const

export function inferCityRegionGroup(countryName: string): CityRegionGroup {
  if (containsCountry(oceaniaCountries, countryName)) return "oceania"
  if (containsCountry(southeastAsiaCountries, countryName)) return "southeast_asia"
  if (containsCountry(northAmericaCountries, countryName)) return "north_america"
  if (containsCountry(europeCountries, countryName)) return "europe"
  if (containsCountry(domesticCountries, countryName)) return "domestic"
  return "unknown"
}

function containsCountry(countries: readonly string[], countryName: string): boolean {
  return countries.some((country) => country.toLowerCase() === countryName.trim().toLowerCase())
}
