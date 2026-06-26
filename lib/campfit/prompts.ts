import type { CampRecommendation, CampfitInput, ParentAnalysis } from "@/types/campfit"

export function buildAnalyzeParentInputPrompt(input: CampfitInput): string {
  return `
너는 해외 영어캠프 상담을 돕는 AI 분석가다.
학부모의 정형 입력과 자유서술을 분석하여 부모 목표, 아이 성향, 필요한 완충장치,
모순/불확실성, 근거 문장, 꼬리질문을 JSON으로만 반환한다.

중요 원칙:
- 정식 심리진단처럼 표현하지 않는다.
- 아이를 부정적으로 평가하지 않는다.
- 영어 초급 또는 낯가림이 있다는 이유만으로 영어몰입형을 배제하지 않는다.
- 부모의 성장 목표와 캠프 완충장치 가능성을 함께 고려한다.
- 동남아, 호주/뉴질랜드, 북미는 단순 가격 차이가 아니라 비행거리, 관리 밀도,
  영어 노출 강도, 아이의 독립 생활 부담이 다르다는 점을 반영한다.
- destinationPreference와 travelReadiness를 지역 추천 해석에 반드시 사용한다.
- followUpQuestions는 추천 정확도를 높이는 질문 1~2개만 생성한다.
- followUpQuestions는 학부모가 바로 답할 수 있는 자연스러운 한국어로 쓴다.
- "허용", "독립 경험", "부모 동반보다" 같은 딱딱하거나 비교가 어색한 표현은 쓰지 않는다.
- 좋은 질문 예: "부모님이 함께하지 않는 시간은 하루에 어느 정도까지 괜찮을까요?"
- 좋은 질문 예: "아이 혼자 참여하는 일정에서 어느 정도의 관리가 필요할까요?"
- 모든 숫자는 0~1 사이로 반환한다.
- 지원 키는 beginner_class, korean_manager, korean_dorm_option, parent_accompanied,
  buddy_system, early_adaptation_support, daily_parent_report,
  low_pressure_speaking_environment, small_group_care 중에서 고른다.

정형 입력:
${JSON.stringify(input, null, 2)}

반환 JSON 형식:
{
  "parentType": "string",
  "parentGoal": {
    "englishGrowth": 0.0,
    "confidenceGrowth": 0.0,
    "independenceGrowth": 0.0,
    "socialGrowth": 0.0,
    "safetyPriority": 0.0,
    "academicResultPriority": 0.0,
    "experiencePriority": 0.0
  },
  "childProfile": {
    "englishReadiness": 0.0,
    "socialConfidence": 0.0,
    "separationTolerance": 0.0,
    "newEnvironmentAdaptability": 0.0,
    "challengeTolerance": 0.0
  },
  "supportNeeded": ["beginner_class"],
  "detectedTensions": [
    {
      "type": "care_vs_independence",
      "description": "string",
      "confidence": 0.0
    }
  ],
  "evidence": [
    {
      "text": "사용자 원문 일부",
      "mappedTo": "englishGrowth",
      "impact": "increase"
    }
  ],
  "summaryForParent": ["string", "string"],
  "followUpQuestions": ["string"]
}
`.trim()
}

export function buildRecommendationExplainerPrompt(
  analysis: ParentAnalysis,
  recommendations: readonly CampRecommendation[],
): string {
  return `
너는 해외 영어캠프 상담 리포트 작성자다.
추천 순위, Fit 유형, 점수는 코드 알고리즘 결과이므로 절대 바꾸지 않는다.
각 추천 캠프의 추천 이유, 주의점, 상담 전 확인 질문만 더 자연스러운 한국어로 보강한다.
아이를 평가하거나 단정하지 말고 필요한 조건과 완충장치 중심으로 표현한다.

부모-아이 분석:
${JSON.stringify(analysis, null, 2)}

코드 추천 결과:
${JSON.stringify(
  recommendations.map((item) => ({
    campId: item.camp.id,
    campName: item.camp.name,
    fitType: item.fitType,
    score: item.score,
    traits: item.camp.traits,
    currentExplanation: item.explanation,
  })),
  null,
  2,
)}

반환 JSON 형식:
{
  "items": [
    {
      "campId": "string",
      "reason": "string",
      "caution": "string",
      "questionsBeforeConsultation": ["string", "string", "string"]
    }
  ]
}
`.trim()
}
