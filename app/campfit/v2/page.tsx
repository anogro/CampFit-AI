import { redirect } from "next/navigation"
import { campfitRedirectPath, type CampfitRouteSearchParams } from "@/app/campfit/redirectToCampfit"

type CampfitV2PageProps = {
  readonly searchParams?: Promise<CampfitRouteSearchParams>
}

export default async function CampfitV2Page({ searchParams }: CampfitV2PageProps) {
  redirect(campfitRedirectPath(await searchParams))
}
