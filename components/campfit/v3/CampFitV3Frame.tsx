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
