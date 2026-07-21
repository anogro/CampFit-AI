import * as React from "react"
import type { ReactNode } from "react"

type CampFitV3FrameProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly contentClassName?: string
}

/**
 * The shared v3 workspace boundary. Every non-landing stage uses the same
 * viewport-sized glass frame as the restored start hero; only the content
 * inside the frame changes between intake, chat, loading, and result.
 */
export function CampFitV3Frame({ children, className = "", contentClassName = "" }: CampFitV3FrameProps) {
  return (
    <main className={`h-dvh w-full overflow-hidden bg-transparent px-3 py-3 sm:px-6 sm:py-6 lg:px-8 ${className}`}>
      <div
        className={`apple-glass campfit-v3-frame-surface mx-auto flex h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-[24px] px-4 py-4 sm:rounded-[32px] sm:px-8 sm:py-7 lg:px-10 ${contentClassName}`}
      >
        {children}
      </div>
    </main>
  )
}

export function V3Header() {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border-default)]">
      <a className="flex items-center gap-2.5" href="https://www.anogro.com/" aria-label="ANOGRO 홈페이지로 이동">
        <img className="h-6 w-auto object-contain" src="/images/Small Logo.png" alt="" />
        <span className="text-lg font-black tracking-[-.03em] text-[#18382a]">ANOGRO</span>
      </a>
      <span className="text-xs font-extrabold text-[var(--accent-primary)] sm:text-sm">CampFit AI</span>
    </header>
  )
}
