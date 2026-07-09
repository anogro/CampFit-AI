import { NextResponse } from "next/server"
import { getV2ApiClient, saveDynamicAnswers, updateV2SessionStatus } from "@/lib/campfit/v2/apiRepository"
import { AnswersV2RequestSchema } from "@/lib/campfit/v2/apiSchemas"

export async function POST(request: Request) {
  const parsed = AnswersV2RequestSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ message: "추가 질문 답변을 다시 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 })
  }

  const client = getV2ApiClient()
  if (client === null) {
    return NextResponse.json({ message: "지금은 답변을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }

  const saved = await saveDynamicAnswers({
    client,
    sessionId: parsed.data.sessionId,
    answers: parsed.data.answers.map((answer) => ({
      dynamicQuestionId: answer.dynamicQuestionId,
      questionKey: answer.questionKey,
      answer: answer.answer,
      ...(answer.answerText === undefined ? {} : { answerText: answer.answerText }),
    })),
  })
  if (!saved) {
    return NextResponse.json({ message: "지금 상담과 관련된 질문에만 답변할 수 있습니다." }, { status: 404 })
  }

  await updateV2SessionStatus(client, parsed.data.sessionId, "followup_completed", "recommend")
  return NextResponse.json({ status: "followup_completed" })
}
