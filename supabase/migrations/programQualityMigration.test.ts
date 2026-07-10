import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migrationPath = path.join(process.cwd(), "supabase", "migrations", "202607110001_add_program_quality_foundation.sql")

describe("program quality foundation migration", () => {
  it("creates the seven Phase 1A tables with RLS and an idempotent shadow seed", () => {
    const sql = readFileSync(migrationPath, "utf8")

    expect(sql).toContain("program_quality_scoring_versions")
    expect(sql).toContain("program_provider_claims")
    expect(sql).toContain("program_evidence_sources")
    expect(sql).toContain("program_fact_observations")
    expect(sql).toContain("program_quality_scores")
    expect(sql).toContain("program_quality_dimension_scores")
    expect(sql).toContain("program_critical_risk_flags")
    expect(sql).toContain("enable row level security")
    expect(sql).toContain("campfit_quality_v1_shadow")
    expect(sql).toContain("on conflict (version_key) do nothing")
    expect(sql).not.toMatch(/\b(?:drop|truncate)\s+(?:table|schema)/i)
  })
})
