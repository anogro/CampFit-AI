export type SpecialCareFollowUp = "none" | "required" | "unknown"

export type SanitizedSpecialCareInput = {
  readonly followUp: SpecialCareFollowUp
  readonly safeMessage: string
}

export type SanitizedConversationInput = {
  readonly safeMessage: string
  readonly healthDetailRedacted: boolean
}

const SAFE_SPECIAL_CARE_MESSAGES: Record<SpecialCareFollowUp, string> = {
  none: "없어요",
  required: "있어요. 상담할 때 별도로 확인할게요",
  unknown: "아직 잘 모르겠어요",
}

/**
 * 특별관리 질문의 자유 입력은 존재 여부만 구조화하고 원문을 보존하지 않는다.
 * 애매하거나 상세해 보이는 입력은 안전을 위해 required로 일반화한다.
 */
export function sanitizeSpecialCareInput(input: string): SanitizedSpecialCareInput {
  const normalized = input.trim().replace(/\s+/g, " ")
  let followUp: SpecialCareFollowUp

  if (/(잘\s*모르|모르겠|확인해\s*(봐|보)야|확인\s*필요.*모르)/u.test(normalized)) {
    followUp = "unknown"
  } else if (/(없어|없습니다|없음|따로\s*없|특별한\s*(사항|것).*(없|아니)|아니요|아닙니다)/u.test(normalized)) {
    followUp = "none"
  } else {
    followUp = "required"
  }

  return { followUp, safeMessage: SAFE_SPECIAL_CARE_MESSAGES[followUp] }
}

/** 브라우저 transcript에도 자발적으로 입력한 상세 건강 문장을 남기지 않는다. */
export function sanitizeConversationInput(input: string, isSpecialCareQuestion: boolean): SanitizedConversationInput {
  const healthDetailRedacted = isSpecialCareQuestion || containsSensitiveHealthDetail(input)
  return healthDetailRedacted
    ? { safeMessage: sanitizeSpecialCareInput(input).safeMessage, healthDetailRedacted: true }
    : { safeMessage: input, healthDetailRedacted: false }
}

export function containsSensitiveHealthDetail(input: string): boolean {
  return /(질환(?:명)?|병명|진단(?:명)?|병력|알레르기|복용(?:약|량|\s*중)|투약|약\s*(?:이름|명칭)|특별\s*식사|건강\s*(?:상태|문제).*(?:상세|설명))/u.test(input)
}
