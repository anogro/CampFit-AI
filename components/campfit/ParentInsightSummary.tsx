import type { ParentAnalysis } from "@/types/campfit"
import { AiUsageBadge } from "@/components/campfit/AiUsageBadge"

type ParentInsightSummaryProps = {
  readonly analysis: ParentAnalysis
  readonly aiUsed: boolean
}

export function ParentInsightSummary({ analysis, aiUsed }: ParentInsightSummaryProps) {
  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--accent-primary)]">부모 유형</p>
          <AiUsageBadge used={aiUsed} usedLabel="Gemini 분석 사용" fallbackLabel="기본 분석 사용" />
        </div>
        <h3 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
          {analysis.parentType}
        </h3>
      </div>
      <div className="grid gap-3">
        {analysis.summaryForParent.map((summary) => (
          <p
            key={summary}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4 leading-7 text-[var(--text-secondary)] [word-break:keep-all]"
          >
            {summary}
          </p>
        ))}
      </div>
      {analysis.detectedTensions.length > 0 ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-tint-yellow)] p-5 text-[var(--text-primary)]">
          <p className="text-sm font-semibold text-[var(--status-warning)]">함께 확인할 지점</p>
          <ul className="mt-3 grid gap-2 leading-7 [word-break:keep-all]">
            {analysis.detectedTensions.map((tension) => (
              <li key={tension.description}>{tension.description}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
