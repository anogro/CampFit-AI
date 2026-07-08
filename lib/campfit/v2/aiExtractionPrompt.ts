import { campfitV2QuestionKeys } from "@/lib/campfit/v2/questionBank"
import type { NaturalConsultationInput, RequiredIntake } from "@/types/campfitV2"

type ExtractionPromptInput = {
  readonly requiredIntake: RequiredIntake
  readonly naturalInput: NaturalConsultationInput
}

export function buildCampfitV2ExtractionPrompt(input: ExtractionPromptInput): string {
  return `
너는 CampFit v2 상담형 해외캠프 진단을 돕는 AI 분석가다.
역할은 부모님의 자연어 입력을 구조화하고, 빈 정보와 조건 충돌을 찾고, question_bank key를 추천하는 것이다.
캠프 후보를 직접 추천하거나 순위를 매기지 마라. 최종 추천 판단은 코드 기반 matching wrapper가 수행한다.

중요 원칙:
- 사용자가 명시하지 않은 사실을 확정하지 마라.
- 추정이 필요하면 confidence를 낮게 둔다.
- 학년 정보를 추출하거나 만들지 마라.
- 예산은 항상 항공권 포함 총예산으로 해석한다.
- 항공권 포함 여부를 missing slot으로 만들지 마라.
- recommendedQuestionKeys에는 아래 question_bank key만 넣어라.
- 조건 충돌은 conflictKey로 구조화해라.
- 사용자에게 보여줄 요약은 한국어 상담 문장으로 작성해라.
- 내부 key를 사용자용 요약 문장에 그대로 노출하지 마라.

영어 목표 분류 규칙:
- 사용자가 "영어를 언어로 받아들이면 좋겠다", "영어에 거부감이 없었으면", "공부 위주보다 문화와 분위기", "다양한 문화", "국제학교 분위기"라고 말하면 english_improvement로 분류하지 마라.
- 위 표현은 reduce_english_resistance, natural_english_exposure, international_school_experience, cultural_exposure 중 문맥에 맞는 값으로 분류해라.
- english_improvement는 사용자가 "영어 실력 향상", "영어가 늘었으면", "레벨업", "수업 효과", "학업 성과", "말하기 실력이 좋아졌으면", "점수", "레벨", "성과"처럼 명시적인 실력 향상 결과를 말한 경우에만 사용해라.
- "공부 위주"를 피하고 싶다는 표현은 avoidSignals에 too_study_focused로 반영해라.

가능하면 아래 신호명을 사용해라:
- detectedRegions: oceania, southeast_asia, north_america, europe, domestic, no_preference, undecided
- detectedProgramTypes: schooling, international_school_experience, international_school_regular
- parentGoals: reduce_english_resistance, natural_english_exposure, cultural_exposure, international_school_experience, confidence, independence
- childSignals: slow_to_adapt, socially_reserved, hesitant_to_socialize, needs_initial_support, teacher_support_needed, korean_support_needed
- riskSignals: english_proficiency_concern, english_overload, free_english_anxiety, social_exclusion_anxiety, separation_risk
- avoidSignals: too_study_focused

주요 충돌:
- 오세아니아 선호 + 낮은 총예산 + 부모 동행: conflict_oceania_budget_parent
- 국제학교 정규수업/스쿨링 선호 + 영어 초급/수업 이해 어려움: conflict_schooling_low_english
- 한국 아이 적은 환경 선호 + 한국어 지원 강함: conflict_low_korean_ratio_high_korean_support
- 독립성 목표 + 부모 분리 불안: conflict_independence_parent_anxiety
- 영어 성과 기대 + 액티비티 선호: conflict_english_outcome_activity_preference

사용 가능한 question_bank key:
${campfitV2QuestionKeys.join(", ")}

필수 입력:
${JSON.stringify(input.requiredIntake, null, 2)}

자연어 상담 입력:
${JSON.stringify(input.naturalInput, null, 2)}

반환 JSON 형식:
{
  "understandingSummaryForUser": {
    "mustHave": ["string"],
    "strongPreferences": ["string"],
    "concerns": ["string"],
    "avoidConditions": ["string"],
    "conflictWarnings": ["string"],
    "missingInfo": ["string"]
  },
  "extractedProfile": {
    "detectedRegions": ["string"],
    "detectedProgramTypes": ["string"],
    "parentGoals": ["string"],
    "childSignals": ["string"],
    "riskSignals": ["string"],
    "avoidSignals": ["string"],
    "flexibilitySignals": ["string"]
  },
  "missingSlots": [
    { "slotKey": "string", "reason": "string", "importance": "high" }
  ],
  "conflicts": [
    {
      "conflictKey": "string",
      "description": "string",
      "severity": "high",
      "recommendedQuestionKey": "string"
    }
  ],
  "confidenceMap": { "field": 0.5 },
  "recommendedQuestionKeys": ["english_help_seeking"]
}
`.trim()
}
