import type { ExperienceDirectionKey } from "@/types/campfitV3"
import type { Camp } from "@/types/campfit"

export const CAMPFIT_V3_DEMO_CATALOG_VERSION = "campfit-v3-demo-2"

export type DemoPriceQuality = "exact" | "official_surcharge" | "reference" | "inquiry"
export type DemoParentMode = "family" | "day" | "child_only"
export type DemoSeason = "summer" | "year_round" | "winter"
export type DemoProductCategory = "english" | "stem" | "sports" | "culture" | "schooling" | "project"
export type DemoMealPlan = "none" | "weekday_lunch" | "weekday_two_meals" | "full_board"

export type DemoPackageInclusions = {
  readonly accommodationIncluded: boolean
  readonly mealPlan: DemoMealPlan
  readonly localTransportIncluded: boolean
  readonly airportTransferIncluded: boolean
  readonly registrationFeeKrw: number | null
  readonly additionalAdultSurchargeKrw: number | null
  readonly additionalChildProgramPriceKrw: number | null
}

export type DemoCityDefinition = {
  readonly id: string
  readonly name: string
  readonly country: string
  readonly description: string
  readonly flightCostKrw: number
  readonly livingCostMonthlyKrw: number
  readonly housingCostMonthlyKrw: number
  readonly parentStayEvidence: string
  readonly profile: {
    readonly costLevel: "low" | "medium" | "high"
    readonly livingEnvironment: "quiet" | "balanced" | "urban"
    readonly medicalLevel: "medium" | "high"
    readonly safetyLevel: "medium" | "high"
    readonly englishEnvironment: "medium" | "high"
    readonly stemStrength: "medium" | "high"
    readonly natureStrength: "low" | "medium" | "high"
    readonly internationality: "medium" | "high"
    readonly strengths: readonly string[]
  }
}

export type DemoProgramDefinition = {
  readonly id: string
  readonly name: string
  readonly city: string
  readonly country: string
  readonly programType: Exclude<Camp["programType"], "unsure">
  readonly category: DemoProductCategory
  readonly ageMin: number
  readonly ageMax: number
  readonly durations: readonly number[]
  readonly seasons: readonly DemoSeason[]
  readonly parentMode: DemoParentMode
  readonly accommodations: readonly string[]
  readonly primaryDirection: ExperienceDirectionKey
  readonly secondaryDirections: readonly ExperienceDirectionKey[]
  readonly koreanSupport: "daily" | "emergency_only" | "none"
  readonly beginnerClass: boolean
  readonly earlyAdaptationSupport: boolean
  readonly dailyParentReport: boolean
  readonly specialCareSupport: "supported" | "unknown"
  readonly priceBaseKrw: number
  readonly priceQuality: DemoPriceQuality
  readonly packageInclusions: DemoPackageInclusions
  readonly traits: readonly string[]
  readonly strengths: readonly string[]
  readonly tradeoffs: readonly string[]
}

export const demoCityDefinitions: readonly DemoCityDefinition[] = [
  {
    id: "demo-city-chiang-mai",
    name: "Chiang Mai",
    country: "Thailand",
    description: "느린 가족 생활, 자연·문화, 비교적 부담 낮은 장기 체류를 함께 살펴볼 수 있는 도시입니다.",
    flightCostKrw: 550_000,
    livingCostMonthlyKrw: 1_400_000,
    housingCostMonthlyKrw: 1_200_000,
    parentStayEvidence: "rest wellness spa massage cafe dining nature park culture museum remote work internet coworking family stay medical safety international community",
    profile: {
      costLevel: "low", livingEnvironment: "quiet", medicalLevel: "medium", safetyLevel: "high", englishEnvironment: "medium", stemStrength: "medium", natureStrength: "high", internationality: "medium",
      strengths: ["휴식·웰니스와 자연 체험", "비교적 낮은 생활비", "차분한 가족 루틴"],
    },
  },
  {
    id: "demo-city-cebu",
    name: "Cebu",
    country: "Philippines",
    description: "영어 프로그램 선택 폭과 바다·리조트형 가족 체류를 함께 비교하기 좋은 도시입니다.",
    flightCostKrw: 450_000,
    livingCostMonthlyKrw: 1_300_000,
    housingCostMonthlyKrw: 1_500_000,
    parentStayEvidence: "rest wellness spa massage family resort beach nature cafe dining remote work internet airport medical international community safety",
    profile: {
      costLevel: "low", livingEnvironment: "balanced", medicalLevel: "medium", safetyLevel: "medium", englishEnvironment: "high", stemStrength: "medium", natureStrength: "high", internationality: "medium",
      strengths: ["영어 프로그램 공급", "바다·리조트 생활", "짧은 비행과 비교적 낮은 비용"],
    },
  },
  {
    id: "demo-city-singapore",
    name: "Singapore",
    country: "Singapore",
    description: "STEM·국제학교·의료와 교통을 우선할 때 강하지만 체류비가 높은 도시입니다.",
    flightCostKrw: 650_000,
    livingCostMonthlyKrw: 2_800_000,
    housingCostMonthlyKrw: 3_500_000,
    parentStayEvidence: "remote work internet coworking cafe dining restaurant shopping convenience urban medical hospital safety international community english environment",
    profile: {
      costLevel: "high", livingEnvironment: "urban", medicalLevel: "high", safetyLevel: "high", englishEnvironment: "high", stemStrength: "high", natureStrength: "low", internationality: "high",
      strengths: ["STEM·국제학교 선택 폭", "높은 의료·치안 신뢰도", "대중교통과 부모 생활 편의"],
    },
  },
  {
    id: "demo-city-auckland",
    name: "Auckland",
    country: "New Zealand",
    description: "영어권 학교 경험, 자연·프로젝트, 비교적 넉넉한 가족 체류를 함께 보는 도시입니다.",
    flightCostKrw: 1_200_000,
    livingCostMonthlyKrw: 2_800_000,
    housingCostMonthlyKrw: 3_400_000,
    parentStayEvidence: "remote work internet coworking cafe dining nature beach park tourism culture medical hospital safety international community english environment",
    profile: {
      costLevel: "high", livingEnvironment: "balanced", medicalLevel: "high", safetyLevel: "high", englishEnvironment: "high", stemStrength: "high", natureStrength: "high", internationality: "high",
      strengths: ["영어권 환경", "자연·프로젝트 균형", "넉넉한 장기 체류감"],
    },
  },
  {
    id: "demo-city-gold-coast",
    name: "Gold Coast",
    country: "Australia",
    description: "스포츠·해변·야외활동과 영어환경을 함께 원하는 가족에게 잘 맞는 활동형 도시입니다.",
    flightCostKrw: 1_000_000,
    livingCostMonthlyKrw: 2_600_000,
    housingCostMonthlyKrw: 3_200_000,
    parentStayEvidence: "rest wellness spa massage cafe dining restaurant nature beach park tourism culture remote work internet medical hospital safety international community english environment",
    profile: {
      costLevel: "high", livingEnvironment: "balanced", medicalLevel: "high", safetyLevel: "high", englishEnvironment: "high", stemStrength: "medium", natureStrength: "high", internationality: "high",
      strengths: ["스포츠·해변 활동", "영어권 또래 교류", "의료·생활환경 안정성"],
    },
  },
  {
    id: "demo-city-kuala-lumpur",
    name: "Kuala Lumpur",
    country: "Malaysia",
    description: "국제학교·로봇·영어 프로그램과 합리적인 도시 생활비를 함께 비교할 수 있습니다.",
    flightCostKrw: 600_000,
    livingCostMonthlyKrw: 1_500_000,
    housingCostMonthlyKrw: 1_700_000,
    parentStayEvidence: "remote work internet coworking cafe dining restaurant shopping convenience urban medical hospital safety international community english environment",
    profile: {
      costLevel: "medium", livingEnvironment: "urban", medicalLevel: "high", safetyLevel: "high", englishEnvironment: "medium", stemStrength: "high", natureStrength: "medium", internationality: "high",
      strengths: ["국제학교·STEM 공급", "다문화 생활환경", "싱가포르보다 낮은 체류비"],
    },
  },
  {
    id: "demo-city-bali",
    name: "Bali",
    country: "Indonesia",
    description: "웰니스·자연·문화와 프로젝트형 활동을 비교하기 좋은 여유로운 가족 체류 도시입니다.",
    flightCostKrw: 650_000,
    livingCostMonthlyKrw: 1_600_000,
    housingCostMonthlyKrw: 1_800_000,
    parentStayEvidence: "rest wellness spa massage nature beach park tourism culture cafe dining remote work internet coworking family stay medical safety international community",
    profile: {
      costLevel: "medium", livingEnvironment: "quiet", medicalLevel: "medium", safetyLevel: "medium", englishEnvironment: "medium", stemStrength: "medium", natureStrength: "high", internationality: "medium",
      strengths: ["웰니스·자연·문화", "프로젝트형 체험", "가족형 숙소 선택 폭"],
    },
  },
  {
    id: "demo-city-dubai",
    name: "Dubai",
    country: "United Arab Emirates",
    description: "국제성·STEM·의료를 최우선할 때 강하지만 높은 체류비와 더운 기후를 고려해야 합니다.",
    flightCostKrw: 900_000,
    livingCostMonthlyKrw: 3_000_000,
    housingCostMonthlyKrw: 3_800_000,
    parentStayEvidence: "remote work internet coworking cafe dining restaurant shopping convenience urban medical hospital safety international community english environment tourism culture",
    profile: {
      costLevel: "high", livingEnvironment: "urban", medicalLevel: "high", safetyLevel: "high", englishEnvironment: "high", stemStrength: "high", natureStrength: "low", internationality: "high",
      strengths: ["국제학교·STEM 환경", "높은 의료·치안", "영어 사용과 도시 편의"],
    },
  },
]

const cityCountry: Readonly<Record<string, string>> = Object.fromEntries(demoCityDefinitions.map((city) => [city.name, city.country]))

function demoProgram(input: Omit<DemoProgramDefinition, "country">): DemoProgramDefinition {
  return { ...input, country: cityCountry[input.city] ?? "" }
}

const familyDefaults = {
  parentMode: "family" as const,
  accommodations: ["Studio", "1BR", "2BR"],
  koreanSupport: "emergency_only" as const,
  beginnerClass: true,
  earlyAdaptationSupport: true,
  dailyParentReport: false,
  specialCareSupport: "unknown" as const,
  packageInclusions: {
    accommodationIncluded: true,
    mealPlan: "weekday_lunch" as const,
    localTransportIncluded: false,
    airportTransferIncluded: false,
    registrationFeeKrw: null,
    additionalAdultSurchargeKrw: null,
    additionalChildProgramPriceKrw: null,
  },
}

const dayDefaults = {
  parentMode: "day" as const,
  accommodations: ["Studio", "1BR", "Hotel", "숙소미포함"],
  koreanSupport: "none" as const,
  beginnerClass: true,
  earlyAdaptationSupport: true,
  dailyParentReport: false,
  specialCareSupport: "unknown" as const,
  packageInclusions: {
    accommodationIncluded: false,
    mealPlan: "none" as const,
    localTransportIncluded: false,
    airportTransferIncluded: false,
    registrationFeeKrw: null,
    additionalAdultSurchargeKrw: null,
    additionalChildProgramPriceKrw: null,
  },
}

const childOnlyDefaults = {
  parentMode: "child_only" as const,
  accommodations: ["Residence", "Hotel", "숙소미포함"],
  koreanSupport: "daily" as const,
  beginnerClass: false,
  earlyAdaptationSupport: true,
  dailyParentReport: true,
  specialCareSupport: "unknown" as const,
  packageInclusions: {
    accommodationIncluded: true,
    mealPlan: "weekday_two_meals" as const,
    localTransportIncluded: true,
    airportTransferIncluded: false,
    registrationFeeKrw: null,
    additionalAdultSurchargeKrw: null,
    additionalChildProgramPriceKrw: null,
  },
}

export const demoProgramDefinitions: readonly DemoProgramDefinition[] = [
  demoProgram({ id: "demo-cm-family-english", name: "Chiang Mai Family English & Nature", city: "Chiang Mai", programType: "family_esl", category: "english", ageMin: 6, ageMax: 12, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, primaryDirection: "englishIntensive", secondaryDirections: ["cultureActivity"], priceBaseKrw: 2_100_000, priceQuality: "exact", traits: ["영어", "자연", "가족캠프"], strengths: ["초급자도 참여하기 쉬운 영어 활동", "자연·문화 일정과 가족 체류의 균형"], tradeoffs: ["영어 몰입 강도는 전문 기숙형보다 낮을 수 있음"] }),
  demoProgram({ id: "demo-cm-maker-lab", name: "Chiang Mai Maker & Science Lab", city: "Chiang Mai", programType: "creative_daycamp", category: "stem", ageMin: 7, ageMax: 13, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["Studio", "1BR", "Residence", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["englishIntensive"], priceBaseKrw: 3_100_000, priceQuality: "official_surcharge", traits: ["STEM", "maker", "프로젝트"], strengths: ["만들기와 과학 실험 결과물이 분명함", "부모가 같은 도시에 머물며 일정 조정 가능"], tradeoffs: ["프로그램 외 숙소·이동을 별도로 확인해야 함"] }),
  demoProgram({ id: "demo-cm-school-break", name: "Chiang Mai International School Break", city: "Chiang Mai", programType: "schooling", category: "schooling", ageMin: 8, ageMax: 14, durations: [2, 3, 4], seasons: ["summer", "winter"], ...familyDefaults, accommodations: ["1BR", "2BR", "Hotel"], primaryDirection: "schoolSchooling", secondaryDirections: ["englishIntensive"], priceBaseKrw: 3_500_000, priceQuality: "reference", traits: ["국제학교", "학교 경험", "영어"], strengths: ["학교형 루틴과 또래 교류", "비교적 차분한 생활환경"], tradeoffs: ["정확한 학교 일정과 학년 배정을 확인해야 함"] }),
  demoProgram({ id: "demo-cm-young-learner-residential", name: "Chiang Mai Young Learner Residential English", city: "Chiang Mai", programType: "managed_immersion", category: "english", ageMin: 7, ageMax: 13, durations: [2, 3, 4, 6], seasons: ["summer", "winter"], ...childOnlyDefaults, primaryDirection: "englishIntensive", secondaryDirections: ["cultureActivity"], priceBaseKrw: 2_800_000, priceQuality: "inquiry", traits: ["영어 몰입", "기숙형", "생활관리"], strengths: ["아이 단독 참여와 생활 관리", "영어 노출을 일정하게 유지"], tradeoffs: ["부모 동반 체류형 조건과는 다름"] }),

  demoProgram({ id: "demo-cebu-family-esl", name: "Cebu Family ESL & Culture Camp", city: "Cebu", programType: "family_esl", category: "english", ageMin: 6, ageMax: 12, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, packageInclusions: { ...familyDefaults.packageInclusions, mealPlan: "weekday_two_meals", localTransportIncluded: true, airportTransferIncluded: true }, accommodations: ["1BR", "2BR", "Hotel"], primaryDirection: "englishIntensive", secondaryDirections: ["cultureActivity"], priceBaseKrw: 2_200_000, priceQuality: "exact", traits: ["영어", "문화", "가족캠프"], strengths: ["영어 수업과 가족형 활동을 함께 비교", "짧은 비행과 리조트형 체류"], tradeoffs: ["시즌별 교통·습도와 숙소 차이를 확인해야 함"] }),
  demoProgram({ id: "demo-cebu-stem-explorers", name: "Cebu STEM Explorers Project Camp", city: "Cebu", programType: "creative_daycamp", category: "stem", ageMin: 7, ageMax: 13, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["Studio", "1BR", "Hotel", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["englishIntensive"], priceBaseKrw: 3_000_000, priceQuality: "official_surcharge", traits: ["STEM", "프로젝트", "실험"], strengths: ["STEM·프로젝트 활동을 영어로 경험", "부모 체류와 프로그램을 분리해 설계 가능"], tradeoffs: ["숙소와 셔틀 비용이 추가될 수 있음"] }),
  demoProgram({ id: "demo-cebu-sports-english", name: "Cebu Junior Sports & English", city: "Cebu", programType: "activity", category: "sports", ageMin: 6, ageMax: 12, durations: [1, 2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["Studio", "1BR", "Hotel"], primaryDirection: "cultureActivity", secondaryDirections: ["englishIntensive"], priceBaseKrw: 2_000_000, priceQuality: "reference", traits: ["스포츠", "영어 활동", "바다"], strengths: ["스포츠와 영어 노출의 부담 낮은 조합", "1주부터 기간을 조절하기 쉬움"], tradeoffs: ["STEM·학업형 결과물은 적을 수 있음"] }),
  demoProgram({ id: "demo-cebu-junior-residential", name: "Cebu Junior Residential English Camp", city: "Cebu", programType: "managed_immersion", category: "english", ageMin: 7, ageMax: 14, durations: [2, 3, 4, 6], seasons: ["summer", "winter"], ...childOnlyDefaults, primaryDirection: "englishIntensive", secondaryDirections: ["subjectProject"], priceBaseKrw: 3_500_000, priceQuality: "inquiry", traits: ["영어 몰입", "기숙형", "주니어"], strengths: ["아이 단독 영어 몰입과 생활관리", "부모가 별도 체류하지 않는 상품 구조"], tradeoffs: ["부모 동반 체류가 필요한 가족에게는 맞지 않음"] }),

  demoProgram({ id: "demo-singapore-stem-maker", name: "Singapore STEM Maker Studio", city: "Singapore", programType: "creative_daycamp", category: "stem", ageMin: 7, ageMax: 13, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, packageInclusions: { ...dayDefaults.packageInclusions, localTransportIncluded: true }, accommodations: ["Studio", "1BR", "Hotel", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["englishIntensive"], priceBaseKrw: 4_800_000, priceQuality: "exact", traits: ["STEM", "robotics", "maker"], strengths: ["로봇·메이커 프로젝트 선택 폭", "도시 교통과 의료 접근성이 좋음"], tradeoffs: ["숙소·생활비가 높아 전체 예산을 함께 봐야 함"] }),
  demoProgram({ id: "demo-singapore-school-experience", name: "Singapore International School Experience", city: "Singapore", programType: "schooling", category: "schooling", ageMin: 6, ageMax: 12, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["1BR", "2BR", "Hotel"], primaryDirection: "schoolSchooling", secondaryDirections: ["englishIntensive"], priceBaseKrw: 5_200_000, priceQuality: "official_surcharge", traits: ["국제학교", "영어", "현지 또래"], strengths: ["영어권 학교 루틴과 국제 또래", "의료·치안과 부모 생활 편의"], tradeoffs: ["학업 강도와 높은 가족 체류비를 확인해야 함"] }),
  demoProgram({ id: "demo-singapore-creative-city", name: "Singapore Creative City Camp", city: "Singapore", programType: "creative_daycamp", category: "culture", ageMin: 6, ageMax: 10, durations: [1, 2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["Studio", "1BR", "Hotel", "숙소미포함"], primaryDirection: "cultureActivity", secondaryDirections: ["subjectProject"], priceBaseKrw: 3_200_000, priceQuality: "reference", traits: ["문화", "도시 체험", "창의 활동"], strengths: ["짧은 기간에도 도시·문화 활동을 경험", "부모가 자유시간과 교통 편의를 확보"], tradeoffs: ["자연·야외 활동 비중은 낮을 수 있음"] }),
  demoProgram({ id: "demo-singapore-young-innovators", name: "Singapore Young Innovators Residential", city: "Singapore", programType: "international_camp", category: "project", ageMin: 9, ageMax: 15, durations: [2, 3, 4, 6], seasons: ["summer", "year_round"], ...childOnlyDefaults, accommodations: ["Residence", "Hotel", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["schoolSchooling"], priceBaseKrw: 6_000_000, priceQuality: "inquiry", traits: ["프로젝트", "국제학생", "기숙형"], strengths: ["국제 팀 프로젝트와 발표", "도시형 STEM 인프라"], tradeoffs: ["아이 단독 생활과 높은 비용을 고려해야 함"] }),

  demoProgram({ id: "demo-auckland-outdoor-english", name: "Auckland English & Outdoor Discovery", city: "Auckland", programType: "activity", category: "english", ageMin: 8, ageMax: 14, durations: [2, 3, 4, 6], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["1BR", "2BR", "Hotel"], primaryDirection: "englishIntensive", secondaryDirections: ["cultureActivity"], priceBaseKrw: 6_800_000, priceQuality: "exact", traits: ["영어", "자연", "야외활동"], strengths: ["영어권 환경과 자연 탐구", "차분한 가족 생활과 의료 접근성"], tradeoffs: ["항공·숙소 비용이 높고 이동 계획이 필요함"] }),
  demoProgram({ id: "demo-auckland-stem-expedition", name: "Auckland STEM Expedition", city: "Auckland", programType: "creative_daycamp", category: "stem", ageMin: 7, ageMax: 14, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["Studio", "1BR", "2BR", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["cultureActivity"], priceBaseKrw: 7_400_000, priceQuality: "official_surcharge", traits: ["STEM", "환경", "프로젝트"], strengths: ["자연 속 STEM 탐구와 결과물", "영어 사용과 프로젝트를 함께 경험"], tradeoffs: ["활동 장소에 따라 차량·셔틀을 확인해야 함"] }),
  demoProgram({ id: "demo-auckland-school-bridge", name: "Auckland Global School Bridge", city: "Auckland", programType: "schooling", category: "schooling", ageMin: 8, ageMax: 15, durations: [3, 4, 6, 8], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["1BR", "2BR", "Residence"], primaryDirection: "schoolSchooling", secondaryDirections: ["englishIntensive"], priceBaseKrw: 8_200_000, priceQuality: "reference", traits: ["학교 경험", "현지 또래", "영어"], strengths: ["영어권 학교생활과 또래 교류", "3~8주 장기 체류 선택지"], tradeoffs: ["학년·학교 일정과 장기 숙소 비용을 확인해야 함"] }),
  demoProgram({ id: "demo-auckland-young-learner", name: "Auckland Young Learner Residential English", city: "Auckland", programType: "managed_immersion", category: "english", ageMin: 10, ageMax: 16, durations: [2, 3, 4], seasons: ["summer", "winter"], ...childOnlyDefaults, primaryDirection: "englishIntensive", secondaryDirections: ["schoolSchooling"], priceBaseKrw: 7_800_000, priceQuality: "inquiry", traits: ["영어 몰입", "기숙형", "다국적"], strengths: ["영어권 아이 단독 생활과 국제 또래", "높은 영어 노출"], tradeoffs: ["부모가 같은 도시에 머무는 가족형 상품은 아님"] }),

  demoProgram({ id: "demo-gold-coast-sports", name: "Gold Coast Sports English Camp", city: "Gold Coast", programType: "activity", category: "sports", ageMin: 6, ageMax: 13, durations: [1, 2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, packageInclusions: { ...familyDefaults.packageInclusions, localTransportIncluded: true }, accommodations: ["Studio", "1BR", "Hotel"], primaryDirection: "cultureActivity", secondaryDirections: ["englishIntensive"], priceBaseKrw: 5_200_000, priceQuality: "exact", traits: ["스포츠", "영어", "해변"], strengths: ["스포츠·해변·영어 활동의 균형", "가족 휴양과 아이 일정을 함께 구성"], tradeoffs: ["활동량이 높고 차량 이동이 필요할 수 있음"] }),
  demoProgram({ id: "demo-gold-coast-ocean-stem", name: "Gold Coast Ocean STEM Project", city: "Gold Coast", programType: "creative_daycamp", category: "stem", ageMin: 7, ageMax: 13, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["1BR", "2BR", "Hotel", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["cultureActivity"], priceBaseKrw: 6_400_000, priceQuality: "official_surcharge", traits: ["STEM", "해양", "프로젝트"], strengths: ["해양·환경 주제와 만들기 프로젝트", "영어권 활동 환경"], tradeoffs: ["날씨와 지역별 이동 조건을 확인해야 함"] }),
  demoProgram({ id: "demo-gold-coast-global-school", name: "Gold Coast Global School Program", city: "Gold Coast", programType: "schooling", category: "schooling", ageMin: 8, ageMax: 15, durations: [2, 3, 4, 6], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["1BR", "2BR", "Hotel"], primaryDirection: "schoolSchooling", secondaryDirections: ["englishIntensive"], priceBaseKrw: 7_400_000, priceQuality: "reference", traits: ["학교 경험", "국제학생", "영어"], strengths: ["영어권 학교 분위기와 국제 또래", "스포츠·야외 선택 폭"], tradeoffs: ["높은 체류비와 학교별 입학 조건을 확인해야 함"] }),
  demoProgram({ id: "demo-gold-coast-residential", name: "Gold Coast Residential Adventure", city: "Gold Coast", programType: "international_camp", category: "sports", ageMin: 9, ageMax: 15, durations: [2, 3, 4, 6], seasons: ["summer", "year_round"], ...childOnlyDefaults, primaryDirection: "cultureActivity", secondaryDirections: ["englishIntensive"], priceBaseKrw: 6_900_000, priceQuality: "inquiry", traits: ["기숙형", "스포츠", "국제학생"], strengths: ["아이 단독 스포츠·영어 몰입", "국제 학생들과 활동"], tradeoffs: ["부모 동반 체류 조건과는 다름"] }),

  demoProgram({ id: "demo-kl-school-bridge", name: "Kuala Lumpur International School Bridge", city: "Kuala Lumpur", programType: "schooling", category: "schooling", ageMin: 6, ageMax: 13, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["Studio", "1BR", "2BR"], primaryDirection: "schoolSchooling", secondaryDirections: ["englishIntensive"], priceBaseKrw: 3_800_000, priceQuality: "exact", traits: ["국제학교", "다문화", "영어"], strengths: ["국제학교형 루틴과 다문화 또래", "비용과 도시 편의의 균형"], tradeoffs: ["영어 사용 비중은 기관별로 다를 수 있음"] }),
  demoProgram({ id: "demo-kl-robotics", name: "Kuala Lumpur Robotics & Maker Academy", city: "Kuala Lumpur", programType: "creative_daycamp", category: "stem", ageMin: 7, ageMax: 14, durations: [2, 3, 4, 6], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["Studio", "1BR", "Hotel", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["schoolSchooling"], priceBaseKrw: 4_600_000, priceQuality: "official_surcharge", traits: ["로봇", "STEM", "maker"], strengths: ["로봇·메이커 프로젝트 선택 폭", "싱가포르보다 낮은 가족 체류비"], tradeoffs: ["교통과 셔틀 운영을 확인해야 함"] }),
  demoProgram({ id: "demo-kl-english-culture", name: "Kuala Lumpur English Culture Exchange", city: "Kuala Lumpur", programType: "family_esl", category: "culture", ageMin: 6, ageMax: 12, durations: [1, 2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["Studio", "1BR", "Hotel"], primaryDirection: "englishIntensive", secondaryDirections: ["cultureActivity"], priceBaseKrw: 3_000_000, priceQuality: "reference", traits: ["영어", "문화", "다문화"], strengths: ["영어와 도시 문화 체험을 가볍게 시작", "1~4주 기간 조절"], tradeoffs: ["자연·야외 활동보다 도시 활동 중심"] }),
  demoProgram({ id: "demo-kl-global-boarding", name: "Kuala Lumpur Global Boarding Camp", city: "Kuala Lumpur", programType: "international_camp", category: "schooling", ageMin: 10, ageMax: 16, durations: [2, 3, 4, 6, 8], seasons: ["summer", "year_round"], ...childOnlyDefaults, accommodations: ["Residence", "Homestay", "숙소미포함"], primaryDirection: "schoolSchooling", secondaryDirections: ["englishIntensive"], priceBaseKrw: 4_900_000, priceQuality: "inquiry", traits: ["기숙형", "다국적", "학교 경험"], strengths: ["장기 아이 단독 체류와 학교형 루틴", "다국적 또래 교류"], tradeoffs: ["부모 동행형 숙소가 아니며 모집 조건 문의 필요"] }),

  demoProgram({ id: "demo-bali-family-culture", name: "Bali Family English & Culture", city: "Bali", programType: "family_esl", category: "culture", ageMin: 6, ageMax: 12, durations: [1, 2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["Studio", "1BR", "2BR", "Hotel"], primaryDirection: "cultureActivity", secondaryDirections: ["englishIntensive"], priceBaseKrw: 2_600_000, priceQuality: "exact", traits: ["문화", "영어", "가족캠프"], strengths: ["문화·자연·영어를 부담 낮게 경험", "가족형 숙소 선택 폭"], tradeoffs: ["의료·교통 조건은 지역별 확인 필요"] }),
  demoProgram({ id: "demo-bali-eco-maker", name: "Bali Eco Maker Project Camp", city: "Bali", programType: "creative_daycamp", category: "project", ageMin: 7, ageMax: 13, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["Studio", "1BR", "Hotel", "숙소미포함"], primaryDirection: "subjectProject", secondaryDirections: ["cultureActivity"], priceBaseKrw: 3_400_000, priceQuality: "official_surcharge", traits: ["환경", "maker", "프로젝트"], strengths: ["환경·만들기 프로젝트와 자연 체험", "부모 웰니스 일정과 병행 가능"], tradeoffs: ["우기와 이동시간, 추가 활동비 확인 필요"] }),
  demoProgram({ id: "demo-bali-school-week", name: "Bali International School Week", city: "Bali", programType: "schooling", category: "schooling", ageMin: 7, ageMax: 14, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["1BR", "2BR", "Hotel"], primaryDirection: "schoolSchooling", secondaryDirections: ["cultureActivity"], priceBaseKrw: 4_000_000, priceQuality: "reference", traits: ["국제학교", "영어", "문화"], strengths: ["국제학교 분위기와 현지 문화", "가족 체류와 학교 루틴의 절충"], tradeoffs: ["정확한 학기·휴일 일정 확인 필요"] }),
  demoProgram({ id: "demo-bali-residential-ocean", name: "Bali Residential Ocean English", city: "Bali", programType: "managed_immersion", category: "english", ageMin: 8, ageMax: 14, durations: [2, 3, 4, 6], seasons: ["summer", "year_round"], ...childOnlyDefaults, primaryDirection: "englishIntensive", secondaryDirections: ["cultureActivity"], priceBaseKrw: 4_200_000, priceQuality: "inquiry", traits: ["영어 몰입", "기숙형", "해양 활동"], strengths: ["영어 몰입과 해양 활동", "아이 독립 생활을 단계적으로 경험"], tradeoffs: ["부모 동반 체류가 필요한 경우 대안으로 보기 어려움"] }),

  demoProgram({ id: "demo-dubai-stem-future-lab", name: "Dubai STEM Future Lab", city: "Dubai", programType: "creative_daycamp", category: "stem", ageMin: 7, ageMax: 14, durations: [2, 3, 4], seasons: ["summer", "year_round"], ...dayDefaults, accommodations: ["Studio", "1BR", "2BR", "Hotel"], primaryDirection: "subjectProject", secondaryDirections: ["englishIntensive"], priceBaseKrw: 6_800_000, priceQuality: "exact", traits: ["STEM", "robotics", "국제성"], strengths: ["국제적인 STEM 프로젝트와 영어 사용", "의료·치안·도시 편의"], tradeoffs: ["높은 숙소비와 더운 기후를 고려해야 함"] }),
  demoProgram({ id: "demo-dubai-school-immersion", name: "Dubai International School Immersion", city: "Dubai", programType: "schooling", category: "schooling", ageMin: 7, ageMax: 14, durations: [2, 3, 4, 6], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["1BR", "2BR", "Hotel"], primaryDirection: "schoolSchooling", secondaryDirections: ["englishIntensive"], priceBaseKrw: 7_200_000, priceQuality: "official_surcharge", traits: ["국제학교", "영어", "다문화"], strengths: ["다국적 학교환경과 높은 영어 노출", "의료·치안과 부모 생활 편의"], tradeoffs: ["학업 강도와 가족 총비용 확인 필요"] }),
  demoProgram({ id: "demo-dubai-sports-explorer", name: "Dubai English Sports Explorer", city: "Dubai", programType: "activity", category: "sports", ageMin: 6, ageMax: 12, durations: [1, 2, 3, 4], seasons: ["summer", "year_round"], ...familyDefaults, accommodations: ["Studio", "1BR", "Hotel"], primaryDirection: "englishIntensive", secondaryDirections: ["cultureActivity"], priceBaseKrw: 5_800_000, priceQuality: "reference", traits: ["스포츠", "영어", "도시 활동"], strengths: ["영어·스포츠·도시 활동을 짧게 경험", "실내 활동 선택 폭"], tradeoffs: ["야외활동과 기후 조건 확인 필요"] }),
  demoProgram({ id: "demo-dubai-young-leaders", name: "Dubai Young Leaders Residential", city: "Dubai", programType: "international_camp", category: "project", ageMin: 10, ageMax: 16, durations: [2, 3, 4, 6, 8], seasons: ["summer", "year_round"], ...childOnlyDefaults, primaryDirection: "englishIntensive", secondaryDirections: ["subjectProject"], priceBaseKrw: 8_200_000, priceQuality: "inquiry", traits: ["기숙형", "리더십", "국제학생"], strengths: ["국제 학생 리더십과 영어 몰입", "2~8주 장기 옵션"], tradeoffs: ["부모 동반형 숙소가 아니며 높은 비용을 확인해야 함"] }),
]
