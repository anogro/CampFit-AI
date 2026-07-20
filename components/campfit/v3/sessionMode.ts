export function shouldDiscardStoredCampfitV3Session(
  demoRequested: boolean,
  savedDemoMode: boolean | undefined,
): boolean {
  return (demoRequested && savedDemoMode !== true) || (!demoRequested && savedDemoMode === true)
}

export function shouldRefreshStoredCampfitV3Result(input: {
  readonly demoRequested: boolean
  readonly savedDemoMode: boolean | undefined
  readonly savedStage: string | undefined
  readonly destinationCount: number
  readonly programCount: number
}): boolean {
  return input.demoRequested
    && input.savedDemoMode === true
    && input.savedStage === "result"
    && (input.destinationCount === 0 || input.programCount === 0)
}
