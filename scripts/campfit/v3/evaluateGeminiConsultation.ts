import { loadEnvConfig } from "@next/env"
import { callGemini } from "@/lib/campfit/geminiClient"
import { buildConversationPrompt, parseGeminiJson } from "@/lib/campfit/v3/geminiPrompt"
import { allowedQuestionKeys } from "@/lib/campfit/v3/questionBank"
import { CampfitV3ModelResponseSchema } from "@/lib/campfit/v3/schemas"
import { createInitialConversationState } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

loadEnvConfig(process.cwd())

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8], departureWindow: "다음 여름방학", durationWeeks: 2,
  budgetMinKrw: 5_000_000, budgetMaxKrw: 8_000_000,
  adultCount: 1, childCount: 1, guardianStaysNearby: true,
}

const cases = [
  ["subject separation", "아이 영어는 초급이지만 저는 영어로 소통할 수 있어요."],
  ["conditional support", "평소에는 한국어 지원이 필요 없지만 아이가 아플 때는 있었으면 좋겠어요."],
  ["compound goal", "영어 실력도 늘었으면 좋겠지만 공부만 하는 캠프는 싫어요."],
  ["parent stay", "아이 캠프 시간에는 저는 카페에 가거나 쉬고 싶어요."],
  ["special care flag", "있어요. 상담할 때 별도로 확인할게요."],
] as const

const state = createInitialConversationState()
const results = []
for (const [name, userMessage] of cases) {
  const input = { transcript: [{ role: "user" as const, content: userMessage }], currentState: state, basicInfo, userMessage, allowedQuestionKeys: allowedQuestionKeys(state) }
  const prompt = buildConversationPrompt(input)
  const first = await callGemini(prompt)
  let parsed = first === null ? null : CampfitV3ModelResponseSchema.safeParse(parseGeminiJson(first))
  let repaired = false
  if (parsed !== null && !parsed.success) {
    repaired = true
    const repair = await callGemini(`${prompt}\n이전 응답은 계약을 벗어났습니다. 설명 없이 올바른 JSON 객체만 반환하세요.`)
    parsed = repair === null ? null : CampfitV3ModelResponseSchema.safeParse(parseGeminiJson(repair))
  }
  results.push({
    name,
    responseReceived: first !== null,
    schemaValid: parsed?.success ?? false,
    repaired,
    facts: parsed?.success ? parsed.data.facts.map((fact) => ({ key: fact.key, subject: fact.subject, value: fact.value, source: fact.source })) : [],
  })
  if (first === null) break
}

const summary = {
  calls: cases.length + results.filter((result) => result.repaired).length,
  cases: cases.length,
  responses: results.filter((result) => result.responseReceived).length,
  schemaValid: results.filter((result) => result.schemaValid).length,
  results,
}
console.log(JSON.stringify(summary, null, 2))
