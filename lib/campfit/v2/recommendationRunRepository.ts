import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import { buildLegacyMatchingPayload } from "@/lib/campfit/v2/legacyAdapter"
import type { CampfitV2MatchingResult } from "@/lib/campfit/v2/v2MatchingWrapper"
import type { ConsultingProfile, RecommendationReportV2 } from "@/types/campfitV2"

type SaveRecommendationRunInput = {
  readonly sessionId: string
  readonly profile: ConsultingProfile
  readonly matchingResult: CampfitV2MatchingResult
  readonly report: RecommendationReportV2
}

type ConsultingProfileRow = {
  readonly session_id: string
  readonly profile_version: string
  readonly hard_constraints: unknown
  readonly strong_preferences: unknown
  readonly soft_preferences: unknown
  readonly child_readiness: unknown
  readonly parent_intent: unknown
  readonly risk_profile: unknown
  readonly flexibility: unknown
  readonly budget_estimates: unknown
  readonly recommendation_strategy: string | null
  readonly legacy_parent_input: unknown
  readonly legacy_parent_analysis: unknown
}

type RecommendationRunRow = {
  readonly session_id: string
  readonly consulting_profile_id: string
  readonly run_version: string
  readonly strategy_summary: unknown
  readonly recommendations: unknown
  readonly excluded_candidates: unknown
  readonly relaxed_candidates: unknown
  readonly report: unknown
  readonly legacy_matching_payload: unknown
}

type LegacyMatchingAuditPayload = {
  readonly warnings: readonly string[]
}

export async function saveCampfitV2RecommendationRun(input: SaveRecommendationRunInput): Promise<string | null> {
  const client = createServerSupabaseClient()
  if (client === null) {
    return null
  }

  const profileRow = buildConsultingProfileRow(input.sessionId, input.profile)
  const { data: profileData, error: profileError } = await client
    .from("campfit_v2_consulting_profiles")
    .upsert(profileRow, { onConflict: "session_id" })
    .select("id")
    .single()

  if (profileError) {
    console.error("CampFit v2 consulting profile save failed", profileError.message)
    return null
  }

  const profileId = readProfileId(profileData)
  if (profileId === null) {
    console.error("CampFit v2 consulting profile save did not return id")
    return null
  }

  const { data: runData, error: runError } = await client
    .from("campfit_v2_recommendation_runs")
    .insert(
      buildRecommendationRunRow({
        sessionId: input.sessionId,
        consultingProfileId: profileId,
        profile: input.profile,
        matchingResult: input.matchingResult,
        report: input.report,
      }),
    )
    .select("id")
    .single()

  if (runError) {
    console.error("CampFit v2 recommendation run save failed", runError.message)
    return null
  }

  return readProfileId(runData)
}

function buildConsultingProfileRow(sessionId: string, profile: ConsultingProfile): ConsultingProfileRow {
  return {
    session_id: sessionId,
    profile_version: "v1",
    hard_constraints: profile.hardConstraints,
    strong_preferences: profile.strongPreferences,
    soft_preferences: profile.softPreferences,
    child_readiness: profile.childReadiness,
    parent_intent: profile.parentIntent,
    risk_profile: profile.riskProfile,
    flexibility: profile.flexibility,
    budget_estimates: profile.budgetEstimates,
    recommendation_strategy: profile.recommendationStrategy ?? null,
    legacy_parent_input: profile.legacyParentInput ?? null,
    legacy_parent_analysis: profile.legacyParentAnalysis ?? null,
  }
}

function buildRecommendationRunRow(input: {
  readonly sessionId: string
  readonly consultingProfileId: string
  readonly profile: ConsultingProfile
  readonly matchingResult: CampfitV2MatchingResult
  readonly report: RecommendationReportV2
}): RecommendationRunRow {
  return {
    session_id: input.sessionId,
    consulting_profile_id: input.consultingProfileId,
    run_version: "v1",
    strategy_summary: input.matchingResult.strategySummary,
    recommendations: input.matchingResult.recommendations,
    excluded_candidates: input.matchingResult.excludedCandidates,
    relaxed_candidates: input.matchingResult.relaxedCandidates,
    report: input.report,
    legacy_matching_payload: buildLegacyMatchingAuditPayload(input.profile),
  }
}

function buildLegacyMatchingAuditPayload(profile: ConsultingProfile): LegacyMatchingAuditPayload {
  return {
    warnings: buildLegacyMatchingPayload(profile).warnings,
  }
}

function readProfileId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    return null
  }

  const id = value.id
  return typeof id === "string" ? id : null
}
