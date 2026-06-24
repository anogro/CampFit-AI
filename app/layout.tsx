import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CampFit AI",
  description: "학부모 고민과 캠프 적응도 체크를 바탕으로 해외 영어캠프 Fit을 추천합니다.",
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
