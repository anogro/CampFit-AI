import fs from "node:fs"
import { demoProgramDefinitions } from "@/data/campfit/v3/demoCatalog"

type JsonRecord = Record<string, unknown>
type DryRunRecord = {
  readonly program_id: string
  readonly inferred_english_requirement_level: string
  readonly confidence: string
  readonly inference_version: string
}

const applyDemo = process.argv.includes("--apply-demo")
const applyProfiles = process.argv.includes("--apply-profiles")
const dryRunPath = "tmp-campfit-english-requirement-dry-run-20260811.json"
loadEnvFile()

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
}

const highConfidenceRecords = readDryRunRecords().filter((record) => record.confidence === "high"
  && record.inferred_english_requirement_level !== "unknown")

if (applyDemo) await patchDemoPayloads()
if (applyProfiles) await patchHighConfidenceProfiles()
if (!applyDemo && !applyProfiles) {
  console.log(JSON.stringify({
    usage: "vite-node --config vitest.config.ts tools/apply-campfit-english-requirement-projection.ts --apply-demo [--apply-profiles]",
    highConfidenceCandidates: highConfidenceRecords.length,
    note: "No write performed. --apply-profiles requires the migration to have been applied first.",
  }, null, 2))
}

async function patchDemoPayloads(): Promise<void> {
  const rows = await getRows("campfit_demo_programs?select=id,slug,detail_payload&demo_source=eq.campfit_v3&limit=1000")
  const definitionsBySlug = new Map(demoProgramDefinitions.map((program) => [
    `campfit-demo-${program.id.replace(/^demo-/, "")}`,
    program,
  ]))
  let patched = 0
  let skipped = 0
  for (const row of rows) {
    const id = stringValue(row["id"])
    const slug = stringValue(row["slug"])
    const definition = slug ? definitionsBySlug.get(slug) : undefined
    if (!id || !definition) {
      skipped += 1
      continue
    }
    const previous = objectValue(row["detail_payload"])
    const next: JsonRecord = {
      ...previous,
      demoEnglishRequirementLevel: definition.englishRequirementLevel,
      demoEnglishRequirementSource: definition.englishRequirementSource,
      demoEnglishRequirementText: definition.englishRequirementText ?? null,
      demoEnglishRequirementConfidence: 0.95,
      demoEnglishRequirementVersion: "campfit-v3-demo-english-requirement-v1",
      demoEnglishExposure: definition.englishExposure,
      demoEnglishFixture: true,
    }
    if (JSON.stringify(previous) === JSON.stringify(next)) {
      skipped += 1
      continue
    }
    await patchRow("campfit_demo_programs", id, { detail_payload: next })
    patched += 1
  }
  console.log(JSON.stringify({ table: "campfit_demo_programs", matched: rows.length, patched, skipped, existingKeysPreserved: true }, null, 2))
}

async function patchHighConfidenceProfiles(): Promise<void> {
  if (!highConfidenceRecords.length) {
    console.log(JSON.stringify({ table: "campfit_program_profiles", candidates: 0, patched: 0 }, null, 2))
    return
  }
  const ids = highConfidenceRecords.map((record) => record.program_id).join(",")
  const rows = await getRows(`campfit_program_profiles?select=program_id,inferred_english_requirement_level,inferred_english_requirement_confidence,inferred_english_requirement_version&program_id=in.(${encodeURIComponent(ids)})`)
  const byProgramId = new Map(rows.map((row) => [stringValue(row["program_id"]), row]))
  let patched = 0
  let skippedMissingProfile = 0
  let skippedExistingProjection = 0
  for (const record of highConfidenceRecords) {
    const row = byProgramId.get(record.program_id)
    if (!row) {
      skippedMissingProfile += 1
      continue
    }
    if (row["inferred_english_requirement_level"] !== null
      || row["inferred_english_requirement_confidence"] !== null
      || row["inferred_english_requirement_version"] !== null) {
      skippedExistingProjection += 1
      continue
    }
    await patchRow("campfit_program_profiles", record.program_id, {
      inferred_english_requirement_level: record.inferred_english_requirement_level,
      inferred_english_requirement_confidence: 0.95,
      inferred_english_requirement_version: record.inference_version,
    }, "program_id")
    patched += 1
  }
  console.log(JSON.stringify({
    table: "campfit_program_profiles",
    highConfidenceCandidates: highConfidenceRecords.length,
    matchingProfileRows: rows.length,
    patched,
    skippedMissingProfile,
    skippedExistingProjection,
    officialFieldsTouched: false,
  }, null, 2))
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
      && typeof (record as JsonRecord)["inferred_english_requirement_level"] === "string"
      && typeof (record as JsonRecord)["confidence"] === "string"
      && typeof (record as JsonRecord)["inference_version"] === "string")
    : []
}

function objectValue(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function loadEnvFile(): void {
  if (!fs.existsSync(".env.local")) return
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match?.[1] && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}
