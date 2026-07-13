import { NextResponse } from "next/server"
import { loadV3Catalog } from "@/lib/campfit/v3/catalogRepository"
import { buildRecommendation } from "@/lib/campfit/v3/recommendationEngine"
import { CampfitV3RecommendRequestSchema } from "@/lib/campfit/v3/schemas"
import { GeminiCampfitV3Provider } from "@/lib/campfit/v3/server/geminiProvider"

export async function POST(request: Request) {
  const parsed = CampfitV3RecommendRequestSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return NextResponse.json({ message: "추천에 필요한 상담 정보를 다시 확인해 주세요." }, { status: 400 })
  }

  try {
    const catalog = await loadV3Catalog()
    const deterministicResult = buildRecommendation({
      basicInfo: parsed.data.basicInfo,
      state: parsed.data.finalState,
      catalog,
    })
    const conclusion = process.env["CAMPFIT_V3_AI_RESULT_EXPLANATION"] === "true"
      ? await new GeminiCampfitV3Provider().explainRecommendation({
          basicInfo: parsed.data.basicInfo,
          state: parsed.data.finalState,
          deterministicResult,
        })
      : null
    return NextResponse.json(conclusion ? { ...deterministicResult, consultingConclusion: conclusion } : deterministicResult)
  } catch {
    return NextResponse.json({ message: "현재 후보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
