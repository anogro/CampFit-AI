import type {
  CampfitV3ActivityPreference,
  CampfitV3ActivityPreferenceCategory,
  CampfitV3ActivityPreferenceProfile,
  CampfitV3ActivityPreferenceStrength,
} from "@/types/campfitV3"

type ActivityLexicon = Readonly<Record<CampfitV3ActivityPreferenceCategory, readonly RegExp[]>>

const activityLexicon: ActivityLexicon = {
  stem_maker: [
    /STEM|STEAM|science|coding|robotics?|maker/iu,
    /과학|실험|코딩|로봇|로보틱스|공학|발명|조립|메이커|만들기|제작/iu,
  ],
  sports_physical: [
    /sports?|football|soccer|basketball|baseball|tennis|swimming/iu,
    /스포츠|수영|축구|농구|야구|테니스|운동|체육|뛰어놀|몸을\s*움직/iu,
  ],
  nature_outdoor: [
    /nature|forest|hiking|camping|outdoor|exploration/iu,
    /자연|숲|산책|하이킹|등산|캠핑|야외\s*(?:활동|체험)?|탐험/iu,
  ],
  animals_ecology: [
    /animals?|marine\s*life|birds?|ecology|wildlife/iu,
    /동물|해양생물|물고기|새|조류|곤충|생태/iu,
  ],
  art_creative: [
    /art|drawing|painting|craft|design/iu,
    /그림|그리기|미술|공예|디자인|창작/iu,
  ],
  performance_music: [
    /music|instrument|singing|dance|dancing|performance|concert/iu,
    /음악|악기|피아노|바이올린|노래|노래하기|춤|댄스|공연|무대|콘서트/iu,
  ],
  culture_lifestyle: [
    /culture|local\s+life|lifestyle|traditional|city\s+experience/iu,
    /문화|현지\s*(?:문화|생활|체험)?|전통|생활문화|도시\s*체험/iu,
  ],
}

const strongPreferencePattern = /제일\s*(?:좋아|재미)|가장\s*(?:좋아|재미)|(?:정말|엄청|특히|너무)\s*(?:좋아|재미)|최고로/iu
const positivePreferencePattern = /좋아(?:해|하|서|요)?|즐겨|재미있|재밌|관심\s*(?:있|많)|흥미\s*(?:있|많)|하고\s*싶/iu
const dislikePreferencePattern = /(?:별로|전혀|그다지)\s*(?:안\s*)?(?:좋아|재미)|좋아하지\s*않|싫어|흥미\s*없|관심\s*없|안\s*맞/iu
const unknownActivityPattern = /(?:딱히|특별히)\s*(?:좋아하는|선호하는)\s*(?:활동|것)\s*없|(?:잘|아직)\s*모르겠|모두\s*괜찮/iu
const varietyPattern = /여러\s*(?:가지|종류)|다양한|골고루|두루|새로운\s*(?:활동|것)|여러\s*활동|폭넓게|많이\s*경험/iu
const varietyStrongPattern = /(?:가장|제일|특히|정말|엄청)\s*(?:다양|여러|골고루|두루)|다양한\s*경험이\s*(?:가장|제일)/iu

const categoryPhrases: Readonly<Record<CampfitV3ActivityPreferenceCategory, string>> = {
  stem_maker: "직접 만들고 실험하는 활동",
  sports_physical: "몸을 움직이는 활동",
  nature_outdoor: "자연·야외 활동",
  animals_ecology: "동물과 생태를 관찰하는 활동",
  art_creative: "그림·공예처럼 표현하는 활동",
  performance_music: "음악·춤·공연 활동",
  culture_lifestyle: "현지 문화와 생활을 경험하는 활동",
}

const strengthRank: Readonly<Record<CampfitV3ActivityPreferenceStrength, number>> = {
  strong: 4,
  positive: 3,
  neutral: 2,
  dislike: 1,
}

export function extractActivityPreferenceProfile(message: string): CampfitV3ActivityPreferenceProfile | null {
  const text = message.trim()
  if (!text) return null

  const sentences = text.split(/(?:\r?\n|[.!?。！？]+)/u).map((sentence) => sentence.trim()).filter(Boolean)
  const collected = new Map<CampfitV3ActivityPreferenceCategory, CampfitV3ActivityPreference>()
  const profileEvidence: string[] = []

  for (const sentence of sentences) {
    if (isParentActivitySentence(sentence)) continue
    for (const category of Object.keys(activityLexicon) as CampfitV3ActivityPreferenceCategory[]) {
      for (const match of allMatches(sentence, activityLexicon[category])) {
        const strength = preferenceStrength(sentence, match.index)
        if (strength === null) continue
        const mentioned = match.value.trim()
        const existing = collected.get(category)
        const candidate: CampfitV3ActivityPreference = {
          category,
          strength,
          rank: null,
          mentionedActivities: [mentioned],
          evidence: [sentence.slice(0, 240)],
        }
        if (existing === undefined || strengthRank[strength] > strengthRank[existing.strength]) {
          collected.set(category, {
            ...candidate,
            mentionedActivities: Array.from(new Set([...(existing?.mentionedActivities ?? []), mentioned])),
            evidence: Array.from(new Set([...(existing?.evidence ?? []), ...candidate.evidence])).slice(0, 3),
          })
        } else if (existing !== undefined) {
          collected.set(category, {
            ...existing,
            mentionedActivities: Array.from(new Set([...existing.mentionedActivities, mentioned])),
            evidence: Array.from(new Set([...existing.evidence, ...candidate.evidence])).slice(0, 3),
          })
        }
        profileEvidence.push(sentence.slice(0, 240))
      }
    }
    if (varietyPattern.test(sentence)) profileEvidence.push(sentence.slice(0, 240))
  }

  const varietyPreference = varietyStrongPattern.test(text)
    ? "strong"
    : varietyPattern.test(text)
      ? "positive"
      : "unspecified"
  if (collected.size === 0 && varietyPreference === "unspecified" && !unknownActivityPattern.test(text)) return null

  const preferences = [...collected.values()]
    .sort((left, right) => strengthRank[right.strength] - strengthRank[left.strength] || left.evidence[0]!.localeCompare(right.evidence[0]!))
    .map((preference, index) => ({
      ...preference,
      rank: preference.strength === "dislike" ? null : index + 1,
    }))

  return {
    preferences,
    varietyPreference,
    evidence: Array.from(new Set(profileEvidence)).slice(0, 6),
  }
}

export function isActivityPreferenceProfileValue(value: unknown): value is CampfitV3ActivityPreferenceProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (!Array.isArray(record["preferences"]) || !["strong", "positive", "unspecified"].includes(record["varietyPreference"] as string)) return false
  if (!Array.isArray(record["evidence"]) || record["evidence"].some((item) => typeof item !== "string" || item.trim().length === 0)) return false
  return record["preferences"].every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false
    const preference = item as Record<string, unknown>
    return ["stem_maker", "sports_physical", "nature_outdoor", "animals_ecology", "art_creative", "performance_music", "culture_lifestyle"].includes(preference["category"] as string)
      && ["strong", "positive", "neutral", "dislike"].includes(preference["strength"] as string)
      && (preference["rank"] === null || typeof preference["rank"] === "number")
      && Array.isArray(preference["mentionedActivities"])
      && preference["mentionedActivities"].every((activity) => typeof activity === "string" && activity.trim().length > 0)
      && Array.isArray(preference["evidence"])
      && preference["evidence"].every((evidence) => typeof evidence === "string" && evidence.trim().length > 0)
  })
}

export function activityRecommendationSufficiency(value: unknown): boolean {
  if (!isActivityPreferenceProfileValue(value)) return false
  if (value.varietyPreference !== "unspecified") return true
  return value.preferences.some((item) => item.strength === "positive" || item.strength === "strong")
}

export function hasMeaningfulActivityEvidence(value: unknown): boolean {
  return isActivityPreferenceProfileValue(value)
    && (value.preferences.length > 0 || value.varietyPreference !== "unspecified")
}

export function activityPreferenceAcknowledgement(value: unknown): string | null {
  if (!isActivityPreferenceProfileValue(value)) return null
  const liked = value.preferences.filter((item) => item.strength === "strong" || item.strength === "positive")
  const disliked = value.preferences.filter((item) => item.strength === "dislike")
  if (liked.length === 0 && value.varietyPreference !== "unspecified") {
    return "한 가지에만 집중하기보다 여러 활동을 다양하게 경험하는 걸 좋아하는 편이군요."
  }
  if (liked.length === 0 && disliked.length > 0) {
    return `${joinActivityPhrases(disliked)}은 선호하지 않는 편이라는 점도 참고할게요.`
  }
  if (liked.length === 0) return null
  if (liked.length === 1) {
    const phrase = categoryPhrases[liked[0]!.category]
    const adverb = liked[0]!.strength === "strong" ? "특히 " : ""
    return `${phrase}을 ${adverb}좋아하는 편이군요${disliked.length ? `, ${joinActivityPhrases(disliked)}은 선호하지 않는 편이고요` : ""}.`
  }
  const [first, second] = liked
  const firstPhrase = categoryPhrases[first!.category]
  const secondPhrase = categoryPhrases[second!.category]
  const firstClause = first!.strength === "strong" ? `${firstPhrase}을 특히 좋아하고` : `${firstPhrase}을 좋아하고`
  return `${firstClause} ${secondPhrase}도 즐기는 편이군요${disliked.length ? `, ${joinActivityPhrases(disliked)}은 덜 선호하고요` : ""}.`
}

export function activityPreferenceValueIsGrounded(
  value: unknown,
  factEvidence: string,
  userMessage: string,
): boolean {
  if (!isActivityPreferenceProfileValue(value)) return false
  const text = userMessage.trim()
  if (!text) return false
  if (value.preferences.length === 0) return hasTextOverlap(value.evidence.join(" ") || factEvidence, text)
  return value.preferences.every((preference) => {
    const evidence = [...preference.evidence, factEvidence].join(" ")
    if (!hasTextOverlap(evidence, text)) return false
    const mentioned = preference.mentionedActivities.join(" ")
    if (mentioned && !hasTextOverlap(mentioned, text)) return false
    return hasPreferenceCue(evidence) || hasPreferenceCue(textAround(text, mentioned))
  })
}

export function activityCategoryPhrase(category: CampfitV3ActivityPreferenceCategory): string {
  return categoryPhrases[category]
}

export function activityPreferenceProfileFromCategory(
  category: CampfitV3ActivityPreferenceCategory | "variety",
  evidence: string,
): CampfitV3ActivityPreferenceProfile {
  if (category === "variety") {
    return { preferences: [], varietyPreference: "positive", evidence: [evidence] }
  }
  return {
    preferences: [{
      category,
      strength: "positive",
      rank: 1,
      mentionedActivities: [categoryPhrases[category]],
      evidence: [evidence],
    }],
    varietyPreference: "unspecified",
    evidence: [evidence],
  }
}

function allMatches(sentence: string, patterns: readonly RegExp[]): readonly { readonly value: string; readonly index: number }[] {
  return patterns.flatMap((pattern) => {
    const globalPattern = new RegExp(pattern.source, `${pattern.flags.replace(/g/gu, "")}g`)
    return [...sentence.matchAll(globalPattern)].map((match) => ({ value: match[0], index: match.index ?? 0 }))
  }).sort((left, right) => left.index - right.index)
}

function preferenceStrength(sentence: string, activityIndex: number): CampfitV3ActivityPreferenceStrength | null {
  const nearbyText = sentence.slice(Math.max(0, activityIndex - 28), activityIndex + 48)
  if (/운동신경|운동\s*능력/iu.test(nearbyText)) return null
  const before = sentence.slice(Math.max(0, activityIndex - 20), activityIndex)
  const after = sentence.slice(activityIndex, activityIndex + 36)
  if (/(?:특히|제일|가장)\s*$/iu.test(before) && positivePreferencePattern.test(after)) return "strong"
  const cues: Array<{ readonly strength: CampfitV3ActivityPreferenceStrength; readonly pattern: RegExp }> = [
    { strength: "dislike", pattern: dislikePreferencePattern },
    { strength: "strong", pattern: strongPreferencePattern },
    { strength: "positive", pattern: positivePreferencePattern },
  ]
  const matches = cues.flatMap(({ strength, pattern }) => {
    const match = sentence.match(pattern)
    return match?.index === undefined ? [] : [{ strength, distance: Math.abs(match.index - activityIndex) }]
  }).filter((candidate) => candidate.distance <= 48)
  return matches.sort((left, right) => left.distance - right.distance || strengthRank[right.strength] - strengthRank[left.strength])[0]?.strength ?? null
}

function hasPreferenceCue(text: string): boolean {
  return strongPreferencePattern.test(text) || positivePreferencePattern.test(text) || dislikePreferencePattern.test(text)
}

function isParentActivitySentence(sentence: string): boolean {
  if (/(?:아이|자녀|우리\s*아이)/iu.test(sentence)) return false
  return /^(?:저는|제가|부모(?:님)?은|엄마는|아빠는)|(?:부모(?:님)?|엄마|아빠).{0,12}(?:좋아|원해|싶|괜찮)/iu.test(sentence.trim())
    || /(?:현지에서|아이\s*캠프\s*시간에는).{0,20}(?:자연|문화|관광|카페|식당)/iu.test(sentence)
}

function hasTextOverlap(evidence: string, userMessage: string): boolean {
  const normalizedMessage = compact(userMessage)
  if (!evidence.trim() || !normalizedMessage) return false
  const tokens = tokenize(evidence).filter((token) => token.length >= 2)
  return tokens.some((token) => normalizedMessage.includes(compact(token)))
}

function textAround(text: string, phrase: string): string {
  if (!phrase) return text
  const index = compact(text).indexOf(compact(phrase))
  if (index < 0) return text
  return text.slice(Math.max(0, index - 40), index + phrase.length + 48)
}

function compact(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/gu, "")
}

function tokenize(value: string): readonly string[] {
  return value.match(/[가-힣A-Za-z0-9]{2,}/gu) ?? []
}

function joinActivityPhrases(preferences: readonly CampfitV3ActivityPreference[]): string {
  const phrases = preferences.slice(0, 2).map((preference) => categoryPhrases[preference.category])
  if (phrases.length <= 1) return phrases[0] ?? "해당 활동"
  return `${phrases[0]}과 ${phrases[1]}`
}
