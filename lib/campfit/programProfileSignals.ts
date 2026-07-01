import type { DurationWeeks } from "@/types/campfit"
import type { PriceOptionRow, ProgramRow } from "@/lib/campfit/programCatalogSchemas"
import { clamp01 } from "@/lib/campfit/utils"

export const allDurations: readonly DurationWeeks[] = ["1w", "2w", "3_4w", "over_4w"]

const currencyToKrw = {
  KRW: 1,
  USD: 1400,
  NZD: 850,
  AUD: 900,
  CAD: 1000,
  SGD: 1000,
  THB: 38,
  PHP: 24,
  IDR: 0.085,
  MYR: 300,
} as const

export function textBlob(program: ProgramRow): string {
  const detail = program.detail_payload === null ? "" : JSON.stringify(program.detail_payload)
  return [
    program.name,
    program.title,
    program.subtitle,
    program.program_type,
    program.program_focus,
    program.host_institution,
    program.organizer,
    program.detailed_description,
    program.short_description,
    program.program_languages,
    program.language_level,
    program.group_composition,
    program.parent_participation_type,
    program.accommodation_type,
    program.care_level,
    program.care_types,
    program.coverage_schedule,
    program.languages_supported,
    program.item_accommodation,
    program.item_supervision_support,
    program.items_notes,
    detail,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase()
}

export function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle.toLowerCase()))
}

export function inferScore(text: string, base: number, rules: readonly (readonly [string, number])[]): number {
  return clamp01(rules.reduce((score, [needle, delta]) => (text.includes(needle.toLowerCase()) ? score + delta : score), base))
}

export function inferAgeRange(program: ProgramRow): { readonly min: number; readonly max: number } {
  const text = `${program.target_age ?? ""} ${program.detailed_description ?? ""} ${program.duration ?? ""}`
  const direct = [...text.matchAll(/(?:만\s*)?(\d{1,2})\s*(?:세|세\s*[~-]\s*(?:만\s*)?(\d{1,2})\s*세)/g)]
  const first = direct[0]
  if (first) {
    const min = Number(first[1])
    const max = Number(first[2] ?? first[1])
    return { min: program.age_min ?? min, max: program.age_max ?? max }
  }

  const elementary = text.match(/초등(?:학교)?\s*(\d)\s*학년|초\s*(\d)/)
  const middle = text.match(/중(?:학교)?\s*(\d)\s*학년|중\s*(\d)/)
  const high = /고등|고등학생/.test(text)
  const minFromGrade = elementary ? 6 + Number(elementary[1] ?? elementary[2]) : undefined
  const maxFromGrade = high ? 17 : middle ? 12 + Number(middle[1] ?? middle[2]) : undefined

  return {
    min: program.age_min ?? minFromGrade ?? 6,
    max: program.age_max ?? maxFromGrade ?? 17,
  }
}

export function inferDurationWeeks(program: ProgramRow, prices: readonly PriceOptionRow[]): readonly DurationWeeks[] {
  const fromPrices = uniqueDurations(prices.map((price) => durationBucket(price.duration_weeks)))
  if (fromPrices.length > 0) {
    return fromPrices
  }

  const text = `${program.duration ?? ""} ${program.duration_options ?? ""} ${program.minimum_duration ?? ""}`
  const weeks = [...text.matchAll(/(\d+)\s*(?:주|week)/gi)].map((match) => Number(match[1]))
  const buckets = uniqueDurations(weeks.map(durationBucket))
  return buckets.length ? buckets : allDurations
}

export function inferBudgetRange(
  program: ProgramRow,
  prices: readonly PriceOptionRow[],
): { readonly min: number; readonly max: number } {
  const values = prices
    .filter((price) => price.status !== "inactive" && price.price_value !== null)
    .map((price) => convertToKrw(price.price_value ?? 0, price.currency))
    .filter((value) => value > 0)

  const explicit = convertToKrw(program.minimum_price_value ?? 0, program.minimum_price_currency ?? program.base_price_currency)
  const textValue = extractKrwFromText(`${program.display_price ?? ""} ${program.price_details ?? ""}`)
  const allValues = [...values, explicit, textValue].filter((value) => value > 0)
  if (allValues.length === 0) {
    return { min: 0, max: 99000000 }
  }

  return { min: Math.min(...allValues), max: Math.max(...allValues) }
}

function durationBucket(weeks: number | null | undefined): DurationWeeks | undefined {
  if (!weeks || weeks < 1) return undefined
  if (weeks <= 1) return "1w"
  if (weeks <= 2) return "2w"
  if (weeks <= 4) return "3_4w"
  return "over_4w"
}

function uniqueDurations(values: readonly (DurationWeeks | undefined)[]): readonly DurationWeeks[] {
  return allDurations.filter((duration) => values.includes(duration))
}

function convertToKrw(amount: number, currency: string | null | undefined): number {
  const normalized = currency?.toUpperCase()
  switch (normalized) {
    case "KRW":
      return Math.round(amount * currencyToKrw.KRW)
    case "USD":
      return Math.round(amount * currencyToKrw.USD)
    case "NZD":
      return Math.round(amount * currencyToKrw.NZD)
    case "AUD":
      return Math.round(amount * currencyToKrw.AUD)
    case "CAD":
      return Math.round(amount * currencyToKrw.CAD)
    case "SGD":
      return Math.round(amount * currencyToKrw.SGD)
    case "THB":
      return Math.round(amount * currencyToKrw.THB)
    case "PHP":
      return Math.round(amount * currencyToKrw.PHP)
    case "IDR":
      return Math.round(amount * currencyToKrw.IDR)
    case "MYR":
      return Math.round(amount * currencyToKrw.MYR)
    default:
      return 0
  }
}

function extractKrwFromText(text: string): number {
  const manwon = text.match(/([\d,.]+)\s*만원/)
  const manwonValue = manwon?.[1]
  if (manwonValue) {
    return Math.round(Number(manwonValue.replace(/,/g, "")) * 10000)
  }

  const krw = text.match(/([\d,]{6,})\s*원/)
  const krwValue = krw?.[1]
  return krwValue ? Number(krwValue.replace(/,/g, "")) : 0
}
