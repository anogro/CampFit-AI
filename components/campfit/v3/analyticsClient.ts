"use client"

import type { campfitV3AnalyticsEventNames } from "@/lib/campfit/v3/analyticsSchema"

export type CampfitV3AnalyticsEventName = (typeof campfitV3AnalyticsEventNames)[number]
export type CampfitV3AnalyticsMode = "production" | "demo"

export type CampfitV3AnalyticsRecommendation = {
  readonly itemType: "city" | "program"
  readonly itemId: string
  readonly itemNameSnapshot: string
  readonly cityId?: string | null
  readonly cityNameSnapshot?: string | null
  readonly countryNameSnapshot?: string | null
  readonly itemRank: number
}

export type CampfitV3AnalyticsEventInput = {
  readonly eventName: CampfitV3AnalyticsEventName
  readonly mode?: CampfitV3AnalyticsMode
  readonly stage?: string | null
  readonly questionKey?: string | null
  readonly questionIndex?: number | null
  readonly progress?: number | null
  readonly resultId?: string | null
  readonly itemType?: "city" | "program" | null
  readonly itemId?: string | null
  readonly itemNameSnapshot?: string | null
  readonly cityId?: string | null
  readonly cityNameSnapshot?: string | null
  readonly countryNameSnapshot?: string | null
  readonly itemRank?: number | null
  readonly linkTarget?: string | null
  readonly action?: string | null
  readonly answerKind?: "quick_reply" | "free_text" | "edit_basic" | null
  readonly catalogSource?: "supabase" | "demo" | "unavailable" | null
  readonly limitedResult?: boolean | null
  readonly cityRecommendations?: readonly CampfitV3AnalyticsRecommendation[]
  readonly programRecommendations?: readonly CampfitV3AnalyticsRecommendation[]
  readonly metadata?: Readonly<Record<string, string | number | boolean>>
}

const visitStorageKey = "campfit-v3-analytics-visit-id"
const journeyStorageKey = "campfit-v3-analytics-journey-id"
const handoffStorageKey = "campfit-v3-analytics-handoff-id"
const recentEventKeys = new Map<string, number>()
const gaMeasurementId = process.env["NEXT_PUBLIC_GA_MEASUREMENT_ID"]?.trim() ?? ""

type CampfitGaParameters = Record<string, string | number | boolean>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function getCampfitV3AnalyticsVisitId(): string {
  return getOrCreateSessionId(visitStorageKey)
}

export function getCampfitV3AnalyticsJourneyId(): string | null {
  return readSessionValue(journeyStorageKey)
}

export function startCampfitV3AnalyticsJourney(): string {
  const journeyId = createOpaqueUuid()
  writeSessionValue(journeyStorageKey, journeyId)
  return journeyId
}

export function clearCampfitV3AnalyticsJourney(): void {
  removeSessionValue(journeyStorageKey)
}

export function createCampfitV3AnalyticsId(): string {
  return createOpaqueUuid()
}

export function trackCampfitV3AnalyticsEvent(input: CampfitV3AnalyticsEventInput): void {
  if (typeof window === "undefined") return

  if (input.eventName === "campfit_city_clicked" || input.eventName === "campfit_program_clicked") {
    const key = `${input.eventName}:${input.resultId ?? ""}:${input.itemId ?? ""}`
    const now = Date.now()
    const lastSentAt = recentEventKeys.get(key) ?? 0
    if (now - lastSentAt < 1000) return
    recentEventKeys.set(key, now)
  }

  trackCampfitV3GaEvent(input)

  const payload = {
    eventId: createOpaqueUuid(),
    visitId: getCampfitV3AnalyticsVisitId(),
    journeyId: getCampfitV3AnalyticsJourneyId(),
    handoffId: getHandoffId(),
    eventName: input.eventName,
    mode: input.mode ?? getCampfitV3AnalyticsMode(),
    sourceApp: "campfit" as const,
    stage: input.stage ?? null,
    questionKey: input.questionKey ?? null,
    questionIndex: input.questionIndex ?? null,
    progress: input.progress ?? null,
    resultId: input.resultId ?? null,
    itemType: input.itemType ?? null,
    itemId: input.itemId ?? null,
    itemNameSnapshot: input.itemNameSnapshot ?? null,
    cityId: input.cityId ?? null,
    cityNameSnapshot: input.cityNameSnapshot ?? null,
    countryNameSnapshot: input.countryNameSnapshot ?? null,
    itemRank: input.itemRank ?? null,
    linkTarget: input.linkTarget ?? null,
    action: input.action ?? null,
    answerKind: input.answerKind ?? null,
    catalogSource: input.catalogSource ?? null,
    limitedResult: input.limitedResult ?? null,
    cityRecommendations: input.cityRecommendations ?? [],
    programRecommendations: input.programRecommendations ?? [],
    metadata: input.metadata ?? {},
    occurredAt: new Date().toISOString(),
  }

  const body = JSON.stringify(payload)
  const blob = new Blob([body], { type: "application/json" })
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/campfit/v3/analytics", blob)) {
    return
  }

  void fetch("/api/campfit/v3/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

function trackCampfitV3GaEvent(input: CampfitV3AnalyticsEventInput): void {
  if (!gaMeasurementId) return

  const mode = input.mode ?? getCampfitV3AnalyticsMode()
  const eventName = getCampfitGaEventName(input.eventName)
  if (!eventName) return

  const parameters: CampfitGaParameters = {
    mode,
    ...(input.stage ? { stage: input.stage } : {}),
  }

  if (input.progress !== null && input.progress !== undefined) parameters["progress"] = input.progress
  if (input.questionKey) parameters["question_key"] = input.questionKey
  if (input.questionIndex !== null && input.questionIndex !== undefined) parameters["question_index"] = input.questionIndex
  if (input.answerKind) parameters["answer_kind"] = input.answerKind
  if (input.catalogSource) parameters["catalog_source"] = input.catalogSource
  if (input.limitedResult !== null && input.limitedResult !== undefined) parameters["limited_result"] = input.limitedResult

  if (input.eventName === "campfit_recommendation_completed") {
    parameters["city_count"] = input.cityRecommendations?.length ?? 0
    parameters["program_count"] = input.programRecommendations?.length ?? 0
    addTopRecommendationNames(parameters, "city", input.cityRecommendations)
    addTopRecommendationNames(parameters, "program", input.programRecommendations)
  }

  if (input.eventName === "campfit_city_clicked" || input.eventName === "campfit_program_clicked") {
    if (input.itemType) parameters["item_type"] = input.itemType
    if (input.itemNameSnapshot) parameters["item_name"] = input.itemNameSnapshot
    if (input.itemRank !== null && input.itemRank !== undefined) parameters["item_rank"] = input.itemRank
    if (input.linkTarget) parameters["link_target"] = input.linkTarget
  }

  if (input.eventName === "campfit_report_action" && input.action) parameters["action"] = input.action

  const eventArguments = ["event", eventName, { ...parameters, send_to: gaMeasurementId }] as const
  if (typeof window.gtag === "function") {
    window.gtag(...eventArguments)
    return
  }

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(eventArguments)
}

function getCampfitGaEventName(eventName: CampfitV3AnalyticsEventName): string | null {
  switch (eventName) {
    case "campfit_heartbeat":
      return null
    case "campfit_city_clicked":
    case "campfit_program_clicked":
      return "campfit_item_click"
    case "campfit_recommendation_completed":
      return "campfit_recommendation_complete"
    case "campfit_result_viewed":
      return "campfit_result_view"
    case "campfit_question_answered":
      return "campfit_question_progress"
    case "campfit_report_action":
      return "campfit_report_action"
    default:
      return eventName
  }
}

function addTopRecommendationNames(
  parameters: CampfitGaParameters,
  itemType: "city" | "program",
  recommendations: readonly CampfitV3AnalyticsRecommendation[] | undefined,
): void {
  recommendations?.slice(0, 3).forEach((recommendation, index) => {
    parameters[`recommended_${itemType}_${index + 1}`] = recommendation.itemNameSnapshot
  })
}

export function getCampfitV3AnalyticsMode(): CampfitV3AnalyticsMode {
  return new URLSearchParams(window.location.search).get("demo") === "1" ? "demo" : "production"
}

function getHandoffId(): string | null {
  const queryValue = new URLSearchParams(window.location.search).get("handoff_id")
  if (queryValue && isUuid(queryValue)) {
    writeSessionValue(handoffStorageKey, queryValue)
    return queryValue
  }
  return readSessionValue(handoffStorageKey)
}

function getOrCreateSessionId(key: string): string {
  const existing = readSessionValue(key)
  if (existing && isUuid(existing)) return existing
  const created = createOpaqueUuid()
  writeSessionValue(key, created)
  return created
}

function readSessionValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Analytics must never block the CampFit flow when storage is unavailable.
  }
}

function removeSessionValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Analytics must never block the CampFit flow when storage is unavailable.
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function createOpaqueUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
