import type { ParentAnalysis } from "@/types/campfit"

type ParentInsightSummaryProps = {
  readonly analysis: ParentAnalysis
}

export function ParentInsightSummary({ analysis }: ParentInsightSummaryProps) {
  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
        <p className="text-sm font-bold text-[var(--accent-primary)]">부모 유형</p>
        <h3 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{analysis.parentType}</h3>
      </div>
      <div className="grid gap-3">
        {analysis.summaryForParent.map((summary) => (
          <p
            key={summary}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4 text-[var(--text-secondary)]"
          >
            {summary}
          </p>
        ))}
      </div>
      {analysis.detectedTensions.length > 0 ? (
        <div className="rounded-lg border border-[var(--status-warning)] bg-[var(--surface-primary)] p-5 text-[var(--text-primary)]">
          <p className="text-sm font-bold text-[var(--status-warning)]">함께 확인할 지점</p>
          <ul className="mt-3 grid gap-2">
            {analysis.detectedTensions.map((tension) => (
              <li key={tension.description}>{tension.description}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
