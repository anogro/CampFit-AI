import { describe, expect, it } from "vitest"
import { assessEnglishReadiness } from "@/lib/campfit/v3/englishReadiness"
import { createInitialConversationState, extractDeterministicFacts, mergeFacts, syncEnglishReadiness } from "@/lib/campfit/v3/stateEngine"

describe("CampFit v3 English readiness", () => {
  it("keeps diverse English evidence separate and combines it conservatively", () => {
    const facts = extractDeterministicFacts("영어유치원을 2년 다녔고 AR 2.8이에요. 외국인 선생님 말은 대충 알아듣고, 간단한 질문에는 답하지만 먼저 말은 잘 못해요. 영어책은 읽어요.")
    const state = syncEnglishReadiness(mergeFacts(createInitialConversationState(), facts))
    const experience = state.facts.childEnglishExperience?.value as Array<Record<string, unknown>>
    const assessment = state.facts.childEnglishAssessment?.value as Array<Record<string, unknown>>

    expect(experience).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "english_kindergarten", durationYears: 2 }),
    ]))
    expect(assessment).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ar", value: 2.8 }),
    ]))
    expect(state.facts.childEnglishListening?.value).toBe("understands_simple_instructions")
    expect(state.facts.childEnglishSpeaking?.value).toBe("difficulty_initiating")
    expect(assessEnglishReadiness(state)).toMatchObject({
      readiness: "beginner_friendly",
      sufficientForRecommendation: true,
    })
    expect(state.facts.englishReadiness?.value).toBe("beginner_friendly")
  })

  it("does not turn an AR score or English-school experience into a readiness level", () => {
    const facts = extractDeterministicFacts("영어유치원은 다녔고 AR 2.8 정도예요.")
    const assessment = assessEnglishReadiness(mergeFacts(createInitialConversationState(), facts))

    expect(assessment.readiness).toBe("unknown")
    expect(assessment.sufficientForRecommendation).toBe(false)
    expect(assessment.missingEvidence).toEqual(expect.arrayContaining(["듣기", "말하기"]))
  })

  it("requires balanced ability evidence before academic readiness", () => {
    const facts = extractDeterministicFacts("아이는 국제학교에 다니고 있고 영어로 수업 설명을 이해해요. 영어로 편하게 대화하고 영어책을 읽고 이해하며 영어로 문장을 써요.")
    const assessment = assessEnglishReadiness(mergeFacts(createInitialConversationState(), facts))

    expect(assessment.readiness).toBe("academic_ready")
    expect(assessment.sufficientForRecommendation).toBe(true)
    expect(assessment.evidenceKeys).toEqual(expect.arrayContaining([
      "childEnglishEnvironment",
      "childEnglishListening",
      "childEnglishSpeaking",
      "childEnglishReading",
      "childEnglishWriting",
    ]))
  })

  it("uses the legacy quick-reply level only as a compatibility fallback", () => {
    const state = mergeFacts(createInitialConversationState(), [{
      key: "childEnglishLevel",
      subject: "child",
      value: "beginner",
      source: "quick_reply",
      confidence: 1,
      status: "confirmed",
      evidence: "영어가 거의 낯설어요",
      updatedAt: "2026-08-10T00:00:00.000Z",
    }])

    expect(assessEnglishReadiness(state)).toMatchObject({ readiness: "support_required", sufficientForRecommendation: true })
  })

  it("keeps the deterministic fallback narrow across natural Korean variants", () => {
    const cases = [
      { text: "영어로 곧잘 말해요.", expected: [["childEnglishSpeaking", "can_converse"]] },
      { text: "외국인 선생님이랑 수업은 잘 따라가요.", expected: [["childEnglishListening", "understands_class_explanation"]] },
      { text: "영어는 오래 배웠는데 실제로 말은 별로 안 나와요.", expected: [["childEnglishSpeaking", "rarely_speaks"]] },
      {
        text: "원어민이 하는 말은 대충 알아듣는데 대답은 잘 못해요.",
        expected: [
          ["childEnglishListening", "understands_simple_instructions"],
          ["childEnglishSpeaking", "difficulty_initiating"],
        ],
      },
      { text: "외국 친구랑 놀 때는 영어를 쓰긴 해요.", expected: [["childEnglishUsage", ["speaks_with_foreigners"]]] },
      { text: "학교 영어는 잘하는데 회화는 자신 없어해요.", expected: [["childEnglishSpeaking", "difficulty_initiating"]] },
      {
        text: "영어유치원은 안 다녔지만 영어로 하는 수업은 잘 따라가요.",
        expected: [
          ["childEnglishExperience", [{ type: "english_class", durationYears: null, ongoing: false }]],
          ["childEnglishListening", "understands_class_explanation"],
        ],
      },
      {
        text: "영어캠프는 처음이지만 외국인 선생님과 대화하는 데 큰 문제는 없어요.",
        expected: [
          ["childEnglishSpeaking", "can_converse"],
          ["childEnglishUsage", ["speaks_with_foreigners"]],
        ],
      },
    ] as const

    for (const { text, expected } of cases) {
      const facts = extractDeterministicFacts(text, undefined, "child_english_level")
      expect(facts.filter((fact) => fact.key.startsWith("childEnglish")).map((fact) => [fact.key, fact.value])).toEqual(expected)
    }
  })
})
