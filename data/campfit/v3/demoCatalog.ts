import type { ExperienceDirectionKey } from "@/types/campfitV3"
import type { Camp } from "@/types/campfit"

export const CAMPFIT_V3_DEMO_CATALOG_VERSION = "campfit-v3-demo-3"

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
  /** Optional real ANOGRO program slug. Leave null for synthetic demo-only programs. */
  readonly anogroSlug?: string | null
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

const coreDemoCityDefinitions: readonly DemoCityDefinition[] = [
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

type AdditionalCitySeed = {
  readonly id: string
  readonly name: string
  readonly country: string
  readonly costLevel: DemoCityDefinition["profile"]["costLevel"]
  readonly livingEnvironment: DemoCityDefinition["profile"]["livingEnvironment"]
  readonly medicalLevel: DemoCityDefinition["profile"]["medicalLevel"]
  readonly safetyLevel: DemoCityDefinition["profile"]["safetyLevel"]
  readonly englishEnvironment: DemoCityDefinition["profile"]["englishEnvironment"]
  readonly stemStrength: DemoCityDefinition["profile"]["stemStrength"]
  readonly natureStrength: DemoCityDefinition["profile"]["natureStrength"]
  readonly internationality: DemoCityDefinition["profile"]["internationality"]
  readonly flightCostKrw: number
  readonly livingCostMonthlyKrw: number
  readonly housingCostMonthlyKrw: number
  readonly strengths: readonly string[]
}

type AdditionalCitySeedValue = readonly [
  string,
  string,
  AdditionalCitySeed["costLevel"],
  AdditionalCitySeed["livingEnvironment"],
  AdditionalCitySeed["medicalLevel"],
  AdditionalCitySeed["safetyLevel"],
  AdditionalCitySeed["englishEnvironment"],
  AdditionalCitySeed["stemStrength"],
  AdditionalCitySeed["natureStrength"],
  AdditionalCitySeed["internationality"],
  number,
  number,
  number,
  readonly string[],
]

const additionalCitySeedValues: readonly AdditionalCitySeedValue[] = [
  ["Los Angeles", "USA", "high", "urban", "high", "medium", "high", "high", "medium", "high", 1_400_000, 2_100_000, 3_600_000, ["다문화 커뮤니티", "예술·기술 인프라", "해변과 도심 활동"]],
  ["London", "UK", "high", "urban", "high", "high", "high", "medium", "medium", "high", 1_600_000, 2_000_000, 4_100_000, ["박물관·공원·공연", "다문화 생활권", "영어권 교육환경"]],
  ["Barcelona", "Spain", "medium", "balanced", "high", "medium", "medium", "medium", "high", "high", 1_500_000, 1_400_000, 2_200_000, ["예술·해변 활동", "야외 체험", "국제학교 선택지"]],
  ["Lisbon", "Portugal", "medium", "balanced", "high", "high", "medium", "medium", "high", "medium", 1_600_000, 1_300_000, 1_900_000, ["온화한 기후", "여유로운 생활", "대서양 자연환경"]],
  ["Taipei", "Taiwan", "medium", "urban", "high", "high", "medium", "high", "medium", "high", 450_000, 1_300_000, 1_200_000, ["의료·교통 접근성", "안전한 생활환경", "도시와 자연의 근접성"]],
  ["Paris", "France", "high", "urban", "high", "medium", "medium", "medium", "medium", "high", 1_500_000, 1_800_000, 2_500_000, ["예술·문화 체험", "국제적 생활환경", "박물관·공원 접근성"]],
  ["Berlin", "Germany", "medium", "urban", "high", "high", "high", "medium", "medium", "high", 1_500_000, 1_600_000, 2_200_000, ["창작·프로젝트 문화", "대안교육 선택지", "공원과 박물관"]],
  ["Nice", "France", "high", "balanced", "high", "high", "medium", "medium", "high", "medium", 1_600_000, 1_600_000, 1_700_000, ["해변과 온화한 기후", "차분한 생활", "예술·자연 활동"]],
  ["Osaka", "Japan", "medium", "urban", "high", "high", "high", "medium", "medium", "medium", 350_000, 1_200_000, 1_100_000, ["한국과 가까운 생활권", "안정적인 치안", "도시·문화 체험"]],
  ["Seattle", "USA", "high", "balanced", "high", "high", "high", "high", "high", "high", 1_300_000, 2_300_000, 3_300_000, ["기술·STEM 환경", "자연과 도시의 균형", "영어권 생활"]],
  ["Valencia", "Spain", "medium", "balanced", "high", "high", "medium", "medium", "high", "medium", 1_500_000, 1_300_000, 1_600_000, ["해변·공원 활동", "온화한 기후", "차분한 가족 생활"]],
  ["Copenhagen", "Denmark", "high", "balanced", "high", "high", "high", "high", "high", "high", 1_700_000, 2_000_000, 2_600_000, ["안전한 생활환경", "자전거·자연 활동", "아동 친화적 도시"]],
  ["Saipan", "USA", "medium", "quiet", "medium", "high", "medium", "medium", "high", "medium", 800_000, 1_400_000, 1_800_000, ["해양·자연 체험", "작은 생활권", "영어 활동"]],
  ["Guam", "USA", "high", "balanced", "high", "high", "medium", "high", "high", "high", 900_000, 1_700_000, 2_300_000, ["해양·야외 활동", "영어권 환경", "의료·생활 편의"]],
  ["Honolulu", "USA", "high", "balanced", "high", "high", "medium", "high", "high", "high", 900_000, 1_800_000, 2_600_000, ["해양·자연 활동", "다문화 생활권", "영어권 환경"]],
  ["Johor Bahru", "Malaysia", "medium", "balanced", "high", "high", "medium", "high", "medium", "high", 600_000, 1_200_000, 1_300_000, ["국제학교 접근성", "싱가포르 연계", "비용 균형"]],
  ["Cape Town", "South Africa", "medium", "balanced", "medium", "medium", "medium", "high", "high", "high", 1_300_000, 1_100_000, 1_600_000, ["자연·해양 활동", "영어권 환경", "다양한 야외 체험"]],
  ["Amsterdam", "Netherlands", "high", "urban", "high", "high", "high", "high", "medium", "high", 1_700_000, 1_900_000, 2_400_000, ["자전거·박물관 문화", "다문화 환경", "프로젝트형 교육"]],
  ["Vancouver", "Canada", "high", "balanced", "high", "high", "high", "high", "high", "high", 1_300_000, 2_000_000, 2_700_000, ["다문화·영어 환경", "자연·야외 활동", "STEM·교육 인프라"]],
  ["Melbourne", "Australia", "high", "urban", "high", "high", "high", "high", "medium", "high", 1_000_000, 1_900_000, 2_500_000, ["예술·스포츠 활동", "영어권 학교환경", "다문화 생활권"]],
  ["San Diego", "USA", "high", "balanced", "high", "high", "high", "high", "high", "high", 1_300_000, 2_000_000, 3_000_000, ["해변·자연 활동", "영어권 환경", "온화한 기후"]],
  ["Tokyo", "Japan", "high", "urban", "high", "high", "high", "high", "medium", "high", 350_000, 1_500_000, 2_000_000, ["안전·교통 인프라", "문화·기술 체험", "다양한 교육 선택지"]],
  ["Munich", "Germany", "high", "balanced", "high", "high", "high", "high", "high", "high", 1_500_000, 1_800_000, 2_300_000, ["안정적인 생활", "과학·기술 환경", "호수·공원 활동"]],
  ["Brisbane", "Australia", "high", "balanced", "high", "high", "high", "high", "high", "high", 1_000_000, 1_700_000, 2_300_000, ["자연·야외 활동", "영어권 환경", "온화한 기후"]],
  ["Dublin", "Ireland", "high", "urban", "high", "high", "medium", "high", "medium", "high", 1_600_000, 1_800_000, 2_500_000, ["영어권 교육", "친근한 생활환경", "문화·공원 활동"]],
  ["Calgary", "Canada", "high", "balanced", "high", "high", "high", "high", "high", "high", 1_300_000, 1_700_000, 2_200_000, ["자연·스포츠 활동", "안정적인 생활", "영어권 환경"]],
  ["Christchurch", "New Zealand", "medium", "quiet", "high", "high", "high", "high", "high", "high", 1_200_000, 1_500_000, 1_900_000, ["자연·야외 활동", "차분한 가족 생활", "영어권 환경"]],
  ["Sydney", "Australia", "high", "urban", "high", "high", "high", "high", "high", "high", 1_000_000, 2_000_000, 2_900_000, ["해변·문화 활동", "영어권 환경", "교육·의료 접근성"]],
  ["Toronto", "Canada", "high", "urban", "high", "high", "high", "high", "medium", "high", 1_300_000, 1_900_000, 2_600_000, ["다문화 커뮤니티", "영어권 교육", "도시·자연 균형"]],
]

const additionalCitySeeds: readonly AdditionalCitySeed[] = additionalCitySeedValues.map(([name, country, costLevel, livingEnvironment, medicalLevel, safetyLevel, englishEnvironment, stemStrength, natureStrength, internationality, flightCostKrw, livingCostMonthlyKrw, housingCostMonthlyKrw, strengths]) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  country,
  costLevel,
  livingEnvironment,
  medicalLevel,
  safetyLevel,
  englishEnvironment,
  stemStrength,
  natureStrength,
  internationality,
  flightCostKrw,
  livingCostMonthlyKrw,
  housingCostMonthlyKrw,
  strengths,
}))

const additionalDemoCityDefinitions: readonly DemoCityDefinition[] = additionalCitySeeds.map((seed) => ({
  id: `demo-city-${seed.id}`,
  name: seed.name,
  country: seed.country,
  description: `${seed.name}의 생활환경과 가족 체류 조건을 비교하는 데모 도시 프로필입니다.`,
  flightCostKrw: seed.flightCostKrw,
  livingCostMonthlyKrw: seed.livingCostMonthlyKrw,
  housingCostMonthlyKrw: seed.housingCostMonthlyKrw,
  parentStayEvidence: `${seed.name} ${seed.strengths.join(" ")} remote work family stay medical hospital safety international community english environment culture tourism nature park weekend activities`,
  profile: {
    costLevel: seed.costLevel,
    livingEnvironment: seed.livingEnvironment,
    medicalLevel: seed.medicalLevel,
    safetyLevel: seed.safetyLevel,
    englishEnvironment: seed.englishEnvironment,
    stemStrength: seed.stemStrength,
    natureStrength: seed.natureStrength,
    internationality: seed.internationality,
    strengths: seed.strengths,
  },
}))

export const demoCityDefinitions: readonly DemoCityDefinition[] = [...coreDemoCityDefinitions, ...additionalDemoCityDefinitions]

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

const coreDemoProgramDefinitions: readonly DemoProgramDefinition[] = [
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

const additionalDemoProgramDefinitions: readonly DemoProgramDefinition[] = additionalCitySeeds.flatMap((city) => {
  const prefix = city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const variants = [
    { suffix: "family-english", label: "Family English & Culture", programType: "family_esl" as const, category: "english" as const, direction: "englishIntensive" as const, secondary: ["cultureActivity"] as const, defaults: familyDefaults, ageMin: 6, ageMax: 12, price: 3_900_000, traits: ["영어", "가족 체류", "문화"], strengths: ["가족이 함께 머물며 영어와 현지 문화를 경험합니다.", "부모 체류와 아이 프로그램을 함께 조정할 수 있습니다."] },
    { suffix: "stem-lab", label: "STEM & Project Lab", programType: "creative_daycamp" as const, category: "stem" as const, direction: "subjectProject" as const, secondary: ["englishIntensive"] as const, defaults: dayDefaults, ageMin: 7, ageMax: 14, price: 4_600_000, traits: ["STEM", "프로젝트", "탐구"], strengths: ["과학·기술 주제의 프로젝트 결과물을 만들어 봅니다.", "부모 체류 중에도 낮 시간 프로그램으로 운영할 수 있습니다."] },
    { suffix: "school-experience", label: "International School Experience", programType: "schooling" as const, category: "schooling" as const, direction: "schoolSchooling" as const, secondary: ["englishIntensive"] as const, defaults: familyDefaults, ageMin: 8, ageMax: 15, price: 5_200_000, traits: ["학교 경험", "영어", "또래 교류"], strengths: ["현지 학교형 루틴과 또래 교류를 경험합니다.", "도시의 교육환경과 가족 생활을 함께 비교할 수 있습니다."] },
    { suffix: "outdoor-discovery", label: "Outdoor & Culture Discovery", programType: "activity" as const, category: "culture" as const, direction: "cultureActivity" as const, secondary: ["englishIntensive"] as const, defaults: dayDefaults, ageMin: 6, ageMax: 13, price: 3_700_000, traits: ["자연", "문화", "야외 활동"], strengths: ["주중·주말에 도시와 자연을 함께 탐색합니다.", "아이의 활동 선호에 따라 체험 일정을 조정할 수 있습니다."] },
  ]
  return variants.map((variant) => demoProgram({
    id: `demo-${prefix}-${variant.suffix}`,
    name: `${city.name} ${variant.label}`,
    city: city.name,
    programType: variant.programType,
    category: variant.category,
    ageMin: variant.ageMin,
    ageMax: variant.ageMax,
    durations: variant.suffix === "outdoor-discovery" ? [1, 2, 3, 4] : [2, 3, 4, 6],
    seasons: ["summer", "year_round"],
    ...variant.defaults,
    primaryDirection: variant.direction,
    secondaryDirections: variant.secondary,
    priceBaseKrw: variant.price,
    priceQuality: variant.suffix === "school-experience" ? "official_surcharge" : variant.suffix === "stem-lab" ? "reference" : "exact",
    traits: variant.traits,
    strengths: variant.strengths,
    tradeoffs: ["데모 카탈로그 항목으로 실제 일정·가격·운영 여부는 ANOGRO 상세에서 확인이 필요합니다."],
  }))
})

export const demoProgramDefinitions: readonly DemoProgramDefinition[] = [...coreDemoProgramDefinitions, ...additionalDemoProgramDefinitions]
