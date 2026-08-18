import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import type { CampfitV3AnalyticsEvent } from "@/lib/campfit/v3/analyticsSchema"

type AnalyticsStatus = "started" | "in_progress" | "recommendation_ready" | "completed" | "restarted"

type ExistingSession = {
  readonly started_at: string
  readonly status: AnalyticsStatus
}

export type RecordAnalyticsResult =
  | { readonly status: "recorded" }
  | { readonly status: "unconfigured" }
  | { readonly status: "failed" }

export async function recordCampfitV3AnalyticsEvent(
  event: CampfitV3AnalyticsEvent,
): Promise<RecordAnalyticsResult> {
  const client = createServerSupabaseClient()
  if (client === null) return { status: "unconfigured" }

  const receivedAt = new Date().toISOString()
  const eventRow = {
    event_id: event.eventId,
    visit_id: event.visitId,
    journey_id: event.journeyId,
    handoff_id: event.handoffId,
    event_name: event.eventName,
    mode: event.mode,
    source_app: event.sourceApp,
    stage: event.stage,
    question_key: event.questionKey,
    question_index: event.questionIndex,
    progress: event.progress,
    result_id: event.resultId,
    item_type: event.itemType,
    item_id: event.itemId,
    item_name_snapshot: event.itemNameSnapshot,
    city_id: event.cityId,
    city_name_snapshot: event.cityNameSnapshot,
    country_name_snapshot: event.countryNameSnapshot,
    item_rank: event.itemRank,
    link_target: event.linkTarget,
    action: event.action,
    answer_kind: event.answerKind,
    catalog_source: event.catalogSource,
    limited_result: event.limitedResult,
    metadata: event.metadata,
    occurred_at: event.occurredAt ?? receivedAt,
    received_at: receivedAt,
  }

  const { error: eventError } = await client
    .from("campfit_v3_analytics_events")
    .upsert(eventRow, { onConflict: "event_id", ignoreDuplicates: true })
  if (eventError) {
    console.error("CampFit v3 analytics event save failed", eventError.message)
    return { status: "failed" }
  }

  if (event.journeyId === null) return { status: "recorded" }

  const { data: existingSession } = await client
    .from("campfit_v3_analytics_sessions")
    .select("started_at,status")
    .eq("journey_id", event.journeyId)
    .maybeSingle<ExistingSession>()

  const nextStatus = resolveStatus(event.eventName, existingSession?.status)
  const startedAt = existingSession?.started_at ?? receivedAt
  const completedAt = event.eventName === "campfit_result_viewed"
    ? receivedAt
    : null
  const durationSeconds = completedAt === null
    ? null
    : Math.max(0, Math.floor((Date.parse(completedAt) - Date.parse(startedAt)) / 1000))

  const { error: sessionError } = await client
    .from("campfit_v3_analytics_sessions")
    .upsert({
      journey_id: event.journeyId,
      visit_id: event.visitId,
      handoff_id: event.handoffId,
      mode: event.mode,
      status: nextStatus,
      source_app: event.sourceApp,
      last_seen_at: receivedAt,
      completed_at: completedAt,
      duration_seconds: durationSeconds,
      last_stage: event.stage,
      last_question_key: event.questionKey,
      last_question_index: event.questionIndex,
      progress: event.progress,
      result_id: event.resultId,
      updated_at: receivedAt,
    }, { onConflict: "journey_id" })
  if (sessionError) {
    console.error("CampFit v3 analytics session save failed", sessionError.message)
    return { status: "failed" }
  }

  if (event.eventName === "campfit_recommendation_completed" && event.resultId !== null) {
    const recommendationRows = [...event.cityRecommendations, ...event.programRecommendations].map((item) => ({
      result_id: event.resultId,
      journey_id: event.journeyId,
      mode: event.mode,
      item_type: item.itemType,
      item_id: item.itemId,
      item_name_snapshot: item.itemNameSnapshot,
      city_id: item.cityId,
      city_name_snapshot: item.cityNameSnapshot,
      country_name_snapshot: item.countryNameSnapshot,
      item_rank: item.itemRank,
      catalog_source: event.catalogSource ?? (event.mode === "demo" ? "demo" : "supabase"),
    }))

    if (recommendationRows.length > 0) {
      const { error: recommendationError } = await client
        .from("campfit_v3_analytics_recommendations")
        .upsert(recommendationRows, { onConflict: "result_id,item_type,item_id" })
      if (recommendationError) {
        console.error("CampFit v3 analytics recommendation save failed", recommendationError.message)
        return { status: "failed" }
      }
    }
  }

  return { status: "recorded" }
}

function resolveStatus(eventName: CampfitV3AnalyticsEvent["eventName"], currentStatus?: AnalyticsStatus): AnalyticsStatus {
  if (currentStatus === "completed" && eventName !== "campfit_restart") return "completed"
  if (eventName === "campfit_started") return "started"
  if (eventName === "campfit_recommendation_completed") return "recommendation_ready"
  if (eventName === "campfit_result_viewed") return "completed"
  if (eventName === "campfit_restart") return "restarted"
  if (eventName === "campfit_intake_submitted" || eventName === "campfit_conversation_started") return "in_progress"
  return currentStatus ?? "in_progress"
}
