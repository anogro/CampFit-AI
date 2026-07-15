export function shouldDiscardStoredCampfitV3Session(
  demoRequested: boolean,
  savedDemoMode: boolean | undefined,
): boolean {
  return (demoRequested && savedDemoMode !== true) || (!demoRequested && savedDemoMode === true)
}
