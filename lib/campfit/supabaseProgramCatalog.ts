import { z } from "zod"
import { camps as fallbackCamps } from "@/data/campfit/camps"
import {
  PriceOptionRowSchema,
  ProgramProfileRowSchema,
  ProgramRowSchema,
  type PriceOptionRow,
  type ProgramProfileRow,
  type ProgramRow,
} from "@/lib/campfit/programCatalogSchemas"
import { buildCampFromCatalog } from "@/lib/campfit/programProfileInference"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import type { Camp } from "@/types/campfit"

const programSelect = [
  "id",
  "name",
  "title",
  "slug",
  "program_type",
  "program_focus",
  "host_institution",
  "organizer",
  "detailed_description",
  "short_description",
  "subtitle",
  "price_details",
  "display_price",
  "minimum_price",
  "minimum_price_currency",
  "minimum_price_value",
  "base_price_currency",
  "base_price_value",
  "location_country",
  "location_city",
  "country",
  "city",
  "target_age",
  "age_min",
  "age_max",
  "duration",
  "duration_options",
  "minimum_duration",
  "program_languages",
  "language_level",
  "group_composition",
  "parent_participation_type",
  "accommodation_type",
  "care_level",
  "care_types",
  "local_presence",
  "coverage_schedule",
  "emergency_support",
  "languages_supported",
  "onsite_manager",
  "local_meeting_available",
  "item_accommodation",
  "item_supervision_support",
  "item_transportation",
  "item_education_program",
  "items_notes",
  "not_included",
  "detail_payload",
  "status",
  "visible",
  "is_listed",
].join(",")

export async function loadCampfitProgramCatalog(): Promise<readonly Camp[]> {
  const client = createServerSupabaseClient()
  if (client === null) {
    return fallbackCamps
  }

  const [programs, priceOptions, profiles] = await Promise.all([
    loadRows(client.from("programs").select(programSelect), ProgramRowSchema.array(), "programs"),
    loadRows(client.from("program_price_options").select("program_id,duration_weeks,currency,price_value,status"), PriceOptionRowSchema.array(), "program_price_options"),
    loadRows(client.from("campfit_program_profiles").select("*"), ProgramProfileRowSchema.array(), "campfit_program_profiles"),
  ])

  if (programs.length === 0) {
    return fallbackCamps
  }

  const pricesByProgram = groupByProgramId(priceOptions)
  const profilesByProgram = new Map(profiles.filter((profile) => profile.active === true).map((profile) => [profile.program_id, profile]))
  const catalog = programs
    .map((program) =>
      buildCampFromCatalog({
        program,
        prices: pricesByProgram.get(program.id) ?? [],
        profile: profilesByProgram.get(program.id),
      }),
    )
    .filter((camp): camp is Camp => camp !== null)

  return catalog.length ? catalog : fallbackCamps
}

async function loadRows<T>(
  query: PromiseLike<{ readonly data: unknown; readonly error: { readonly message: string } | null }>,
  schema: z.ZodType<readonly T[]>,
  label: string,
): Promise<readonly T[]> {
  const { data, error } = await query
  if (error) {
    console.error(`Supabase ${label} load failed`, error.message)
    return []
  }

  const parsed = schema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(`Supabase ${label} parse failed`)
    return []
  }
  return parsed.data
}

function groupByProgramId(rows: readonly PriceOptionRow[]): ReadonlyMap<string, readonly PriceOptionRow[]> {
  const grouped = new Map<string, PriceOptionRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.program_id) ?? []
    list.push(row)
    grouped.set(row.program_id, list)
  }
  return grouped
}
