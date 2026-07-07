import { recommendCamps } from "@/lib/campfit/matching"
import { buildLegacyMatchingPayload } from "@/lib/campfit/v2/legacyAdapter"
import {
  preferredRegions,
} from "@/lib/campfit/v2/profileAccess"
import {
  bucketRank,
  buildConditionRelaxationSuggestions,
  buildConsultingChecklist,
  buildExcludedReasons,
  buildMatchedConditions,
  buildMismatchReasons,
  buildMitigation,
  buildRecommendDespiteMismatchReason,
  buildRiskReasons,
  childFitText,
  classifyRecommendationTierV2,
  familyFitText,
  normalizedProgramPreferences,
  regionPriorityAdjustment,
} from "@/lib/campfit/v2/v2MatchingRules"
import type { Camp, CampRecommendation } from "@/types/campfit"
import type { ConsultingProfile, ExcludedCandidateV2, RecommendationCardV2, RegionGroup } from "@/types/campfitV2"

export {
  buildConditionRelaxationSuggestions,
  buildExcludedReasons,
  buildMismatchReasons,
  buildRecommendDespiteMismatchReason,
  classifyRecommendationTierV2,
} from "@/lib/campfit/v2/v2MatchingRules"

export type RecommendationCardV2WithScore = RecommendationCardV2 & {
  readonly scoreBreakdown: {
    readonly legacyScore: number
    readonly v2Score: number
  }
}

export type CampfitV2MatchingResult = {
  readonly recommendations: readonly RecommendationCardV2WithScore[]
  readonly excludedCandidates: readonly ExcludedCandidateV2[]
  readonly relaxedCandidates: readonly RecommendationCardV2WithScore[]
  readonly strategySummary: Record<string, unknown>
}

export function recommendCampsV2(
  profile: ConsultingProfile,
  options: { readonly camps: readonly Camp[] },
): CampfitV2MatchingResult {
  const legacyMatchingPayload = buildLegacyMatchingPayload(profile)
  const legacyRecommendations = recommendCamps({ ...legacyMatchingPayload, camps: options.camps })
  const legacyByCampId = new Map(legacyRecommendations.map((item) => [item.camp.id, item]))
  const filtered = applyV2HardFilters(options.camps, profile)
  const cards = buildCandidateBucketsV2(filtered.eligible, profile)
    .map((camp) => scoreCandidateV2(camp, profile, legacyByCampId.get(camp.id)))
    .sort((left, right) => right.scoreBreakdown.v2Score - left.scoreBreakdown.v2Score)
  const recommendations = cards.filter((card) => card.tier !== "not_recommended").slice(0, 3)
  const relaxedCandidates = [
    ...cards.filter((card) => card.tier === "not_recommended"),
    ...filtered.relaxed.map((camp) => scoreCandidateV2(camp, profile, legacyByCampId.get(camp.id))),
  ].slice(0, 5)

  return {
    recommendations,
    excludedCandidates: filtered.excluded,
    relaxedCandidates,
    strategySummary: {
      recommendationStrategy: profile.recommendationStrategy ?? "safe_first_camp",
      exactCandidateCount: recommendations.length,
      excludedCandidateCount: filtered.excluded.length,
      relaxedCandidateCount: relaxedCandidates.length,
    },
  }
}

export function applyV2HardFilters(camps: readonly Camp[], profile: ConsultingProfile): {
  readonly eligible: readonly Camp[]
  readonly relaxed: readonly Camp[]
  readonly excluded: readonly ExcludedCandidateV2[]
} {
  const eligible: Camp[] = []
  const relaxed: Camp[] = []
  const excluded: ExcludedCandidateV2[] = []
  for (const camp of camps) {
    const reasons = buildExcludedReasons(camp, profile)
    const regionMismatch = reasons.includes("지역을 필수 조건으로 설정했기 때문에 제외했습니다.")
    if (regionMismatch) {
      relaxed.push(camp)
      continue
    }

    if (reasons.length > 0) {
      const stillWorthConsideringReason = reasons.some((reason) => reason.includes("예산"))
        ? "예산 조건을 조정하면 다시 비교할 수 있습니다."
        : "제외 조건을 완화할 수 있다면 상담에서 재검토할 수 있습니다."
      excluded.push({
        programId: camp.id,
        programName: camp.name,
        excludedReasons: reasons,
        conditionRelaxation: buildConditionRelaxationSuggestions({ programId: camp.id, programName: camp.name, excludedReasons: reasons, conditionRelaxation: [] }, profile),
        stillWorthConsideringReason,
      })
      continue
    }

    eligible.push(camp)
  }

  return { eligible, relaxed, excluded }
}

export function buildCandidateBucketsV2(camps: readonly Camp[], profile: ConsultingProfile): readonly Camp[] {
  const regionSet = new Set(preferredRegions(profile))
  const programSet = new Set(normalizedProgramPreferences(profile))
  return [...camps].sort((left, right) => bucketRank(left, regionSet, programSet) - bucketRank(right, regionSet, programSet))
}

export function scoreCandidateV2(
  camp: Camp,
  profile: ConsultingProfile,
  legacyResult?: CampRecommendation,
): RecommendationCardV2WithScore {
  const matchedConditions = buildMatchedConditions(camp, profile)
  const mismatchedConditions = buildMismatchReasons(camp, profile)
  const riskReasons = buildRiskReasons(camp, profile)
  const legacyScore = legacyResult?.score ?? 50
  const v2Score = Math.max(
    0,
    legacyScore +
      matchedConditions.length * 8 -
      mismatchedConditions.length * 12 -
      riskReasons.length * 5 +
      regionPriorityAdjustment(camp, profile),
  )
  const tier = classifyRecommendationTierV2({ v2Score, mismatchedConditions, riskReasons })

  const recommendDespiteMismatchReason = buildRecommendDespiteMismatchReason(camp, profile, mismatchedConditions)
  return {
    programId: camp.id,
    programName: camp.name,
    tier,
    fitSummary: `${camp.name}은 ${matchedConditions.slice(0, 2).join(", ") || "기본 조건"} 측면에서 비교할 수 있는 후보입니다.`,
    matchedConditions,
    mismatchedConditions,
    recommendDespiteMismatchReason: recommendDespiteMismatchReason ?? "주요 조건 불일치 없이 추천 가능한 후보입니다.",
    childFit: childFitText(camp, profile),
    familyFit: familyFitText(camp, profile),
    riskLevel: riskReasons.length >= 3 ? "high" : riskReasons.length >= 1 ? "medium" : "low",
    riskReasons,
    mitigation: buildMitigation(camp, profile),
    consultingChecklist: buildConsultingChecklist(camp, profile),
    scoreBreakdown: { legacyScore, v2Score },
  }
}
