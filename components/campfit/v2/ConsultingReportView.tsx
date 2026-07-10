"use client"

import type { ReactNode } from "react"
import { DestinationRecommendationsSection } from "@/components/campfit/v2/DestinationRecommendationsSection"
import { FitRadarChart } from "@/components/campfit/v2/FitRadarChart"
import { SectionIntro } from "@/components/campfit/v2/V2Controls"
import { buildDisplayFitAxes, buildRiskManagementNote, type DisplayFitAxis } from "@/lib/campfit/v2/fitDisplay"
import type { FitScoreAxis, ProgramModeRecommendation, RecommendationCardV2, RecommendationReportV2, RecommendationTier } from "@/types/campfitV2"

type ConsultingReportViewProps = {
  readonly report: RecommendationReportV2
}

export function ConsultingReportView({ report }: ConsultingReportViewProps) {
  const candidates = report.recommendations.slice(0, 3)
  const displayAxes = buildDisplayFitAxes(report.fitScoreSummary.axes)
  const riskManagementNote = buildRiskManagementNote(report.fitScoreSummary.axes)

  return (
    <section className="grid gap-6" aria-labelledby="campfit-v2-report-title">
      <SectionIntro
        eyebrow="컨설팅 리포트"
        title="아이에게 맞는 캠프 방향을 정리했어요"
        description="입력해주신 조건을 기준으로 맞는 방향, 조정할 점, 상담 전 확인할 내용을 함께 정리했습니다."
      />

      <section className="grid gap-3 rounded-lg border border-[var(--border-subtle)] border-l-4 border-l-[var(--accent-primary)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">오늘의 결론</h3>
        <p className="max-w-4xl text-base font-medium leading-7 text-[var(--text-ink)] [word-break:keep-all]">{report.conclusion}</p>
      </section>

      <section className="apple-glass-soft grid gap-6 rounded-lg p-5 md:p-6" aria-labelledby="campfit-fit-summary-title">
        <div className="grid gap-2">
          <div>
            <h3 id="campfit-fit-summary-title" className="text-xl font-bold text-[var(--text-primary)]">현재 입력 기준 적합도</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">아래 점수는 입력해주신 조건을 기준으로 비교한 참고 지표입니다. 실제 비용과 운영 조건은 상담 전 확인이 필요합니다.</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5">
            <p className="text-sm font-bold text-[var(--text-secondary)]">종합 점수</p>
            <p className="text-5xl font-extrabold leading-none tabular-nums text-[var(--accent-primary)]">{report.fitScoreSummary.overallScore}<span className="ml-1 text-lg">점</span></p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{tierLabel(report.fitScoreSummary.tier)}</p>
            <p className="rounded-md bg-[var(--surface-tint-yellow)] px-3 py-2 text-sm leading-6 text-[var(--status-warning)] [word-break:keep-all]">{riskManagementNote}</p>
          </div>
          <FitRadarChart axes={displayAxes} />
        </div>
        <AxisGrid axes={displayAxes} />
      </section>

      <DestinationRecommendationsSection recommendations={report.destinationRecommendations} />

      <ReportSection title="추천 프로그램 방식">
        <ProgramModeCards recommendations={report.programModeRecommendations} />
      </ReportSection>

      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">추천 조합 TOP 3</h3>
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
        <h3 className="text-lg font-bold text-[var(--text-primary)]">현재 조건에서 먼저 검토할 후보</h3>
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

      <ReportSection title="원래 원했던 방향에서 확인할 점">
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
        <CompactList sectionId={`matched-${card.programId}`} title="잘 맞는 점" items={card.matchedConditions.slice(0, 3)} />
        <CompactList sectionId={`mismatch-${card.programId}`} title="확인하거나 조정할 점" items={card.mismatchedConditions.slice(0, 3)} emphasized />
      </div>
      <CompactList sectionId={`despite-${card.programId}`} title="그래도 살펴볼 만한 이유" items={[card.recommendDespiteMismatchReason ?? "조건 확인 후 비교할 수 있는 후보입니다."]} />
      <details className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3">
        <summary className="cursor-pointer text-sm font-bold text-[var(--text-primary)]">상담 전 확인할 점 더 보기</summary>
        <SimpleList sectionId={`checklist-${card.programId}`} items={card.consultingChecklist.slice(0, 4)} />
      </details>
    </article>
  )
}

function ProgramModeCards({ recommendations }: { readonly recommendations: readonly ProgramModeRecommendation[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {recommendations.map((recommendation) => (
        <article key={`program-mode-${recommendation.key}`} className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4 shadow-[var(--shadow-soft)]">
          {recommendation.imagePath ? (
            <img
              src={recommendation.imagePath}
              alt={recommendation.imageAlt}
              className="h-36 w-full rounded-md object-cover"
            />
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-xs font-bold text-[var(--accent-primary)]">{tierLabel(recommendation.tier)}</p>
              <h4 className="text-base font-bold text-[var(--text-primary)] [word-break:keep-all]">{recommendation.title}</h4>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-sm font-extrabold tabular-nums text-[var(--accent-primary)]">{recommendation.score}점</span>
          </div>
          <p className="text-sm font-semibold leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{recommendation.fitLabel}</p>
          <CompactList sectionId={`program-mode-why-${recommendation.key}`} title="잘 맞는 점" items={recommendation.whyFits.slice(0, 2)} />
          <CompactList sectionId={`program-mode-tradeoff-${recommendation.key}`} title="확인하거나 조정할 점" items={recommendation.tradeoffs.slice(0, 2)} emphasized />
          <CompactList sectionId={`program-mode-verify-${recommendation.key}`} title="상담 전 확인할 점" items={recommendation.verifyBeforeConsulting.slice(0, 2)} />
        </article>
      ))}
    </div>
  )
}

function ExcludedSummary({ report }: { readonly report: RecommendationReportV2 }) {
  const details = report.excludedCandidates.slice(0, 5)
  return (
    <section className="apple-glass-soft grid gap-3 rounded-[24px] p-5">
      <h3 className="text-lg font-bold text-[var(--text-primary)]">이번 조건에서 뒤로 미룬 후보</h3>
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

function AxisGrid({ axes }: { readonly axes: readonly DisplayFitAxis[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {axes.map((axis, index) => (
        <div key={`axis-${index}-${axis.label}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3">
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
      return "우선 검토"
    case "good_with_support":
      return "지원장치가 있으면 적합"
    case "possible_if_adjusted":
      return "조건 조정 후 검토"
    case "not_recommended":
      return "현재 조건에서는 비추천"
  }
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}
