import { describe, expect, it } from "vitest"
import { parseStructuredProviderText } from "@/lib/campfit/v3/providerNormalization"

describe("CampFit v3 provider normalization", () => {
  it("accepts common Solar shape variations without inventing evidence", () => {
    const payload = {
      assistantMessage: "아이의 영어 수업 참여 상황을 확인했어요.",
      facts: [
        {
          key: "childEnglishExperience",
          subject: "child",
          item: [{ type: "english_class", durationYears: null, ongoing: null }],
          source: "explicit_user_statement",
          confidence: 1,
          evidence: "영어로 하는 수업은 잘 따라가요.",
        },
        {
          key: "childEnglishListening",
          subject: "child",
          value: ["understands_class_explanation"],
          source: "explicit_user_statement",
          confidence: 1,
          evidence: "수업은 잘 따라가요.",
        },
        {
          key: "childEnglishUsage",
          subject: "child",
          value: "speaks_with_foreigners",
          source: "explicit_user_statement",
          confidence: 1,
          evidence: "외국인 선생님과 대화하는 데 큰 문제는 없어요.",
        },
        {
          key: "childEnglishLevel",
          subject: "child",
          value: "unknown",
          source: "ai_inference",
          confidence: 0.7,
          evidence: "준비도는 추가 확인이 필요해요.",
        },
        {
          key: "childEnglishReading",
          subject: "child",
          value: ["unknown"],
          source: "explicit_user_statement",
          confidence: 0.5,
          evidence: "읽기 수준은 직접 언급되지 않았어요.",
        },
      ],
      unresolved: Array.from({ length: 28 }, (_, index) => index === 0 ? "childEnglishReading" : "durationWeeks"),
      conflicts: [],
      suggestedNextQuestionKey: "child_english_level",
      nextAction: "ask",
      readyForRecommendation: false,
    }

    const result = parseStructuredProviderText(JSON.stringify(payload), ["child_english_level"])

    expect(result.model).not.toBeNull()
    expect(result.model?.facts.map((fact) => [fact.key, fact.value])).toEqual([
      ["childEnglishExperience", [{ type: "english_class", durationYears: null, ongoing: null }]],
      ["childEnglishListening", "understands_class_explanation"],
      ["childEnglishUsage", ["speaks_with_foreigners"]],
    ])
    expect(result.model?.unresolved).toHaveLength(2)
  })

  it("accepts a grounded semantic activity profile while preserving evidence", () => {
    const payload = {
      assistantMessage: "직접 만들고 실험하는 활동을 특히 좋아하는 편이군요.",
      facts: [{
        key: "activityPreferences",
        subject: "preference",
        value: {
          preferences: [{
            category: "stem_maker",
            strength: "strong",
            rank: 1,
            mentionedActivities: ["레고 조립"],
            evidence: ["레고 조립을 제일 좋아해요"],
          }],
          varietyPreference: "unspecified",
          evidence: ["레고 조립을 제일 좋아해요"],
        },
        source: "explicit_user_statement",
        confidence: 1,
        evidence: "레고 조립을 제일 좋아해요",
      }],
      unresolved: [],
      conflicts: [],
      suggestedNextQuestionKey: null,
      nextAction: "recommend",
      readyForRecommendation: false,
    }

    const result = parseStructuredProviderText(JSON.stringify(payload), ["child_activity_preferences"])

    expect(result.model?.facts[0]?.key).toBe("activityPreferences")
    expect(result.model?.facts[0]?.value).toMatchObject({
      preferences: [{ category: "stem_maker", strength: "strong", rank: 1 }],
    })
  })
})
