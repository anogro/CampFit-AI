import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import { toCityFitProfile } from "@/lib/campfit/v2/cityProfileAdapter"
import type { CityFitProfile } from "@/types/campfitV2"

type SupabaseClient = NonNullable<ReturnType<typeof createServerSupabaseClient>>
type CityRow = z.infer<typeof CityRowSchema>

const CityRowSchema = z.record(z.string(), z.unknown())

export async function loadCityRows(client: SupabaseClient = createRequiredServerClient()): Promise<readonly CityRow[]> {
  const { data, error } = await client.from("Cities").select("*")
  if (error) {
    console.error("CampFit v2 Cities load failed", { code: error.code, message: error.message })
    return []
  }

  const parsed = z.array(CityRowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error("CampFit v2 Cities parse failed")
    return []
  }

  return parsed.data
}

export async function loadCityFitProfiles(): Promise<readonly CityFitProfile[]> {
  const client = createServerSupabaseClient()
  if (client === null) return []
  const rows = await loadCityRows(client)
  return rows.flatMap((row) => {
    const profile = toCityFitProfile(row)
    return profile === null ? [] : [profile]
  })
}

function createRequiredServerClient(): SupabaseClient {
  const client = createServerSupabaseClient()
  if (client === null) {
    throw new MissingSupabaseClientError()
  }
  return client
}

class MissingSupabaseClientError extends Error {
  constructor() {
    super("Supabase server client is not configured.")
    this.name = "MissingSupabaseClientError"
  }
}
