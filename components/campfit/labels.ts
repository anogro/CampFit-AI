import type { FitType } from "@/types/campfit"

export const gradeLabels = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3"] as const

export const optionLabels = {
  englishSelfLevel: {
    almost_none: "거의 처음",
    basic_expression: "간단한 단어/표현",
    simple_conversation: "짧은 대화 가능",
    comfortable: "편하게 대화 가능",
  },
  overseasExperience: {
    none: "해외 경험 없음",
    travel_only: "가족 여행 정도",
    camp_experience: "캠프 경험 있음",
  },
  level: {
    low: "낮음",
    medium: "보통",
    high: "높음",
  },
  budgetRange: {
    under_3m: "300만 원 이하",
    "3m_5m": "300만-500만 원",
    "5m_8m": "500만-800만 원",
    over_8m: "800만 원 이상",
  },
  destinationPreference: {
    no_preference: "아직 모르겠음",
    southeast_asia: "동남아 관리형",
    oceania: "호주/뉴질랜드",
    north_america: "미국/캐나다",
  },
  travelReadiness: {
    short_flight_care: "짧은 비행과 촘촘한 관리",
    moderate_distance: "거리보다 프로그램 적합도",
    long_flight_independent: "장거리·독립형도 가능",
  },
  durationWeeks: {
    "1w": "1주",
    "2w": "2주",
    "3_4w": "3-4주",
    over_4w: "4주 이상",
  },
  parentAccompanied: {
    required: "부모 동반 필수",
    preferred: "가능하면 동반",
    not_needed: "비동반 가능",
    unsure: "아직 모르겠음",
  },
  koreanManagerRequired: {
    required: "한국인 관리자 필수",
    preferred: "있으면 좋음",
    not_needed: "필수 아님",
  },
  preferredProgramType: {
    managed_immersion: "관리형 영어몰입",
    schooling: "스쿨링",
    family_esl: "가족동반 ESL",
    activity: "액티비티 영어캠프",
    creative_daycamp: "창의 데이캠프",
    international_camp: "고강도 국제캠프",
    unsure: "아직 모르겠음",
  },
} as const

export function fitTypeLabel(fitType: FitType): string {
  switch (fitType) {
    case "comfort":
      return "Comfort Fit"
    case "stretch":
      return "Stretch Fit"
    case "overreach":
      return "Overreach"
    case "underchallenge":
      return "Underchallenge"
  }
}

export function readinessLabel(value: string): string {
  switch (value) {
    case "early_adaptation":
      return "초기 적응 지원 권장"
    case "basic_adaptation":
      return "기초 적응 단계"
    case "moderate_ready":
      return "중간 준비도"
    case "high_ready":
      return "높은 준비도"
    default:
      return "확인 필요"
  }
}
