import { NextResponse } from "next/server"
import { getV2ApiClient, loadActiveQuestionKeys, loadAnsweredDynamicAnswers, loadLatestAIExtraction, loadV2SessionBundle, materializeDynamicQuestions } from "@/lib/campfit/v2/apiRepository"
import { planCampfitV2Questions } from "@/lib/campfit/v2/questionPlanner"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId")
  if (sessionId === null) {
    return NextResponse.json({ message: "sessionId가 필요합니다." }, { status: 400 })
  }

  const client = getV2ApiClient()
  if (client === null) {
    return NextResponse.json({ message: "동적 질문 저장 환경변수가 설정되어 있지 않습니다." }, { status: 500 })
  }

  const [bundle, extraction, answeredQuestions, validQuestionKeys] = await Promise.all([
    loadV2SessionBundle(client, sessionId),
    loadLatestAIExtraction(client, sessionId),
    loadAnsweredDynamicAnswers(client, sessionId),
    loadActiveQuestionKeys(client),
  ])
  if (bundle === null || extraction === null) {
    return NextResponse.json({ message: "분석된 상담 세션을 찾을 수 없습니다." }, { status: 404 })
  }

  const planned = planCampfitV2Questions({
    requiredIntake: bundle.requiredIntake,
    extraction,
    answeredQuestions,
    validQuestionKeys,
  })
  const questions = await materializeDynamicQuestions({ client, sessionId, planned })
  return NextResponse.json({ questions })
}
