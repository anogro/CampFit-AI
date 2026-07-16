import type { Metadata } from "next"
import { CampFitV3Flow } from "@/components/campfit/v3/CampFitV3Flow"

export const metadata: Metadata = {
  title: "CampFit AI v3 · 부모동반 해외 교육 상담",
  description: "아이의 경험과 부모의 체류 조건을 대화로 정리해 해외 캠프와 도시 후보를 비교합니다.",
}

export default function CampfitV3Page() {
  return <CampFitV3Flow />
}
