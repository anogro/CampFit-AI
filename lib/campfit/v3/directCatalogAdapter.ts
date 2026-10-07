import type { V3CatalogProgram, V3CatalogSessionVariant } from "@/lib/campfit/v3/catalogRepository"
import { inferDirectionSignals, inferExperienceAssessment, inferParentScope } from "@/lib/campfit/v3/catalogPolicy"

type Row = Readonly<Record<string, unknown>>
export type DirectCatalogFee = {
  readonly amount: number | null; readonly currency: string | null; readonly unit: string | null
  readonly periodWeeks: number | null; readonly priceYear: number | null
  readonly appliesTo: string | null; readonly notes: string | null
}
export type DirectCatalogMetadata = {
  readonly sourceKind: "program" | "school"; readonly sourceId: string; readonly sourceOfferingId?: string
  readonly yearLevels: readonly string[]; readonly minAttendanceWeeks: number | null
  readonly maxAttendanceWeeks: number | null; readonly minPayableWeeks: number | null
  readonly availabilityMode: "enquiry_required" | "session_capacity"; readonly detailPath: string
  readonly fees: readonly DirectCatalogFee[]; readonly verificationNotes: readonly string[]
}
type DirectProgram = V3CatalogProgram & { readonly directCatalog: DirectCatalogMetadata }
const countryNames: Readonly<Record<string, string>> = {
  CA: "Canada", US: "USA", "UNITED STATES": "USA", NZ: "New Zealand", AU: "Australia",
  GB: "UK", "UNITED KINGDOM": "UK", SG: "Singapore", MY: "Malaysia", TH: "Thailand", CH: "Switzerland",
  PH: "Philippines", IE: "Ireland", ES: "Spain", FR: "France", DE: "Germany", IT: "Italy",
  PT: "Portugal", NL: "Netherlands", DK: "Denmark", JP: "Japan", KR: "South Korea",
}
export function canonicalCountry(value: unknown): string {
  const raw = text(value) ?? ""
  return countryNames[raw.toUpperCase()] ?? raw
}

export function mapDirectActivityCatalog(camps: readonly Row[], offerings: readonly Row[], today: string): readonly DirectProgram[] {
  return camps.flatMap((camp) => {
    const sourceId = text(camp["id"])
    if (!sourceId || !text(camp["official_name"]) || !text(camp["city"]) || !text(camp["country_code"])
      || camp["is_published"] !== true || camp["review_status"] !== "verified"
      || camp["visitor_eligibility"] === "no" || camp["direct_registration_status"] === "no") return []
    const allSessions = offerings.filter((row) => row["camp_id"] === sourceId)
    const sessions = allSessions.filter((row) => row["schedule_status"] !== "historical"
      && (!text(row["end_date"] ?? row["season_end"]) || String(row["end_date"] ?? row["season_end"]).slice(0, 10) >= today))
    if (allSessions.length && !sessions.length) return []
    const id = `program:${sourceId}`
    const base = baseProgram(id, camp["official_name"], camp["city"], camp["country_code"], camp, "activity")
    const variants = sessions.map((row) => sessionVariant(row, id, "activity"))
    return [{ ...base,
      imageUrl: text(camp["image_url"]), description: text(camp["summary_ko"]),
      parentScope: { participationMode: "unknown", stayMode: camp["delivery_mode"] === "day_camp" ? "day" : camp["delivery_mode"] === "residential" ? "child_residential" : "unknown", guardianNearbyCompatible: null },
      sessionVariants: variants, hasSessionRows: allSessions.length > 0,
      directCatalog: {
        sourceKind: "program", sourceId, yearLevels: [], minAttendanceWeeks: null, maxAttendanceWeeks: null,
        minPayableWeeks: null, availabilityMode: "session_capacity", detailPath: `/program/local/${encodeURIComponent(sourceId)}`,
        fees: sessions.flatMap((row) => {
          const amount = number(row["price_min"])
          if (amount === null || !text(row["currency"])) return []
          const unit = text(row["price_unit"])
          return [{ amount, currency: text(row["currency"]), unit: unit === "per_week" || unit === "week" ? "per_week" : unit === "per_day" || unit === "day" ? "per_day" : unit,
            periodWeeks: null, priceYear: number(row["price_year"]), appliesTo: text(row["season_label"]) ?? text(row["start_date"]),
            notes: [text(row["price_basis_notes"]), number(row["price_max"]) !== null && number(row["price_max"]) !== amount ? `범위 상한 ${row["price_max"]}` : null].filter(Boolean).join(" · ") || null }]
        }),
        verificationNotes: [
          ...(camp["visitor_eligibility"] !== "yes" ? ["해외 방문 아동의 참가 자격"] : []),
          ...(camp["direct_registration_status"] !== "yes" ? ["운영기관 직접 신청 가능 여부"] : []),
          ...sessions.filter((row) => row["registration_status"] !== "open").map(() => "희망 회차의 접수·잔여석 상태"),
        ],
      },
    }]
  })
}

export function mapDirectSchoolCatalog(schools: readonly Row[], offerings: readonly Row[], sessions: readonly Row[], today: string): readonly DirectProgram[] {
  return schools.flatMap((school) => {
    const sourceId = text(school["id"])
    if (!sourceId || !text(school["name"]) || !text(school["city"]) || !text(school["country"])
      || school["status"] !== "published" || school["short_term_confirmed"] !== true
      || school["direct_registration_confirmed"] !== true || !text(school["verified_at"])) return []
    return offerings.filter((row) => row["school_id"] === sourceId && row["status"] === "published").flatMap((offering) => {
      const sourceOfferingId = text(offering["id"])
      if (!sourceOfferingId || !text(offering["name"])) return []
      const isCamp = ["camp", "day_camp", "family_camp", "residential_camp"].includes(String(offering["offering_type"]))
      const allSessions = sessions.filter((row) => row["offering_id"] === sourceOfferingId && row["status"] === "published")
      const future = allSessions.filter((row) => !text(row["ends_on"]) || String(row["ends_on"]).slice(0, 10) >= today)
      if (isCamp && allSessions.length && !future.length) return []
      const id = `school:${sourceId}:${sourceOfferingId}`
      const name = `${school["name"]} — ${offering["name"]}`
      const facts = { ...offering, age_min: number(offering["age_min"]) ?? number(school["age_min"]), age_max: number(offering["age_max"]) ?? number(school["age_max"]) }
      const base = baseProgram(id, name, school["city"], school["country"], facts, isCamp ? "activity" : "schooling")
      const min = number(offering["min_weeks"]), max = number(offering["max_weeks"])
      if (min !== null && max !== null && min > max) return []
      const durationWeeks = min !== null && max !== null && max >= min
        ? Array.from({ length: 12 }, (_, i) => i + 1).filter((week) => week >= min && week <= max) : []
      const fees = arrayRows(offering["fee_options"]).map((fee): DirectCatalogFee => ({
        amount: number(fee["amount"]), currency: text(fee["currency"]), unit: text(fee["unit"]),
        periodWeeks: number(fee["periodWeeks"]), priceYear: number(fee["priceYear"]), appliesTo: text(fee["appliesTo"]), notes: text(fee["notes"]),
      }))
      if (!fees.length && number(offering["fee_amount"]) !== null) fees.push({ amount: number(offering["fee_amount"]), currency: text(offering["fee_currency"]), unit: null, periodWeeks: null, priceYear: null, appliesTo: null, notes: text(offering["fee_basis"]) })
      const conditions = object(offering["admission_conditions"])
      const conditionLabels: Readonly<Record<string, string>> = { english: "영어 조건", assessment: "평가 조건", visa: "비자 조건", insurance: "보험 조건", applicationLead: "신청 권장 시점", applicationProcess: "신청 절차" }
      const notes = [text(offering["guardian_notes"]), ...Object.entries(conditions).flatMap(([key, value]) => conditionLabels[key] && text(value) ? [`${conditionLabels[key]}: ${text(value)}`] : []),
        ...arrayRows(offering["fee_options"]).flatMap((fee) => {
          const administration = object(fee["administration"])
          const amount = number(administration["amount"]), currency = text(administration["currency"])
          return [
            ...(amount !== null && currency ? [`등록·행정비 ${currency} ${amount}${administration["included"] === true ? " (포함)" : administration["included"] === false ? " (별도)" : " (포함 여부 확인 필요)"}${administration["refundable"] === false ? " · 환불 불가" : ""}`] : []),
            ...strings(fee["extraFees"]), ...(text(fee["refundNotes"]) ? [text(fee["refundNotes"])] : []),
          ]
        }),
      ].filter((v): v is string => !!v)
      return [{ ...base, slug: text(school["slug"]), imageUrl: text(school["image_url"]), description: text(offering["description"]) ?? text(school["summary"]),
        durationWeeks, durationSource: durationWeeks.length ? "profile_or_text" : "unknown",
        parentScope: inferParentScope({ participationText: text(offering["guardian_policy"]) ?? "", accommodationText: offering["regular_class_participation"] === true ? "day program" : "", groupText: "", coverageText: "", nameText: name, profileParentAccompanied: null }),
        sessionVariants: future.map((row) => sessionVariant(row, id, isCamp ? "camp" : "school")),
        hasSessionRows: future.length > 0,
        directCatalog: { sourceKind: "school", sourceId, sourceOfferingId,
          yearLevels: strings(offering["year_levels"]), minAttendanceWeeks: min, maxAttendanceWeeks: max,
          minPayableWeeks: number(offering["minimum_payable_weeks"]), availabilityMode: isCamp ? "session_capacity" : "enquiry_required",
          detailPath: `/schools/${encodeURIComponent(text(school["slug"]) ?? sourceId)}`, fees, verificationNotes: notes },
      }]
    })
  })
}

function sessionVariant(row: Row, programId: string, kind: "activity" | "camp" | "school"): V3CatalogSessionVariant {
  const raw = text(kind === "activity" ? row["registration_status"] : row["availability"])
  const availabilityStatus = kind === "school" ? "needs_inquiry" : raw === "closed" || raw === "cancelled" ? "closed"
    : raw === "open" || raw === "limited" ? "confirmed_available" : "needs_inquiry"
  return { programId, sessionId: text(row["id"]), startDate: text(kind === "activity" ? row["start_date"] ?? row["season_start"] : row["starts_on"]),
    endDate: text(kind === "activity" ? row["end_date"] ?? row["season_end"] : row["ends_on"]), availableDurationWeeks: [],
    availabilityStatus, status: raw, label: text(row["season_label"]), note: text(row["schedule_notes"]),
    source: "program_sessions", evidence: [{ source: kind === "activity" ? "local_activity_camp_offerings" : "school_sessions", value: raw, confidence: "high" }] }
}
function baseProgram(id: string, nameValue: unknown, cityValue: unknown, countryValue: unknown, row: Row, programType: V3CatalogProgram["programType"]): V3CatalogProgram {
  const name = text(nameValue)!, description = text(row["summary_ko"]) ?? text(row["description"]) ?? ""
  const traits = strings(row["activities"])
  const sources = [{ source: "public_catalog", text: [name, description, ...traits].join(" "), confidence: "high" as const }]
  return { id, slug: null, name, city: text(cityValue)!, country: canonicalCountry(countryValue), programType,
    directionSignals: inferDirectionSignals({ profileProgramType: programType, traits, structuredText: description, fallbackText: name }),
    experienceAssessment: inferExperienceAssessment({ profileProgramType: programType, traits, sources }),
    ageMin: number(row["age_min"]), ageMax: number(row["age_max"]), ageSource: number(row["age_min"]) !== null && number(row["age_max"]) !== null ? "program" : "unknown",
    durationWeeks: [], durationSource: "unknown", parentAccompanied: false,
    parentScope: { participationMode: "unknown", stayMode: "unknown", guardianNearbyCompatible: null },
    koreanManager: null, koreanDailySupport: null, koreanEmergencySupport: null, emergencySupport: null,
    beginnerClass: null, earlyAdaptationSupport: null, dailyParentReport: null, traits,
    specialCareSupport: "unknown", budgetMinKrw: null, budgetMaxKrw: null, priceOptions: [], sessionWindows: [],
    hasSessionRows: false, hasScheduledSessionRows: false, sessionStatusNeedsConfirmation: true,
    imageUrl: null, description: description || null, status: "active", catalogSource: "supabase", updatedAt: null }
}
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null }
function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
function strings(value: unknown): readonly string[] { return Array.isArray(value) ? value.filter((v): v is string => !!text(v)) : [] }
function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {} }
function arrayRows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((v) => v && typeof v === "object" && !Array.isArray(v)) : [] }
