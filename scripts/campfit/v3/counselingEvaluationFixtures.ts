import type {
  CampfitV3FactKey,
  CampfitV3FactSource,
  CampfitV3FactStatus,
  CampfitV3FactSubject,
} from "@/types/campfitV3"

export type EvaluationMatcherName =
  | "equals"
  | "contains"
  | "containsAll"
  | "doesNotContain"
  | "oneOf"
  | "statusIs"
  | "confidenceAtLeast"
  | "confidenceBelow"
  | "isUnknown"
  | "isAbsent"
  | "questionTargets"
  | "questionDoesNotTarget"

export type EvaluationMatcher = {
  readonly path: string
  readonly matcher: EvaluationMatcherName
  readonly expected?: unknown
}

export type FactSeed = {
  readonly key: CampfitV3FactKey
  readonly subject: CampfitV3FactSubject
  readonly value: unknown
  readonly source?: CampfitV3FactSource
  readonly confidence?: number
  readonly status?: CampfitV3FactStatus
}

export type CounselingEvaluationCase = {
  readonly id: string
  readonly category: string
  readonly utterance: string
  readonly initialFacts?: readonly FactSeed[]
  readonly initialQuestionKey?: string
  readonly expectedFacts: readonly EvaluationMatcher[]
  readonly expectedAbsentFacts?: readonly string[]
  readonly forbiddenInferences: readonly CampfitV3FactKey[]
  readonly expectedQuestionTarget?: string | null
  readonly expectedQuestionNotTargets?: readonly string[]
  readonly notes: string
}

export type CounselingEvaluationTurn = {
  readonly utterance: string
  readonly expectedStateDelta: readonly EvaluationMatcher[]
  readonly forbiddenInferences: readonly CampfitV3FactKey[]
  readonly expectedQuestionTarget?: string | null
}

export type CounselingEvaluationScenario = {
  readonly id: string
  readonly title: string
  readonly turns: readonly CounselingEvaluationTurn[]
  readonly expectedFinalState: readonly EvaluationMatcher[]
  readonly expectedUnansweredFields?: readonly string[]
  readonly expectedNoRepeatTargets?: readonly string[]
}

const fact = (path: string, matcher: EvaluationMatcherName, expected?: unknown): EvaluationMatcher => ({ path, matcher, expected })
const containsAll = (path: string, expected: readonly unknown[]): EvaluationMatcher => fact(path, "containsAll", expected)
const absent = (path: string): EvaluationMatcher => fact(path, "isAbsent")

export const counselingEvaluationCases: readonly CounselingEvaluationCase[] = [
  {
    id: "a-subject-separation",
    category: "child-parent-english-separation",
    utterance: "아이는 영어를 거의 못하는데 저는 생활영어 정도는 돼요.",
    expectedFacts: [
      fact("facts.childEnglishLevel.value", "equals", "beginner"),
      fact("facts.parentEnglishCommunication.value", "equals", "possible"),
    ],
    expectedAbsentFacts: ["facts.koreanSupportNeed"],
    forbiddenInferences: ["koreanSupportNeed"],
    notes: "아이와 부모의 영어 주체를 분리하고 한국어 지원을 추론하지 않음",
  },
  {
    id: "b-multiple-goals",
    category: "multiple-goals",
    utterance: "영어도 조금 늘었으면 좋겠고 친구도 사귀고 과학 활동도 해봤으면 해요.",
    expectedFacts: [
      containsAll("facts.desiredOutcomes.value", ["english_confidence", "peer_connection"]),
      containsAll("facts.socialPreference.value", ["people_and_peer_interaction"]),
      containsAll("facts.preferredActivities.value", ["science"]),
      fact("facts.experienceGoals.value.englishIntensive", "oneOf", ["primary", "secondary"]),
    ],
    forbiddenInferences: ["koreanSupportNeed"],
    notes: "한 발화에서 목표·사회성·활동을 함께 추출",
  },
  {
    id: "c-conditional-destinations",
    category: "multiple-destinations",
    utterance: "싱가포르가 제일 궁금하지만 비용이 너무 높으면 세부나 치앙마이도 괜찮아요.",
    expectedFacts: [
      containsAll("facts.destinationPreference.value", ["Singapore", "Cebu", "Chiang Mai"]),
      fact("facts.preferredRegions.value", "contains", "southeast_asia"),
    ],
    forbiddenInferences: [],
    notes: "조건부 대안을 유실하지 않음; 상대적 우선순위는 별도 평가",
  },
  {
    id: "d-budget-includes-costs",
    category: "budget-scope",
    utterance: "항공이랑 숙소까지 다 합해서 800 정도 생각해요.",
    expectedFacts: [
      fact("updatedBasicInfo.budgetMaxKrw", "equals", 8_000_000),
      fact("facts.budgetIncludesFlight.value", "equals", true),
    ],
    forbiddenInferences: [],
    notes: "항공 포함 예산을 프로그램비만으로 축소하지 않음",
  },
  {
    id: "e-duration-range",
    category: "duration-uncertainty",
    utterance: "짧으면 2주, 아이가 괜찮아하면 3주까지도 가능해요.",
    expectedFacts: [fact("facts.durationWeeks.value", "oneOf", [2, 3])],
    forbiddenInferences: [],
    notes: "2~3주 범위 표현은 단일 확정값으로 과장하지 않아야 함",
  },
  {
    id: "f-budget-correction",
    category: "explicit-correction",
    utterance: "아까 700이라고 했는데 항공권 생각하면 900까지는 봐야 할 것 같아요.",
    initialFacts: [{ key: "budgetRangeKrw", subject: "constraint", value: { min: 5_000_000, max: 7_000_000 }, source: "structured_input" }],
    expectedFacts: [
      fact("facts.budgetRangeKrw.value.max", "equals", 9_000_000),
      fact("facts.budgetRangeKrw.status", "statusIs", "confirmed"),
      fact("facts.budgetRangeKrw.source", "equals", "user_correction"),
    ],
    forbiddenInferences: [],
    notes: "최신 명시 예산이 이전 값을 교체",
  },
  {
    id: "g-negative-english-only",
    category: "negation",
    utterance: "영어만 하루 종일 하는 캠프는 원하지 않아요.",
    expectedFacts: [absent("facts.experienceGoals.value.englishIntensive")],
    forbiddenInferences: [],
    notes: "영어 집중 비선호를 영어 집중 선호로 뒤집지 않음",
  },
  {
    id: "h-social-adaptation",
    category: "child-temperament",
    utterance: "처음에는 낯을 가리지만 익숙해지면 친구들이랑 잘 놀아요.",
    expectedFacts: [
      containsAll("facts.socialPreference.value", ["people_and_peer_interaction"]),
      fact("facts.initialAdaptationSupportNeed.value", "equals", true),
    ],
    forbiddenInferences: [],
    notes: "초기 적응 지원과 이후 또래 선호를 함께 보존",
  },
  {
    id: "i-parent-stay-goals",
    category: "parent-stay-goals",
    utterance: "아이 캠프 시간에는 근처 카페에서 일하거나 좀 쉬고 싶어요.",
    expectedFacts: [containsAll("facts.parentStayGoals.value", ["remoteWork", "cafeDining", "restWellness"])],
    forbiddenInferences: [],
    notes: "부모의 체류 목적을 아이 목표로 바꾸지 않음",
  },
  {
    id: "j-school-routine",
    category: "school-environment",
    utterance: "놀기만 하는 캠프보다는 실제 학교처럼 수업 시간표가 있었으면 해요.",
    expectedFacts: [fact("facts.experienceGoals.value.schoolSchooling", "equals", "primary")],
    forbiddenInferences: [],
    notes: "학교형 환경과 예측 가능한 루틴 선호",
  },
  {
    id: "k-activity-preferences",
    category: "activity-preferences",
    utterance: "로봇 조립이나 코딩은 좋아하는데 운동 위주는 싫어해요.",
    expectedFacts: [containsAll("facts.preferredActivities.value", ["robotics", "coding"])],
    expectedAbsentFacts: ["facts.preferredActivities.value.sports"],
    forbiddenInferences: [],
    notes: "긍정 활동과 운동 위주 비선호를 혼동하지 않음",
  },
  {
    id: "l-culture-nature",
    category: "culture-nature",
    utterance: "영어 성과보다는 그 나라 문화를 보고 자연에서 활동하는 게 더 중요해요.",
    expectedFacts: [fact("facts.experienceGoals.value.cultureActivity", "equals", "primary"), fact("facts.experienceGoals.value.englishIntensive", "equals", "none")],
    forbiddenInferences: [],
    notes: "문화·자연 우선과 영어 성과 낮은 우선순위",
  },
  {
    id: "m-korean-support-optional",
    category: "support-uncertainty",
    utterance: "한국어 가능한 분이 있으면 마음은 놓이겠지만 꼭 있어야 하는 건 아니에요.",
    expectedFacts: [fact("facts.koreanSupportNeed.value", "equals", "preferred")],
    forbiddenInferences: [],
    notes: "한국어 지원 선호를 필수로 과장하지 않음",
  },
  {
    id: "n-special-care-flag",
    category: "special-care-privacy",
    utterance: "기관에 미리 전달해야 할 부분은 하나 있는데 여기서 자세히 쓰지는 않을게요.",
    expectedFacts: [fact("facts.specialCareFollowUp.value", "equals", "required")],
    forbiddenInferences: [],
    notes: "상세 의료정보 대신 상담 전 확인 flag만 저장",
  },
  {
    id: "o-unrelated-background",
    category: "irrelevant-context",
    utterance: "작년에 오키나와 여행은 잘했는데 이번에는 남편이 일 때문에 같이 못 갈 수도 있어요.",
    expectedFacts: [],
    expectedAbsentFacts: ["facts.destinationPreference"],
    forbiddenInferences: ["destinationPreference"],
    notes: "과거 여행지를 현재 희망 지역으로 자동 저장하지 않음",
  },
  {
    id: "p-ambiguous-english",
    category: "ambiguous-language",
    utterance: "영어는 그냥 보통인 것 같아요.",
    expectedFacts: [fact("questionKey", "questionTargets", "child_english_level")],
    expectedQuestionTarget: "child_english_level",
    expectedAbsentFacts: ["facts.childEnglishLevel"],
    forbiddenInferences: [],
    notes: "모호한 수준은 임의 enum으로 확정하지 않고 후속 질문",
  },
  {
    id: "q-answer-deferral",
    category: "answer-deferral",
    utterance: "그건 아직 잘 모르겠어요. 다른 것부터 보고 싶어요.",
    expectedFacts: [fact("questionKey", "questionTargets", "child_english_level")],
    expectedQuestionTarget: "child_english_level",
    expectedAbsentFacts: ["facts.childEnglishLevel", "facts.preferredRegions"],
    forbiddenInferences: ["childEnglishLevel", "preferredRegions"],
    notes: "회피 답변에서 profile을 억지로 채우지 않음",
  },
  {
    id: "r-destination-confirmed",
    category: "confirmation",
    utterance: "지역은 싱가포르로 결정했어요.",
    initialQuestionKey: "preferred_region",
    initialFacts: [{ key: "destinationPreference", subject: "preference", value: ["Singapore"], source: "ai_inference", confidence: 0.4, status: "tentative" }],
    expectedFacts: [
      fact("facts.destinationPreference.value", "contains", "Singapore"),
      fact("facts.destinationPreference.status", "statusIs", "confirmed"),
    ],
    forbiddenInferences: [],
    notes: "tentative 지역을 명시 확정 발화로 승격",
  },
  {
    id: "s-budget-flexibility",
    category: "conditional-budget",
    utterance: "좋은 학교 프로그램이면 예산을 조금 넘겨도 괜찮아요.",
    expectedFacts: [fact("facts.experienceGoals.value.schoolSchooling", "equals", "primary")],
    forbiddenInferences: [],
    notes: "학교 우선 조건을 살리고 예산 제한 자체를 삭제하지 않음",
  },
  {
    id: "t-parent-english-support",
    category: "parent-english-support",
    utterance: "저는 영어가 되니까 한국어 지원은 없어도 괜찮아요.",
    expectedFacts: [
      fact("facts.parentEnglishCommunication.value", "equals", "possible"),
      fact("facts.koreanSupportNeed.value", "equals", "none"),
    ],
    forbiddenInferences: [],
    notes: "부모 영어 가능과 한국어 지원 비필수를 분리",
  },
  {
    id: "u-solo-not-allowed",
    category: "parent-accompanied",
    utterance: "아이 혼자 다른 도시로 보내는 건 절대 안 되고 제가 근처에 있어야 해요.",
    expectedFacts: [],
    expectedAbsentFacts: ["facts.dayProgramSeparationReadiness"],
    forbiddenInferences: [],
    notes: "부모 동반 전제 밖의 solo 추천 신호를 만들지 않음",
  },
  {
    id: "v-school-culture-mix",
    category: "mixed-experience",
    utterance: "오전에는 학교 수업을 하고 오후에는 현지 문화 체험을 하면 좋겠어요.",
    expectedFacts: [
      fact("facts.experienceGoals.value.schoolSchooling", "equals", "primary"),
      fact("facts.experienceGoals.value.cultureActivity", "equals", "primary"),
    ],
    forbiddenInferences: [],
    notes: "학교와 문화 목적을 하나로 축소하지 않음",
  },
  {
    id: "w-english-mixed-language",
    category: "mixed-language",
    utterance: "아이는 beginner고 저는 basic communication은 가능해요.",
    expectedFacts: [
      fact("facts.childEnglishLevel.value", "equals", "beginner"),
      fact("facts.parentEnglishCommunication.value", "equals", "possible"),
    ],
    forbiddenInferences: [],
    notes: "한국어·영어 혼용 발화에서도 주체 분리",
  },
  {
    id: "x-colloquial-typo",
    category: "colloquial-typo",
    utterance: "애가 영어는 거의 첨이고 로봇만들기는 엄청 조아해요.",
    expectedFacts: [
      fact("facts.childEnglishLevel.value", "equals", "beginner"),
      containsAll("facts.preferredActivities.value", ["robotics"]),
    ],
    forbiddenInferences: [],
    notes: "구어체·오타에서 핵심 사실을 최대한 회수",
  },
] as const

export const counselingEvaluationScenarios: readonly CounselingEvaluationScenario[] = [
  {
    id: "scenario-1-culture-first-overseas",
    title: "첫 해외 경험 + 문화형",
    turns: [
      { utterance: "아이는 영어가 거의 처음이고 낯선 곳에서는 적응하는 데 시간이 걸려요.", expectedStateDelta: [fact("facts.childEnglishLevel.value", "equals", "beginner"), fact("facts.initialAdaptationSupportNeed.value", "equals", true)], forbiddenInferences: ["koreanSupportNeed"] },
      { utterance: "문화랑 자연을 좋아하고 치앙마이나 발리가 궁금해요.", expectedStateDelta: [fact("facts.experienceGoals.value.cultureActivity", "equals", "primary"), containsAll("facts.destinationPreference.value", ["Chiang Mai", "Bali"])], forbiddenInferences: [] },
      { utterance: "아이 캠프 동안 저는 근처 카페에서 일하고 쉬고 싶어요.", expectedStateDelta: [containsAll("facts.parentStayGoals.value", ["remoteWork", "cafeDining", "restWellness"])], forbiddenInferences: [] },
      { utterance: "부모가 근처에 있어야 마음이 놓여요.", expectedStateDelta: [], forbiddenInferences: ["childEnglishLevel"] },
    ],
    expectedFinalState: [fact("facts.childEnglishLevel.value", "equals", "beginner"), fact("facts.experienceGoals.value.cultureActivity", "equals", "primary"), containsAll("facts.destinationPreference.value", ["Chiang Mai", "Bali"]), containsAll("facts.parentStayGoals.value", ["remoteWork", "cafeDining", "restWellness"])],
    expectedNoRepeatTargets: ["child_english_level"],
  },
  {
    id: "scenario-2-schooling",
    title: "학교·스쿨링형",
    turns: [
      { utterance: "실제 학교처럼 시간표가 있는 경험을 원해요.", expectedStateDelta: [fact("facts.experienceGoals.value.schoolSchooling", "equals", "primary")], forbiddenInferences: [] },
      { utterance: "영어권 환경이면 좋고 오클랜드나 싱가포르를 비교하고 싶어요.", expectedStateDelta: [containsAll("facts.destinationPreference.value", ["Auckland", "Singapore"])], forbiddenInferences: [] },
      { utterance: "2주 생각하고 예산은 1200만원까지 가능해요.", expectedStateDelta: [fact("facts.durationWeeks.value", "equals", 2), fact("updatedBasicInfo.budgetMaxKrw", "equals", 12_000_000)], forbiddenInferences: [] },
      { utterance: "좋은 학교 프로그램이면 예산을 조금 넘겨도 괜찮아요.", expectedStateDelta: [fact("facts.experienceGoals.value.schoolSchooling", "equals", "primary")], forbiddenInferences: [] },
    ],
    expectedFinalState: [fact("facts.experienceGoals.value.schoolSchooling", "equals", "primary"), containsAll("facts.destinationPreference.value", ["Auckland", "Singapore"]), fact("facts.durationWeeks.value", "equals", 2)],
    expectedNoRepeatTargets: ["primary_experience_goal"],
  },
  {
    id: "scenario-3-stem",
    title: "STEM형",
    turns: [
      { utterance: "아이는 영어가 초급이고 저는 영어로 소통 가능해요.", expectedStateDelta: [fact("facts.childEnglishLevel.value", "equals", "beginner"), fact("facts.parentEnglishCommunication.value", "equals", "possible")], forbiddenInferences: ["koreanSupportNeed"] },
      { utterance: "로봇 만들기와 코딩, 과학 실험을 좋아해요.", expectedStateDelta: [containsAll("facts.preferredActivities.value", ["robotics", "coding", "science"])], forbiddenInferences: [] },
      { utterance: "싱가포르나 오클랜드를 둘 다 보고 싶어요.", expectedStateDelta: [containsAll("facts.destinationPreference.value", ["Singapore", "Auckland"])], forbiddenInferences: [] },
      { utterance: "프로젝트 결과물이 남으면 좋겠어요.", expectedStateDelta: [], forbiddenInferences: [] },
    ],
    expectedFinalState: [fact("facts.childEnglishLevel.value", "equals", "beginner"), fact("facts.parentEnglishCommunication.value", "equals", "possible"), containsAll("facts.preferredActivities.value", ["robotics", "coding", "science"]), containsAll("facts.destinationPreference.value", ["Singapore", "Auckland"])],
    expectedNoRepeatTargets: ["child_english_level"],
  },
  {
    id: "scenario-4-corrections",
    title: "여러 번 정정",
    turns: [
      { utterance: "예산은 700만원 정도예요. 싱가포르도 생각해요.", expectedStateDelta: [fact("facts.budgetRangeKrw.value.max", "equals", 7_000_000), fact("facts.destinationPreference.value", "contains", "Singapore")], forbiddenInferences: [] },
      { utterance: "아까 예산 700이라고 했는데 900까지는 가능해요.", expectedStateDelta: [fact("facts.budgetRangeKrw.value.max", "equals", 9_000_000), fact("facts.budgetRangeKrw.status", "statusIs", "confirmed")], forbiddenInferences: [] },
      { utterance: "항공 포함 900만원으로 정리할게요.", expectedStateDelta: [fact("facts.budgetIncludesFlight.value", "equals", true)], forbiddenInferences: [] },
      { utterance: "싱가포르로 확정했어요.", expectedStateDelta: [fact("facts.destinationPreference.status", "statusIs", "confirmed")], forbiddenInferences: [] },
    ],
    expectedFinalState: [fact("facts.budgetRangeKrw.value.max", "equals", 9_000_000), fact("facts.budgetIncludesFlight.value", "equals", true), fact("facts.destinationPreference.status", "statusIs", "confirmed")],
    expectedNoRepeatTargets: ["preferred_region"],
  },
  {
    id: "scenario-5-uncertain-parent",
    title: "불확실한 부모",
    turns: [
      { utterance: "영어는 그냥 보통인 것 같아요.", expectedStateDelta: [absent("facts.childEnglishLevel")], forbiddenInferences: ["childEnglishLevel"] },
      { utterance: "지역은 아직 잘 모르겠어요.", expectedStateDelta: [absent("facts.destinationPreference")], forbiddenInferences: ["destinationPreference"] },
      { utterance: "예산도 아직 미정이에요.", expectedStateDelta: [], forbiddenInferences: [] },
      { utterance: "다른 것부터 보고 싶어요.", expectedStateDelta: [], forbiddenInferences: [] },
    ],
    expectedFinalState: [absent("facts.childEnglishLevel"), absent("facts.destinationPreference")],
    expectedUnansweredFields: ["childEnglishLevel", "preferredRegions"],
  },
  {
    id: "scenario-6-special-care",
    title: "특별관리 포함",
    turns: [
      { utterance: "아이 영어는 초급이고 뉴질랜드가 궁금해요.", expectedStateDelta: [fact("facts.childEnglishLevel.value", "equals", "beginner"), fact("facts.destinationPreference.value", "contains", "New Zealand")], forbiddenInferences: [] },
      { utterance: "기관에 미리 전달해야 할 부분은 하나 있는데 여기서는 자세히 쓰지 않을게요.", expectedStateDelta: [fact("facts.specialCareFollowUp.value", "equals", "required")], forbiddenInferences: ["worries"] },
      { utterance: "부모는 근처에 머물 예정이에요.", expectedStateDelta: [], forbiddenInferences: [] },
      { utterance: "프로그램 전에 기관과 지원 가능 여부를 확인할게요.", expectedStateDelta: [fact("facts.specialCareFollowUp.value", "equals", "required")], forbiddenInferences: [] },
    ],
    expectedFinalState: [fact("facts.specialCareFollowUp.value", "equals", "required"), fact("facts.childEnglishLevel.value", "equals", "beginner")],
    expectedNoRepeatTargets: ["child_english_level"],
  },
]
