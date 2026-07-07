import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CampFit",
  description: "아이의 성향과 가족 조건을 바탕으로 첫 해외캠프 선택 방향을 차분히 정리합니다.",
}

type RootLayoutProps = {
  readonly children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
