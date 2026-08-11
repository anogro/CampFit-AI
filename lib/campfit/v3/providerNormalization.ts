import { CampfitV3ModelResponseSchema } from "@/lib/campfit/v3/schemas"
import { isSemanticallyValidModelFact } from "@/lib/campfit/v3/stateEngine"
import { campfitV3FactKeys, campfitV3ParentExperienceNeedAxes } from "@/types/campfitV3"
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
  const json = normalizeFactSources(normalizeSuggestedNextQuestion(normalizeModelShapes(value)))
  const parsed = CampfitV3ModelResponseSchema.safeParse(json)
  if (!parsed.success) {
    return { model: null, error: "schema_validation_failed" }
  }
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

function normalizeModelShapes(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  const normalizedFacts = Array.isArray(record["facts"])
    ? record["facts"].map(normalizeModelFactShape).filter((fact): fact is Record<string, unknown> => fact !== null)
    : null
  const hasTrustedFact = normalizedFacts?.some((fact) => !(fact["source"] === "explicit_user_statement"
    && typeof fact["confidence"] === "number" && fact["confidence"] < 0.85)) ?? false
  const facts = normalizedFacts === null
    ? record["facts"]
    : hasTrustedFact
      ? normalizedFacts.filter((fact) => !(fact["source"] === "explicit_user_statement"
        && typeof fact["confidence"] === "number" && fact["confidence"] < 0.85))
      : normalizedFacts
  const unresolved = Array.isArray(record["unresolved"])
    ? Array.from(new Set(record["unresolved"].filter((key): key is string => typeof key === "string" && campfitV3FactKeys.includes(key as never)))).slice(0, 20)
    : record["unresolved"]
  return { ...record, facts, unresolved }
}

function normalizeModelFactShape(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const fact = { ...(value as Record<string, unknown>) }
  const key = fact["key"]
  if (typeof key !== "string") return fact
  if (fact["value"] === undefined && "values" in fact) fact["value"] = fact["values"]
  delete fact["values"]
  if (fact["value"] === null) return null

  if (key === "childEnglishExperience") {
    if (!("value" in fact) && "item" in fact) fact["value"] = fact["item"]
    delete fact["item"]
    if (typeof fact["value"] === "string") fact["value"] = normalizeExperienceItem(fact["value"])
    if (fact["value"] !== undefined && !Array.isArray(fact["value"])) fact["value"] = [fact["value"]]
    if (Array.isArray(fact["value"])) {
      const normalized = fact["value"].map(normalizeExperienceItem).filter((item): item is Record<string, unknown> => item !== null)
      fact["value"] = normalized
      if (normalized.length === 0) return null
    }
  }
  if (key === "childEnglishAssessment" && fact["value"] !== undefined && !Array.isArray(fact["value"])) fact["value"] = [fact["value"]]
  if (key === "childEnglishAssessment" && Array.isArray(fact["value"])) {
    const normalized = fact["value"].filter((item) => isAssessmentItem(item))
    fact["value"] = normalized
    if (normalized.length === 0) return null
  }
  if (key === "childEnglishEnvironment" && fact["value"] !== undefined && !Array.isArray(fact["value"])) fact["value"] = [fact["value"]]
  if (key === "childEnglishEnvironment" && Array.isArray(fact["value"])) {
    const normalized = fact["value"].filter((item): item is string => ["international_school", "overseas_school", "overseas_camp", "overseas_residence"].includes(item as string))
    fact["value"] = normalized
    if (normalized.length === 0) return null
  }
  if (key === "childEnglishUsage" && fact["value"] !== undefined && !Array.isArray(fact["value"])) fact["value"] = [fact["value"]]
  if (key === "childEnglishUsage" && Array.isArray(fact["value"])) {
    const normalized = fact["value"].filter((item): item is string => ["speaks_with_foreigners", "answers_in_english", "initiates_in_english", "difficulty_initiating", "rarely_uses_english"].includes(item as string))
    fact["value"] = normalized
    if (normalized.length === 0) return null
  }
  if (key === "parentExperienceNeeds") {
    fact["value"] = normalizeParentExperienceNeeds(fact["value"], fact["evidence"])
  }
  if (["childEnglishListening", "childEnglishSpeaking", "childEnglishReading", "childEnglishWriting", "englishReadiness"]
    .includes(key) && Array.isArray(fact["value"]) && fact["value"].length === 1) {
    fact["value"] = fact["value"][0]
  }
  if (key === "childEnglishLevel" && fact["value"] === "unknown") return null
  if (key === "childEnglishListening" && !["understands_simple_instructions", "understands_class_explanation", "struggles_with_class_explanation", "unknown"].includes(fact["value"] as string)) return null
  if (key === "childEnglishSpeaking" && !["answers_simple_questions", "can_converse", "initiates_speech", "can_present_in_english", "difficulty_initiating", "rarely_speaks", "unknown"].includes(fact["value"] as string)) return null
  if (key === "childEnglishReading" && !["phonics_only", "reads_simple_text", "reads_english_books", "understands_english_books", "unknown"].includes(fact["value"] as string)) return null
  if (key === "childEnglishWriting" && !["simple_words", "simple_sentences", "can_explain_in_english", "unknown"].includes(fact["value"] as string)) return null
  return fact
}

function normalizeParentExperienceNeeds(value: unknown, factEvidence: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  const evidence = typeof factEvidence === "string" && factEvidence.trim().length > 0 ? factEvidence.trim().slice(0, 240) : null
  return Object.fromEntries(campfitV3ParentExperienceNeedAxes.map((axis) => {
    const item = record[axis]
    if (typeof item === "string") {
      return [axis, { importance: item, evidence: item === "unspecified" || evidence === null ? [] : [evidence] }]
    }
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const normalized = item as Record<string, unknown>
      return [axis, {
        ...normalized,
        evidence: Array.isArray(normalized["evidence"])
          ? normalized["evidence"]
          : normalized["importance"] === "unspecified" || evidence === null ? [] : [evidence],
      }]
    }
    return [axis, item]
  }))
}

function normalizeExperienceItem(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string" && ["english_kindergarten", "english_academy", "english_class", "english_immersion"].includes(value)) {
    return { type: value, durationYears: null, ongoing: null }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  return ["english_kindergarten", "english_academy", "english_class", "english_immersion"].includes(item["type"] as string)
    ? item
    : null
}

function isAssessmentItem(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return ["ar", "lexile", "english_exam", "school_level"].includes(item["type"] as string)
    && (typeof item["value"] === "number" || typeof item["value"] === "string")
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

function normalizeFactSources(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  if (!("facts" in value) || !Array.isArray(value.facts)) return value

  const normalizedFacts = value.facts.map((fact) => {
    if (typeof fact !== "object" || fact === null || Array.isArray(fact)) return fact
    if (!("source" in fact) || typeof fact.source !== "string") return fact

    let source = fact.source.trim().toLocaleLowerCase()
    if (source !== "explicit_user_statement" && source !== "ai_inference") {
      if (source.includes("inference")) {
        source = "ai_inference"
      } else {
        source = "ai_inference"
      }
    }
    return { ...fact, source }
  })

  return { ...value, facts: normalizedFacts }
}
