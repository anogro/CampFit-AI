import { z } from "zod"
import { callGemini } from "@/lib/campfit/geminiClient"
import { buildFallbackExtraction } from "@/lib/campfit/v2/aiExtractionFallback"
import { buildCampfitV2ExtractionPrompt } from "@/lib/campfit/v2/aiExtractionPrompt"
import { AIExtractionResultSchema } from "@/lib/campfit/v2/schemas"
import { campfitV2QuestionKeys, isCampfitV2QuestionKey } from "@/lib/campfit/v2/questionBank"
import type { AIExtractionResult, NaturalConsultationInput, ProfileConflict, RequiredIntake } from "@/types/campfitV2"

export { buildFallbackExtraction } from "@/lib/campfit/v2/aiExtractionFallback"
export { buildCampfitV2ExtractionPrompt } from "@/lib/campfit/v2/aiExtractionPrompt"

type ExtractionInput = {
  readonly requiredIntake: RequiredIntake
  readonly naturalInput: NaturalConsultationInput
}

type ExtractionOptions = {
  readonly validQuestionKeys?: readonly string[]
  readonly callModel?: (prompt: string) => Promise<string | null>
}

type ExtractionResult = {
  readonly extraction: AIExtractionResult
  readonly aiUsed: boolean
}

const SummaryObjectSchema = z
  .object({
    mustHave: z.array(z.string()),
    strongPreferences: z.array(z.string()),
    concerns: z.array(z.string()),
    avoidConditions: z.array(z.string()),
    conflictWarnings: z.array(z.string()),
    missingInfo: z.array(z.string()),
  })
  .strict()

const RawExtractionSchema = AIExtractionResultSchema.omit({ understandingSummaryForUser: true })
  .extend({
    understandingSummaryForUser: z.union([z.string().min(1), SummaryObjectSchema]),
  })
  .strict()

export async function extractCampfitV2Consultation(
  input: ExtractionInput,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const prompt = buildCampfitV2ExtractionPrompt(input)
  const callModel = options.callModel ?? callGemini
  const text = await callModel(prompt)
  const fallback = buildFallbackExtraction(input.requiredIntake, input.naturalInput)
  if (text === null) {
    return { extraction: sanitizeAIExtractionResult(fallback, options.validQuestionKeys), aiUsed: false }
  }

  const parsedJson = parseJsonObject(text)
  const parsed = RawExtractionSchema.safeParse(parsedJson)
  if (!parsed.success) {
    return { extraction: sanitizeAIExtractionResult(fallback, options.validQuestionKeys), aiUsed: false }
  }

  const normalized = AIExtractionResultSchema.safeParse({
    ...parsed.data,
    understandingSummaryForUser: normalizeSummary(parsed.data.understandingSummaryForUser),
  })
  if (!normalized.success) {
    return { extraction: sanitizeAIExtractionResult(fallback, options.validQuestionKeys), aiUsed: false }
  }

  return { extraction: sanitizeAIExtractionResult(toAIExtractionResult(normalized.data), options.validQuestionKeys), aiUsed: true }
}

export function sanitizeAIExtractionResult(
  result: AIExtractionResult,
  validQuestionKeys: readonly string[] = campfitV2QuestionKeys,
): AIExtractionResult {
  const allowed = new Set(validQuestionKeys)
  const recommendedQuestionKeys = dedupeStrings(
    result.recommendedQuestionKeys.filter((key) => isCampfitV2QuestionKey(key) && allowed.has(key)),
  )
  const conflicts = result.conflicts.map((conflict): ProfileConflict => {
    const key = conflict.recommendedQuestionKey
    if (key !== undefined && (!isCampfitV2QuestionKey(key) || !allowed.has(key))) {
      return {
        conflictKey: conflict.conflictKey,
        description: conflict.description,
        severity: conflict.severity,
      }
    }

    return conflict
  })

  return {
    ...result,
    conflicts,
    recommendedQuestionKeys,
  }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "")

  try {
    return JSON.parse(withoutFence)
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }
  }

  const start = withoutFence.indexOf("{")
  const end = withoutFence.lastIndexOf("}")
  if (start < 0 || end < start) {
    return null
  }

  try {
    return JSON.parse(withoutFence.slice(start, end + 1))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null
    }

    throw error
  }
}

function normalizeSummary(summary: string | z.infer<typeof SummaryObjectSchema>): string {
  if (typeof summary === "string") {
    return summary
  }

  return [
    summary.mustHave.length > 0 ? `필수 조건: ${summary.mustHave.join(", ")}` : "",
    summary.strongPreferences.length > 0 ? `강한 선호: ${summary.strongPreferences.join(", ")}` : "",
    summary.concerns.length > 0 ? `걱정: ${summary.concerns.join(", ")}` : "",
    summary.avoidConditions.length > 0 ? `피하고 싶은 조건: ${summary.avoidConditions.join(", ")}` : "",
    summary.conflictWarnings.length > 0 ? `충돌 가능성: ${summary.conflictWarnings.join(", ")}` : "",
    summary.missingInfo.length > 0 ? `추가 확인 필요: ${summary.missingInfo.join(", ")}` : "",
  ]
    .filter((item) => item.length > 0)
    .join("\n")
}

function toAIExtractionResult(value: z.infer<typeof AIExtractionResultSchema>): AIExtractionResult {
  return {
    understandingSummaryForUser: value.understandingSummaryForUser,
    extractedProfile: value.extractedProfile,
    missingSlots: value.missingSlots,
    conflicts: value.conflicts.map((conflict): ProfileConflict => ({
      conflictKey: conflict.conflictKey,
      description: conflict.description,
      severity: conflict.severity,
      ...(conflict.recommendedQuestionKey === undefined
        ? {}
        : { recommendedQuestionKey: conflict.recommendedQuestionKey }),
    })),
    confidenceMap: value.confidenceMap,
    recommendedQuestionKeys: value.recommendedQuestionKeys,
  }
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}
