import type { CampfitV3ConversationState, CampfitV3QuickReply } from "@/types/campfitV3"
import { questionReplies } from "@/lib/campfit/v3/stateEngine"

export type CampfitV3Question = {
  readonly key: string
  readonly title: string
  readonly helper: string
  readonly quickReplies: readonly CampfitV3QuickReply[]
  readonly completedBy: readonly string[]
  readonly priority: number
  readonly shouldAsk?: (state: CampfitV3ConversationState) => boolean
}

export const campfitV3QuestionBank: readonly CampfitV3Question[] = [
  {
    key: "child_english_level",
    title: "아이의 현재 영어 사용 수준은 어느 정도인가요?",
    helper: "부모님의 영어 능력과는 분리해서 아이 기준으로 알려주세요.",
    quickReplies: questionReplies([["beginner", "영어가 거의 낯설어요"], ["basic", "단어·짧은 표현 정도예요"], ["intermediate", "간단한 일상 대화가 가능해요"], ["advanced", "영어 수업도 참여할 수 있어요"]]),
    completedBy: ["childEnglishLevel"],
    priority: 100,
  },
  {
    key: "special_care_follow_up",
    title: "프로그램을 선택하기 전에 별도로 확인해야 할 건강·식사·복약 관련 사항이 있나요?",
    helper: "질환명이나 약 이름 등 상세정보는 입력하지 마세요. 자세한 내용은 프로그램 상담 시 별도로 확인합니다.",
    quickReplies: questionReplies([["none", "없어요"], ["required", "있어요. 상담할 때 별도로 확인할게요"], ["unknown", "아직 잘 모르겠어요"]]),
    completedBy: ["specialCareFollowUp"],
    priority: 95,
  },
  {
    key: "korean_support_need",
    title: "현지에서 한국어 지원은 어느 정도 필요할까요?",
    helper: "상시 지원과 비상 상황 지원을 구분해 주세요.",
    quickReplies: questionReplies([["must_daily", "매일 한국어 지원이 꼭 필요해요"], ["emergency_only", "비상 상황에서만 필요해요"], ["preferred", "있으면 더 안심돼요"], ["none", "중요하지 않아요"]]),
    completedBy: ["koreanSupportNeed"],
    priority: 90,
  },
  {
    key: "parent_communication_need",
    title: "프로그램에서 부모님께 어느 정도로 소식을 전해주면 좋을까요?",
    helper: "필요한 연락 빈도를 기준으로 골라주세요.",
    quickReplies: questionReplies([["daily", "매일 간단히 공유받고 싶어요"], ["issue_only", "문제가 있을 때 바로 연락받고 싶어요"], ["occasional", "가끔 소식을 받으면 충분해요"], ["not_important", "중요하지 않아요"]]),
    completedBy: ["parentCommunicationNeed"],
    priority: 88,
  },
  {
    key: "primary_experience_goal",
    title: "이번 경험에서 가장 중요하게 기대하는 것은 무엇인가요?",
    helper: "다른 목표가 함께 있다면 자유 입력으로 덧붙여도 좋아요.",
    quickReplies: questionReplies([["schoolSchooling", "국제학교·스쿨링 경험"], ["englishIntensive", "영어 자신감과 집중 노출"], ["subjectProject", "STEM·예술·프로젝트"], ["cultureActivity", "문화·활동과 즐거운 경험"]]),
    completedBy: ["experienceGoals"],
    priority: 80,
  },
  {
    key: "preferred_region",
    title: "우선 살펴보고 싶은 지역이 있나요?",
    helper: "지역을 정하지 않았다면 상관없음을 선택해도 됩니다.",
    quickReplies: questionReplies([["southeast_asia", "동남아시아"], ["oceania", "오세아니아"], ["north_america", "북미"], ["europe", "유럽"], ["no_preference", "지역은 상관없어요"]]),
    completedBy: ["preferredRegions"],
    priority: 75,
  },
  {
    key: "region_importance",
    title: "희망 지역은 어느 정도로 중요한 조건인가요?",
    helper: "지역을 고정하면 프로그램 후보가 크게 줄어들 수 있어요.",
    quickReplies: questionReplies([["must", "이 지역만 가능해요"], ["strong", "이 지역을 우선하고 싶어요"], ["soft", "가능하면 좋지만 다른 곳도 괜찮아요"]]),
    completedBy: ["regionImportance"],
    priority: 74,
    shouldAsk: (state) => Array.isArray(state.facts.preferredRegions?.value) && state.facts.preferredRegions.value.length > 0,
  },
  {
    key: "parent_stay_goal",
    title: "아이 프로그램 시간에는 부모님이 어떻게 지내고 싶으세요?",
    helper: "도시를 비교할 때 부모님의 체류 목적도 함께 봅니다.",
    quickReplies: questionReplies([["restWellness", "휴식·웰니스"], ["cafeDining", "카페·식당과 현지 생활"], ["tourismCulture", "관광·문화"], ["natureBeach", "자연·해변"], ["remoteWork", "원격근무"], ["childScheduleFirst", "아이 일정이 가장 중요해요"]]),
    completedBy: ["parentStayGoals"],
    priority: 60,
  },
  {
    key: "first_overseas_experience",
    title: "이번이 아이의 첫 해외 교육 경험인가요?",
    helper: "첫 경험 여부는 초기 적응 지원을 판단할 때만 사용합니다.",
    quickReplies: questionReplies([["first", "네, 첫 경험이에요"], ["experienced", "아니요, 비슷한 경험이 있어요"]]),
    completedBy: ["isFirstOverseasEducationExperience"],
    priority: 50,
  },
  {
    key: "day_program_separation",
    title: "초반 안내가 있다면 아이가 낮 프로그램에 참여할 수 있을까요?",
    helper: "부모님은 같은 도시나 인근에 머무는 것을 전제로 합니다.",
    quickReplies: questionReplies([["needs_close_support", "처음에는 가까운 도움이 많이 필요해요"], ["with_initial_support", "초반 안내가 있으면 가능해요"], ["ready", "새로운 일정에도 잘 참여해요"]]),
    completedBy: ["dayProgramSeparationReadiness"],
    priority: 45,
    shouldAsk: (state) => state.facts.isFirstOverseasEducationExperience?.value === true,
  },
]

export function selectNextQuestion(state: CampfitV3ConversationState): CampfitV3Question | null {
  if (state.questionCount >= 10) return null
  const asked = new Set(state.askedQuestionKeys)
  return [...campfitV3QuestionBank]
    .sort((left, right) => right.priority - left.priority)
    .find((question) => {
      if (asked.has(question.key)) return false
      if (question.shouldAsk && !question.shouldAsk(state)) return false
      return question.completedBy.some((key) => state.facts[key as keyof typeof state.facts] === undefined)
    }) ?? null
}

export function getQuestion(key: string | null): CampfitV3Question | null {
  return key === null ? null : campfitV3QuestionBank.find((question) => question.key === key) ?? null
}

export function allowedQuestionKeys(state: CampfitV3ConversationState): readonly string[] {
  const asked = new Set(state.askedQuestionKeys)
  return campfitV3QuestionBank.filter((question) => !asked.has(question.key)).map((question) => question.key)
}
