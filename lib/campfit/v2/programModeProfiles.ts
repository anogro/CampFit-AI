import type { ProgramModeFitProfile } from "@/types/campfitV2"

type ModeScores = Pick<
  ProgramModeFitProfile,
  | "englishExposure"
  | "academicIntensity"
  | "parentSeparationLoad"
  | "independenceRequired"
  | "socialIntensity"
  | "routineStability"
  | "activityLoad"
  | "beginnerFriendly"
  | "parentAccompanimentFit"
  | "koreanSupportCompatibility"
  | "smallGroupFit"
  | "emotionalSafetyFit"
  | "dailyLifeSupportNeed"
  | "dailyLifeSupportCoverage"
  | "englishConfidenceFit"
  | "englishImprovementFit"
  | "internationalSchoolExposureFit"
  | "culturalExposureFit"
  | "confidenceGrowthFit"
  | "independenceGrowthFit"
  | "academicGrowthFit"
  | "activityExperienceFit"
  | "studyAbroadTrialFit"
  | "safeCareFit"
  | "budgetPressure"
  | "durationFlexibility"
  | "parentStayPracticality"
>

type ModeDefinition = Omit<ProgramModeFitProfile, keyof ModeScores> & ModeScores

export const programModeProfiles: readonly ProgramModeFitProfile[] = [
  mode({
    modeKey: "international_school_regular", title: "국제학교 정규수업 체험", shortTitle: "국제학교 정규수업", description: "현지 또는 국제학교의 실제 수업과 학급 생활을 경험하는 방식입니다.",
    englishExposure: 5, academicIntensity: 5, parentSeparationLoad: 3, independenceRequired: 4, socialIntensity: 4, routineStability: 4, activityLoad: 2,
    beginnerFriendly: 2, parentAccompanimentFit: 3, koreanSupportCompatibility: 2, smallGroupFit: 2, emotionalSafetyFit: 2, dailyLifeSupportNeed: 3, dailyLifeSupportCoverage: 2,
    englishConfidenceFit: 3, englishImprovementFit: 5, internationalSchoolExposureFit: 5, culturalExposureFit: 4, confidenceGrowthFit: 3, independenceGrowthFit: 4, academicGrowthFit: 5, activityExperienceFit: 2, studyAbroadTrialFit: 5, safeCareFit: 2, budgetPressure: 5, durationFlexibility: 2, parentStayPracticality: 3,
    bestFor: ["국제학교 수업 분위기를 직접 경험하고 싶은 경우", "학업 영어와 유학 전 적응을 함께 확인하고 싶은 경우"], watchOut: ["영어 초급이라면 수업 참여 부담이 커질 수 있습니다."], verifyBeforeConsulting: ["ESL 보조와 실제 정규 학급 참여 범위", "평가·숙제 부담과 학기 일정"], imageKey: "international-school-regular", imageAlt: "국제학교 교실에서 수업에 참여하는 학생들", imageTheme: "classroom", imagePath: null,
  }),
  mode({
    modeKey: "international_school_camp", title: "국제학교 방학캠프", shortTitle: "국제학교 방학캠프", description: "국제학교 캠퍼스와 다국적 활동을 정규수업보다 낮은 부담으로 경험하는 방식입니다.",
    englishExposure: 4, academicIntensity: 3, parentSeparationLoad: 3, independenceRequired: 3, socialIntensity: 4, routineStability: 4, activityLoad: 4,
    beginnerFriendly: 3, parentAccompanimentFit: 3, koreanSupportCompatibility: 2, smallGroupFit: 3, emotionalSafetyFit: 3, dailyLifeSupportNeed: 3, dailyLifeSupportCoverage: 3,
    englishConfidenceFit: 4, englishImprovementFit: 3, internationalSchoolExposureFit: 5, culturalExposureFit: 5, confidenceGrowthFit: 4, independenceGrowthFit: 3, academicGrowthFit: 3, activityExperienceFit: 4, studyAbroadTrialFit: 4, safeCareFit: 3, budgetPressure: 4, durationFlexibility: 4, parentStayPracticality: 4,
    bestFor: ["국제학교 분위기와 문화 경험을 함께 보고 싶은 경우", "정규수업보다 낮은 부담으로 첫 해외 캠프를 시작하고 싶은 경우"], watchOut: ["실제 정규 스쿨링 경험과는 운영 방식이 다를 수 있습니다."], verifyBeforeConsulting: ["현지·다국적 학생 구성", "초급 지원과 캠퍼스 실제 사용 여부"], imageKey: "international-school-camp", imageAlt: "국제학교 캠퍼스에서 활동하는 다국적 학생들", imageTheme: "campus", imagePath: null,
  }),
  mode({
    modeKey: "family_esl", title: "가족동반 ESL", shortTitle: "가족동반 ESL", description: "부모가 가까이 머물며 아이의 영어 수업과 활동 적응을 지원하는 방식입니다.",
    englishExposure: 3, academicIntensity: 2, parentSeparationLoad: 1, independenceRequired: 1, socialIntensity: 3, routineStability: 4, activityLoad: 3,
    beginnerFriendly: 5, parentAccompanimentFit: 5, koreanSupportCompatibility: 4, smallGroupFit: 4, emotionalSafetyFit: 5, dailyLifeSupportNeed: 1, dailyLifeSupportCoverage: 5,
    englishConfidenceFit: 5, englishImprovementFit: 3, internationalSchoolExposureFit: 2, culturalExposureFit: 4, confidenceGrowthFit: 4, independenceGrowthFit: 2, academicGrowthFit: 2, activityExperienceFit: 3, studyAbroadTrialFit: 2, safeCareFit: 5, budgetPressure: 4, durationFlexibility: 4, parentStayPracticality: 5,
    bestFor: ["첫 해외 경험의 적응 부담을 낮추고 싶은 경우", "영어 거부감을 줄이며 가족 체류를 함께 계획하는 경우"], watchOut: ["정규학교 몰입이나 독립심 훈련은 상대적으로 약할 수 있습니다."], verifyBeforeConsulting: ["부모 체류와 숙소의 실제 운영 방식", "아이 단독 활동 시간과 전체 체류 비용"], imageKey: "family-esl", imageAlt: "부모와 아이가 영어 활동에 참여하는 모습", imageTheme: "family", imagePath: null,
  }),
  mode({
    modeKey: "language_school_esl", title: "어학원 ESL", shortTitle: "어학원 ESL", description: "수준별 소그룹 영어 수업을 중심으로 듣기와 말하기 기반을 만드는 방식입니다.",
    englishExposure: 4, academicIntensity: 3, parentSeparationLoad: 2, independenceRequired: 2, socialIntensity: 3, routineStability: 5, activityLoad: 1,
    beginnerFriendly: 4, parentAccompanimentFit: 4, koreanSupportCompatibility: 3, smallGroupFit: 4, emotionalSafetyFit: 3, dailyLifeSupportNeed: 2, dailyLifeSupportCoverage: 3,
    englishConfidenceFit: 4, englishImprovementFit: 5, internationalSchoolExposureFit: 1, culturalExposureFit: 2, confidenceGrowthFit: 3, independenceGrowthFit: 2, academicGrowthFit: 3, activityExperienceFit: 1, studyAbroadTrialFit: 3, safeCareFit: 3, budgetPressure: 3, durationFlexibility: 5, parentStayPracticality: 5,
    bestFor: ["영어 실력 향상과 말하기 자신감을 우선하는 경우", "기간과 수업 강도를 비교해서 고르고 싶은 경우"], watchOut: ["현지 또래·문화 경험은 별도 활동이 필요할 수 있습니다."], verifyBeforeConsulting: ["반 배정과 수업 시간", "한국 학생 비율과 액티비티 결합 여부"], imageKey: "language-school-esl", imageAlt: "소그룹 영어 수업에서 대화하는 학생들", imageTheme: "language-class", imagePath: null,
  }),
  mode({
    modeKey: "managed_immersion", title: "관리형 영어몰입", shortTitle: "관리형 영어몰입", description: "인솔과 생활관리, 한국어 소통 장치를 두고 영어 수업과 활동을 운영하는 방식입니다.",
    englishExposure: 4, academicIntensity: 3, parentSeparationLoad: 4, independenceRequired: 3, socialIntensity: 4, routineStability: 5, activityLoad: 3,
    beginnerFriendly: 4, parentAccompanimentFit: 2, koreanSupportCompatibility: 5, smallGroupFit: 4, emotionalSafetyFit: 4, dailyLifeSupportNeed: 4, dailyLifeSupportCoverage: 5,
    englishConfidenceFit: 3, englishImprovementFit: 4, internationalSchoolExposureFit: 2, culturalExposureFit: 3, confidenceGrowthFit: 3, independenceGrowthFit: 3, academicGrowthFit: 3, activityExperienceFit: 3, studyAbroadTrialFit: 2, safeCareFit: 5, budgetPressure: 3, durationFlexibility: 3, parentStayPracticality: 2,
    bestFor: ["첫 단독 캠프에서 관리와 소통 장치를 우선하는 경우", "한국어 지원 범위를 분명히 확인하고 싶은 경우"], watchOut: ["현지 문화 몰입과 부모 동행 조건은 제한적일 수 있습니다."], verifyBeforeConsulting: ["관리자 상주와 야간 관리 범위", "영어 사용 규칙과 한국인 비율"], imageKey: "managed-immersion", imageAlt: "인솔자가 함께하는 소그룹 영어 활동", imageTheme: "managed-group", imagePath: null,
  }),
  mode({
    modeKey: "activity_sports", title: "액티비티/스포츠 캠프", shortTitle: "액티비티 캠프", description: "스포츠와 야외 활동 속에서 자연스럽게 영어를 사용하고 자신감을 쌓는 방식입니다.",
    englishExposure: 3, academicIntensity: 1, parentSeparationLoad: 3, independenceRequired: 3, socialIntensity: 4, routineStability: 3, activityLoad: 5,
    beginnerFriendly: 5, parentAccompanimentFit: 3, koreanSupportCompatibility: 3, smallGroupFit: 3, emotionalSafetyFit: 4, dailyLifeSupportNeed: 2, dailyLifeSupportCoverage: 3,
    englishConfidenceFit: 5, englishImprovementFit: 2, internationalSchoolExposureFit: 1, culturalExposureFit: 4, confidenceGrowthFit: 5, independenceGrowthFit: 3, academicGrowthFit: 1, activityExperienceFit: 5, studyAbroadTrialFit: 2, safeCareFit: 3, budgetPressure: 3, durationFlexibility: 5, parentStayPracticality: 4,
    bestFor: ["활동을 통해 영어 부담을 낮추고 싶은 경우", "자신감과 또래 교류 경험을 우선하는 경우"], watchOut: ["눈에 보이는 영어 실력 향상은 제한적일 수 있습니다."], verifyBeforeConsulting: ["종목 난이도와 안전 인력", "영어 사용량과 우천 대체 일정"], imageKey: "activity-sports", imageAlt: "야외 팀 활동에 참여하는 학생들", imageTheme: "outdoor", imagePath: null,
  }),
  mode({
    modeKey: "steam_project", title: "STEAM/프로젝트 캠프", shortTitle: "STEAM/프로젝트", description: "실험과 메이커, 협업 프로젝트를 영어 또는 다국적 환경에서 수행하는 방식입니다.",
    englishExposure: 3, academicIntensity: 4, parentSeparationLoad: 3, independenceRequired: 3, socialIntensity: 3, routineStability: 4, activityLoad: 2,
    beginnerFriendly: 3, parentAccompanimentFit: 3, koreanSupportCompatibility: 2, smallGroupFit: 4, emotionalSafetyFit: 3, dailyLifeSupportNeed: 2, dailyLifeSupportCoverage: 3,
    englishConfidenceFit: 3, englishImprovementFit: 3, internationalSchoolExposureFit: 2, culturalExposureFit: 3, confidenceGrowthFit: 3, independenceGrowthFit: 3, academicGrowthFit: 5, activityExperienceFit: 3, studyAbroadTrialFit: 3, safeCareFit: 3, budgetPressure: 4, durationFlexibility: 4, parentStayPracticality: 3,
    bestFor: ["호기심과 프로젝트 경험을 학업 자극으로 연결하고 싶은 경우", "만들기와 협업 활동을 좋아하는 경우"], watchOut: ["영어와 프로젝트 난이도가 함께 높아질 수 있습니다."], verifyBeforeConsulting: ["프로젝트 수준과 언어 지원", "팀 구성과 강사 전문성"], imageKey: "steam-project", imageAlt: "학생들이 함께 만드는 프로젝트 활동", imageTheme: "maker", imagePath: null,
  }),
  mode({
    modeKey: "homestay_schooling", title: "홈스테이+학교체험", shortTitle: "홈스테이+학교체험", description: "현지 가정에 머물며 학교와 일상생활을 함께 경험하는 고몰입 방식입니다.",
    englishExposure: 5, academicIntensity: 4, parentSeparationLoad: 5, independenceRequired: 5, socialIntensity: 5, routineStability: 3, activityLoad: 3,
    beginnerFriendly: 2, parentAccompanimentFit: 1, koreanSupportCompatibility: 1, smallGroupFit: 2, emotionalSafetyFit: 2, dailyLifeSupportNeed: 4, dailyLifeSupportCoverage: 2,
    englishConfidenceFit: 4, englishImprovementFit: 5, internationalSchoolExposureFit: 5, culturalExposureFit: 5, confidenceGrowthFit: 4, independenceGrowthFit: 5, academicGrowthFit: 4, activityExperienceFit: 3, studyAbroadTrialFit: 5, safeCareFit: 2, budgetPressure: 4, durationFlexibility: 2, parentStayPracticality: 1,
    bestFor: ["장기 유학 전 실제 생활을 깊게 경험하고 싶은 경우", "영어와 문화, 독립심을 함께 시험해보고 싶은 경우"], watchOut: ["분리·음식·생활 습관 적응 부담이 큽니다."], verifyBeforeConsulting: ["가정 검증과 통학 방식", "식사·비상 연락·변경 정책"], imageKey: "homestay-schooling", imageAlt: "현지 가정과 등교 준비를 하는 학생", imageTheme: "homestay", imagePath: null,
  }),
  mode({
    modeKey: "residential_international_camp", title: "기숙형 국제캠프", shortTitle: "기숙형 국제캠프", description: "부모와 떨어져 기숙 생활과 다국적 그룹 활동을 함께 경험하는 방식입니다.",
    englishExposure: 5, academicIntensity: 3, parentSeparationLoad: 5, independenceRequired: 5, socialIntensity: 5, routineStability: 4, activityLoad: 4,
    beginnerFriendly: 2, parentAccompanimentFit: 1, koreanSupportCompatibility: 2, smallGroupFit: 3, emotionalSafetyFit: 2, dailyLifeSupportNeed: 4, dailyLifeSupportCoverage: 4,
    englishConfidenceFit: 4, englishImprovementFit: 4, internationalSchoolExposureFit: 3, culturalExposureFit: 5, confidenceGrowthFit: 4, independenceGrowthFit: 5, academicGrowthFit: 3, activityExperienceFit: 4, studyAbroadTrialFit: 4, safeCareFit: 4, budgetPressure: 4, durationFlexibility: 2, parentStayPracticality: 1,
    bestFor: ["독립심과 다국적 또래 경험을 우선하는 경우", "단체생활과 새로운 도전을 즐기는 경우"], watchOut: ["낮은 분리 적응이나 생활 독립성은 큰 부담이 될 수 있습니다."], verifyBeforeConsulting: ["야간 관리와 사감 비율", "룸메이트 구성과 의료·비상 체계"], imageKey: "residential-international-camp", imageAlt: "국제캠프 공동 활동에 참여하는 학생들", imageTheme: "residential", imagePath: null,
  }),
  mode({
    modeKey: "culture_activity", title: "문화·액티비티 결합형", shortTitle: "문화·액티비티", description: "도시 탐방과 문화체험, 가벼운 영어 활동을 결합한 낮은 진입 부담의 방식입니다.",
    englishExposure: 2, academicIntensity: 1, parentSeparationLoad: 2, independenceRequired: 2, socialIntensity: 3, routineStability: 3, activityLoad: 4,
    beginnerFriendly: 5, parentAccompanimentFit: 5, koreanSupportCompatibility: 4, smallGroupFit: 4, emotionalSafetyFit: 5, dailyLifeSupportNeed: 1, dailyLifeSupportCoverage: 4,
    englishConfidenceFit: 5, englishImprovementFit: 1, internationalSchoolExposureFit: 1, culturalExposureFit: 5, confidenceGrowthFit: 5, independenceGrowthFit: 2, academicGrowthFit: 1, activityExperienceFit: 5, studyAbroadTrialFit: 2, safeCareFit: 4, budgetPressure: 3, durationFlexibility: 5, parentStayPracticality: 5,
    bestFor: ["첫 해외 경험에서 문화 노출과 자신감을 먼저 만들고 싶은 경우", "학업보다 체험과 활동을 선호하는 경우"], watchOut: ["영어 수업량과 학업 성과는 낮을 수 있습니다."], verifyBeforeConsulting: ["영어 사용 시간과 교육 활동 비율", "이동 피로와 인솔 체계"], imageKey: "culture-activity", imageAlt: "도시 문화체험에 참여하는 소그룹 학생들", imageTheme: "city-experience", imagePath: null,
  }),
]

function mode(definition: ModeDefinition): ProgramModeFitProfile {
  return definition
}
