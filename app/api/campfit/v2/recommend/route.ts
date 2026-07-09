import { NextResponse } from "next/server"
import { loadCampfitProgramCatalog } from "@/lib/campfit/supabaseProgramCatalog"
import { getTravelCostAssumptions, estimateAvailableProgramBudget } from "@/lib/campfit/v2/budgetEstimator"
import { getV2ApiClient, loadAnsweredDynamicAnswers, loadLatestAIExtraction, loadV2SessionBundle, updateV2SessionStatus } from "@/lib/campfit/v2/apiRepository"
import { RecommendV2RequestSchema } from "@/lib/campfit/v2/apiSchemas"
import { loadCityFitProfiles } from "@/lib/campfit/v2/cityProfileRepository"
import { buildCampfitV2ConsultingProfile } from "@/lib/campfit/v2/profileBuilder"
import { saveCampfitV2RecommendationRun } from "@/lib/campfit/v2/recommendationRunRepository"
import { buildCampfitV2Report } from "@/lib/campfit/v2/reportBuilder"
import { recommendCampsV2 } from "@/lib/campfit/v2/v2MatchingWrapper"

export async function POST(request: Request) {
  const parsed = RecommendV2RequestSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ message: "상담 정보를 다시 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 })
  }

  const client = getV2ApiClient()
  if (client === null) {
    return NextResponse.json({ message: "지금은 리포트를 만들 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }

  const [bundle, extraction, dynamicAnswers, assumptions, camps, cityFitProfiles] = await Promise.all([
    loadV2SessionBundle(client, parsed.data.sessionId),
    loadLatestAIExtraction(client, parsed.data.sessionId),
    loadAnsweredDynamicAnswers(client, parsed.data.sessionId),
    getTravelCostAssumptions(),
    loadCampfitProgramCatalog(),
    loadCityFitProfiles(),
  ])
  if (bundle === null || extraction === null) {
    return NextResponse.json({ message: "리포트를 만들 상담 정보를 찾을 수 없습니다. 처음부터 다시 시도해 주세요." }, { status: 404 })
  }

  const budgetEstimates = estimateAvailableProgramBudget({ requiredIntake: bundle.requiredIntake, assumptions })
  const consultingProfile = buildCampfitV2ConsultingProfile({
    ...bundle,
    extraction,
    dynamicAnswers,
    budgetEstimates,
  })
  const matchingResult = recommendCampsV2(consultingProfile, { camps })
  const report = buildCampfitV2Report(consultingProfile, matchingResult, { cityFitProfiles })
  const recommendationRunId = await saveCampfitV2RecommendationRun({
    sessionId: parsed.data.sessionId,
    profile: consultingProfile,
    matchingResult,
    report,
  })
  await updateV2SessionStatus(client, parsed.data.sessionId, "recommended", "report")

  return NextResponse.json({ consultingProfile, report, recommendationRunId })
}
