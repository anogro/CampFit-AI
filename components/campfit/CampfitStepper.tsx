const totalSteps = 5

type CampfitStepperProps = {
  readonly currentStep: number
}

export function CampfitProgress({ currentStep }: CampfitStepperProps) {
  const progress = Math.min(100, Math.max(0, Math.round((currentStep / totalSteps) * 100)))

  return (
    <div className="grid gap-2" aria-label="CampFit 진행률">
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-tertiary)]">
        <span>추천 준비 중</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <div
          className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
