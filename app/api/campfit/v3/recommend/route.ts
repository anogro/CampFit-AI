import { NextResponse } from "next/server"
import { loadV3Catalog } from "@/lib/campfit/v3/catalogRepository"
import { isReadyForRecommendation } from "@/lib/campfit/v3/progress"
import { buildRecommendation } from "@/lib/campfit/v3/recommendationEngine"
import {
  CampfitV3RecommendationResultSchema,
  CampfitV3RecommendRequestSchema,
} from "@/lib/campfit/v3/schemas"
import { createConversationProvider } from "@/lib/campfit/v3/server/providerFactory"

export async function POST(request: Request) {
  const parsed = CampfitV3RecommendRequestSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return NextResponse.json({ message: "추천에 필요한 상담 정보를 다시 확인해 주세요." }, { status: 400 })
  }
  if (!isReadyForRecommendation(parsed.data.finalState)) {
    return NextResponse.json(
      { message: "추천 전에 아직 확인할 상담 항목이 있어요. 상담을 이어서 완료해 주세요." },
      { status: 409 },
    )
  }

  try {
    const catalog = await loadV3Catalog()
    if (catalog.source === "unavailable") {
      return NextResponse.json(
        { ok: false, error: { code: "CATALOG_UNAVAILABLE", message: "추천 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." } },
        { status: 503 },
      )
    }
    const deterministicResult = buildRecommendation({
      basicInfo: parsed.data.basicInfo,
      state: parsed.data.finalState,
      catalog,
    })
    const conclusion = process.env["CAMPFIT_V3_AI_RESULT_EXPLANATION"] === "true"
      ? await createConversationProvider().explainRecommendation({
          basicInfo: parsed.data.basicInfo,
          state: parsed.data.finalState,
          deterministicResult,
        })
      : null
    const result = CampfitV3RecommendationResultSchema.parse(
      conclusion ? { ...deterministicResult, consultingConclusion: conclusion } : deterministicResult,
    )
    return NextResponse.json(result)
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
