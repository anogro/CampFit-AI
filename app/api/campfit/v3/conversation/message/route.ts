import { NextResponse } from "next/server"
import { processConversationMessage } from "@/lib/campfit/v3/conversationService"
import {
  CampfitV3ConversationMessageRequestSchema,
  CampfitV3ConversationResponseSchema,
} from "@/lib/campfit/v3/schemas"
import { GeminiCampfitV3Provider } from "@/lib/campfit/v3/server/geminiProvider"
import type { CampfitV3ConversationResponse } from "@/types/campfitV3"

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
    const validated = CampfitV3ConversationResponseSchema.parse(response)
    return NextResponse.json(toPublicConversationResponse(validated))
  } catch {
    return NextResponse.json(
      { message: "답변을 처리하지 못했어요. 선택지를 고르거나 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    )
  }
}

function toPublicConversationResponse(
  response: CampfitV3ConversationResponse,
): CampfitV3ConversationResponse {
  const { diagnostics: _diagnostics, ...publicResponse } = response
  if (!shouldExposeDiagnostics() || response.diagnostics === undefined) return publicResponse

  const diagnostics = response.diagnostics
  return {
    ...publicResponse,
    diagnostics: {
      providerCallAttempted: diagnostics.providerCallAttempted,
      providerResponseValidated: diagnostics.providerResponseValidated,
      aiUsed: diagnostics.aiUsed,
      fallbackReason: diagnostics.fallbackReason,
    },
  }
}

function shouldExposeDiagnostics(): boolean {
  return process.env["NODE_ENV"] !== "production"
    && process.env["CAMPFIT_V3_INCLUDE_DIAGNOSTICS"] === "true"
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
