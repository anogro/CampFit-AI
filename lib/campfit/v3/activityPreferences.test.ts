import { describe, expect, it } from "vitest"
import {
  activityPreferenceAcknowledgement,
  activityPreferenceValueIsGrounded,
  activityRecommendationSufficiency,
  extractActivityPreferenceProfile,
} from "@/lib/campfit/v3/activityPreferences"
import { extractDeterministicFacts } from "@/lib/campfit/v3/stateEngine"

function preference(value: unknown, category: string) {
  if (typeof value !== "object" || value === null || !("preferences" in value)) return undefined
  const preferences = (value as { preferences: readonly { category: string; strength: string; rank: number | null; mentionedActivities: readonly string[] }[] }).preferences
  return preferences.find((item) => item.category === category)
}

describe("activity preference extraction", () => {
  it("recognizes classroom comprehension and responsive speaking together", () => {
    const facts = extractDeterministicFacts("영어 수업 설명은 이해하고 질문에도 영어로 답할 수 있어요.", undefined, "child_english_level")

    expect(facts.find((fact) => fact.key === "childEnglishListening")?.value).toBe("understands_class_explanation")
    expect(facts.find((fact) => fact.key === "childEnglishSpeaking")?.value).toBe("answers_simple_questions")
  })

  it("extracts multiple activities, strength, and rank from one sentence", () => {
    const value = extractActivityPreferenceProfile("과학실험을 제일 좋아하고 수영도 좋아해요.")

    expect(preference(value, "stem_maker")).toMatchObject({ strength: "strong", rank: 1 })
    expect(preference(value, "sports_physical")).toMatchObject({ strength: "positive", rank: 2 })
    expect(activityRecommendationSufficiency(value)).toBe(true)
    expect(activityPreferenceAcknowledgement(value)).toContain("만들고 실험")
  })

  it("does not turn experience into preference and preserves dislike", () => {
    const value = extractActivityPreferenceProfile("수영은 3년 했는데 별로 좋아하지 않아요. 동물 보는 게 제일 좋아요.")

    expect(preference(value, "sports_physical")).toMatchObject({ strength: "dislike" })
    expect(preference(value, "animals_ecology")).toMatchObject({ strength: "strong" })
  })

  it("keeps drawing dislike separate from making and building", () => {
    const value = extractActivityPreferenceProfile("그림 그리기는 별로 안 좋아하는데 레고 만들기나 조립은 좋아해요.")

    expect(preference(value, "art_creative")).toMatchObject({ strength: "dislike" })
    expect(preference(value, "stem_maker")).toMatchObject({ strength: "positive" })
  })

  it("does not confuse a parent wish with the child's preference", () => {
    const value = extractActivityPreferenceProfile("부모로서 아이가 코딩을 잘했으면 좋겠어요. 아이는 축구를 제일 좋아해요.")

    expect(preference(value, "stem_maker")).toBeUndefined()
    expect(preference(value, "sports_physical")).toMatchObject({ strength: "strong" })
  })

  it("keeps performance experience and an explicit dance preference grounded", () => {
    const value = extractActivityPreferenceProfile("피아노를 오래 배웠는데 별로 좋아하지 않아요. 춤은 좋아해요.")

    expect(preference(value, "performance_music")).toMatchObject({ strength: "positive" })
    expect(preference(value, "performance_music")?.rank).toBe(1)
  })

  it("can extract nature and ecology preferences together", () => {
    const value = extractActivityPreferenceProfile("밖에 나가서 곤충 찾고 자연을 관찰하는 걸 좋아해요.")

    expect(preference(value, "nature_outdoor")).toBeDefined()
    expect(preference(value, "animals_ecology")).toBeDefined()
  })

  it("stores breadth preference without inventing a category", () => {
    const value = extractActivityPreferenceProfile("한 가지를 오래 하는 것보다 여러 가지를 다양하게 경험하는 걸 좋아해요.")

    expect(value?.preferences).toHaveLength(0)
    expect(value?.varietyPreference).toBe("positive")
    expect(activityRecommendationSufficiency(value)).toBe(true)
  })

  it("keeps an explicit unknown answer category-free", () => {
    const value = extractActivityPreferenceProfile("특히 좋아하는 활동은 잘 모르겠어요.")

    expect(value?.preferences).toHaveLength(0)
    expect(value?.varietyPreference).toBe("unspecified")
    expect(activityRecommendationSufficiency(value)).toBe(false)
  })

  it("does not infer preference from ability alone", () => {
    expect(extractActivityPreferenceProfile("과학을 잘해요. 그림도 잘 그려요. 운동신경도 좋아요.")).toBeNull()
  })

  it("uses explicit body-movement language and specific sports as a strong signal", () => {
    const value = extractActivityPreferenceProfile("몸 쓰는 건 좋아하고 특히 수영이랑 축구를 좋아해요.")

    expect(preference(value, "sports_physical")).toMatchObject({ strength: "strong" })
    expect(preference(value, "sports_physical")?.mentionedActivities.join(" ")).toMatch(/수영|축구/u)
  })

  it("accepts provider semantic categories only when their evidence is grounded", () => {
    const grounded = {
      preferences: [{ category: "stem_maker", strength: "strong", rank: 1, mentionedActivities: ["레고 조립"], evidence: ["레고 조립이 제일 좋아요"] }],
      varietyPreference: "unspecified",
      evidence: ["레고 조립이 제일 좋아요"],
    }
    const hallucinated = {
      preferences: [{ category: "sports_physical", strength: "positive", rank: 1, mentionedActivities: ["축구"], evidence: ["축구를 좋아해요"] }],
      varietyPreference: "unspecified",
      evidence: ["축구를 좋아해요"],
    }
    const experienceOnly = {
      preferences: [{ category: "sports_physical", strength: "strong", rank: 1, mentionedActivities: ["수영"], evidence: ["수영을 3년 했어요"] }],
      varietyPreference: "unspecified",
      evidence: ["수영을 3년 했어요"],
    }

    expect(activityPreferenceValueIsGrounded(grounded, "레고 조립이 제일 좋아요", "레고 조립이 제일 좋아요")).toBe(true)
    expect(activityPreferenceValueIsGrounded(hallucinated, "축구를 좋아해요", "레고 조립을 좋아해요")).toBe(false)
    expect(activityPreferenceValueIsGrounded(experienceOnly, "수영을 3년 했어요", "수영을 3년 했어요")).toBe(false)
  })
})
