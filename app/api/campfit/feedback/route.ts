import { NextResponse } from "next/server"
import { FeedbackRequestSchema } from "@/schemas/campfit/campfitSchemas"
import { saveCampfitFeedback } from "@/lib/campfit/supabaseCampfit"

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = FeedbackRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "피드백 값을 다시 확인해 주세요.", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  await saveCampfitFeedback(parsed.data.sessionId, parsed.data.feedback, parsed.data.clickedCampId)
  return NextResponse.json({ ok: true })
}
