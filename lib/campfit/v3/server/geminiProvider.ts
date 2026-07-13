import "server-only"

import { callGemini } from "@/lib/campfit/geminiClient"
import { buildConversationPrompt, parseGeminiJson } from "@/lib/campfit/v3/geminiPrompt"
import { CampfitV3ModelResponseSchema } from "@/lib/campfit/v3/schemas"
import type { AnalyzeConversationInput, CampfitV3LLMProvider, CampfitV3ModelResponse } from "@/lib/campfit/v3/provider"

export class GeminiCampfitV3Provider implements CampfitV3LLMProvider {
  async analyzeConversation(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null> {
    return this.requestStructured(buildConversationPrompt(input))
  }

  async generateConsultingResponse(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null> {
    return this.analyzeConversation(input)
  }

  async explainRecommendation(input: Parameters<CampfitV3LLMProvider["explainRecommendation"]>[0]): Promise<string | null> {
    const prompt = [
      "당신은 부모동반 해외 교육 경험을 돕는 CampFit AI 상담가입니다.",
      "아래 결과는 코드와 DB가 계산한 allowlist입니다. 도시, 프로그램, 가격, 지원 사실을 새로 만들지 마세요.",
      "사용자에게 보여줄 오늘의 상담 결론을 자연스러운 한국어 2~3문장으로 작성하세요.",
      "상세 질환명, 알레르기명, 약 이름 등 민감정보를 언급하지 마세요.",
      "설명이나 markdown 없이 {\"conclusion\":\"...\"} JSON 객체만 반환하세요.",
      JSON.stringify({ basicInfo: input.basicInfo, facts: input.state.facts, result: input.deterministicResult }),
    ].join("\n")
    const text = await callGemini(prompt)
    if (text === null) return null
    const parsed = parseGeminiJson(text)
    if (typeof parsed === "object" && parsed !== null && "conclusion" in parsed && typeof parsed.conclusion === "string") {
      return parsed.conclusion.slice(0, 500)
    }
    return null
  }

  private async requestStructured(prompt: string): Promise<CampfitV3ModelResponse | null> {
    const first = await callGemini(prompt)
    if (first === null) return null
    const parsed = CampfitV3ModelResponseSchema.safeParse(parseGeminiJson(first))
    if (parsed.success) return parsed.data

    const repair = await callGemini([
      prompt,
      "이전 응답은 JSON 계약을 충족하지 못했습니다.",
      "설명이나 markdown 없이 계약에 맞는 JSON 객체만 다시 반환하세요.",
    ].join("\n"))
    if (repair === null) return null
    const repaired = CampfitV3ModelResponseSchema.safeParse(parseGeminiJson(repair))
    return repaired.success ? repaired.data : null
  }
}
