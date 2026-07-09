import { describe, expect, it } from "vitest"
import { inferCityRegionGroup, toCityFitProfile } from "@/lib/campfit/v2/cityProfileAdapter"

describe("toCityFitProfile", () => {
  it("Given a Cities row When adapting Then city fields and cost ranges are mapped", () => {
    const profile = toCityFitProfile({
      id: "00cfce7c-15a1-4208-9117-a3d33abf79aa",
      "City name": "Chiang Mai",
      Country: "Thailand",
      Description: "도시와 자연이 공존하는 곳",
      "LivingCost KRW": "KRW765469",
      "HousingCost KRW": "KRW622612",
      "Flight Cost KRW": 700000,
      "Korean Population Density": "낮음",
      "Medical Access": "영어 진료 가능",
      "Safety Level": "일반적",
      "Main Language": "Thai",
      "Spoken Languages": "Thai,English",
      "Climate note": "건기와 우기가 뚜렷합니다.",
      style: "과정,유연",
    })

    expect(profile?.cityName).toBe("Chiang Mai")
    expect(profile?.countryName).toBe("Thailand")
    expect(profile?.regionGroup).toBe("southeast_asia")
    expect(profile?.monthlyLivingCostKrwMin).toBe(765469)
    expect(profile?.monthlyLivingCostKrwMax).toBe(1388081)
    expect(profile?.flightPerPersonKrwMin).toBe(700000)
    expect(profile?.flightPerPersonKrwMax).toBe(700000)
    expect(profile?.dataQuality).toBe("city_data")
    expect(profile?.sourceFields).toContain("Flight Cost KRW")
  })

  it("Given no flight field When adapting Then flight confirmation is required", () => {
    const profile = toCityFitProfile({
      id: "city-without-flight",
      "City name": "Auckland",
      Country: "New Zealand",
      "LivingCost KRW": "KRW1474522",
      "HousingCost KRW": "KRW1793355",
    })

    expect(profile?.regionGroup).toBe("oceania")
    expect(profile?.flightPerPersonKrwMin).toBeUndefined()
    expect(profile?.verifyBeforeConsulting).toContain("항공권 비용은 상담 전 확인이 필요합니다.")
  })
})

describe("inferCityRegionGroup", () => {
  it("Given known countries When inferring region Then supported CampFit regions are returned", () => {
    expect(inferCityRegionGroup("Australia")).toBe("oceania")
    expect(inferCityRegionGroup("Thailand")).toBe("southeast_asia")
    expect(inferCityRegionGroup("Canada")).toBe("north_america")
    expect(inferCityRegionGroup("Ireland")).toBe("europe")
    expect(inferCityRegionGroup("South Korea")).toBe("domestic")
    expect(inferCityRegionGroup("UAE")).toBe("unknown")
  })
})
