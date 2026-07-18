import { NextResponse } from "next/server"
import { processConversationMessage } from "@/lib/campfit/v3/conversationService"
import {
  CampfitV3ConversationMessageRequestSchema,
  CampfitV3ConversationResponseSchema,
} from "@/lib/campfit/v3/schemas"
import { resolveAiTimeoutMs } from "@/lib/campfit/v3/providerConfig"
import { createConversationProvider, resolveAiProvider } from "@/lib/campfit/v3/server/providerFactory"
import type { CampfitV3ConversationResponse } from "@/types/campfitV3"

export async function POST(request: Request) {
  const parsed = CampfitV3ConversationMessageRequestSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return NextResponse.json({ message: "상담 답변을 다시 확인해 주세요." }, { status: 400 })
  }

  try {
    const response = await processConversationMessage({
      ...parsed.data,
      provider: createConversationProvider(providerOptions()),
    })
    const validated = CampfitV3ConversationResponseSchema.parse(response)
    logProviderResult(validated)
    return NextResponse.json(toPublicConversationResponse(validated))
  } catch {
    return NextResponse.json(
      { message: "답변을 처리하지 못했어요. 선택지를 고르거나 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    )
  }
}

function providerOptions(): { readonly maxProviderRequests: 1 } {
  // The product path must not spend a second provider round-trip repairing a
  // response. Deterministic extraction can continue immediately on any
  // provider timeout, transport failure, or invalid response.
  return { maxProviderRequests: 1 }
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
      providerResponseReceived: diagnostics.providerResponseReceived,
      providerResponseValidated: diagnostics.providerResponseValidated,
      aiUsed: diagnostics.aiUsed,
      fallbackReason: diagnostics.fallbackReason,
      providerHttpStatus: diagnostics.providerHttpStatus,
      providerErrorStatus: diagnostics.providerErrorStatus,
      providerRequestCount: diagnostics.providerRequestCount,
      elapsedMs: diagnostics.elapsedMs,
    },
  }
}

function shouldExposeDiagnostics(): boolean {
  return process.env["NODE_ENV"] !== "production"
    && process.env["CAMPFIT_V3_INCLUDE_DIAGNOSTICS"] === "true"
}

function logProviderResult(response: CampfitV3ConversationResponse): void {
  if (!shouldLogProviderResult() || response.diagnostics === undefined) return

  const selectedProvider = resolveAiProvider()
  const selectedModel = (selectedProvider === "openai" ? process.env["OPENAI_MODEL"] : process.env["GEMINI_MODEL"])?.trim() || null
  const diagnostics = response.diagnostics
  console.info(JSON.stringify({
    event: "campfit_v3_provider_result",
    selectedProvider,
    selectedModel,
    providerCallAttempted: diagnostics.providerCallAttempted,
    providerResponseReceived: diagnostics.providerResponseReceived,
    providerResponseValidated: diagnostics.providerResponseValidated,
    providerHttpStatus: diagnostics.providerHttpStatus,
    providerRequestCount: diagnostics.providerRequestCount,
    providerElapsedMs: diagnostics.elapsedMs,
    configuredTimeoutMs: resolveAiTimeoutMs(),
    aiUsed: diagnostics.aiUsed,
    fallbackReason: diagnostics.fallbackReason,
    errorName: diagnostics.errorName ?? null,
    errorMessage: diagnostics.errorMessage ?? null,
    causeName: diagnostics.causeName ?? null,
    causeCode: diagnostics.causeCode ?? null,
    causeErrno: diagnostics.causeErrno ?? null,
    causeSyscall: diagnostics.causeSyscall ?? null,
    causeHostname: diagnostics.causeHostname ?? null,
    causeMessage: diagnostics.causeMessage ?? null,
    runtime: process.version,
    vercelRegion: process.env["VERCEL_REGION"] ?? null,
  }))
}

function shouldLogProviderResult(): boolean {
  return process.env["VERCEL_ENV"] === "preview"
    || (process.env["NODE_ENV"] !== "production" && process.env["CAMPFIT_V3_INCLUDE_DIAGNOSTICS"] === "true")
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
