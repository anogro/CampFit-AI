"use client"

import type { ReactNode } from "react"
import { SectionIntro } from "@/components/campfit/v2/V2Controls"
import type { FitScoreAxis, RecommendationCardV2, RecommendationReportV2, RecommendationTier } from "@/types/campfitV2"

type ConsultingReportViewProps = {
  readonly report: RecommendationReportV2
  readonly recommendationRunId: string | null
}

export function ConsultingReportView({ report, recommendationRunId }: ConsultingReportViewProps) {
  const candidates = report.recommendations.slice(0, 3)

  return (
    <section className="grid gap-6" aria-labelledby="campfit-v2-report-title">
      <SectionIntro
        eyebrow="컨설팅 리포트"
        title="추천보다 중요한 건, 지금 무엇을 선택하고 무엇을 조정할지입니다."
        description="점수는 절대 평가가 아니라 현재 입력 조건 기준의 비교용 적합도입니다. 비용은 실제 견적 전까지 상담 전 확인 항목으로 표시합니다."
      />
      {recommendationRunId ? <p className="text-xs font-semibold text-[var(--text-tertiary)]">리포트 번호: {recommendationRunId}</p> : null}

      <ReportSection title="오늘의 결론">
        <p className="text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{report.conclusion}</p>
      </ReportSection>

      <section className="apple-glass-soft grid gap-5 rounded-[24px] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">종합 적합도</h3>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">현재 조건 기준의 비교용 점수입니다.</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[2rem] font-extrabold leading-none text-[var(--accent-primary)]">{report.fitScoreSummary.overallScore}<span className="text-base">점</span></p>
            <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{report.fitScoreSummary.label}</p>
          </div>
        </div>
        <AxisGrid axes={report.fitScoreSummary.axes} />
      </section>

      <ReportSection title="우리 가족에게 맞는 캠프 방식">
        <SimpleList sectionId="program-modes" items={report.recommendedProgramModes} />
      </ReportSection>

      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">우리 가족에게 맞는 선택 방향</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          {report.optionGroups.map((group, index) => (
            <article key={`option-${index}-${group.key}`} className="apple-glass-soft grid gap-3 rounded-[20px] p-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-base font-bold text-[var(--text-primary)] [word-break:keep-all]">{group.title}</h4>
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary)]">{group.score}점</span>
              </div>
              <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{group.fitLabel}</p>
              <CompactList sectionId={`option-match-${group.key}`} title="맞는 점" items={group.matchedPoints.slice(0, 2)} />
              <CompactList sectionId={`option-tradeoff-${group.key}`} title="확인할 점" items={group.tradeoffs.slice(0, 2)} emphasized />
              <p className="rounded-lg bg-[var(--surface-primary)] p-3 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{group.suggestedAction}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">지금 조건에서 먼저 검토해볼 후보</h3>
        {candidates.length > 0 ? (
          <div className="grid gap-4">
            {candidates.map((card, index) => <CandidateCard key={`candidate-${index}-${card.programId}`} card={card} index={index} />)}
          </div>
        ) : (
          <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
            정확히 맞는 후보는 아직 없지만, 위 선택 방향을 기준으로 조건을 조정하면 가까운 후보를 비교해볼 수 있습니다.
          </p>
        )}
      </section>

      <ReportSection title="처음 원했던 방향에서 확인이 필요한 부분">
        <SimpleList sectionId="mismatch-summary" items={uniqueStrings(candidates.flatMap((card) => card.mismatchedConditions)).slice(0, 5)} emptyText="큰 조건 불일치는 아직 선명하게 잡히지 않았습니다." />
      </ReportSection>

      <ReportSection title="조건을 바꾸면 열리는 선택지">
        <SimpleList sectionId="relaxation" items={report.conditionRelaxationSuggestions.slice(0, 5)} />
      </ReportSection>

      <ExcludedSummary report={report} />

      <ReportSection title="상담 전 확인 질문">
        <SimpleList sectionId="consulting-checklist" items={report.consultingChecklist} />
      </ReportSection>
    </section>
  )
}

function CandidateCard({ card, index }: { readonly card: RecommendationCardV2; readonly index: number }) {
  return (
    <article className="apple-glass-soft grid gap-4 rounded-[24px] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--accent-primary)]">{tierLabel(card.tier)}</p>
          <h4 className="text-lg font-bold text-[var(--text-primary)] [word-break:keep-all]">{index + 1}. {card.programName}</h4>
        </div>
        <div className="rounded-full bg-[var(--surface-tint-blue)] px-3 py-1 text-sm font-extrabold text-[var(--accent-primary)]">
          {card.fitScoreSummary.overallScore}점
        </div>
      </div>
      <p className="text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{card.fitSummary}</p>
      <AxisPills axes={card.fitScoreSummary.axes.slice(0, 4)} />
      <div className="grid gap-3 lg:grid-cols-2">
        <CompactList sectionId={`matched-${card.programId}`} title="맞는 조건" items={card.matchedConditions.slice(0, 3)} />
        <CompactList sectionId={`mismatch-${card.programId}`} title="맞지 않는 조건" items={card.mismatchedConditions.slice(0, 3)} emphasized />
      </div>
      <CompactList sectionId={`despite-${card.programId}`} title="그럼에도 검토할 이유" items={[card.recommendDespiteMismatchReason ?? "조건 확인 후 비교할 수 있는 후보입니다."]} />
      <details className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3">
        <summary className="cursor-pointer text-sm font-bold text-[var(--text-primary)]">상담 전 확인할 점 더 보기</summary>
        <SimpleList sectionId={`checklist-${card.programId}`} items={card.consultingChecklist.slice(0, 4)} />
      </details>
    </article>
  )
}

function ExcludedSummary({ report }: { readonly report: RecommendationReportV2 }) {
  const details = report.excludedCandidates.slice(0, 5)
  return (
    <section className="apple-glass-soft grid gap-3 rounded-[24px] p-5">
      <h3 className="text-lg font-bold text-[var(--text-primary)]">제외 후보 요약</h3>
      <SimpleList
        sectionId="excluded-summary"
        items={report.excludedSummaryGroups.map((group) => `${group.label}: ${group.count}개`)}
        emptyText="조건 때문에 크게 제외된 후보는 많지 않습니다."
      />
      {details.length > 0 ? (
        <details className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3">
          <summary className="cursor-pointer text-sm font-bold text-[var(--text-primary)]">제외 후보 상세 보기</summary>
          <div className="mt-3 grid gap-3">
            {details.map((candidate, index) => (
              <article key={`excluded-${index}-${candidate.programId}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">{candidate.programName}</h4>
                <CompactList sectionId={`excluded-reason-${candidate.programId}`} title="제외 이유" items={candidate.excludedReasons.slice(0, 3)} />
                <CompactList sectionId={`excluded-relax-${candidate.programId}`} title="조건을 바꾸면 가능한 방향" items={candidate.conditionRelaxation.slice(0, 2)} />
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

function ReportSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="apple-glass-soft grid gap-3 rounded-[24px] p-5">
      <h3 className="text-lg font-bold text-[var(--text-primary)] [word-break:keep-all]">{title}</h3>
      {children}
    </section>
  )
}

function AxisGrid({ axes }: { readonly axes: readonly FitScoreAxis[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {axes.map((axis, index) => (
        <div key={`axis-${index}-${axis.key}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[var(--text-primary)]">{axis.label}</p>
            <p className="text-sm font-extrabold text-[var(--accent-primary)]">{axis.score}점</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)] [word-break:keep-all]">{axis.comment}</p>
        </div>
      ))}
    </div>
  )
}

function AxisPills({ axes }: { readonly axes: readonly FitScoreAxis[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {axes.map((axis, index) => (
        <div key={`axis-pill-${index}-${axis.key}`} className="flex items-center justify-between rounded-full border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-2 text-xs font-bold">
          <span className="text-[var(--text-secondary)]">{axis.label}</span>
          <span className="text-[var(--accent-primary)]">{axis.score}</span>
        </div>
      ))}
    </div>
  )
}

function CompactList({ sectionId, title, items, emphasized = false }: { readonly sectionId: string; readonly title: string; readonly items: readonly string[]; readonly emphasized?: boolean }) {
  return (
    <div className={`grid gap-2 rounded-lg border border-[var(--border-subtle)] p-3 ${emphasized ? "bg-[var(--surface-tint-yellow)]" : "bg-[var(--surface-primary)]"}`}>
      <p className="text-xs font-bold text-[var(--text-primary)]">{title}</p>
      <SimpleList sectionId={sectionId} items={items} />
    </div>
  )
}

function SimpleList({ sectionId, items, emptyText = "해당 항목은 상담에서 추가 확인이 필요합니다." }: { readonly sectionId: string; readonly items: readonly string[]; readonly emptyText?: string }) {
  return items.length > 0 ? (
    <ul className="grid gap-1 text-sm leading-6 text-[var(--text-secondary)]">
      {items.map((item, index) => <li key={`${sectionId}-${index}`} className="[word-break:keep-all]">{item}</li>)}
    </ul>
  ) : (
    <p className="text-sm leading-6 text-[var(--text-tertiary)] [word-break:keep-all]">{emptyText}</p>
  )
}

function tierLabel(tier: RecommendationTier): string {
  switch (tier) {
    case "best_fit":
      return "가장 적합"
    case "good_with_support":
      return "지원 조건 확인 후 적합"
    case "possible_if_adjusted":
      return "조건을 조정하면 검토 가능"
    case "not_recommended":
      return "지금은 우선순위가 낮음"
  }
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}
