import type { FitType } from "@/types/campfit"
import { fitTypeLabel } from "@/components/campfit/labels"

type FitTypeBadgeProps = {
  readonly fitType: FitType
}

export function FitTypeBadge({ fitType }: FitTypeBadgeProps) {
  const colorClass = {
    comfort: "border-[var(--status-success)] bg-[var(--accent-soft)] text-[var(--status-success)]",
    stretch: "border-[var(--accent-primary)] bg-[var(--surface-elevated)] text-[var(--accent-primary)]",
    overreach: "border-[var(--status-warning)] bg-[var(--surface-primary)] text-[var(--status-warning)]",
    underchallenge: "border-[var(--text-tertiary)] bg-[var(--surface-primary)] text-[var(--text-secondary)]",
  }[fitType]

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${colorClass}`}>
      {fitTypeLabel(fitType)}
    </span>
  )
}
