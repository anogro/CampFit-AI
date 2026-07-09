import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import {
  AIExtractionRowSchema,
  DynamicAnswerRowSchema,
  DynamicQuestionRowSchema,
  NaturalInputRowSchema,
  QuestionBankRowSchema,
  RequiredIntakeRowSchema,
  SessionRowSchema,
  normalizeDynamicQuestion,
  normalizeExtraction,
  normalizeNaturalInput,
  normalizeRequiredIntake,
  toNaturalInputRow,
  toRequiredIntakeRow,
} from "@/lib/campfit/v2/apiMappers"
import { AIExtractionResultSchema, DynamicQuestionSchema, NaturalConsultationInputSchema, RequiredIntakeSchema } from "@/lib/campfit/v2/schemas"
import type { AIExtractionResult, DynamicAnswer, DynamicQuestion, NaturalConsultationInput, RequiredIntake } from "@/types/campfitV2"

type SupabaseClient = NonNullable<ReturnType<typeof createServerSupabaseClient>>

export type MaterializedDynamicQuestion = DynamicQuestion & {
  readonly dynamicQuestionId: string
  readonly placeholder?: string
  readonly exampleText?: string
}

export type V2SessionBundle = {
  readonly requiredIntake: RequiredIntake
  readonly naturalInput: NaturalConsultationInput
}

type QuestionBankRow = z.infer<typeof QuestionBankRowSchema>

export function getV2ApiClient(): SupabaseClient | null {
  return createServerSupabaseClient()
}

export async function createV2Session(input: {
  readonly client: SupabaseClient
  readonly requiredIntake: RequiredIntake
  readonly naturalInput: NaturalConsultationInput
  readonly anonymousSessionId?: string
}): Promise<string | null> {
  const { data, error } = await input.client
    .from("campfit_v2_sessions")
    .insert({
      anonymous_session_id: input.anonymousSessionId ?? null,
      status: "intake_completed",
      current_step: "intake_completed",
    })
    .select("id")
    .single()
  if (error) {
    logSupabaseError("[CampFit v2] create session failed", error)
    return null
  }

  const session = SessionRowSchema.safeParse(data)
  if (!session.success) {
    console.error("[CampFit v2] create session returned invalid id")
    return null
  }

  const sessionId = session.data.id
  const [requiredResult, naturalResult] = await Promise.all([
    input.client.from("campfit_v2_required_intakes").insert(toRequiredIntakeRow(sessionId, input.requiredIntake)),
    input.client.from("campfit_v2_natural_inputs").insert(toNaturalInputRow(sessionId, input.naturalInput)),
  ])
  if (requiredResult.error) {
    logSupabaseError("[CampFit v2] create required intake failed", requiredResult.error)
  }
  if (naturalResult.error) {
    logSupabaseError("[CampFit v2] create natural input failed", naturalResult.error)
  }
  return requiredResult.error || naturalResult.error ? null : sessionId
}

export async function loadV2SessionBundle(client: SupabaseClient, sessionId: string): Promise<V2SessionBundle | null> {
  const [requiredResult, naturalResult] = await Promise.all([
    client
      .from("campfit_v2_required_intakes")
      .select("child_age_at_start,departure_window,duration_weeks_min,duration_weeks_max,total_budget_all_in_krw_min,total_budget_all_in_krw_max,budget_scope,child_count,parent_count,sibling_count,preferred_region_groups,region_priority,parent_accompaniment_mode,korean_support_need,accommodation_preferences,raw_answers")
      .eq("session_id", sessionId)
      .single(),
    client
      .from("campfit_v2_natural_inputs")
      .select("situation_text,child_context_text,success_and_concerns_text,additional_notes")
      .eq("session_id", sessionId)
      .single(),
  ])
  if (requiredResult.error || naturalResult.error) return null

  const required = RequiredIntakeRowSchema.safeParse(requiredResult.data)
  const natural = NaturalInputRowSchema.safeParse(naturalResult.data)
  if (!required.success || !natural.success) return null

  return {
    requiredIntake: fromRequiredIntakeRow(required.data),
    naturalInput: fromNaturalInputRow(natural.data),
  }
}

export async function loadActiveQuestionKeys(client: SupabaseClient): Promise<readonly string[]> {
  const { data, error } = await client.from("campfit_v2_question_bank").select("question_key").eq("active", true)
  if (error) return []
  return z.array(z.object({ question_key: z.string() }).strict()).parse(data ?? []).map((row) => row.question_key)
}

export async function saveAIExtraction(client: SupabaseClient, sessionId: string, extraction: AIExtractionResult): Promise<void> {
  await client.from("campfit_v2_ai_extractions").insert({
    session_id: sessionId,
    extraction_version: "v1",
    extracted_profile: extraction.extractedProfile,
    missing_slots: extraction.missingSlots,
    conflicts: extraction.conflicts,
    confidence_map: extraction.confidenceMap,
    recommended_question_keys: extraction.recommendedQuestionKeys,
  })
}

export async function loadLatestAIExtraction(client: SupabaseClient, sessionId: string): Promise<AIExtractionResult | null> {
  const { data, error } = await client
    .from("campfit_v2_ai_extractions")
    .select("extracted_profile,missing_slots,conflicts,confidence_map,recommended_question_keys")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || data === null) return null

  const parsed = AIExtractionRowSchema.safeParse(data)
  if (!parsed.success) return null
  const extraction = AIExtractionResultSchema.safeParse({
    extractedProfile: parsed.data.extracted_profile,
    missingSlots: parsed.data.missing_slots,
    conflicts: parsed.data.conflicts,
    confidenceMap: parsed.data.confidence_map,
    recommendedQuestionKeys: parsed.data.recommended_question_keys,
    understandingSummaryForUser: "이전 상담 내용을 바탕으로 추가 질문을 준비했습니다.",
  })
  return extraction.success ? normalizeExtraction(extraction.data) : null
}

export async function loadAnsweredDynamicAnswers(client: SupabaseClient, sessionId: string): Promise<readonly DynamicAnswer[]> {
  const { data, error } = await client
    .from("campfit_v2_dynamic_answers")
    .select("question_key,answer,answer_text")
    .eq("session_id", sessionId)
  if (error) return []

  return z.array(DynamicAnswerRowSchema).parse(data ?? []).map((row) => ({
    questionKey: row.question_key,
    answer: row.answer,
    ...(row.answer_text === null ? {} : { answerText: row.answer_text }),
  }))
}

export async function materializeDynamicQuestions(input: {
  readonly client: SupabaseClient
  readonly sessionId: string
  readonly planned: readonly { readonly questionKey: string; readonly priority: number; readonly reason: string }[]
}): Promise<readonly MaterializedDynamicQuestion[]> {
  const pending = await loadPendingQuestions(input.client, input.sessionId)
  if (pending.length > 0) return pending

  const keys = input.planned.slice(0, 5).map((item) => item.questionKey)
  if (keys.length === 0) return []

  const { data, error } = await input.client
    .from("campfit_v2_question_bank")
    .select("id,question_key,priority,question_type,title,helper_text,placeholder,example_text,options")
    .eq("active", true)
    .in("question_key", keys)
  if (error) return []

  const rows = z.array(QuestionBankRowSchema).parse(data ?? [])
  const plannedByKey = new Map(input.planned.map((item) => [item.questionKey, item]))
  const inserts = rows.map((row) => {
    const planned = plannedByKey.get(row.question_key)
    const snapshot = questionFromBankRow(row, planned?.reason ?? "추천 정확도를 높이기 위한 질문입니다.")
    return {
      session_id: input.sessionId,
      question_bank_id: row.id,
      question_key: row.question_key,
      source: row.question_key.startsWith("conflict_") ? "conflict" : "rule",
      priority: planned?.priority ?? row.priority,
      reason: snapshot.reason,
      status: "pending",
      question_snapshot: snapshot,
    }
  })
  const { error: insertError } = await input.client.from("campfit_v2_dynamic_questions").insert(inserts)
  return insertError ? [] : loadPendingQuestions(input.client, input.sessionId)
}

export async function saveDynamicAnswers(input: {
  readonly client: SupabaseClient
  readonly sessionId: string
  readonly answers: readonly { readonly dynamicQuestionId: string; readonly questionKey: string; readonly answer: unknown; readonly answerText?: string }[]
}): Promise<boolean> {
  const ids = input.answers.map((answer) => answer.dynamicQuestionId)
  const { data, error } = await input.client
    .from("campfit_v2_dynamic_questions")
    .select("id,question_key")
    .eq("session_id", input.sessionId)
    .in("id", ids)
  if (error) return false

  const owned = new Map(z.array(z.object({ id: z.string(), question_key: z.string() }).strict()).parse(data ?? []).map((row) => [row.id, row.question_key]))
  if (input.answers.some((answer) => owned.get(answer.dynamicQuestionId) !== answer.questionKey)) return false

  const rows = input.answers.map((answer) => ({
    session_id: input.sessionId,
    dynamic_question_id: answer.dynamicQuestionId,
    question_key: answer.questionKey,
    answer: answer.answer,
    answer_text: answer.answerText ?? null,
  }))
  const [insertResult, updateResult] = await Promise.all([
    input.client.from("campfit_v2_dynamic_answers").insert(rows),
    input.client.from("campfit_v2_dynamic_questions").update({ status: "answered", answered_at: new Date().toISOString() }).in("id", ids),
  ])
  return !insertResult.error && !updateResult.error
}

export async function updateV2SessionStatus(client: SupabaseClient, sessionId: string, status: string, currentStep: string): Promise<void> {
  await client.from("campfit_v2_sessions").update({ status, current_step: currentStep }).eq("id", sessionId)
}

async function loadPendingQuestions(client: SupabaseClient, sessionId: string): Promise<readonly MaterializedDynamicQuestion[]> {
  const { data, error } = await client
    .from("campfit_v2_dynamic_questions")
    .select("id,question_key,priority,reason,question_snapshot")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .limit(5)
  if (error) return []

  return z.array(DynamicQuestionRowSchema).parse(data ?? []).flatMap((row) => {
    const parsed = DynamicQuestionSchema.safeParse(row.question_snapshot)
    if (!parsed.success) return []
    return [{ ...normalizeDynamicQuestion(parsed.data), dynamicQuestionId: row.id }]
  })
}

function questionFromBankRow(row: QuestionBankRow, reason: string): DynamicQuestion & { readonly placeholder?: string; readonly exampleText?: string } {
  const parsed = DynamicQuestionSchema.parse({
    questionKey: row.question_key,
    title: row.title,
    ...(row.helper_text === null ? {} : { helperText: row.helper_text }),
    questionType: row.question_type,
    options: row.options,
    reason,
    priority: row.priority,
  })
  return {
    ...normalizeDynamicQuestion(parsed),
    ...(row.placeholder === null ? {} : { placeholder: row.placeholder }),
    ...(row.example_text === null ? {} : { exampleText: row.example_text }),
  }
}

function fromRequiredIntakeRow(row: z.infer<typeof RequiredIntakeRowSchema>): RequiredIntake {
  return normalizeRequiredIntake(RequiredIntakeSchema.parse({
    childAgeAtStart: row.child_age_at_start,
    departureWindow: row.departure_window,
    ...(row.duration_weeks_min === null ? {} : { durationWeeksMin: row.duration_weeks_min }),
    ...(row.duration_weeks_max === null ? {} : { durationWeeksMax: row.duration_weeks_max }),
    ...(row.total_budget_all_in_krw_min === null ? {} : { totalBudgetAllInKrwMin: row.total_budget_all_in_krw_min }),
    ...(row.total_budget_all_in_krw_max === null ? {} : { totalBudgetAllInKrwMax: row.total_budget_all_in_krw_max }),
    budgetScope: row.budget_scope,
    travelerCounts: { child: row.child_count, parent: row.parent_count, sibling: row.sibling_count },
    preferredRegionGroups: row.preferred_region_groups,
    regionPriority: row.region_priority,
    parentAccompanimentMode: row.parent_accompaniment_mode,
    koreanSupportNeed: row.korean_support_need,
    accommodationPreferences: row.accommodation_preferences,
    rawAnswers: isRecord(row.raw_answers) ? row.raw_answers : {},
  }))
}

function fromNaturalInputRow(row: z.infer<typeof NaturalInputRowSchema>): NaturalConsultationInput {
  return normalizeNaturalInput(NaturalConsultationInputSchema.parse({
    situationText: row.situation_text,
    ...(row.child_context_text === null ? {} : { childContextText: row.child_context_text }),
    ...(row.success_and_concerns_text === null ? {} : { successAndConcernsText: row.success_and_concerns_text }),
    ...(row.additional_notes === null ? {} : { additionalNotes: row.additional_notes }),
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function logSupabaseError(label: string, error: unknown): void {
  const normalized = normalizeSupabaseError(error)
  console.error(label, {
    name: normalized.name,
    code: normalized.code,
    status: normalized.status,
    statusCode: normalized.statusCode,
    message: normalized.message,
    details: normalized.details,
    hint: normalized.hint,
    keys: normalized.keys,
    body: normalized.body,
  })
}

function normalizeSupabaseError(error: unknown): {
  readonly name?: string
  readonly code?: string
  readonly status?: number
  readonly statusCode?: number
  readonly message?: string
  readonly details?: string
  readonly hint?: string
  readonly keys?: readonly string[]
  readonly body?: string
} {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) }
  }

  const body = JSON.stringify(error)
  return {
    ...optionalString("name", readStringProperty(error, "name")),
    ...optionalString("code", readStringProperty(error, "code")),
    ...optionalNumber("status", readNumberProperty(error, "status")),
    ...optionalNumber("statusCode", readNumberProperty(error, "statusCode")),
    message: readStringProperty(error, "message") ?? String(error),
    ...optionalString("details", readStringProperty(error, "details")),
    ...optionalString("hint", readStringProperty(error, "hint")),
    keys: Object.getOwnPropertyNames(error),
    ...(body === "{}" ? {} : { body }),
  }
}

function readStringProperty(value: object, key: string): string | undefined {
  if (!(key in value)) return undefined
  const property = value[key as keyof typeof value]
  return typeof property === "string" ? property : undefined
}

function readNumberProperty(value: object, key: string): number | undefined {
  if (!(key in value)) return undefined
  const property = value[key as keyof typeof value]
  return typeof property === "number" ? property : undefined
}

function optionalString(key: "name" | "code" | "details" | "hint", value: string | undefined): Record<typeof key, string> | Record<string, never> {
  return value === undefined ? {} : { [key]: value } as Record<typeof key, string>
}

function optionalNumber(key: "status" | "statusCode", value: number | undefined): Record<typeof key, number> | Record<string, never> {
  return value === undefined ? {} : { [key]: value } as Record<typeof key, number>
}
