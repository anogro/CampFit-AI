import { describe, expect, it } from "vitest"
import { CampfitV3RecommendationResultSchema } from "@/lib/campfit/v3/schemas"

describe("CampFit v3 recommendation result provenance", () => {
  it("preserves per-candidate source through JSON session serialization", () => {
    const result = {
      consultingConclusion: "테스트 결과",
      experienceDirections: [],
      destinationRecommendations: [],
      requiredSupportConditions: [],
      programCandidates: [
        candidate("production", "supabase", "https://www.anogro.com/program/production"),
        candidate("demo", "demo", null),
      ],
      verificationChecklist: [],
      alternatives: [],
      limitedResult: false,
      catalogSource: "supabase" as const,
    }

    const restored = CampfitV3RecommendationResultSchema.parse(JSON.parse(JSON.stringify(result)))

    expect(restored.programCandidates.map((program) => program.catalogSource)).toEqual(["supabase", "demo"])
  })

  it("accepts legacy candidates that have no source field", () => {
    const legacy = {
      consultingConclusion: "기존 결과",
      experienceDirections: [],
      destinationRecommendations: [],
      requiredSupportConditions: [],
      programCandidates: [candidate("legacy", undefined, null)],
      verificationChecklist: [],
      alternatives: [],
      limitedResult: true,
      catalogSource: "supabase" as const,
    }

    const parsed = CampfitV3RecommendationResultSchema.parse(legacy)

    expect(parsed.programCandidates[0]?.catalogSource).toBeUndefined()
  })
})

function candidate(programId: string, catalogSource: "supabase" | "demo" | undefined, detailUrl: string | null) {
  return {
    programId,
    name: `${programId} program`,
    cityName: "London",
    countryName: "UK",
    imageUrl: null,
    ageLabel: "만 8~12세",
    durationLabel: "3주 옵션",
    priceLabel: "가격 확인 필요",
    primaryDirection: "프로젝트",
    reason: "테스트 후보",
    verify: [],
    catalogSource,
    detailUrl,
    group: "우선 살펴볼 프로그램" as const,
    score: 80,
  }
}
