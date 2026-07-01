"use client"

import { MessageCircle } from "lucide-react"
import type { z } from "zod"
import type { RecommendationResultSchema } from "@/schemas/campfit/campfitSchemas"
import { RecommendationProgramCard } from "@/components/campfit/RecommendationProgramCard"
import { ResultVisualSummary } from "@/components/campfit/ResultVisualSummary"

type RecommendationResultView = z.infer<typeof RecommendationResultSchema>

type RecommendationDashboardProps = {
  readonly result: RecommendationResultView
  readonly onFeedback: (feedback: "good_fit" | "different" | "unsure" | "consultation_requested", campId?: string) => void
  readonly feedbackStatus: string
}

export function RecommendationDashboard({ result, onFeedback, feedbackStatus }: RecommendationDashboardProps) {
  const cityRecommendations = summarizeCities(result)

  return (
    <div className="grid gap-6">
      <ResultVisualSummary result={result} />

      {result.noCandidateMessage ? (
        <section className="rounded-[24px] border border-[rgb(255_204_0_/_0.32)] bg-[rgb(255_204_0_/_0.12)] p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <p className="font-semibold leading-7 text-[var(--status-warning)] [word-break:keep-all]">{result.noCandidateMessage}</p>
        </section>
      ) : null}

      {cityRecommendations.length > 0 ? (
        <section className="apple-glass rounded-[28px] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--accent-primary)]">도시 추천</p>
              <h3 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
                먼저 체류 도시와 생활 방식을 비교해 보세요.
              </h3>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
              같은 캠프라도 도시, 이동거리, 부모 동반 방식, 생활 관리 강도에 따라 체감 난이도가 달라집니다.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {cityRecommendations.map((city, index) => (
              <CityCard key={`${city.country}-${city.city}`} city={city} rank={index + 1} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--accent-primary)]">프로그램 후보</p>
            <h3 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
              도시 방향에 맞는 실제 프로그램입니다.
            </h3>
          </div>
        </div>
        {result.recommendations.map((recommendation, index) => (
          <RecommendationProgramCard
            key={recommendation.camp.id}
            recommendation={recommendation}
            rank={index + 1}
            onFeedback={onFeedback}
          />
        ))}
      </div>

      <section className="apple-glass-soft rounded-[24px] p-5">
        <div className="flex items-center gap-2">
          <MessageCircle size={19} aria-hidden="true" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">추천 피드백</h3>
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

type CitySummary = {
  readonly country: string
  readonly city: string
  readonly averageScore: number
  readonly topProgram: string
  readonly traits: readonly string[]
  readonly count: number
}

function summarizeCities(result: RecommendationResultView): readonly CitySummary[] {
  const grouped = new Map<string, RecommendationResultView["recommendations"]>()
  for (const recommendation of result.recommendations) {
    const key = `${recommendation.camp.country}|${recommendation.camp.city}`
    grouped.set(key, [...(grouped.get(key) ?? []), recommendation])
  }

  return Array.from(grouped.entries())
    .map(([key, recommendations]) => {
      const [country = "", city = ""] = key.split("|")
      const score = Math.round(
        recommendations.reduce((sum, recommendation) => sum + recommendation.score, 0) / recommendations.length,
      )
      const topProgram = recommendations.sort((left, right) => right.score - left.score)[0]?.camp.name ?? "프로그램 확인 필요"
      const traits = [...new Set(recommendations.flatMap((recommendation) => recommendation.camp.traits))].slice(0, 4)
      return { country, city, averageScore: score, topProgram, traits, count: recommendations.length }
    })
    .sort((left, right) => right.averageScore - left.averageScore)
    .slice(0, 3)
}

function CityCard({ city, rank }: { readonly city: CitySummary; readonly rank: number }) {
  return (
    <article
      className={[
        "rounded-[24px] border p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl",
        rank === 1
          ? "border-[var(--accent-primary)] bg-[var(--surface-tint-blue)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-glass)]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="apple-pill bg-[var(--text-primary)] px-3 py-1 text-xs font-semibold text-white">{rank}순위</span>
        <span className="text-sm font-bold tabular-nums text-[var(--accent-primary)]">{city.averageScore}점</span>
      </div>
      <h4 className="mt-4 text-lg font-bold text-[var(--text-primary)] [word-break:keep-all]">
        {city.city}, {city.country}
      </h4>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
        대표 후보: {city.topProgram}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {city.traits.map((trait) => (
          <span key={trait} className="apple-pill bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {trait}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-[var(--text-tertiary)]">
        추천 프로그램 {city.count}개 기준
      </p>
    </article>
  )
}

function FeedbackButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button
      className="apple-pill min-h-11 border border-[var(--border-default)] bg-[var(--surface-glass)] px-5 font-semibold text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-tint-blue)] active:scale-[0.98]"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
