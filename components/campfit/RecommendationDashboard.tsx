"use client"

import { MessageCircle, Send } from "lucide-react"
import type { z } from "zod"
import type { RecommendationResultSchema } from "@/schemas/campfit/campfitSchemas"
import { FitTypeBadge } from "@/components/campfit/FitTypeBadge"
import { readinessLabel } from "@/components/campfit/labels"

type RecommendationResultView = z.infer<typeof RecommendationResultSchema>

type RecommendationDashboardProps = {
  readonly result: RecommendationResultView
  readonly onFeedback: (feedback: "good_fit" | "different" | "unsure" | "consultation_requested", campId?: string) => void
  readonly feedbackStatus: string
}

export function RecommendationDashboard({ result, onFeedback, feedbackStatus }: RecommendationDashboardProps) {
  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
        <p className="text-sm font-bold text-[var(--accent-primary)]">분석 요약</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Metric label="부모 유형" value={result.analysis.parentType} />
          <Metric label="캠프 영어 적응도" value={readinessLabel(result.readiness.overallReadiness)} />
          <Metric label="필요 완충장치" value={`${result.readiness.recommendedSupport.length}개 확인`} />
        </div>
        <div className="mt-5 grid gap-2">
          {result.analysis.summaryForParent.slice(0, 3).map((summary) => (
            <p key={summary} className="text-sm leading-6 text-[var(--text-secondary)]">
              {summary}
            </p>
          ))}
        </div>
      </section>

      {result.noCandidateMessage ? (
        <section className="rounded-lg border border-[var(--status-warning)] bg-[var(--surface-secondary)] p-5">
          <p className="font-bold text-[var(--status-warning)]">{result.noCandidateMessage}</p>
        </section>
      ) : null}

      <div className="grid gap-5">
        {result.recommendations.map((recommendation, index) => (
          <article
            key={recommendation.camp.id}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-5 shadow-[0_24px_70px_rgb(16_32_51_/_0.08)]"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--text-tertiary)]">{index + 1}순위 추천</p>
                <h3 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{recommendation.camp.name}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {recommendation.camp.country} · {recommendation.camp.city} ·{" "}
                  {recommendation.camp.traits.join(" / ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <FitTypeBadge fitType={recommendation.fitType} />
                <span className="rounded-full bg-[var(--surface-elevated)] px-3 py-1 text-sm font-bold text-[var(--accent-primary)]">
                  {recommendation.score}점
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <InfoBlock title="추천 이유" body={recommendation.explanation.reason} />
              <InfoBlock title="주의점" body={recommendation.explanation.caution} warning />
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border-subtle)] p-4">
              <p className="font-bold text-[var(--text-primary)]">상담 전 확인 질문</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--text-secondary)]">
                {recommendation.explanation.questionsBeforeConsultation.map((question) => (
                  <li key={question}>· {question}</li>
                ))}
              </ul>
            </div>

            <button
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 font-bold text-white transition hover:bg-[var(--accent-hover)] active:translate-y-px"
              type="button"
              onClick={() => onFeedback("consultation_requested", recommendation.camp.id)}
            >
              <Send size={17} aria-hidden="true" />
              이 추천 결과로 상담받기
            </button>
          </article>
        ))}
      </div>

      <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-5">
        <div className="flex items-center gap-2">
          <MessageCircle size={19} aria-hidden="true" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">추천 피드백</h3>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <FeedbackButton label="잘 맞아요" onClick={() => onFeedback("good_fit")} />
          <FeedbackButton label="조금 달라요" onClick={() => onFeedback("different")} />
          <FeedbackButton label="잘 모르겠어요" onClick={() => onFeedback("unsure")} />
        </div>
        {feedbackStatus ? <p className="mt-3 text-sm text-[var(--status-success)]">{feedbackStatus}</p> : null}
      </section>
    </div>
  )
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
      <p className="text-xs font-bold text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function InfoBlock({ title, body, warning = false }: { readonly title: string; readonly body: string; readonly warning?: boolean }) {
  return (
    <div
      className={[
        "rounded-lg border p-4",
        warning
          ? "border-[var(--status-warning)] bg-[var(--surface-primary)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-primary)]",
      ].join(" ")}
    >
      <p className={warning ? "font-bold text-[var(--status-warning)]" : "font-bold text-[var(--accent-primary)]"}>
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  )
}

function FeedbackButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button
      className="min-h-11 rounded-lg border border-[var(--border-default)] px-4 font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-elevated)] active:translate-y-px"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
