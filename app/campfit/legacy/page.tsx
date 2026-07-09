import type { Metadata } from "next"
import { CampfitFlow } from "@/components/campfit/CampfitFlow"

export const metadata: Metadata = {
  title: "이전 CampFit 버전",
  description: "비교와 롤백을 위해 남겨둔 이전 CampFit 추천 화면입니다.",
}

export default function CampfitLegacyPage() {
  return (
    <div>
      <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 md:px-6 md:pt-8">
        <p className="rounded-md border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
          이전 CampFit 버전
        </p>
      </div>
      <CampfitFlow />
    </div>
  )
}
