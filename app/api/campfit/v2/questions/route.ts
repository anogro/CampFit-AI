import { NextResponse } from "next/server"
import { getV2ApiClient, loadActiveQuestionKeys, loadAnsweredDynamicAnswers, loadLatestAIExtraction, loadV2SessionBundle, materializeDynamicQuestions } from "@/lib/campfit/v2/apiRepository"
import { planCampfitV2Questions } from "@/lib/campfit/v2/questionPlanner"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId")
  if (sessionId === null) {
    return NextResponse.json({ message: "상담 정보를 불러오지 못했습니다. 처음부터 다시 시도해 주세요." }, { status: 400 })
  }

  const client = getV2ApiClient()
  if (client === null) {
    return NextResponse.json({ message: "지금은 질문을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }

  const [bundle, extraction, answeredQuestions, validQuestionKeys] = await Promise.all([
    loadV2SessionBundle(client, sessionId),
    loadLatestAIExtraction(client, sessionId),
    loadAnsweredDynamicAnswers(client, sessionId),
    loadActiveQuestionKeys(client),
  ])
  if (bundle === null || extraction === null) {
    return NextResponse.json({ message: "상담 정보를 찾을 수 없습니다. 처음부터 다시 시도해 주세요." }, { status: 404 })
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
