import type { ExperienceDirectionKey } from "@/types/campfitV3"

export type V3CatalogSource = "supabase" | "static_fallback" | "demo" | "unavailable"

export type V3ParticipationMode =
  | "parent_required"
  | "parent_recommended"
  | "child_only_allowed"
  | "unknown"

export type V3StayMode = "day" | "family_stay" | "child_residential" | "homestay" | "mixed" | "unknown"

export type V3ParentScope = {
  readonly participationMode: V3ParticipationMode
  readonly stayMode: V3StayMode
  readonly guardianNearbyCompatible: boolean | null
}

export type V3SessionWindow = {
  readonly startDate: string
  readonly endDate: string
  readonly weeks: number | null
  readonly status: string | null
  readonly source: "program_sessions" | "program_text"
  readonly precision: "exact" | "season"
}

export type V3DirectionSignals = Readonly<Record<ExperienceDirectionKey, number>>

export type V3DateRange = {
  readonly startDate: string
  readonly endDate: string
}

type CatalogRow = Readonly<Record<string, unknown>>

export function isPublicV3ProgramRow(row: CatalogRow, today: string): boolean {
  if (readRowString(row, "status")?.toLowerCase() !== "active") return false
  if (row["visible"] !== true || row["is_listed"] !== true) return false
  const expiredAt = readRowString(row, "list_expired_at")
  return expiredAt === undefined || expiredAt.slice(0, 10) >= today
}

/** Cities created before the listing flag existed remain readable; only an explicit false is private. */
export function isVisibleV3CityRow(row: CatalogRow): boolean {
  return row["is_listed"] !== false
}

export function inferParentScope(input: {
  readonly participationText: string
  readonly accommodationText: string
  readonly groupText: string
  readonly coverageText: string
  readonly nameText: string
  readonly profileParentAccompanied: boolean | null
}): V3ParentScope {
  const participation = normalizeText(input.participationText)
  const accommodation = normalizeText(input.accommodationText)
  const fallback = normalizeText([input.groupText, input.coverageText, input.nameText].join(" "))
  const parentRequired = /(부모\s*동반\s*필수|parent[_\s-]*(?:required|must)|guardian[_\s-]*required)/i.test(participation)
  const parentRecommended = /(부모\s*동반\s*권장|parent[_\s-]*recommended|부모동반\/현지\s*체류형)/i.test(participation)
  const childOnly = /(아이\s*단독|주니어\s*단독|child[_\s-]*(?:only|alone)|unaccompanied|without\s+(?:a\s+)?parent)/i.test(participation)
  const homestay = /(homestay|홈스테이)/i.test(accommodation)
  const residential = /(boarding|residential|기숙|dormitor|residence|학생\s*숙소|campus\s*residence)/i.test(accommodation)
  const day = /(day[_\s-]*(?:camp|program|programme)|낮\s*프로그램|통학형|숙소\s*별도|accommodation[_\s-]*(?:not[_\s-]*included|not[_\s-]*described|없음))/i.test(accommodation)
  const familyStay = /(family[_\s-]*stay|가족\s*숙소|부모\s*숙박)/i.test(accommodation)
  const mixed = /(self[-_\s]*arranged|자체\s*숙소|선택\s*가능|option|mixed)/i.test(accommodation)

  const participationMode: V3ParticipationMode = parentRequired
    ? "parent_required"
    : parentRecommended
      ? "parent_recommended"
      : childOnly || /(아이\s*단독\s*참여\s*가능)/i.test(participation)
        ? "child_only_allowed"
        : "unknown"

  // Explicit participation and accommodation fields always outrank labels or names.
  if (childOnly && (homestay || residential) && !day) {
    return { participationMode, stayMode: homestay ? "homestay" : "child_residential", guardianNearbyCompatible: false }
  }
  if ((parentRequired || parentRecommended) && (homestay || residential) && !day && !familyStay) {
    return { participationMode, stayMode: "mixed", guardianNearbyCompatible: null }
  }
  if (parentRequired || parentRecommended) {
    return {
      participationMode,
      stayMode: day ? "day" : familyStay ? "family_stay" : "unknown",
      guardianNearbyCompatible: true,
    }
  }
  if (homestay && !day) {
    return { participationMode, stayMode: "homestay", guardianNearbyCompatible: false }
  }
  if (day) {
    return { participationMode, stayMode: "day", guardianNearbyCompatible: true }
  }
  if (familyStay) {
    return { participationMode, stayMode: "family_stay", guardianNearbyCompatible: true }
  }
  if (mixed || (childOnly && !accommodation)) {
    return { participationMode, stayMode: "mixed", guardianNearbyCompatible: null }
  }
  if (residential) return { participationMode, stayMode: "child_residential", guardianNearbyCompatible: false }

  // Use group/coverage/name only when the structured fields did not decide the scope.
  if (!participation && !accommodation) {
    if (/(부모\s*동반\s*(?:필수|권장)|family\s*camp|가족\s*캠프|가족형)/i.test(fallback)) {
      return {
        participationMode: /(필수|required|must)/i.test(fallback) ? "parent_required" : "parent_recommended",
        stayMode: /(day\s*(?:camp|program)|통학형|낮\s*프로그램)/i.test(fallback) ? "day" : "unknown",
        guardianNearbyCompatible: true,
      }
    }
    if (/(homestay|홈스테이|boarding|residential|기숙|dormitor)/i.test(fallback)) {
      return { participationMode, stayMode: /homestay|홈스테이/i.test(fallback) ? "homestay" : "child_residential", guardianNearbyCompatible: false }
    }
    if (/(day\s*(?:camp|program)|통학형|낮\s*프로그램|월\s*[-~]\s*금|monday\s*[-–]\s*friday)/i.test(fallback)) {
      return { participationMode, stayMode: "day", guardianNearbyCompatible: true }
    }
  }
  if (input.profileParentAccompanied === true) {
    return { participationMode, stayMode: "unknown", guardianNearbyCompatible: true }
  }
  return { participationMode, stayMode: "unknown", guardianNearbyCompatible: null }
}

export function inferDirectionSignals(input: {
  readonly profileProgramType: string | null
  readonly traits: readonly string[]
  readonly structuredText?: string
  readonly fallbackText?: string
}): V3DirectionSignals {
  const profileType = normalizeText(input.profileProgramType ?? "")
  const structuredText = normalizeText([...input.traits, input.structuredText ?? ""].join(" "))
  const scores: Record<ExperienceDirectionKey, number> = {
    schoolSchooling: 10,
    englishIntensive: 10,
    subjectProject: 10,
    cultureActivity: 10,
  }

  if (profileType === "schooling") scores.schoolSchooling = 95
  if (profileType === "managed_immersion" || profileType === "family_esl") scores.englishIntensive = 90
  if (profileType === "creative_daycamp") scores.subjectProject = 95
  if (profileType === "activity") scores.cultureActivity = 95
  if (profileType === "international_camp") {
    scores.schoolSchooling = 45
    scores.englishIntensive = 45
    scores.cultureActivity = 45
  }

  applyDirectionKeywords(scores, structuredText)
  // Description/name text is only a fallback when structured evidence produced no usable match.
  if (Math.max(...Object.values(scores)) < 55) {
    applyDirectionKeywords(scores, normalizeText(input.fallbackText ?? ""))
  }
  return scores
}

function applyDirectionKeywords(scores: Record<ExperienceDirectionKey, number>, text: string): void {
  if (/(international\s*school|국제학교|현지학교|schooling|정규\s*수업|school\s*class|학교\s*환경)/i.test(text)) {
    scores.schoolSchooling = Math.max(scores.schoolSchooling, 88)
  }
  if (/(english|영어|esl|language\s*school|어학|immersion|몰입)/i.test(text)) {
    scores.englishIntensive = Math.max(scores.englishIntensive, 82)
  }
  if (/(\bstem\b|\bsteam\b|\bcoding\b|코딩|\brobot(?:ics)?\b|로봇|\bmaker\b|\bscience\b|과학|\btechnology\b|\bengineering\b|\bproject(?:s)?\b|프로젝트|\bcreative\s+(?:project|arts?)\b|창의\s*(?:프로젝트|창작)|\bart\s+project\b|예술\s*프로젝트|\bmusic\s+(?:project|production)\b|음악\s*(?:프로젝트|제작)|\bsports?\s+specialt(?:y|ies)\b|스포츠\s*특화)/i.test(text)) {
    scores.subjectProject = Math.max(scores.subjectProject, 90)
  }
  if (/(culture|문화|activity|액티비티|sports|스포츠|outdoor|야외|excursion|현장\s*체험|nature|자연|beach|해변)/i.test(text)) {
    scores.cultureActivity = Math.max(scores.cultureActivity, 86)
  }
}

export function inferSpecialCareSupport(text: string): "supported" | "unsupported" | "unknown" {
  const normalized = normalizeText(text)
  if (/(특별\s*(?:식사|건강|복약).{0,12}(?:지원\s*불가|대응\s*불가)|알레르기.{0,12}(?:지원\s*불가|대응\s*불가)|(?:special\s*diet|allerg|medication).{0,18}(?:not\s*supported|unavailable|cannot))/i.test(normalized)) {
    return "unsupported"
  }
  if (/(특별\s*식사\s*(?:지원|대응)|알레르기\s*(?:지원|대응)|복약\s*(?:지원|관리)|special\s*diet\s*support|allergy\s*support|medication\s*(?:support|management))/i.test(normalized)) {
    return "supported"
  }
  return "unknown"
}

export function parseDurationWeeks(text: string): readonly number[] {
  const values = new Set<number>()
  const normalized = text.replace(/[–—]/g, "-")
  for (const match of normalized.matchAll(/(\d{1,2})\s*[-~]\s*(\d{1,2})\s*(?:주|weeks?)/gi)) {
    const start = Number(match[1])
    const end = Number(match[2])
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start || end > 20) continue
    for (let value = start; value <= end; value += 1) values.add(value)
  }
  for (const match of normalized.matchAll(/(\d{1,2})\s*(?:주|weeks?)/gi)) {
    const value = Number(match[1])
    if (value >= 1 && value <= 20) values.add(value)
  }
  for (const match of normalized.matchAll(/(\d{1,3})\s*(?:days?|일|nights?|박)/gi)) {
    const days = Number(match[1])
    if (days >= 5 && days <= 140) values.add(Math.max(1, Math.round(days / 7)))
  }
  return [...values].sort((left, right) => left - right)
}

export function extractSessionWindowsFromText(text: string): readonly V3SessionWindow[] {
  const exactDates = extractExactDates(text)
  if (exactDates.length) {
    const windows: V3SessionWindow[] = []
    for (let index = 0; index < exactDates.length; index += 2) {
      const startDate = exactDates[index]
      if (!startDate) continue
      const endDate = exactDates[index + 1] ?? startDate
      windows.push({ startDate, endDate, weeks: inferredWeeks(startDate, endDate), status: null, source: "program_text", precision: "exact" })
    }
    return windows
  }

  const season = text.match(/(20\d{2}).{0,28}(여름|summer|겨울|winter)/i)
  if (!season) return []
  const year = Number(season[1])
  const kind = season[2]?.toLowerCase()
  if (kind === "겨울" || kind === "winter") {
    return [{ startDate: `${year}-12-01`, endDate: `${year + 1}-02-${daysInMonth(year + 1, 2)}`, weeks: null, status: null, source: "program_text", precision: "season" }]
  }
  return [{ startDate: `${year}-06-01`, endDate: `${year}-08-31`, weeks: null, status: null, source: "program_text", precision: "season" }]
}

export function parseDepartureRange(value: string, now = new Date()): V3DateRange | null {
  const text = value.trim()
  if (!text || /(미정|모르|undecided)/i.test(text)) return null
  const exactDates = extractExactDates(text)
  if (exactDates.length >= 2) return { startDate: exactDates[0]!, endDate: exactDates[1]! }
  if (exactDates.length === 1) return { startDate: exactDates[0]!, endDate: exactDates[0]! }

  const explicitMonth = text.match(/(20\d{2})\s*(?:[.\-/]|년\s*)(\d{1,2})(?:\s*월)?(?!\s*[.\-/]\s*\d)/)
  if (explicitMonth) {
    const year = Number(explicitMonth[1])
    const month = Number(explicitMonth[2])
    if (month >= 1 && month <= 12) return monthRange(year, month)
  }

  const explicitSeason = text.match(/(20\d{2}).{0,16}(여름|summer|겨울|winter)/i)
  if (explicitSeason) return seasonRange(Number(explicitSeason[1]), String(explicitSeason[2]))

  const today = utcDateParts(now)
  if (/(다음|내년).{0,8}(여름|summer)/i.test(text)) return seasonRange(today.year + 1, "여름")
  if (/(다음|내년).{0,8}(겨울|winter)/i.test(text)) return seasonRange(today.year + 1, "겨울")
  if (/(여름|summer)/i.test(text)) {
    const year = today.month <= 8 ? today.year : today.year + 1
    return seasonRange(year, "여름")
  }
  if (/(겨울|winter)/i.test(text)) {
    const year = today.month <= 2 ? today.year - 1 : today.month <= 12 ? today.year : today.year + 1
    return seasonRange(year, "겨울")
  }
  const withinMonths = text.match(/(\d{1,2})\s*개월\s*이내/)
  if (withinMonths) {
    const months = Number(withinMonths[1])
    const end = new Date(Date.UTC(today.year, today.month - 1 + months, today.day))
    return { startDate: toIsoDate(today.year, today.month, today.day), endDate: isoFromDate(end) }
  }
  return null
}

export function rangesOverlap(left: V3DateRange, right: V3DateRange): boolean {
  return left.startDate <= right.endDate && right.startDate <= left.endDate
}

export function isoToday(now = new Date()): string {
  const parts = utcDateParts(now)
  return toIsoDate(parts.year, parts.month, parts.day)
}

function extractExactDates(text: string): readonly string[] {
  const values: string[] = []
  const pattern = /(20\d{2})\s*(?:[.\-/]|년\s*)(\d{1,2})\s*(?:[.\-/]|월\s*)(\d{1,2})\s*일?/g
  for (const match of text.matchAll(pattern)) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (isValidDate(year, month, day)) values.push(toIsoDate(year, month, day))
  }
  return values
}

function seasonRange(year: number, season: string): V3DateRange {
  if (/겨울|winter/i.test(season)) {
    return { startDate: `${year}-12-01`, endDate: `${year + 1}-02-${daysInMonth(year + 1, 2)}` }
  }
  return { startDate: `${year}-06-01`, endDate: `${year}-08-31` }
}

function monthRange(year: number, month: number): V3DateRange {
  return { startDate: toIsoDate(year, month, 1), endDate: toIsoDate(year, month, daysInMonth(year, month)) }
}

function inferredWeeks(startDate: string, endDate: string): number | null {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.max(1, Math.round(((end - start) / 86_400_000 + 1) / 7))
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return false
  return true
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
}

function isoFromDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function utcDateParts(value: Date): { readonly year: number; readonly month: number; readonly day: number } {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function readRowString(row: CatalogRow, key: string): string | undefined {
  const value = row[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
