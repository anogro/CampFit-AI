import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3ExperienceDirection,
  CampfitV3RecommendationResult,
  ExperienceDirectionKey,
} from "@/types/campfitV3"
import { CAMPFIT_V3_MAX_DURATION_WEEKS, CAMPFIT_V3_MIN_DURATION_WEEKS } from "@/types/campfitV3"

export type DecisionAxisLevel = "low" | "medium" | "high"

export type DecisionAxis = {
  readonly key: "english" | "school" | "project" | "culture" | "support" | "family"
  readonly label: string
  readonly summaryLabel: string
  readonly level: DecisionAxisLevel
}

export type ProgramCatalogPresentation = {
  readonly sectionTitle: string
  readonly sectionSubtitle: string
  readonly notice: string | null
  readonly showProgramCards: boolean
  readonly unavailableTitle: string | null
  readonly unavailableGuidance: string | null
}

const directionAxis: Readonly<Record<ExperienceDirectionKey, Omit<DecisionAxis, "level">>> = {
  englishIntensive: { key: "english", label: "영어 경험", summaryLabel: "영어 경험" },
  schoolSchooling: { key: "school", label: "학교·학습", summaryLabel: "학교·학습" },
  subjectProject: { key: "project", label: "주제·프로젝트", summaryLabel: "주제·프로젝트 경험" },
  cultureActivity: { key: "culture", label: "문화·활동", summaryLabel: "문화·활동 경험" },
}

export function buildDecisionAxes(
  result: CampfitV3RecommendationResult,
  state: CampfitV3ConversationState,
  basicInfo: CampfitV3BasicInfo,
): readonly DecisionAxis[] {
  const directions = new Map(result.experienceDirections.map((direction) => [direction.key, direction]))
  const directionKeys: readonly ExperienceDirectionKey[] = ["englishIntensive", "schoolSchooling", "subjectProject", "cultureActivity"]
  return [
    ...directionKeys.map((key): DecisionAxis => ({ ...directionAxis[key], level: directionLevel(directions.get(key)) })),
    { key: "support", label: "지원 필요", summaryLabel: "필요한 지원 확인", level: supportLevel(state) },
    { key: "family", label: "가족 체류 현실성", summaryLabel: "가족 체류의 현실성", level: familyLevel(state, basicInfo) },
  ]
}

export function decisionAxisLevelLabel(level: DecisionAxisLevel): string {
  return level === "high" ? "높음" : level === "medium" ? "보통" : "낮음"
}

export function decisionAxisGeometry(level: DecisionAxisLevel): number {
  return level === "high" ? 88 : level === "medium" ? 62 : 34
}

export function decisionAxesSummary(axes: readonly DecisionAxis[]): string {
  const emphasized = axes.filter((axis) => axis.level === "high")
  const selected = (emphasized.length ? emphasized : axes.filter((axis) => axis.level === "medium")).slice(0, 2)
  if (!selected.length) return "이번 상담에서는 입력한 조건을 균형 있게 반영했어요."
  return `이번 상담에서는 ${joinKorean(selected.map((axis) => axis.summaryLabel))}을 중요하게 반영했어요.`
}

export function programCatalogPresentation(
  source: CampfitV3RecommendationResult["catalogSource"],
): ProgramCatalogPresentation {
  if (source === "supabase") {
    return {
      sectionTitle: "현재 조건에서 살펴볼 프로그램",
      sectionSubtitle: "실제 프로그램 DB에서 확인한 후보를 비교해보세요.",
      notice: null,
      showProgramCards: true,
      unavailableTitle: null,
      unavailableGuidance: null,
    }
  }
  if (source === "static_fallback") {
    return {
      sectionTitle: "개발용 예시 후보",
      sectionSubtitle: "실제 프로그램 DB 후보가 아니며, 화면 흐름과 비교 방식을 확인하기 위한 예시입니다.",
      notice: "이 카드는 실제 프로그램 DB 후보가 아니며, 개발용 예시 후보입니다. 실제 선택이나 상담에는 사용하지 마세요.",
      showProgramCards: true,
      unavailableTitle: null,
      unavailableGuidance: null,
    }
  }
  if (source === "demo") {
    return {
      sectionTitle: "추천 프로그램 예시",
      sectionSubtitle: "현재 조건에서 함께 비교할 시연용 후보입니다.",
      notice: "현재 화면의 프로그램은 추천 흐름을 보여주기 위한 시연용 예시입니다. 실제 운영 일정·가격·모집 여부는 제공기관 확인이 필요합니다.",
      showProgramCards: true,
      unavailableTitle: null,
      unavailableGuidance: null,
    }
  }
  return {
    sectionTitle: "프로그램 정보 확인",
    sectionSubtitle: "프로그램 데이터 연결 상태를 다시 확인해주세요.",
    notice: null,
    showProgramCards: false,
    unavailableTitle: "프로그램 정보를 불러오지 못했습니다",
    unavailableGuidance: "잠시 후 다시 상담 결과를 확인해주세요. 문제가 계속되면 프로그램 담당자에게 최신 후보를 문의해주세요.",
  }
}

export function buildAnogroCityHref(cityName: string, baseUrl = anogroBaseUrl()): string | null {
  const normalizedName = cityName.trim()
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/+$/, "") ?? ""
  if (!normalizedName || !normalizedBaseUrl) return null
  try {
    const parsedBaseUrl = new URL(normalizedBaseUrl)
    if (parsedBaseUrl.protocol !== "https:" && parsedBaseUrl.protocol !== "http:") return null
    return `${normalizedBaseUrl}/city/${encodeURIComponent(normalizedName)}`
  } catch {
    return null
  }
}

export function safeProgramDetailHref(detailUrl: string | null): string | null {
  const normalizedUrl = detailUrl?.trim() ?? ""
  if (!normalizedUrl) return null
  try {
    const parsed = new URL(normalizedUrl)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? normalizedUrl : null
  } catch {
    return null
  }
}

function directionLevel(direction: CampfitV3ExperienceDirection | undefined): DecisionAxisLevel {
  if (!direction) return "low"
  if (direction.fitLabel === "가장 잘 맞는 방향") return "high"
  if (direction.fitLabel === "함께 검토할 방향") return direction.score >= 75 ? "high" : "medium"
  return direction.score >= 75 ? "high" : direction.score >= 50 ? "medium" : "low"
}

function supportLevel(state: CampfitV3ConversationState): DecisionAxisLevel {
  const care = factString(state, "specialCareFollowUp")
  const korean = factString(state, "koreanSupportNeed")
  const separation = factString(state, "dayProgramSeparationReadiness")
  const communication = factString(state, "parentCommunicationNeed")
  const english = factString(state, "childEnglishLevel")
  const firstExperience = state.facts.isFirstOverseasEducationExperience?.value === true

  if (care === "required" || korean === "must_daily" || separation === "needs_close_support") return "high"
  if (
    care === "unknown"
    || korean === "emergency_only"
    || korean === "preferred"
    || communication === "daily"
    || communication === "issue_only"
    || english === "beginner"
    || firstExperience
    || separation === "with_initial_support"
  ) return "medium"
  return "low"
}

function familyLevel(state: CampfitV3ConversationState, basicInfo: CampfitV3BasicInfo): DecisionAxisLevel {
  const stayGoals = state.facts.parentStayGoals?.value
  const hasStayGoal = Array.isArray(stayGoals) && stayGoals.length > 0
  const hasCompleteBasics = basicInfo.guardianStaysNearby
    && basicInfo.durationWeeks >= CAMPFIT_V3_MIN_DURATION_WEEKS
    && basicInfo.durationWeeks <= CAMPFIT_V3_MAX_DURATION_WEEKS
    && basicInfo.budgetMaxKrw >= basicInfo.budgetMinKrw
    && basicInfo.adultCount >= 1
    && basicInfo.childCount >= 1
  if (hasStayGoal && hasCompleteBasics) return "high"
  if (hasStayGoal || hasCompleteBasics) return "medium"
  return "low"
}

function factString(state: CampfitV3ConversationState, key: keyof CampfitV3ConversationState["facts"]): string {
  return String(state.facts[key]?.value ?? "")
}

function joinKorean(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "입력한 조건"
  return `${items.slice(0, -1).join(", ")}과 ${items[items.length - 1]}`
}

function anogroBaseUrl(): string {
  return process.env["NEXT_PUBLIC_ANOGRO_SITE_URL"] ?? "https://www.anogro.com"
}
