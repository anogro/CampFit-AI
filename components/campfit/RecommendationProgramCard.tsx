"use client"

import { ChevronDown, Send } from "lucide-react"
import type { z } from "zod"
import type { RecommendationResultSchema } from "@/schemas/campfit/campfitSchemas"
import { FitTypeBadge } from "@/components/campfit/FitTypeBadge"

type RecommendationResultView = z.infer<typeof RecommendationResultSchema>
type RecommendationView = RecommendationResultView["recommendations"][number]

type RecommendationProgramCardProps = {
  readonly recommendation: RecommendationView
  readonly rank: number
  readonly onFeedback: (feedback: "good_fit" | "different" | "unsure" | "consultation_requested", campId?: string) => void
}

const scoreLabels = {
  goalFit: "가족 목표와 맞는 정도",
  supportFit: "아이를 챙겨주는 장치",
  growthPotential: "성장 경험 가능성",
  residualRisk: "피로하거나 부담될 신호",
} as const

export function RecommendationProgramCard({ recommendation, rank, onFeedback }: RecommendationProgramCardProps) {
  const anogroHref = getAnogroProgramHref(recommendation.camp)
  const isTopRecommendation = rank === 1
  const scoreRows = [
    { label: scoreLabels.goalFit, value: recommendation.debugScores.goalFit, tone: "primary" },
    { label: scoreLabels.supportFit, value: recommendation.debugScores.supportFit, tone: "success" },
    { label: scoreLabels.growthPotential, value: recommendation.debugScores.growthPotential, tone: "primary" },
    { label: scoreLabels.residualRisk, value: recommendation.debugScores.residualRisk, tone: "warning" },
  ] as const

  return (
    <article
      className={[
        "apple-glass relative overflow-hidden rounded-[28px] p-5",
        isTopRecommendation ? "ring-4 ring-[var(--accent-soft)]" : "",
      ].join(" ")}
    >
      {isTopRecommendation ? (
        <div className="-mx-5 -mt-5 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-tint-blue)] px-5 py-3">
          <p className="text-sm font-bold text-[var(--accent-primary)] [word-break:keep-all]">가장 먼저 살펴볼 캠프</p>
          <p className="text-xs font-semibold text-[var(--text-secondary)] [word-break:keep-all]">
            입력 조건과 아이 적응 신호를 함께 봤을 때 먼저 확인해볼 만합니다.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "apple-pill px-3 py-1 text-xs font-semibold",
                isTopRecommendation ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--text-primary)] text-white",
              ].join(" ")}
            >
              {rank}순위
            </span>
            <FitTypeBadge fitType={recommendation.fitType} />
            <span className="apple-pill bg-[var(--surface-tint-blue)] px-3 py-1 text-xs font-semibold text-[var(--status-info)]">
              {recommendation.score}점
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
            {recommendation.camp.name}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
            {recommendation.camp.country} · {recommendation.camp.city} · {recommendation.camp.traits.slice(0, 3).join(" / ")}
          </p>
          <p className="mt-4 text-base leading-7 text-[var(--text-primary)] [word-break:keep-all]">
            {summarizeReason(recommendation.explanation.reason)}
          </p>
        </div>

        <div
          className={[
            "rounded-[22px] border p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl",
            isTopRecommendation
              ? "border-[var(--accent-soft)] bg-[var(--surface-tint-blue)]"
              : "border-[var(--border-subtle)] bg-[var(--surface-glass)]",
          ].join(" ")}
        >
          {isTopRecommendation ? (
            <div className="mb-4 rounded-[18px] bg-[var(--surface-glass)] p-3 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">종합 캠프핏 점수</p>
              <p className="mt-1 text-4xl font-bold tracking-[-0.03em] text-[var(--accent-primary)] tabular-nums">
                {recommendation.score}
                <span className="text-base font-semibold text-[var(--text-secondary)]">점</span>
              </p>
            </div>
          ) : null}
          <p className="text-xs font-semibold text-[var(--text-tertiary)]">왜 이 방향이 맞는지</p>
          <div className="mt-3 grid gap-3">
            {scoreRows.map((row) => (
              <ScoreBar key={row.label} label={row.label} value={row.value} tone={row.tone} />
            ))}
          </div>
        </div>
      </div>

      <details className="group mt-5 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-glass)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-[var(--text-primary)]">
          피하면 좋은 점과 상담 질문 보기
          <ChevronDown
            size={18}
            className="shrink-0 transition group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="grid gap-4 border-t border-[var(--border-subtle)] p-4">
          <InfoBlock title="왜 이 방향이 맞는지" body={recommendation.explanation.reason} />
          <InfoBlock title="피하면 좋은 선택지" body={recommendation.explanation.caution} warning />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">다음에 확인할 체크포인트</p>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--text-secondary)]">
              {recommendation.explanation.questionsBeforeConsultation.map((question) => (
                <li key={question} className="flex gap-2 [word-break:keep-all]">
                  <span aria-hidden="true">-</span>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      <a
        href={anogroHref}
        target="_blank"
        rel="noreferrer"
        className="apple-pill glass-cta mt-5 inline-flex min-h-11 items-center gap-2 px-5 text-[15px] font-semibold transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
        onClick={() => onFeedback("consultation_requested", recommendation.camp.id)}
      >
        <Send size={17} className="text-[var(--accent-brand-green)]" aria-hidden="true" />
        ANOGRO에서 상세 보기
      </a>
    </article>
  )
}

function ScoreBar({ label, value, tone }: { readonly label: string; readonly value: number; readonly tone: "primary" | "success" | "warning" }) {
  const percent = Math.round(value * 100)
  const barClass = tone === "warning" ? "bg-[var(--status-warning)]" : tone === "success" ? "bg-[var(--status-success)]" : "bg-[var(--accent-primary)]"

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--text-secondary)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">{percent}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function InfoBlock({ title, body, warning = false }: { readonly title: string; readonly body: string; readonly warning?: boolean }) {
  return (
    <div className={warning ? "rounded-[18px] bg-[var(--surface-tint-yellow)] p-4" : "rounded-[18px] bg-[var(--surface-secondary)] p-4"}>
      <p className={warning ? "font-semibold text-[var(--status-warning)]" : "font-semibold text-[var(--accent-primary)]"}>
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{body}</p>
    </div>
  )
}

function summarizeReason(reason: string): string {
  const [firstSentence] = reason.split(".")
  return firstSentence ? `${firstSentence}.` : reason
}

function getAnogroProgramHref(camp: RecommendationView["camp"]): string {
  const baseUrl = process.env["NEXT_PUBLIC_ANOGRO_SITE_URL"] ?? "https://www.anogro.com"
  const programIdentifier = camp.anogroProgramSlug ?? camp.anogroProgramId

  if (!programIdentifier) {
    return `${baseUrl}/program`
  }

  return `${baseUrl}/program/${encodeURIComponent(programIdentifier)}`
}
