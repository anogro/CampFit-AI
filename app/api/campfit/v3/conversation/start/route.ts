import { NextResponse } from "next/server"
import { startConversation } from "@/lib/campfit/v3/conversationService"
import { CampfitV3ConversationStartRequestSchema } from "@/lib/campfit/v3/schemas"

export async function POST(request: Request) {
  const parsed = CampfitV3ConversationStartRequestSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return NextResponse.json({ message: "기본정보를 다시 확인해 주세요." }, { status: 400 })
  }
  const response = startConversation(parsed.data.basicInfo)
  const publicResponse = { ...response }
  delete publicResponse.diagnostics

  return NextResponse.json(publicResponse)
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
