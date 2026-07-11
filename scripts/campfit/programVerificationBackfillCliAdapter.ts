import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  BackfillReadExecutor,
  ProgramVerificationBackfillReadRepository,
} from "@/lib/campfit/v2/programVerificationBackfillContracts"
import {
  BACKFILL_SCORING_VERSION_COLUMNS,
  BACKFILL_SCORING_VERSION_KEY,
  createProgramVerificationBackfillReadRepository,
  parseProgramVerificationBackfillScoringVersionRow,
  throwProgramVerificationBackfillReadError,
} from "@/lib/campfit/v2/programVerificationBackfillReadCore"
import type { ProgramQualityScoringVersion } from "@/types/campfitProgramQuality"

export interface ProgramVerificationBackfillCliAdapter {
  readonly readRepository: ProgramVerificationBackfillReadRepository
  readonly loadScoringVersion: () => Promise<ProgramQualityScoringVersion>
}

type CliEnvironment = Readonly<Record<string, string | undefined>>

interface CliSupabaseConfiguration {
  readonly url: string
  readonly serviceRoleKey: string
}

export function createProgramVerificationBackfillCliAdapterFromEnvironment(
  environment: CliEnvironment = process.env,
): ProgramVerificationBackfillCliAdapter | null {
  const configuration = readCliSupabaseConfiguration(environment)
  if (configuration === null) return null
  const client = createClient(configuration.url, configuration.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return createProgramVerificationBackfillCliAdapter(client)
}

function createProgramVerificationBackfillCliAdapter(
  client: SupabaseClient,
): ProgramVerificationBackfillCliAdapter {
  return {
    readRepository: createProgramVerificationBackfillReadRepository(createSupabaseReadExecutor(client)),
    loadScoringVersion: async () => {
      const { data, error } = await client
        .from("program_quality_scoring_versions")
        .select(BACKFILL_SCORING_VERSION_COLUMNS)
        .eq("version_key", BACKFILL_SCORING_VERSION_KEY)
        .in("status", ["shadow", "active"])
        .maybeSingle()
      if (error !== null) throwProgramVerificationBackfillReadError("backfill scoring version load", error)
      return parseProgramVerificationBackfillScoringVersionRow(data)
    },
  }
}

function readCliSupabaseConfiguration(
  environment: CliEnvironment,
): CliSupabaseConfiguration | null {
  const url = environment["NEXT_PUBLIC_SUPABASE_URL"]?.trim()
  const serviceRoleKey = environment["SUPABASE_SERVICE_ROLE_KEY"]?.trim()
  if (!url || !serviceRoleKey) return null
  return { url, serviceRoleKey }
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
