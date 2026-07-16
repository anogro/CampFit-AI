import { CampfitV3ModelResponseSchema } from "@/lib/campfit/v3/schemas"
import { isSemanticallyValidModelFact } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3ModelResponse } from "@/lib/campfit/v3/provider"

export type StructuredProviderParseResult =
  | { readonly model: CampfitV3ModelResponse; readonly error: null }
  | { readonly model: null; readonly error: "json_parse_failed" | "schema_validation_failed" | "semantic_validation_failed" }

export function parseStructuredProviderText(text: string, allowedQuestionKeys: readonly string[]): StructuredProviderParseResult {
  try {
    return normalizeCampfitProviderPayload(JSON.parse(text) as unknown, allowedQuestionKeys)
  } catch {
    return { model: null, error: "json_parse_failed" }
  }
}

export function normalizeCampfitProviderPayload(value: unknown, allowedQuestionKeys: readonly string[]): StructuredProviderParseResult {
  const json = normalizeSuggestedNextQuestion(value)
  const parsed = CampfitV3ModelResponseSchema.safeParse(json)
  if (!parsed.success) return { model: null, error: "schema_validation_failed" }
  if (new Set(parsed.data.facts.map((fact) => fact.key)).size !== parsed.data.facts.length) {
    return { model: null, error: "semantic_validation_failed" }
  }
  if (parsed.data.suggestedNextQuestionKey !== null
    && !allowedQuestionKeys.includes(parsed.data.suggestedNextQuestionKey)) {
    return { model: null, error: "semantic_validation_failed" }
  }
  if (!isSafeUserFacingMessage(parsed.data.assistantMessage)
    || parsed.data.assistantMessage.split(/[?？]/u).length - 1 > 1
    || parsed.data.facts.some((fact) => containsDetailedHealthDisclosure(fact.evidence))
    || parsed.data.facts.some((fact) => fact.source === "explicit_user_statement" && fact.confidence < 0.85)) {
    return { model: null, error: "semantic_validation_failed" }
  }
  if (!parsed.data.facts.every(isSemanticallyValidModelFact)) {
    return { model: null, error: "semantic_validation_failed" }
  }
  return { model: parsed.data, error: null }
}

const internalCounselorTerms = [
  "slot",
  "target",
  "schema",
  "validation",
  "confidence score",
  "fallback",
  "parser",
  "state merge",
  "조건으로 연결하지 못했어요",
] as const

function isSafeUserFacingMessage(message: string): boolean {
  const normalized = message.toLocaleLowerCase()
  return !internalCounselorTerms.some((term) => normalized.includes(term.toLocaleLowerCase()))
    && !containsDetailedHealthDisclosure(message)
}

function containsDetailedHealthDisclosure(value: string): boolean {
  return /(질환명|진단명|복용약|약\s*이름|약명|복용량|병력|알레르기\s*(항목|이름|명칭)|천식|당뇨|아토피|뇌전증|간질|ADHD|자폐|우울증|공황장애|갑상선|심장병|크론병|셀리악)/iu.test(value)
}

function normalizeSuggestedNextQuestion(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  if (!("suggestedNextQuestionKey" in value) || typeof value.suggestedNextQuestionKey !== "string") return value
  return value.suggestedNextQuestionKey.trim() === ""
    ? { ...value, suggestedNextQuestionKey: null }
    : value
}
