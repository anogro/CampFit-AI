import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = {
  title: "CampFit",
  description: "아이의 성향과 가족 조건을 바탕으로 첫 해외캠프 선택 방향을 차분히 정리합니다.",
}

type RootLayoutProps = {
  readonly children: React.ReactNode
}

const GA_MEASUREMENT_ID = process.env["NEXT_PUBLIC_GA_MEASUREMENT_ID"]?.trim()
const GA_LINKER_DOMAINS = ["www.anogro.com", "anogro.com", "camp-fit-ai.vercel.app"]

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>
        {GA_MEASUREMENT_ID && /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID) ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="campfit-gtag-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('consent', 'default', { analytics_storage: 'granted' });
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', {
  send_page_view: true,
  linker: { domains: ${JSON.stringify(GA_LINKER_DOMAINS)} }
});`}
            </Script>
          </>
        ) : null}
        {children}
      </body>
    </html>
  )
}
