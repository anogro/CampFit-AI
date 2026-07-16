import { redirect } from "next/navigation"
import { campfitRedirectPath, type CampfitRouteSearchParams } from "@/app/campfit/redirectToCampfit"

type CampfitV3PageProps = {
  readonly searchParams?: Promise<CampfitRouteSearchParams>
}

export default async function CampfitV3Page({ searchParams }: CampfitV3PageProps) {
  redirect(campfitRedirectPath(await searchParams))
}
