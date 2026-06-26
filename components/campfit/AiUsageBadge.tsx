type AiUsageBadgeProps = {
  readonly used: boolean
  readonly usedLabel: string
  readonly fallbackLabel: string
}

export function AiUsageBadge({ used, usedLabel, fallbackLabel }: AiUsageBadgeProps) {
  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        used
          ? "bg-[var(--surface-tint-green)] text-[var(--status-success)]"
          : "bg-[var(--surface-tint-yellow)] text-[var(--status-warning)]",
      ].join(" ")}
    >
      {used ? usedLabel : fallbackLabel}
    </span>
  )
}
