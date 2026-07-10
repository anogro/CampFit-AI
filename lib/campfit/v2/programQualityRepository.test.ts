import { describe, expect, it, vi } from "vitest"

const { from } = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock("server-only", () => ({}))

vi.mock("@/lib/campfit/supabaseServer", () => ({
  createServerSupabaseClient: () => ({ from }),
}))

import { loadActiveScoringVersion } from "@/lib/campfit/v2/programQualityRepository"

describe("loadActiveScoringVersion", () => {
  it("loads the persisted configuration needed for deterministic scoring", async () => {
    const version = {
      id: "00000000-0000-0000-0000-000000000001",
      version_key: "campfit_quality_v1_shadow",
      status: "shadow",
      prior_score: 60,
      confidence_weights: { evidenceVolume: 0.2, sourceDiversity: 0.2, sourceAuthority: 0.2, recency: 0.15, dimensionCoverage: 0.15, agreement: 0.1 },
      dimension_weights: { care_emotional_support: 0.12, staff_management: 0.1, safety_emergency: 0.14, parent_communication: 0.09, english_environment: 0.1, beginner_support: 0.09, teaching_quality: 0.1, living_support: 0.1, cost_transparency: 0.08, advertising_consistency: 0.08 },
      public_visibility_rules: { confidenceThreshold: 50, minimumDimensionCoverage: 6, minimumIndependentSourceCount: 1 },
      rule_config: { providerOnlyConfidenceCap: 30, providerOnlyPositivePriorAdjustmentCap: 5, evidenceVolumeSaturationCount: 6, recencyHalfLifeDays: 365, sourceAuthorityWeights: { provider_claim: 0.2, provider_official_document: 0.45, partner_verified_document: 0.7, public_official_page: 0.55, independent_review: 0.5, verified_parent_review: 0.8, campfit_post_program_survey: 0.9, consultation_feedback: 0.65, official_incident_record: 1, manual_audit: 0.95, legacy_program_verification: 0.7 } },
      created_at: "2026-07-11T00:00:00.000Z",
      activated_at: "2026-07-11T00:00:00.000Z",
      retired_at: null,
    }
    let selectedColumns = ""
    const query = {
      in: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: () => Promise.resolve({
        data: selectedColumns.includes("confidence_weights") ? version : {
          id: version.id,
          version_key: version.version_key,
          status: version.status,
          prior_score: version.prior_score,
          created_at: version.created_at,
        },
        error: null,
      }),
    }
    from.mockReturnValue({
      select: (columns: string) => {
        selectedColumns = columns
        return query
      },
    })

    const result = await loadActiveScoringVersion()

    expect(result?.confidenceWeights.evidenceVolume).toBe(0.2)
    expect(result?.dimensionWeights.safety_emergency).toBe(0.14)
  })
})
