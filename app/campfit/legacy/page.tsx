import { redirect } from "next/navigation"
import { campfitRedirectPath, type CampfitRouteSearchParams } from "@/app/campfit/redirectToCampfit"

type CampfitLegacyPageProps = {
  readonly searchParams?: Promise<CampfitRouteSearchParams>
}

export default async function CampfitLegacyPage({ searchParams }: CampfitLegacyPageProps) {
  redirect(campfitRedirectPath(await searchParams))
}
