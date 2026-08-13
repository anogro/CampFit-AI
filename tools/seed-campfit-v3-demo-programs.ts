import crypto from "node:crypto"
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { demoProgramDefinitions } from "@/data/campfit/v3/demoCatalog"

const batch = process.env["CAMPFIT_DEMO_BATCH"] ?? "campfit-v3-demo-3"
const dryRun = process.argv.includes("--dry-run")

if (!dryRun) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  const envKey = match?.[1]
  const envValue = match?.[2]
  if (envKey && envValue && !process.env[envKey]) process.env[envKey] = envValue.replace(/^['"]|['"]$/g, "")
  }
}

const rows = demoProgramDefinitions.map((program) => {
  const slug = `campfit-demo-${program.id.replace(/^demo-/, "")}`
  const id = deterministicUuid(slug)
  return {
    id,
    slug,
    name: program.name,
    title: program.name,
    subtitle: `CampFit v3 demo · ${program.city}`,
    organizer: "CampFit AI Demo Catalog",
    host_institution: "CampFit AI Demo Catalog",
    program_type: program.programType,
    curriculum_type: null,
    program_focus: null,
    location_city: program.city,
    location_country: program.country,
    city: program.city,
    country: program.country,
    city_slug: program.city.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    age_min: program.ageMin,
    age_max: program.ageMax,
    target_age: `${program.ageMin}-${program.ageMax}`,
    duration_options: program.durations.join(", "),
    duration: program.durations.join(", "),
    minimum_duration: Math.min(...program.durations),
    base_price_currency: "KRW",
    base_price_value: program.priceBaseKrw,
    minimum_price_currency: "KRW",
    minimum_price_value: program.priceBaseKrw,
    minimum_price: program.priceBaseKrw,
    display_price: program.priceBaseKrw,
    currency: "KRW",
    pricing_mode: null,
    short_description: `${program.strengths.join(" ")} ${program.tradeoffs.join(" ")}`,
    detailed_description: `${program.strengths.join(" ")} 실제 일정·가격·운영 여부는 데모 데이터 확인용입니다.`,
    requirements: `연령 ${program.ageMin}-${program.ageMax}세 · ${program.durations.join(", ")}주 선택 가능`,
    parent_participation_type: null,
    accommodation_type: program.accommodations.join(", "),
    language_level: null,
    languages_supported: ["English"],
    emergency_support: true,
    korean_ratio_label: null,
    care_level: null,
    local_presence: null,
    detail_schema_version: 1,
    detail_payload: {
      demo: true,
      demo_batch: batch,
      category: program.category,
      seasons: program.seasons,
      traits: program.traits,
      strengths: program.strengths,
      tradeoffs: program.tradeoffs,
      parentMode: program.parentMode,
      accommodations: program.accommodations,
      koreanSupport: program.koreanSupport,
      beginnerClass: program.beginnerClass,
      earlyAdaptationSupport: program.earlyAdaptationSupport,
      dailyParentReport: program.dailyParentReport,
      specialCareSupport: program.specialCareSupport,
      demoEnglishRequirementLevel: program.englishRequirementLevel,
      demoEnglishRequirementSource: program.englishRequirementSource,
      demoEnglishRequirementText: program.englishRequirementText ?? null,
      demoEnglishRequirementConfidence: program.englishRequirementConfidence,
      demoEnglishRequirementVersion: program.englishRequirementVersion,
      demoEnglishExposure: program.englishExposure,
      demoEnglishFixture: true,
      priceQuality: program.priceQuality,
      packageInclusions: program.packageInclusions,
    },
    status: "active",
    visible: true,
    is_listed: true,
    demo_batch: batch,
    demo_source: "campfit_v3",
  }
})

if (dryRun) {
  console.log(JSON.stringify({ batch, count: rows.length, cities: new Set(rows.map((row) => row.city)).size, sample: rows.slice(0, 2) }, null, 2))
  process.exit(0)
}

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
try {
  const { error } = await supabase.from("campfit_demo_programs").upsert(rows, { onConflict: "slug" })
  if (error) throw error
  console.log(`Seeded ${rows.length} CampFit demo programs in batch ${batch}.`)
} catch (error) {
  const details = error && typeof error === "object"
    ? error as { code?: string; message?: string; details?: string; hint?: string }
    : { message: String(error) }
  console.error(JSON.stringify({
    code: details.code ?? null,
    message: details.message ?? null,
    details: details.details ?? null,
    hint: details.hint ?? null,
  }, null, 2))
  process.exitCode = 1
}

function deterministicUuid(value: string): string {
  const hex = crypto.createHash("sha256").update(value).digest("hex").slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
