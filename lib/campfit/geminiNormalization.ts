import { supportKeys, type DetectedTension, type ParentAnalysis, type SupportKey } from "@/types/campfit"

const supportKeySet = new Set<string>(supportKeys)
export function normalizeParentAnalysisCandidate(candidate: unknown, fallback: ParentAnalysis): unknown {
  if (!isRecord(candidate)) {
    return candidate
  }

  return {
    ...candidate,
    supportNeeded: normalizeSupportNeeded(candidate["supportNeeded"], fallback),
    detectedTensions: normalizeDetectedTensions(candidate["detectedTensions"], fallback),
    evidence: normalizeEvidence(candidate["evidence"], fallback),
    summaryForParent: normalizeStringArray(candidate["summaryForParent"], fallback.summaryForParent, 2, 5),
    followUpQuestions: normalizeStringArray(candidate["followUpQuestions"], fallback.followUpQuestions, 1, 2),
  }
}

function normalizeSupportNeeded(value: unknown, fallback: ParentAnalysis): readonly SupportKey[] {
  if (!Array.isArray(value)) {
    return fallback.supportNeeded
  }

  const supportNeeded = value.filter(isSupportKey).slice(0, 6)
  return supportNeeded.length > 0 ? supportNeeded : fallback.supportNeeded
}

function normalizeDetectedTensions(value: unknown, fallback: ParentAnalysis): readonly DetectedTension[] {
  if (!Array.isArray(value)) {
    return fallback.detectedTensions
  }

  const tensions = value
    .filter(isRecord)
    .map((item) => ({
      type: normalizeTensionType(item["type"]),
      description:
        typeof item["description"] === "string" && isReadableText(item["description"])
          ? item["description"]
          : "상담 전 조건을 함께 확인해야 합니다.",
      confidence: clampScore(item["confidence"]),
    }))
    .slice(0, 5)

  return tensions.length > 0 ? tensions : fallback.detectedTensions
}

function normalizeEvidence(value: unknown, fallback: ParentAnalysis) {
  if (!Array.isArray(value)) {
    return fallback.evidence
  }

  const evidence = value
    .filter(isRecord)
    .map((item) => ({
      text: typeof item["text"] === "string" && isReadableText(item["text"]) ? item["text"] : fallback.evidence[0]?.text ?? "입력 내용",
      mappedTo: typeof item["mappedTo"] === "string" ? item["mappedTo"] : "parentGoal",
      impact: item["impact"] === "decrease" ? "decrease" : "increase",
    }))
    .slice(0, 6)

  return evidence.length > 0 ? evidence : fallback.evidence
}

function normalizeStringArray(value: unknown, fallback: readonly string[], minLength: number, maxLength: number): readonly string[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  const items = value.filter((item): item is string => typeof item === "string" && isReadableText(item)).slice(0, maxLength)
  return items.length >= minLength ? items : fallback
}

function normalizeTensionType(value: unknown): DetectedTension["type"] {
  switch (value) {
    case "care_vs_independence":
    case "english_growth_vs_anxiety":
    case "academic_result_vs_burden":
    case "budget_vs_care":
    case "safety_vs_challenge":
      return value
    default:
      return "safety_vs_challenge"
  }
}

function clampScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5
}

function isSupportKey(value: unknown): value is SupportKey {
  return typeof value === "string" && supportKeySet.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isReadableText(value: string): boolean {
  const suspiciousMatches = value.match(/[ÃÂ�□]|[ìíëêãð]/gi)
  return (suspiciousMatches?.length ?? 0) < 2
}
