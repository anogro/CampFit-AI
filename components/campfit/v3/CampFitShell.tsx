"use client"

import { createContext, useContext, type ReactNode } from "react"

export type CampFitShellMode = "standalone" | "embedded"

const CampFitShellModeContext = createContext<CampFitShellMode>("standalone")

type CampFitShellProps = {
  readonly mode: CampFitShellMode
  readonly children: ReactNode
}

/**
 * Provides one presentation boundary for both direct CampFit visits and a
 * future ANOGRO modal. The flow below this boundary remains the same in both
 * modes; only the outer surface is allowed to change.
 */
export function CampFitShell({ mode, children }: CampFitShellProps) {
  return (
    <CampFitShellModeContext.Provider value={mode}>
      <div
        data-campfit-shell="true"
        data-campfit-mode={mode}
        className={campFitShellClassName(mode)}
      >
        {children}
      </div>
    </CampFitShellModeContext.Provider>
  )
}

export function useCampFitShellMode(): CampFitShellMode {
  return useContext(CampFitShellModeContext)
}

export function campFitShellClassName(mode: CampFitShellMode): string {
  return mode === "embedded"
    ? "min-h-[100dvh] w-full bg-transparent"
    : "min-h-[100dvh] w-full bg-[var(--surface-secondary)]"
}
