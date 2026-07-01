import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import type { FeedbackValue, RecommendationResult } from "@/types/campfit"

type SessionInsert = {
  readonly session_id: string
  readonly parent_input: unknown
  readonly structured_profile: unknown
  readonly camp_readiness_check: unknown
  readonly follow_up_answers: unknown
  readonly recommended_camps: unknown
  readonly consultation_requested: boolean
}

type FeedbackInsert = {
  readonly session_id: string
  readonly feedback: FeedbackValue
  readonly clicked_camp: string | null
}

export async function saveCampfitSession(
  result: RecommendationResult,
  parentInput: unknown,
  followUpAnswers: readonly string[],
): Promise<void> {
  const client = createServerSupabaseClient()
  if (client === null) {
    return
  }

  const payload: SessionInsert = {
    session_id: result.sessionId,
    parent_input: parentInput,
    structured_profile: result.analysis,
    camp_readiness_check: result.readiness,
    follow_up_answers: followUpAnswers,
    recommended_camps: result.recommendations,
    consultation_requested: false,
  }

  const { error } = await client.from("campfit_sessions").insert(payload)
  if (error) {
    console.error("Supabase session save failed", error.message)
  }
}

export async function saveCampfitFeedback(
  sessionId: string,
  feedback: FeedbackValue,
  clickedCampId?: string,
): Promise<void> {
  const client = createServerSupabaseClient()
  if (client === null) {
    return
  }

  const payload: FeedbackInsert = {
    session_id: sessionId,
    feedback,
    clicked_camp: clickedCampId ?? null,
  }

  const { error } = await client.from("campfit_feedback").insert(payload)
  if (error) {
    console.error("Supabase feedback save failed", error.message)
  }
}
