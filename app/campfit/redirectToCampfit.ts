export type CampfitRouteSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>

export function campfitRedirectPath(searchParams?: CampfitRouteSearchParams): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) continue
    if (typeof value !== "string") {
      for (const item of value) query.append(key, item)
    } else {
      query.set(key, value)
    }
  }

  const serialized = query.toString()
  return serialized ? `/campfit?${serialized}` : "/campfit"
}
