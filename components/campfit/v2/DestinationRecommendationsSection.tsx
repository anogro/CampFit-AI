import type { DestinationRecommendationV2 } from "@/types/campfitV2"

type DestinationRecommendationsSectionProps = {
  readonly recommendations: readonly DestinationRecommendationV2[]
}

export function DestinationRecommendationsSection({ recommendations }: DestinationRecommendationsSectionProps) {
  const visible = recommendations.slice(0, 3)
  if (visible.length === 0) return null

  return (
    <section className="grid gap-3">
      <h3 className="text-lg font-bold text-[var(--text-primary)]">검토하기 좋은 도시·지역 방향</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {visible.map((recommendation, index) => (
          <DestinationCard key={`${recommendation.key}-${index}`} recommendation={recommendation} index={index} />
        ))}
      </div>
    </section>
  )
}

function DestinationCard({ recommendation, index }: { readonly recommendation: DestinationRecommendationV2; readonly index: number }) {
  return (
    <article className="apple-glass-soft grid gap-3 rounded-[20px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--accent-primary)]">{index + 1}. {dataQualityLabel(recommendation.dataQuality)}</p>
          <h4 className="mt-1 text-base font-bold text-[var(--text-primary)] [word-break:keep-all]">{recommendation.title}</h4>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary)]">{recommendation.score}점</span>
      </div>
      <p className="line-clamp-3 text-sm font-semibold leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{recommendation.fitLabel}</p>
      <CompactList title="왜 볼 만한가" items={recommendation.whyFits.slice(0, 2)} />
      <CompactList title="확인할 점" items={recommendation.tradeoffs.slice(0, 2)} emphasized />
      <CompactList title="상담 전 확인" items={recommendation.verifyBeforeConsulting.slice(0, 2)} />
      {recommendation.cityPageUrl ? (
        <a className="text-sm font-bold text-[var(--accent-primary)] underline-offset-4 hover:underline" href={recommendation.cityPageUrl}>
          도시 정보 보기
        </a>
      ) : null}
    </article>
  )
}

function CompactList({ title, items, emphasized = false }: { readonly title: string; readonly items: readonly string[]; readonly emphasized?: boolean }) {
  return (
    <div className={`grid gap-1 rounded-lg border border-[var(--border-subtle)] p-3 ${emphasized ? "bg-[var(--surface-tint-yellow)]" : "bg-[var(--surface-primary)]"}`}>
      <p className="text-xs font-bold text-[var(--text-primary)]">{title}</p>
      <ul className="grid gap-1 text-sm leading-6 text-[var(--text-secondary)]">
        {items.map((item, index) => <li key={`${title}-${index}`} className="[word-break:keep-all]">{item}</li>)}
      </ul>
    </div>
  )
}

function dataQualityLabel(value: DestinationRecommendationV2["dataQuality"]): string {
  switch (value) {
    case "city_data":
      return "도시 데이터 기준"
    case "region_inferred":
      return "지역 기준"
    case "fallback_direction":
      return "방향 제안"
    case "needs_verification":
      return "확인 필요"
  }
}
