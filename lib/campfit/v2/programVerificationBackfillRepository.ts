import "server-only"

import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import {
  BACKFILL_SCORING_VERSION_COLUMNS,
  BACKFILL_SCORING_VERSION_KEY,
  createProgramVerificationBackfillReadRepository,
  parseProgramVerificationBackfillScoringVersionRow,
  throwProgramVerificationBackfillReadError,
} from "@/lib/campfit/v2/programVerificationBackfillReadCore"
import type {
  BackfillReadExecutor,
  ProgramVerificationBackfillReadRepository,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"
import type { ProgramQualityScoringVersion } from "@/types/campfitProgramQuality"

type SupabaseClient = NonNullable<ReturnType<typeof createServerSupabaseClient>>

export {
  createProgramVerificationBackfillReadRepository,
  findBackfillProgramLinkWarnings,
  ProgramVerificationBackfillReadError,
} from "@/lib/campfit/v2/programVerificationBackfillReadCore"
export type {
  BackfillProgramLinkWarning,
  BackfillProgramQualityDimensionScore,
  BackfillProgramQualityScore,
  BackfillProgramRow,
  BackfillReadExecutor,
  BackfillReadRequest,
  BackfillReadTable,
  LegacyProgramVerificationRow,
  ProgramQualityTableCounts,
  ProgramVerificationBackfillReadRepository,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"

export function createSupabaseProgramVerificationBackfillReadRepository(): ProgramVerificationBackfillReadRepository | null {
  const client = createServerSupabaseClient()
  if (client === null) return null
  return createProgramVerificationBackfillReadRepository(createSupabaseReadExecutor(client))
}

export async function loadSupabaseBackfillScoringVersion(): Promise<ProgramQualityScoringVersion | null> {
  const client = createServerSupabaseClient()
  if (client === null) return null
  const { data, error } = await client
    .from("program_quality_scoring_versions")
    .select(BACKFILL_SCORING_VERSION_COLUMNS)
    .eq("version_key", BACKFILL_SCORING_VERSION_KEY)
    .in("status", ["shadow", "active"])
    .maybeSingle()
  if (error !== null) throwProgramVerificationBackfillReadError("backfill scoring version load", error)
  return parseProgramVerificationBackfillScoringVersionRow(data)
}

function createSupabaseReadExecutor(client: SupabaseClient): BackfillReadExecutor {
  return {
    execute: async (request) => {
      if (request.kind === "count") {
        const { data, count, error } = await client.from(request.table).select(request.columns, {
          count: request.count,
          head: request.head,
        })
        return { data, count, error }
      }

      let query = client.from(request.table).select(request.columns).in(request.filterColumn, request.ids)
      for (const column of request.orderBy) query = query.order(column, { ascending: true })
      const { data, error } = await query
      return { data, error }
    },
  }
}
