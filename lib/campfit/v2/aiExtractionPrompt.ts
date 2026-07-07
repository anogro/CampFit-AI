import { campfitV2QuestionKeys } from "@/lib/campfit/v2/questionBank"
import type { NaturalConsultationInput, RequiredIntake } from "@/types/campfitV2"

type ExtractionPromptInput = {
  readonly requiredIntake: RequiredIntake
  readonly naturalInput: NaturalConsultationInput
}

export function buildCampfitV2ExtractionPrompt(input: ExtractionPromptInput): string {
  return `
너는 CampFit v2 상담형 해외캠프 진단을 돕는 AI 분석가다.
너의 역할은 자연어 이해, 누락 정보 탐지, 조건 충돌 탐지, 질문 key 추천이다.
캠프 후보를 직접 추천하거나 순위를 매기지 않는다. 최종 추천 판정은 코드 기반 matching wrapper가 수행한다.

중요 원칙:
- 사용자가 명시하지 않은 사실을 확정하지 마라.
- 애매하면 추정으로 표시하고 confidence를 낮게 줘라.
- 학년 정보를 추출하거나 만들지 마라.
- 예산은 항상 항공권 포함 총예산으로 해석한다.
- 항공권 포함 여부를 missing slot으로 만들지 마라.
- recommendedQuestionKeys에는 아래 question_bank key만 넣어라.
- 조건 충돌은 conflictKey로 구조화한다.
- 사용자에게 보여줄 요약은 한국어로 작성한다.

허용 question_bank key:
${campfitV2QuestionKeys.join(", ")}

대표 충돌:
- 오세아니아 선호 + 낮은 총예산 + 부모 동행: conflict_oceania_budget_parent
- 국제학교 정규수업/스쿨링 선호 + 영어 초급/도움 요청 어려움: conflict_schooling_low_english
- 한국 아이 적게 원함 + 한국어 지원 강함: conflict_low_korean_ratio_high_korean_support
- 독립심 목표 + 부모 분리 불안: conflict_independence_parent_anxiety
- 영어 성과 기대 + 액티비티형 선호: conflict_english_outcome_activity_preference

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
