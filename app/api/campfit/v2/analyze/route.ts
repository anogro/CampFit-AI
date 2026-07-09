import { NextResponse } from "next/server"
import { getV2ApiClient, loadActiveQuestionKeys, loadV2SessionBundle, saveAIExtraction, updateV2SessionStatus } from "@/lib/campfit/v2/apiRepository"
import { AnalyzeV2RequestSchema } from "@/lib/campfit/v2/apiSchemas"
import { extractCampfitV2Consultation } from "@/lib/campfit/v2/aiExtraction"

export async function POST(request: Request) {
  const parsed = AnalyzeV2RequestSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ message: "상담 정보를 다시 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 })
  }

  const client = getV2ApiClient()
  if (client === null) {
    return NextResponse.json({ message: "지금은 상담 내용을 분석할 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }

  const bundle = await loadV2SessionBundle(client, parsed.data.sessionId)
  if (bundle === null) {
    return NextResponse.json({ message: "상담 정보를 불러오지 못했습니다. 처음부터 다시 시도해 주세요." }, { status: 404 })
  }

  const validQuestionKeys = await loadActiveQuestionKeys(client)
  const result = await extractCampfitV2Consultation(bundle, { validQuestionKeys })
  await saveAIExtraction(client, parsed.data.sessionId, result.extraction)
  await updateV2SessionStatus(client, parsed.data.sessionId, "analyzed", "ai_review")

  return NextResponse.json({
    ...result.extraction,
    aiUsed: result.aiUsed,
  })
}
