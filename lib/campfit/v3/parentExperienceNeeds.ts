import {
  campfitV3ParentExperienceNeedAxes,
  campfitV3ParentNeedImportanceValues,
} from "@/types/campfitV3"
import type {
  CampfitV3ParentExperienceNeedAxis,
  CampfitV3ParentExperienceNeeds,
  CampfitV3ParentNeedImportance,
} from "@/types/campfitV3"

const axisMatchers: Readonly<Record<CampfitV3ParentExperienceNeedAxis, RegExp>> = {
  english_growth: /(?:영어|회화|말하기).{0,48}(?:늘|성장|자신감|자연스럽|접|배우|사용|쓰|경험|노출|좋|싶|했으면|원|유지|확대)/iu,
  peer_interaction: /외국\s*친구|친구|또래|어울리|교류|사귀|함께\s*지내|같이\s*놀/iu,
  global_experience: /새로운\s*(?:경험|문화|환경)|다양한\s*문화|해외\s*(?:생활|경험)|시야|세상을?\s*(?:넓|보)/iu,
  independence_confidence: /혼자서|혼자\s*해|자신감|독립|스스로|낯선\s*(?:환경|곳)|해낼\s*수/iu,
  school_learning_experience: /(?:국제\s*학교|해외\s*학교|현지\s*학교|학교\s*(?:생활|수업|방식|경험)|스쿨링).{0,48}(?:경험|미리|원하|싶|좋|필요|굳이|안\s*가)|(?:이민|해외로\s*이사).{0,24}(?:국제\s*학교|해외\s*학교|학교\s*생활)/iu,
}

const axisLabels: Readonly<Record<CampfitV3ParentExperienceNeedAxis, string>> = {
  english_growth: "영어를 실제로 사용하며 자연스럽게 늘리는 경험",
  peer_interaction: "현지·다양한 국적의 또래와 어울리는 경험",
  global_experience: "새로운 문화와 환경을 경험하는 것",
  independence_confidence: "새로운 환경에서 스스로 해내며 자신감을 키우는 것",
  school_learning_experience: "해외 학교생활과 수업 방식을 미리 경험하는 것",
}

const emptyNeed = (): { readonly importance: "unspecified"; readonly evidence: readonly string[] } => ({
  importance: "unspecified",
  evidence: [],
})

export function emptyParentExperienceNeeds(): CampfitV3ParentExperienceNeeds {
  return Object.fromEntries(campfitV3ParentExperienceNeedAxes.map((axis) => [axis, emptyNeed()])) as CampfitV3ParentExperienceNeeds
}

/**
 * A small provider-failure safety net. Solar remains the semantic extractor on
 * the normal path; this fallback only captures unambiguous goal mentions when
 * the provider is unavailable.
 */
export function extractParentExperienceNeedsValue(message: string): CampfitV3ParentExperienceNeeds | null {
  const text = message.trim()
  if (!text) return null

  const needs = { ...emptyParentExperienceNeeds() } as Record<CampfitV3ParentExperienceNeedAxis, { importance: CampfitV3ParentNeedImportance; evidence: readonly string[] }>
  let found = false
  for (const axis of campfitV3ParentExperienceNeedAxes) {
    const match = text.match(axisMatchers[axis])
    if (match?.index === undefined) continue
    if (axis === "english_growth" && !hasEnglishGoalCue(text, match.index, match[0].length)) continue
    if (!hasParentGoalCue(text, match.index, match[0].length)) continue
    found = true
    const evidence = sentenceForMatch(text, match.index, match[0].length)
    needs[axis] = {
      importance: inferFallbackImportance(text, axis, match.index, match[0].length),
      evidence: [evidence],
    }
  }
  return found ? needs : null
}

function hasEnglishGoalCue(text: string, matchIndex: number, matchLength: number): boolean {
  const start = Math.max(0, matchIndex - 8)
  const end = Math.min(text.length, matchIndex + Math.max(matchLength, 1) + 20)
  const nearby = text.slice(start, end)
  return /(?:영어|회화|말하기).{0,20}(?:늘|성장|자신감|자연스럽|접|배우|사용|쓰|경험|노출|좋|싶|했으면|원|유지|확대)/iu.test(nearby)
}

export function hasParentExperienceNeeds(value: unknown): value is CampfitV3ParentExperienceNeeds {
  if (!isParentExperienceNeedsValue(value)) return false
  return campfitV3ParentExperienceNeedAxes.some((axis) => value[axis].importance !== "unspecified")
}

export function isParentExperienceNeedsValue(value: unknown): value is CampfitV3ParentExperienceNeeds {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== campfitV3ParentExperienceNeedAxes.length) return false
  return campfitV3ParentExperienceNeedAxes.every((axis) => {
    const item = record[axis]
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false
    const need = item as Record<string, unknown>
    return campfitV3ParentNeedImportanceValues.includes(need["importance"] as CampfitV3ParentNeedImportance)
      && Array.isArray(need["evidence"])
      && need["evidence"].length <= 3
      && need["evidence"].every((entry) => typeof entry === "string" && entry.trim().length > 0 && entry.length <= 240)
  })
}

export function parentExperienceNeedsAcknowledgement(
  value: CampfitV3ParentExperienceNeeds,
): string | null {
  const primary = axesWithImportance(value, "primary")
  const important = axesWithImportance(value, "important")
  const niceToHave = axesWithImportance(value, "nice_to_have")
  const avoid = axesWithImportance(value, "avoid")
  const lead = primary[0] ?? important[0] ?? niceToHave[0]
  if (lead === undefined && avoid.length === 0) return null

  if (lead === "peer_interaction" && (niceToHave.includes("english_growth") || important.includes("english_growth"))) {
    return "영어를 접하는 것도 좋지만, 이번 경험에서는 또래와 어울리는 것을 가장 중요하게 보고 계시네요."
  }
  if (lead === "global_experience" && niceToHave.includes("english_growth") && niceToHave.includes("peer_interaction")) {
    return "영어를 쓰고 친구를 만나는 것도 좋지만, 무엇보다 새로운 문화와 환경을 경험하는 것을 중요하게 보고 계시네요."
  }
  if (lead !== undefined) {
    if (primary.includes(lead)) {
      const secondary = niceToHave[0] ?? important[0]
      if (secondary !== undefined) return `${axisLabels[lead]}을 가장 중요하게 보시고, ${axisLabels[secondary]}도 함께 기대하고 계시네요.`
      return `${axisLabels[lead]}을 이번 경험에서 가장 중요하게 보고 계시네요.`
    }
    if (important.includes(lead)) return `${axisLabels[lead]}을 중요한 기준으로 보고 계시네요.`
    return `${axisLabels[lead]}도 함께 기대하고 계시네요.`
  }
  if (avoid.includes("school_learning_experience")) {
    return "국제학교·학업 중심 경험은 꼭 필요하지 않은 것으로 이해했어요."
  }
  return "말씀하신 경험의 방향을 확인했어요."
}

export function parentNeedEvidenceIsGrounded(value: unknown, factEvidence: string, userMessage: string): boolean {
  if (!isParentExperienceNeedsValue(value) || !hasParentExperienceNeeds(value)) return false
  const normalizedMessage = normalizeForEvidence(userMessage)
  const normalizedFactEvidence = normalizeForEvidence(factEvidence)
  return campfitV3ParentExperienceNeedAxes.some((axis) => {
    const need = value[axis]
    if (need.importance === "unspecified" || need.evidence.length === 0) return false
    const evidenceIsPresent = need.evidence.some((evidence) => {
      const normalizedEvidence = normalizeForEvidence(evidence)
      return normalizedEvidence.length > 0 && normalizedMessage.includes(normalizedEvidence)
    })
    return evidenceIsPresent
      || normalizedFactEvidence.length > 0 && normalizedMessage.includes(normalizedFactEvidence)
  })
}

function axesWithImportance(value: CampfitV3ParentExperienceNeeds, importance: CampfitV3ParentNeedImportance): CampfitV3ParentExperienceNeedAxis[] {
  return campfitV3ParentExperienceNeedAxes.filter((axis) => value[axis].importance === importance)
}

function hasParentGoalCue(text: string, matchIndex: number, matchLength: number): boolean {
  // Keep the goal cue close to the matched axis. A later, unrelated phrase
  // such as "동남아 쪽이면 좋겠어요" must not turn a child's "친구" mention
  // into a parent peer-interaction goal.
  const start = Math.max(0, matchIndex - 36)
  const end = Math.min(text.length, matchIndex + Math.max(matchLength, 1) + 36)
  const nearby = text.slice(start, end)
  if (/(?:처음\s*보는\s*친구|낯을?\s*가리|친해지)/iu.test(nearby)
    && !/(?:친구|또래).{0,24}(?:좋겠|중요|어울려|사귀어|싶|원)/iu.test(nearby)) return false
  const strongGoalCue = /(?:했으면|좋겠|좋지만|원하|중요|목적|경험(?:하|했|해보)|싶|생겼으면|얻었으면|키웠으면|늘면|어울려?보|사귀어?보|굳이|안\s*가|필요\s*없|미리\s*경험)/iu.test(nearby)
  if (strongGoalCue) return true
  if (/(?:아이가|아이|자녀).{0,24}(?:좋아|잘해|활발|낯을?\s*가리)/iu.test(nearby)) return false
  return /(?:되면|있으면|가능하면|같이).{0,14}좋/iu.test(nearby)
}

function inferFallbackImportance(
  text: string,
  axis: CampfitV3ParentExperienceNeedAxis,
  matchIndex: number,
  matchLength: number,
): CampfitV3ParentNeedImportance {
  const local = text.slice(Math.max(0, matchIndex - 34), Math.min(text.length, matchIndex + matchLength + 64))
  const contrast = axis === "english_growth"
    && /(?:영어|회화|말하기).{0,20}(?:늘|성장|자신감|자연스럽|접|배우|사용|쓰|경험|노출|좋|싶|했으면|원|유지|확대).{0,8}(?:지만|는데|보다)/iu.test(text)
    || axis === "peer_interaction"
    && /(?:친구|또래|어울리|교류).{0,20}(?:좋|했으면|원|싶|어울려|사귀어).{0,8}(?:지만|는데|보다)/iu.test(text)
  if (isAvoid(local, axis, text)) return "avoid"
  // In natural Korean, a parent may state the primary peer goal first and
  // append English as a secondary wish with "...가장 중요하고 영어는...".
  // Do not let the primary cue leak forward to the later English phrase.
  if (axis === "english_growth" && primaryPeerGoalAppearsBefore(text, matchIndex)) return "nice_to_have"
  if (axis === "peer_interaction" && /영어.{0,40}(?:지만|는데).{0,40}(?:외국\s*친구|친구|또래|어울리|교류)/iu.test(text)) return "primary"
  // A contrast cue belongs to the axis named after the contrast, even when
  // a later "가장 중요" phrase is close enough to fool the generic priority
  // matcher. For example, "영어도 좋겠지만 ... 친구들과 어울리는 경험이
  // 가장 중요" makes English secondary, not primary.
  if (contrast) return "nice_to_have"
  if (isPrimary(local, text, axis, matchIndex, matchLength)) return "primary"
  if (/(?:되면|있으면|가능하면|같이).{0,14}좋|좋.{0,14}(?:지만|고|으면)/iu.test(local)) return "nice_to_have"
  if (/(중요|많이|꼭|하고\s*싶|경험했으면|사귀었으면|어울렸으면|늘었으면|생겼으면)/iu.test(local)) return "important"
  return "important"
}

function primaryPeerGoalAppearsBefore(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 72), matchIndex)
  return /(?:친구|또래|어울리).{0,30}(?:가장|제일|무엇보다).{0,14}(?:중요|우선).{0,8}(?:하고|하며|인데|지만)\s*$/iu.test(before)
}

function isPrimary(local: string, wholeText: string, axis: CampfitV3ParentExperienceNeedAxis, matchIndex: number, matchLength: number): boolean {
  if (axis === "school_learning_experience" && /(?:(?:해외|국제|현지)?\s*학교(?:생활|수업)|수업\s*방식).{0,40}(?:가장|제일)\s*중요/iu.test(wholeText)) return true
  const before = wholeText.slice(Math.max(0, matchIndex - 36), matchIndex)
  const after = wholeText.slice(matchIndex + matchLength, matchIndex + matchLength + 42)
  const priorityBeforeAxis = /(?:가장\s*중요|제일\s*중요|무엇보다|이번\s*목적|꼭)/iu.test(before)
  const priorityAfterMatch = after.match(/(?:가장\s*중요|제일\s*중요|무엇보다|꼭|중요해)/iu)
  const textBetween = priorityAfterMatch === null ? "" : after.slice(0, priorityAfterMatch.index ?? 0)
  const priorityAfterAxis = priorityAfterMatch !== null && !/(지만|는데|보다|아니고)/iu.test(textBetween)
  if (priorityBeforeAxis || priorityAfterAxis) return true
  if (axis === "school_learning_experience" && /(?:(?:이민|해외로\s*이사).{0,32}(?:국제\s*학교|학교\s*생활)|(?:국제\s*학교|학교\s*생활).{0,32}(?:미리\s*경험|경험해보고\s*싶))/iu.test(wholeText)) return true
  if (axis === "independence_confidence" && /(?:(?:이번에는|이번\s*경험에서).{0,32}(?:혼자|자신감|독립)|(?:혼자|자신감|독립).{0,32}(?:생겼으면|얻었으면|키웠으면))/iu.test(wholeText)) return true
  if (axis === "global_experience" && /무엇보다.{0,40}(문화|새로운\s*경험|새로운\s*환경)/iu.test(wholeText)) return true
  return false
}

function isAvoid(local: string, axis: CampfitV3ParentExperienceNeedAxis, wholeText: string): boolean {
  if (axis === "school_learning_experience") {
    return /(?:국제\s*학교|해외\s*학교|스쿨링|학교\s*(?:생활|수업|경험)).{0,28}(?:굳이|안\s*(?:가|해도)|필요\s*없|원하(?:지|는)\s*않|싫)/iu.test(wholeText)
  }
  return /(?:원하지\s*않|굳이\s*필요\s*없|필요\s*없|싫어|안\s*했으면)/iu.test(local)
}

function sentenceForMatch(text: string, index: number, length: number): string {
  const start = Math.max(text.lastIndexOf(".", index), text.lastIndexOf("\n", index)) + 1
  const nextPeriod = text.indexOf(".", index + length)
  const end = nextPeriod === -1 ? text.length : nextPeriod
  return text.slice(start, end).trim().slice(0, 240) || text.slice(0, 240)
}

function normalizeForEvidence(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim()
}
