import { NextResponse } from "next/server"
import { RecommendRequestSchema } from "@/schemas/campfit/campfitSchemas"
import { enrichRecommendationExplanations } from "@/lib/campfit/gemini"
import { buildNoCandidateMessage, recommendCamps } from "@/lib/campfit/matching"
import { scoreCampReadiness } from "@/lib/campfit/readiness"
import { saveCampfitSession } from "@/lib/campfit/supabaseCampfit"
import { createSessionId } from "@/lib/campfit/utils"
import type { RecommendationResult } from "@/types/campfit"

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = RecommendRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "추천에 필요한 입력값을 다시 확인해 주세요.", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const readiness = scoreCampReadiness(parsed.data.readinessAnswers)
  const recommendations = recommendCamps({
    input: parsed.data.input,
    analysis: parsed.data.analysis,
    readiness,
  })
  const enriched = await enrichRecommendationExplanations(parsed.data.analysis, recommendations)
  const sessionId = parsed.data.sessionId ?? createSessionId()
  const baseResult = {
    sessionId,
    analysis: parsed.data.analysis,
    aiUsage: {
      parentAnalysis: parsed.data.aiUsage?.parentAnalysis ?? false,
      recommendationExplanation: enriched.aiUsed,
    },
    readiness,
    recommendations: enriched.recommendations,
  }
  const result: RecommendationResult =
    enriched.recommendations.length === 0
      ? { ...baseResult, noCandidateMessage: buildNoCandidateMessage(parsed.data.input) }
      : baseResult

  await saveCampfitSession(result, parsed.data.input, parsed.data.followUpAnswers)
  return NextResponse.json(result)
}
