import type { FitType } from "@/types/campfit"
import { fitTypeLabel } from "@/components/campfit/labels"

type FitTypeBadgeProps = {
  readonly fitType: FitType
}

export function FitTypeBadge({ fitType }: FitTypeBadgeProps) {
  const colorClass = {
    comfort: "border-transparent bg-[var(--surface-tint-green)] text-[var(--status-success)]",
    stretch: "border-transparent bg-[var(--surface-tint-blue)] text-[var(--status-info)]",
    overreach: "border-transparent bg-[var(--surface-tint-yellow)] text-[var(--status-warning)]",
    underchallenge: "border-[var(--text-tertiary)] bg-[var(--surface-primary)] text-[var(--text-secondary)]",
  }[fitType]

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${colorClass}`}>
      {fitTypeLabel(fitType)}
    </span>
  )
}
