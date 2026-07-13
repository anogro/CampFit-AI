import type { Metadata } from "next"
import { CampFitV3Flow } from "@/components/campfit/v3/CampFitV3Flow"

export const metadata: Metadata = {
  title: "CampFit AI v3 · 부모동반 해외 교육 상담",
  description: "가족의 조건을 대화로 정리하고 현재 살펴볼 도시와 프로그램 후보를 안내합니다.",
}

export default function CampfitV3Page() {
  return <CampFitV3Flow />
}
