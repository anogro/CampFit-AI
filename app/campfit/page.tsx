import type { Metadata } from "next"
import { CampFitShell, type CampFitShellMode } from "@/components/campfit/v3/CampFitShell"
import { CampFitV3Flow } from "@/components/campfit/v3/CampFitV3Flow"

export const metadata: Metadata = {
  title: "CampFit AI 상담형 추천",
  description: "아이의 준비도와 가족 조건을 바탕으로 해외캠프 상담 리포트를 생성합니다.",
}

type CampfitPageProps = {
  readonly searchParams?: Promise<{ readonly embedded?: string | readonly string[] }>
}

export default async function CampfitPage({ searchParams }: CampfitPageProps) {
  const query = await searchParams
  const embedded = Array.isArray(query?.embedded) ? query.embedded[0] : query?.embedded
  const mode: CampFitShellMode = embedded === "1" ? "embedded" : "standalone"

  return (
    <CampFitShell mode={mode}>
      <CampFitV3Flow />
    </CampFitShell>
  )
}
