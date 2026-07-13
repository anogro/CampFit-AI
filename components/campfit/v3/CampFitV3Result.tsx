"use client"

import { V3Header } from "@/components/campfit/v3/CampFitV3Flow"
import type { CampfitV3DestinationRecommendation, CampfitV3ProgramCandidate, CampfitV3RecommendationResult } from "@/types/campfitV3"

export function CampFitV3Result({ result, onRestart }: { readonly result: CampfitV3RecommendationResult; readonly onRestart: () => void }) {
  const primary = result.experienceDirections[0]
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1280px] px-4 py-4 sm:px-6 lg:px-10">
      <V3Header />
      <div className="mx-auto max-w-[1120px] py-7 sm:py-10">
        <section className="apple-glass rounded-[28px] p-5 sm:p-8">
          <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">CAMPFIT AI CONSULTING NOTE</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.035em] sm:text-4xl">오늘의 상담 결론</h1>
          <p className="mt-5 max-w-4xl text-base font-medium leading-8 text-[var(--text-secondary)] [word-break:keep-all] sm:text-lg">{result.consultingConclusion}</p>
          {result.limitedResult ? <p className="mt-4 rounded-2xl bg-[var(--surface-tint-yellow)] px-4 py-3 text-sm leading-6 text-[var(--status-warning)]">현재 확인된 프로그램 수가 적어 조건과 도시 방향을 중심으로 정리했습니다. 없는 후보를 임의로 만들지 않았어요.</p> : null}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
          <div className="apple-glass-soft flex flex-col items-center rounded-[24px] p-6 text-center">
            <h2 className="text-sm font-extrabold text-[var(--text-secondary)]">가장 잘 맞는 경험 방향</h2>
            <div className="mt-5 grid h-48 w-48 place-items-center bg-[var(--accent-soft)] p-8 [clip-path:polygon(25%_6.7%,75%_6.7%,100%_50%,75%_93.3%,25%_93.3%,0_50%)]">
              <div><p className="text-2xl font-black tracking-[-.03em] text-[var(--accent-primary)]">{primary?.label ?? "조건 확인"}</p><p className="mt-2 text-xs font-bold text-[var(--text-secondary)]">{primary?.fitLabel ?? "확인 중"}</p></div>
            </div>
          </div>
          <div className="apple-glass-soft rounded-[24px] p-6">
            <h2 className="text-xl font-bold">함께 검토할 경험 방향</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.experienceDirections.map((direction) => <article className="rounded-2xl border border-[var(--border-default)] bg-white p-4" key={direction.key}><div className="flex items-start justify-between gap-3"><h3 className="font-extrabold">{direction.label}</h3><span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-primary)]">{direction.fitLabel}</span></div><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{direction.explanation}</p></article>)}
            </div>
          </div>
        </section>

        <Section title="추천 도시" subtitle="서로 다른 역할의 도시를 비교해 선택 폭을 보여드려요.">
          {result.destinationRecommendations.length ? <div className="grid gap-4 md:grid-cols-3">{result.destinationRecommendations.map((city) => <CityCard city={city} key={city.cityId} />)}</div> : <Empty text="현재 조건에서 근거를 확인할 수 있는 도시가 없습니다." />}
        </Section>

        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <ListCard title="꼭 필요한 지원 조건" items={result.requiredSupportConditions} />
          <ListCard title="최종 선택 전 확인사항" items={result.verificationChecklist} />
        </section>

        <Section title="현재 조건에서 살펴볼 프로그램" subtitle="실제 DB에 있는 부모동반형 후보만 표시합니다.">
          {result.programCandidates.length ? <div className="grid gap-4 lg:grid-cols-3">{result.programCandidates.map((program) => <ProgramCard program={program} key={program.programId} />)}</div> : <Empty text="연령·기간·부모동반 조건을 모두 확인할 수 있는 프로그램 후보가 아직 없습니다." />}
        </Section>

        <Section title="조건을 조정하면 가능한 대안">
          <div className="grid gap-3 sm:grid-cols-2">{result.alternatives.map((alternative) => <p className="rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm leading-6" key={alternative}>{alternative}</p>)}</div>
        </Section>

        <div className="mt-8 flex justify-center"><button className="glass-cta min-h-14 rounded-full px-8 text-base font-extrabold" type="button" onClick={onRestart}>다시 상담하기</button></div>
      </div>
    </main>
  )
}

function Section({ title, subtitle, children }: { readonly title: string; readonly subtitle?: string; readonly children: React.ReactNode }) {
  return <section className="mt-7"><div className="mb-4"><h2 className="text-2xl font-bold tracking-[-.025em]">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}</div>{children}</section>
}

function CityCard({ city }: { readonly city: CampfitV3DestinationRecommendation }) {
  return (
    <article className="apple-glass-soft overflow-hidden rounded-[22px]">
      {city.imageUrl ? <img className="h-36 w-full object-cover" src={city.imageUrl} alt="" /> : <div className="grid h-36 place-items-center bg-[var(--accent-soft)] text-3xl font-black text-[var(--accent-primary)]">{city.cityName.slice(0, 1)}</div>}
      <div className="p-5"><p className="text-xs font-bold text-[var(--accent-primary)]">{city.role}</p><h3 className="mt-1 text-xl font-black">{city.cityName}</h3><p className="text-sm text-[var(--text-secondary)]">{city.countryName}</p><p className="mt-3 text-sm leading-6">{city.reason}</p><div className="mt-4 rounded-xl bg-white p-3"><p className="text-xs font-bold text-[var(--text-secondary)]">{city.costEstimate.label} · 신뢰도 {confidenceLabel(city.costEstimate.confidence)}</p><p className="mt-1 font-extrabold">{costLabel(city.costEstimate.estimatedTotalMinKrw, city.costEstimate.estimatedTotalMaxKrw)}</p></div>{city.verify.length ? <p className="mt-3 text-xs leading-5 text-[var(--status-warning)]">확인: {city.verify.join(" · ")}</p> : null}</div>
    </article>
  )
}

function ProgramCard({ program }: { readonly program: CampfitV3ProgramCandidate }) {
  return (
    <article className="apple-glass-soft flex flex-col overflow-hidden rounded-[22px]">
      {program.imageUrl ? <img className="h-40 w-full object-cover" src={program.imageUrl} alt="" /> : <div className="grid h-40 place-items-center bg-[var(--surface-secondary)] text-2xl font-black text-[var(--accent-primary)]">CampFit</div>}
      <div className="flex flex-1 flex-col p-5"><span className="self-start rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-bold text-[var(--accent-primary)]">{program.group}</span><h3 className="mt-3 text-lg font-black leading-6">{program.name}</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{program.cityName}, {program.countryName}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-secondary)]"><span>{program.ageLabel}</span><span>·</span><span>{program.durationLabel}</span><span>·</span><span>{program.priceLabel}</span></div><p className="mt-4 text-sm leading-6">{program.reason}</p>{program.verify.length ? <p className="mt-3 text-xs leading-5 text-[var(--status-warning)]">확인: {program.verify.join(" · ")}</p> : null}{program.detailUrl ? <a className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-default)] bg-white px-4 text-sm font-bold" href={program.detailUrl}>상세 정보 보기</a> : null}</div>
    </article>
  )
}

function ListCard({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return <article className="apple-glass-soft rounded-[22px] p-5 sm:p-6"><h2 className="text-xl font-bold">{title}</h2><ul className="mt-4 space-y-3">{items.map((item) => <li className="flex gap-3 text-sm leading-6" key={item}><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-primary)]">✓</span><span>{item}</span></li>)}</ul></article>
}

function Empty({ text }: { readonly text: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-white px-5 py-8 text-center text-sm text-[var(--text-secondary)]">{text}</div>
}

function costLabel(min: number | null, max: number | null): string {
  if (min === null || max === null) return "일부 비용 확인 필요"
  return `${Math.round(min / 10_000).toLocaleString("ko-KR")}만~${Math.round(max / 10_000).toLocaleString("ko-KR")}만 원`
}

function confidenceLabel(value: "low" | "medium" | "high"): string {
  return value === "high" ? "높음" : value === "medium" ? "보통" : "낮음"
}
