import { z } from "zod"
import { ParentAnalysisSchema } from "@/schemas/campfit/campfitSchemas"
import type { CampRecommendation, CampfitInput, ParentAnalysis } from "@/types/campfit"
import { buildAnalyzeParentInputPrompt, buildRecommendationExplainerPrompt } from "@/lib/campfit/prompts"

const defaultModel = "gemini-1.5-flash"

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
})

const ExplainerSchema = z.object({
  items: z.array(
    z.object({
      campId: z.string().min(1),
      reason: z.string().min(1),
      caution: z.string().min(1),
      questionsBeforeConsultation: z.array(z.string().min(1)).min(2).max(4),
    }),
  ),
})

export async function analyzeParentInput(input: CampfitInput): Promise<ParentAnalysis> {
  const prompt = buildAnalyzeParentInputPrompt(input)
  const text = await callGemini(prompt)
  if (text === null) {
    return fallbackAnalysis(input)
  }

  const parsed = parseJsonObject(text)
  const result = ParentAnalysisSchema.safeParse(parsed)
  if (!result.success) {
    return fallbackAnalysis(input)
  }

  return result.data
}

export async function enrichRecommendationExplanations(
  analysis: ParentAnalysis,
  recommendations: readonly CampRecommendation[],
): Promise<readonly CampRecommendation[]> {
  const prompt = buildRecommendationExplainerPrompt(analysis, recommendations)
  const text = await callGemini(prompt)
  if (text === null) {
    return recommendations
  }

  const parsed = parseJsonObject(text)
  const verified = ExplainerSchema.safeParse(parsed)
  if (!verified.success) {
    return recommendations
  }

  return recommendations.map((recommendation) => {
    const item = verified.data.items.find((candidate) => candidate.campId === recommendation.camp.id)
    if (!item) {
      return recommendation
    }

    return {
      ...recommendation,
      explanation: {
        reason: item.reason,
        caution: item.caution,
        questionsBeforeConsultation: item.questionsBeforeConsultation,
      },
    }
  })
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env["GEMINI_API_KEY"]
  if (!apiKey) {
    return null
  }

  const model = process.env["GEMINI_MODEL"] ?? defaultModel
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    })

    if (!response.ok) {
      return null
    }

    const json = await response.json()
    const parsed = GeminiResponseSchema.safeParse(json)
    if (!parsed.success) {
      return null
    }

    return parsed.data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch (error) {
    if (error instanceof Error) {
      console.error("Gemini request failed", error.message)
      return null
    }

    throw error
  }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "")

  try {
    return JSON.parse(withoutFence)
  } catch {
    const start = withoutFence.indexOf("{")
    const end = withoutFence.lastIndexOf("}")
    if (start < 0 || end < start) {
      return null
    }

    try {
      return JSON.parse(withoutFence.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function fallbackAnalysis(input: CampfitInput): ParentAnalysis {
  const safetyPriority = input.koreanManagerRequired === "required" ? 0.86 : 0.62
  const englishReadiness = englishReadinessFromSelfLevel(input.englishSelfLevel)
  const shynessPenalty = input.shynessLevel === "high" ? 0.24 : input.shynessLevel === "medium" ? 0.12 : 0
  const separation = input.separationTolerance === "high" ? 0.78 : input.separationTolerance === "medium" ? 0.52 : 0.3

  return {
    parentType: safetyPriority > 0.8 ? "안심형 도전 추구" : "성장 균형 추구",
    parentGoal: {
      englishGrowth: 0.82,
      confidenceGrowth: 0.78,
      independenceGrowth: input.parentAccompanied === "not_needed" ? 0.72 : 0.52,
      socialGrowth: 0.58,
      safetyPriority,
      academicResultPriority: input.preferredProgramType === "managed_immersion" ? 0.72 : 0.48,
      experiencePriority: 0.62,
    },
    childProfile: {
      englishReadiness,
      socialConfidence: Math.max(0.25, 0.72 - shynessPenalty),
      separationTolerance: separation,
      newEnvironmentAdaptability: input.overseasExperience === "none" ? 0.42 : 0.66,
      challengeTolerance: input.preferredProgramType === "managed_immersion" ? 0.58 : 0.5,
    },
    supportNeeded: [
      "beginner_class",
      input.koreanManagerRequired === "required" ? "korean_manager" : "early_adaptation_support",
      input.parentAccompanied === "required" ? "parent_accompanied" : "daily_parent_report",
    ],
    detectedTensions: [
      {
        type: "english_growth_vs_anxiety",
        description: "영어 성장 기대는 높지만 첫 캠프 적응 부담을 함께 낮춰야 합니다.",
        confidence: 0.72,
      },
    ],
    evidence: [
      {
        text: input.parentConcernText.slice(0, 120),
        mappedTo: "parentGoal.englishGrowth",
        impact: "increase",
      },
    ],
    summaryForParent: [
      "영어 노출과 자신감 성장을 기대하는 입력으로 이해했습니다.",
      "처음 적응을 돕는 완충장치가 추천 품질에 중요한 조건입니다.",
      "캠프 난이도는 낮추기보다 지원 구조와 함께 비교하는 방향이 적합합니다.",
    ],
    followUpQuestions: [
      "캠프 초반 3일 동안 아이가 가장 걱정할 만한 상황은 무엇인가요?",
      "부모 동반보다 아이의 독립 경험을 어느 정도까지 허용할 수 있나요?",
    ],
  }
}

function englishReadinessFromSelfLevel(level: CampfitInput["englishSelfLevel"]): number {
  switch (level) {
    case "almost_none":
      return 0.25
    case "basic_expression":
      return 0.42
    case "simple_conversation":
      return 0.66
    case "comfortable":
      return 0.84
  }
}
