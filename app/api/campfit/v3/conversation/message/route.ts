import { NextResponse } from "next/server"
import { processConversationMessage } from "@/lib/campfit/v3/conversationService"
import { CampfitV3ConversationMessageRequestSchema } from "@/lib/campfit/v3/schemas"
import { GeminiCampfitV3Provider } from "@/lib/campfit/v3/server/geminiProvider"

export async function POST(request: Request) {
  const parsed = CampfitV3ConversationMessageRequestSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return NextResponse.json({ message: "상담 답변을 다시 확인해 주세요." }, { status: 400 })
  }

  try {
    const response = await processConversationMessage({
      ...parsed.data,
      provider: new GeminiCampfitV3Provider(),
    })
    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ message: "답변은 보관했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
