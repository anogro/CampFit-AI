import fs from "node:fs"
import { demoProgramDefinitions, type DemoProgramDefinition } from "@/data/campfit/v3/demoCatalog"
import type { EnglishRequirementLevel } from "@/lib/campfit/v3/englishRequirement"

type JsonRecord = Record<string, unknown>
type DryRunRecord = {
  readonly program_id: string
  readonly program_name: string
  readonly inferred_english_requirement_level?: string
  readonly confidence?: string
  readonly inference_version?: string
  readonly source_snapshot?: JsonRecord
}
type RequirementPlan = {
  readonly programId: string
  readonly programName: string
  readonly level: EnglishRequirementLevel
  readonly confidence: number
  readonly version: string
  readonly reason: string
}
type CurrentProjection = {
  readonly program_id: string
  readonly inferred_english_requirement_level: string | null
  readonly inferred_english_requirement_confidence: number | null
  readonly inferred_english_requirement_version: string | null
}

const ACTUAL_VERSION = "campfit-english-requirement-inference-v0.2"
const DEMO_VERSION = "campfit-v3-demo-english-requirement-v0.2"
const dryRunPath = "tmp-campfit-english-requirement-dry-run-20260811.json"
const args = new Set(process.argv.slice(2))
const applyDemo = args.has("--apply-demo")
const applyProfiles = args.has("--apply-profiles")
const overwriteInferred = args.has("--overwrite-inferred")
const preview = args.has("--preview") || (!applyDemo && !applyProfiles)

if (overwriteInferred && !applyProfiles) {
  throw new Error("--overwrite-inferred requires --apply-profiles")
}

loadEnvFile()

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
}

const actualPlans = readDryRunRecords().map(classifyActualProgram)
const demoPlans = demoProgramDefinitions.map(toDemoPlan)
const currentProfiles = preview || applyProfiles
  ? await getCurrentProfiles(actualPlans.map((plan) => plan.programId))
  : []
const currentDemoRows = preview || applyDemo
  ? await getRows("campfit_demo_programs?select=id,slug,detail_payload&demo_source=eq.campfit_v3&limit=1000")
  : []

if (preview) printPreview(actualPlans, currentProfiles, demoPlans, currentDemoRows)
if (applyProfiles) await patchProfiles(actualPlans, currentProfiles)
if (applyDemo) await patchDemoPayloads(demoPlans, currentDemoRows)

function classifyActualProgram(record: DryRunRecord): RequirementPlan {
  const snapshot = objectValue(record.source_snapshot)
  const profile = objectValue(snapshot["profile"])
  const name = normalize(record.program_name)
  const languageLevel = stringValue(snapshot["language_level"]) ?? ""
  const description = [
    snapshot["short_description_excerpt"],
    snapshot["detailed_description_excerpt"],
    snapshot["requirements"],
    snapshot["item_education_program"],
    snapshot["program_type"],
    snapshot["program_focus"],
    snapshot["group_composition"],
    ...(stringArrayValue(snapshot["session_notes"])),
  ].map(stringValue).filter((value): value is string => value !== null).join(" ")
  const text = normalize([name, languageLevel, description, stringValue(snapshot["program_languages"]), stringValue(snapshot["languages_supported"])].filter(Boolean).join(" "))
  const explicitEnglishText = normalize([name, languageLevel, description].filter(Boolean).join(" "))
  const schoolFormat = /(schooling|regular\s+(?:class|schooling)|summer\s+school|school\s+(?:program|experience|bridge|curriculum)|정규\s*수업|정규\s*학교|스쿨링|학교\s*(?:편입|수업|생활|커리큘럼)|국제학교\s*(?:수업|생활|커리큘럼))/iu.test(text)
  const academicTrack = /(specialist academies\s*[-–—]\s*(?:entrepreneurship|leadership|business|applied sciences)|applied sciences|entrepreneurship and innovation|business and applied|essay|debate|presentation|reading|writing|literacy|mathematics|robotics|science challenges|project(?:s|\s+lab)|탐구\s*수업|정규수업|국제학교\s*커리큘럼|프로젝트|토론(?!토)|발표|에세이|읽기|쓰기|리터러시|수학|로봇|과학)/iu.test(text)
  const activityOnly = /\b(?:sports|football|soccer|tennis|4-h|performing arts|theatre|art|music|outdoor|activity|activities)\b|enrichment\s+(?:day\s+)?camp|스포츠|축구|테니스|예술|공연|체험|문화|자연/iu.test(text)
    && !schoolFormat
    && !academicTrack
  const positiveEnglishSignal = /(english\s*(?:class|lesson|course|program|camp|immersion|in\s*action|&\s*culture)|esl|english\s*(?:and|&|\+)\s*(?:culture|activit)|영어\s*(?:수업|교육|몰입|캠프)|영어\s*[+·]\s*(?:문화|액티비티|활동)|어학|기본\s*영어\s*의사소통|영어\s*학습)/iu.test(explicitEnglishText)
  const negativeEnglishSignal = /(?:영어\s*학습|영어\s*캠프).*(?:아니|아님|아니다|아닌)|not\s+an\s+english(?:-learning)?/iu.test(explicitEnglishText)
  const englishContext = positiveEnglishSignal && !negativeEnglishSignal
  const explicitBeginner = /(beginner|초급|초보)/iu.test(languageLevel)
  const explicitGeneral = /(기본\s*영어\s*의사소통|basic\s*english|영어\s*(?:수업|설명|몰입|캠프)|영어\s*[+·]\s*(?:문화|액티비티|활동)|english\s*(?:class|lesson|course|program|camp|in\s*action|&\s*culture)|esl)/iu.test(explicitEnglishText)
  const activityEnglishSignal = /(기본\s*영어\s*의사소통|영어\s*(?:수업|설명|교육)|영어\s*[+·]\s*(?:문화|액티비티|활동)|english\s*(?:class|lesson|course|program|in\s*action|&\s*culture)|english\s*(?:and|&|\+)\s*(?:culture|activit)|esl)/iu.test(explicitEnglishText)
  const supportedBeginner = readBoolean(profile, "beginner_class")
    || readBoolean(profile, "early_adaptation_support")
    || readBoolean(profile, "low_pressure_speaking_environment")
  const youngLearner = /(young learner|elementary|초등|초[1-6]|유아|아동|만\s*[2-9]|7\s*[-~]\s*12|5\s*[-~]\s*14)/iu.test(text)

  if (schoolFormat || academicTrack) {
    return plan(record, "academic_english", schoolFormat ? 0.9 : 0.75, "학교형 수업 또는 학업형 읽기·쓰기·발표 활동이 명시되어 academic English로 분류")
  }
  if (explicitBeginner && supportedBeginner) {
    return plan(record, "beginner_friendly", 0.9, "초급 수준 표현과 적응·초보자 지원 신호가 함께 확인되어 beginner-friendly로 분류")
  }
  if (explicitBeginner) {
    return plan(record, "beginner_friendly", 0.75, "초급·어린 연령 또는 시범·체험 중심 활동으로 영어 부담이 낮다고 합리적으로 판단")
  }
  if (activityOnly && !activityEnglishSignal) {
    return plan(record, "no_requirement", 0.75, "스포츠·체험·예술 활동 중심이며 영어 학습이나 영어 의사표현이 참가 조건으로 드러나지 않음")
  }
  if (activityOnly && (supportedBeginner || youngLearner)) {
    return plan(record, "beginner_friendly", 0.75, "어린 연령 또는 초보자 지원이 있는 활동 중심 프로그램으로 영어 부담이 낮다고 합리적으로 판단")
  }
  if (explicitGeneral || englishContext) {
    return plan(record, "general_english", explicitGeneral ? 0.9 : 0.75, "영어 수업·영어 진행·영어 협업 참여가 필요하지만 학업형 요건까지는 확인되지 않음")
  }
  if (activityOnly) {
    return plan(record, "beginner_friendly", 0.6, "활동 중심 프로그램으로 보이나 언어 운영 정보가 제한되어 보수적으로 beginner-friendly로 분류")
  }
  if (stringValue(snapshot["program_focus"]) !== null) {
    return plan(record, "general_english", 0.6, "프로그램 설명이 제한적이지만 영어 중심 운영으로 표시되어 general English로 보수적으로 분류")
  }
  return plan(record, "unknown", 0.4, "프로그램 형식과 언어 참여 방식만으로 합리적인 requirement를 판단하기 어려움")
}

function plan(record: DryRunRecord, level: EnglishRequirementLevel, confidence: number, reason: string): RequirementPlan {
  return {
    programId: record.program_id,
    programName: record.program_name,
    level,
    confidence,
    version: ACTUAL_VERSION,
    reason,
  }
}

function toDemoPlan(definition: DemoProgramDefinition): RequirementPlan {
  return {
    programId: definition.id,
    programName: definition.name,
    level: definition.englishRequirementLevel,
    confidence: definition.englishRequirementConfidence,
    version: definition.englishRequirementVersion || DEMO_VERSION,
    reason: definition.englishRequirementText ?? "데모 fixture 분류",
  }
}

async function getCurrentProfiles(ids: readonly string[]): Promise<readonly JsonRecord[]> {
  if (ids.length === 0) return []
  const path = `campfit_program_profiles?select=program_id,inferred_english_requirement_level,inferred_english_requirement_confidence,inferred_english_requirement_version&program_id=in.(${ids.join(",")})`
  return getRows(path)
}

async function patchProfiles(plans: readonly RequirementPlan[], rows: readonly JsonRecord[]): Promise<void> {
  const byId = new Map(rows.map((row) => [stringValue(row["program_id"]), row]))
  let patched = 0
  let skippedMissingProfile = 0
  let skippedExistingProjection = 0
  let skippedUnchanged = 0

  for (const plan of plans) {
    const row = byId.get(plan.programId)
    if (!row) {
      skippedMissingProfile += 1
      continue
    }
    const next = projectionFromPlan(plan)
    const patch = {
      inferred_english_requirement_level: plan.level,
      inferred_english_requirement_confidence: plan.confidence,
      inferred_english_requirement_version: plan.version,
    }
    const current = currentProjection(row)
    if (sameProjection(current, next)) {
      skippedUnchanged += 1
      continue
    }
    if (!overwriteInferred && hasExistingProjection(current)) {
      skippedExistingProjection += 1
      continue
    }
    await patchRow("campfit_program_profiles", plan.programId, patch, "program_id")
    patched += 1
  }

  console.log(JSON.stringify({
    table: "campfit_program_profiles",
    candidates: plans.length,
    patched,
    skippedMissingProfile,
    skippedExistingProjection,
    skippedUnchanged,
    overwriteInferred,
    officialFieldsTouched: false,
    unrelatedFieldsTouched: false,
  }, null, 2))
}

async function patchDemoPayloads(plans: readonly RequirementPlan[], rows: readonly JsonRecord[]): Promise<void> {
  const definitionsBySlug = new Map(demoProgramDefinitions.map((program) => [demoSlug(program.id), program]))
  const plansById = new Map(plans.map((plan) => [plan.programId, plan]))
  let matched = 0
  let patched = 0
  let skipped = 0
  const changedKeys = new Set<string>()

  for (const row of rows) {
    const id = stringValue(row["id"])
    const slug = stringValue(row["slug"])
    const definition = slug ? definitionsBySlug.get(slug) : undefined
    const plan = definition && plansById.get(definition.id)
    if (!id || !definition || !plan) {
      skipped += 1
      continue
    }
    matched += 1
    const previous = objectValue(row["detail_payload"])
    const patch = demoPayload(definition)
    const next = { ...previous, ...patch }
    const rowChangedKeys = Object.keys(patch).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    rowChangedKeys.forEach((key) => changedKeys.add(key))
    if (rowChangedKeys.length === 0) {
      skipped += 1
      continue
    }
    await patchRow("campfit_demo_programs", id, { detail_payload: next })
    patched += 1
  }

  console.log(JSON.stringify({
    table: "campfit_demo_programs",
    candidates: plans.length,
    matched,
    patched,
    skipped,
    changedKeys: [...changedKeys].sort(),
    unrelatedFieldsTouched: false,
  }, null, 2))
}

function printPreview(
  actualPlans: readonly RequirementPlan[],
  currentProfiles: readonly JsonRecord[],
  demoPlans: readonly RequirementPlan[],
  currentDemoRows: readonly JsonRecord[],
): void {
  const actualById = new Map(currentProfiles.map((row) => [stringValue(row["program_id"]), currentProjection(row)]))
  const demoBySlug = new Map(currentDemoRows.map((row) => [stringValue(row["slug"]), objectValue(row["detail_payload"])]))
  const actualRows = actualPlans.map((plan) => {
    const before = actualById.get(plan.programId) ?? null
    return { ...plan, before, after: projectionFromPlan(plan), changedWithOverwrite: before === null || !sameProjection(before, projectionFromPlan(plan)) }
  })
  const demoRows = demoPlans.map((plan) => {
    const definition = demoProgramDefinitions.find((item) => item.id === plan.programId)
    const before = definition ? demoBySlug.get(demoSlug(definition.id)) ?? null : null
    const after = definition ? demoPayload(definition) : null
    return { ...plan, before: before ? pickDemoFields(before) : null, after, changedKeys: after ? Object.keys(after).filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key])) : [] }
  })
  console.log(JSON.stringify({
    version: { actual: ACTUAL_VERSION, demo: DEMO_VERSION },
    actual: { ...summary(actualPlans), currentRows: currentProfiles.length, rows: actualRows },
    demo: { ...summary(demoPlans), currentRows: currentDemoRows.length, rows: demoRows },
    safeguards: { officialFieldsTouched: 0, unrelatedFieldsTouched: 0, overwriteRequiresExplicitFlag: true },
  }, null, 2))
}

function summary(plans: readonly RequirementPlan[]): JsonRecord {
  return {
    total: plans.length,
    taxonomy: countBy(plans, (plan) => plan.level),
    confidence: countBy(plans, (plan) => plan.confidence.toFixed(2)),
    unknownReasons: plans.filter((plan) => plan.level === "unknown").map((plan) => ({ programId: plan.programId, programName: plan.programName, reason: plan.reason })),
    academicPrograms: plans.filter((plan) => plan.level === "academic_english").map((plan) => plan.programName),
    noRequirementPrograms: plans.filter((plan) => plan.level === "no_requirement").map((plan) => plan.programName),
  }
}

function demoPayload(definition: DemoProgramDefinition): JsonRecord {
  return {
    demoEnglishRequirementLevel: definition.englishRequirementLevel,
    demoEnglishRequirementSource: definition.englishRequirementSource,
    demoEnglishRequirementText: definition.englishRequirementText ?? null,
    demoEnglishRequirementConfidence: definition.englishRequirementConfidence,
    demoEnglishRequirementVersion: definition.englishRequirementVersion || DEMO_VERSION,
    demoEnglishExposure: definition.englishExposure,
    demoEnglishFixture: true,
  }
}

function pickDemoFields(payload: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.keys(demoPayload(demoProgramDefinitions[0]!)).map((key) => [key, payload[key] ?? null]))
}

function projectionFromPlan(plan: RequirementPlan): CurrentProjection {
  return {
    program_id: plan.programId,
    inferred_english_requirement_level: plan.level,
    inferred_english_requirement_confidence: plan.confidence,
    inferred_english_requirement_version: plan.version,
  }
}

function currentProjection(row: JsonRecord): CurrentProjection {
  return {
    program_id: stringValue(row["program_id"]) ?? "",
    inferred_english_requirement_level: stringValue(row["inferred_english_requirement_level"]),
    inferred_english_requirement_confidence: numberValue(row["inferred_english_requirement_confidence"]),
    inferred_english_requirement_version: stringValue(row["inferred_english_requirement_version"]),
  }
}

function sameProjection(left: CurrentProjection, right: CurrentProjection): boolean {
  return left.inferred_english_requirement_level === right.inferred_english_requirement_level
    && left.inferred_english_requirement_confidence === right.inferred_english_requirement_confidence
    && left.inferred_english_requirement_version === right.inferred_english_requirement_version
}

function hasExistingProjection(projection: CurrentProjection): boolean {
  return projection.inferred_english_requirement_level !== null
    || projection.inferred_english_requirement_confidence !== null
    || projection.inferred_english_requirement_version !== null
}

async function getRows(path: string): Promise<readonly JsonRecord[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers })
  const body = await response.text()
  if (!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${body}`)
  const parsed = JSON.parse(body) as unknown
  return Array.isArray(parsed) ? parsed.filter((item): item is JsonRecord => typeof item === "object" && item !== null) : []
}

async function patchRow(table: string, id: string, body: JsonRecord, whereColumn = "id"): Promise<void> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${whereColumn}=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`PATCH ${table}/${id} failed (${response.status}): ${await response.text()}`)
}

function readDryRunRecords(): readonly DryRunRecord[] {
  const parsed = JSON.parse(fs.readFileSync(dryRunPath, "utf8")) as { records?: unknown }
  return Array.isArray(parsed.records)
    ? parsed.records.filter((record): record is DryRunRecord => typeof record === "object" && record !== null
      && typeof (record as JsonRecord)["program_id"] === "string"
      && typeof (record as JsonRecord)["program_name"] === "string")
    : []
}

function demoSlug(id: string): string {
  return `campfit-demo-${id.replace(/^demo-/, "")}`
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item)
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

function objectValue(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function stringArrayValue(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function readBoolean(row: JsonRecord, key: string): boolean {
  return row[key] === true
}

function loadEnvFile(): void {
  if (!fs.existsSync(".env.local")) return
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match?.[1] && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}
