import type { Metadata } from "next"
import { CampFitV2Flow } from "@/components/campfit/v2/CampFitV2Flow"

export const metadata: Metadata = {
  title: "CampFit AI 상담형 추천",
  description: "아이의 준비도와 가족 조건을 바탕으로 해외캠프 상담 리포트를 생성합니다.",
}

export default function CampfitPage() {
  return <CampFitV2Flow />
}
