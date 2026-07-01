const { createClient } = require("@supabase/supabase-js")
const fs = require("fs")

const durations = ["1w", "2w", "3_4w", "over_4w"]
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
}

function readEnv(path) {
  const entries = {}
  if (!fs.existsSync(path)) {
    return entries
  }

  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) {
      entries[match[1]] = match[2]
    }
  }
  return entries
}

function createSupabase() {
  const env = { ...readEnv(".env.local"), ...process.env }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function textBlob(program) {
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
    program.detail_payload ? JSON.stringify(program.detail_payload) : "",
  ]
    .filter((part) => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase()
}

function hasAny(text, needles) {
  return needles.some((needle) => text.includes(needle.toLowerCase()))
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function inferScore(text, base, rules) {
  return clamp01(rules.reduce((score, [needle, delta]) => (text.includes(needle.toLowerCase()) ? score + delta : score), base))
}

function inferProgramType(text) {
  if (hasAny(text, ["가족캠프", "부모동반", "parent", "family"])) return "family_esl"
  if (hasAny(text, ["스쿨링", "schooling", "international school", "정규수업"])) return "schooling"
  if (hasAny(text, ["steam", "maker", "창의", "요리", "미술", "enrichment", "workshop"])) return "creative_daycamp"
  if (hasAny(text, ["스포츠", "sports", "activity", "액티비티", "outdoor"])) return "activity"
  if (hasAny(text, ["기숙", "boarding", "international", "global", "아이만"])) return "international_camp"
  return "managed_immersion"
}

function inferAgeRange(program) {
  const text = `${program.target_age || ""} ${program.detailed_description || ""} ${program.duration || ""}`
  const direct = [...text.matchAll(/(?:만\s*)?(\d{1,2})\s*(?:세|세\s*[~-]\s*(?:만\s*)?(\d{1,2})\s*세)/g)][0]
  if (direct) {
    return { min: program.age_min || Number(direct[1]), max: program.age_max || Number(direct[2] || direct[1]) }
  }

  const elementary = text.match(/초등(?:학교)?\s*(\d)\s*학년|초\s*(\d)/)
  const middle = text.match(/중(?:학교)?\s*(\d)\s*학년|중\s*(\d)/)
  const high = /고등|고등학생/.test(text)
  const minFromGrade = elementary ? 6 + Number(elementary[1] || elementary[2]) : undefined
  const maxFromGrade = high ? 17 : middle ? 12 + Number(middle[1] || middle[2]) : undefined
  return { min: program.age_min || minFromGrade || 6, max: program.age_max || maxFromGrade || 17 }
}

function durationBucket(weeks) {
  if (!weeks || weeks < 1) return undefined
  if (weeks <= 1) return "1w"
  if (weeks <= 2) return "2w"
  if (weeks <= 4) return "3_4w"
  return "over_4w"
}

function uniqueDurations(values) {
  return durations.filter((duration) => values.includes(duration))
}

function inferDurationWeeks(program, prices) {
  const fromPrices = uniqueDurations(prices.map((price) => durationBucket(price.duration_weeks)))
  if (fromPrices.length > 0) {
    return fromPrices
  }

  const text = `${program.duration || ""} ${program.duration_options || ""} ${program.minimum_duration || ""}`
  const weeks = [...text.matchAll(/(\d+)\s*(?:주|week)/gi)].map((match) => Number(match[1]))
  const buckets = uniqueDurations(weeks.map(durationBucket))
  return buckets.length ? buckets : durations
}

function convertToKrw(amount, currency) {
  const rate = currencyToKrw[String(currency || "").toUpperCase()]
  return rate ? Math.round(amount * rate) : 0
}

function extractKrwFromText(text) {
  const manwon = text.match(/([\d,.]+)\s*만원/)
  if (manwon && manwon[1]) {
    return Math.round(Number(manwon[1].replace(/,/g, "")) * 10000)
  }

  const krw = text.match(/([\d,]{6,})\s*원/)
  return krw && krw[1] ? Number(krw[1].replace(/,/g, "")) : 0
}

function inferBudgetRange(program, prices) {
  const values = prices
    .filter((price) => price.status !== "inactive" && price.price_value)
    .map((price) => convertToKrw(price.price_value, price.currency))
    .filter((value) => value > 0)
  const explicit = convertToKrw(program.minimum_price_value || 0, program.minimum_price_currency || program.base_price_currency)
  const textValue = extractKrwFromText(`${program.display_price || ""} ${program.price_details || ""}`)
  const allValues = [...values, explicit, textValue].filter((value) => value > 0)
  return allValues.length ? { min: Math.min(...allValues), max: Math.max(...allValues) } : { min: null, max: null }
}

function buildTraits(programType, flags) {
  const labels = {
    managed_immersion: "관리형몰입",
    schooling: "스쿨링",
    family_esl: "가족ESL",
    activity: "액티비티",
    creative_daycamp: "창의데이캠프",
    international_camp: "국제캠프",
  }
  return [
    labels[programType],
    flags.koreanManager ? "한국어케어" : "",
    flags.parentAccompanied ? "가족동반" : "",
    flags.beginnerClass ? "초급지원" : "",
    flags.boarding ? "독립경험" : "",
    flags.lowPressureSpeaking ? "부담낮은노출" : "",
    flags.smallGroupCare ? "세심한관리" : "",
  ]
    .filter(Boolean)
    .slice(0, 5)
}

function buildProfile(program, prices) {
  const text = textBlob(program)
  const programType = inferProgramType(text)
  const parentAccompanied = hasAny(text, ["부모동반", "부모 동반", "가족캠프", "family", "parent", "보호자"])
  const boarding = hasAny(text, ["기숙", "boarding", "dorm", "숙소 포함", "아이만", "child_only"])
  const koreanManager = program.onsite_manager === true || program.local_presence === true || hasAny(text, ["한국어", "한국인", "korean"])
  const beginnerClass = hasAny(text, ["초급", "beginner", "입문", "기초", "young learner"])
  const buddySystem = hasAny(text, ["버디", "buddy", "멘토", "mentor"])
  const dailyParentReport = hasAny(text, ["리포트", "보고", "daily report", "생활 관리", "parent report"])
  const smallGroupCare = hasAny(text, ["소규모", "소그룹", "small group", "1:1", "관리형"]) || koreanManager
  const lowPressureSpeaking = programType === "activity" || programType === "creative_daycamp" || parentAccompanied
  const age = inferAgeRange(program)
  const budget = inferBudgetRange(program, prices)

  return {
    program_id: program.id,
    program_name: program.title || program.name || "이름 미정 프로그램",
    partner_id: program.partner_id || null,
    partner_name: program.host_institution || program.organizer || null,
    country: program.country || program.location_country || null,
    city: program.city || program.location_city || null,
    program_type: programType,
    age_min: age.min,
    age_max: age.max,
    budget_min_krw: budget.min,
    budget_max_krw: budget.max,
    duration_weeks: inferDurationWeeks(program, prices),
    korean_manager: koreanManager,
    parent_accompanied: parentAccompanied,
    korean_dorm_option: boarding && koreanManager,
    beginner_class: beginnerClass,
    buddy_system: buddySystem,
    early_adaptation_support: smallGroupCare || koreanManager,
    daily_parent_report: dailyParentReport,
    low_pressure_speaking_environment: lowPressureSpeaking,
    small_group_care: smallGroupCare,
    english_exposure: inferScore(text, 0.48, [
      ["영어몰입", 0.22],
      ["english", 0.12],
      ["어학", 0.14],
      ["schooling", 0.12],
      ["half-day", -0.12],
    ]),
    boarding_independence: clamp01((boarding ? 0.72 : 0.28) + (parentAccompanied ? -0.24 : 0.08)),
    academic_intensity: inferScore(text, programType === "activity" || programType === "creative_daycamp" ? 0.36 : 0.58, [
      ["집중", 0.16],
      ["어학", 0.14],
      ["cambridge", 0.14],
      ["스포츠", -0.08],
      ["activity", -0.08],
      ["enrichment", -0.1],
    ]),
    foreign_peer_interaction: inferScore(text, 0.52, [
      ["국제", 0.1],
      ["international", 0.1],
      ["현지", 0.1],
      ["local", 0.08],
      ["한국", -0.08],
    ]),
    parent_separation: clamp01((parentAccompanied ? 0.28 : 0.58) + (boarding ? 0.18 : 0)),
    traits: buildTraits(programType, { koreanManager, parentAccompanied, beginnerClass, boarding, lowPressureSpeaking, smallGroupCare }),
    source_snapshot: {
      program,
      price_options: prices,
      inference_note: "Generated by CampFit profile sync from existing program fields. Review and adjust in Supabase if needed.",
    },
    active: true,
  }
}

function groupPrices(rows) {
  const grouped = new Map()
  for (const row of rows) {
    const list = grouped.get(row.program_id) || []
    list.push(row)
    grouped.set(row.program_id, list)
  }
  return grouped
}

async function main() {
  const dryRun = !process.argv.includes("--apply")
  const supabase = createSupabase()
  const { data: programs, error: programError } = await supabase.from("programs").select("*").eq("visible", true).eq("is_listed", true)
  if (programError) throw programError
  const { data: prices, error: priceError } = await supabase.from("program_price_options").select("*")
  if (priceError) throw priceError
  const { data: profiles, error: profileError } = await supabase.from("campfit_program_profiles").select("program_id,active")
  if (profileError) throw profileError

  const existing = new Set((profiles || []).filter((profile) => profile.active === true).map((profile) => profile.program_id))
  const pricesByProgram = groupPrices(prices || [])
  const inserts = (programs || [])
    .filter((program) => !existing.has(program.id))
    .map((program) => buildProfile(program, pricesByProgram.get(program.id) || []))

  console.log(JSON.stringify({ dryRun, insertCount: inserts.length, names: inserts.map((insert) => insert.program_name) }, null, 2))
  if (dryRun || inserts.length === 0) {
    return
  }

  const { error } = await supabase.from("campfit_program_profiles").insert(inserts)
  if (error) throw error
  console.log(`Inserted ${inserts.length} campfit_program_profiles rows.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
