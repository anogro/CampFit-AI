"use client"

import { useMemo, useState, type ReactNode } from "react"
import { CampFitV3DecisionRadar } from "@/components/campfit/v3/CampFitV3DecisionRadar"
import { V3Header } from "@/components/campfit/v3/CampFitV3Flow"
import {
  buildAnogroCityHref,
  buildDecisionAxes,
  decisionAxesSummary,
  programCatalogPresentation,
  safeProgramDetailHref,
} from "@/components/campfit/v3/resultPresentation"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3DestinationRecommendation,
  CampfitV3ProgramCandidate,
  CampfitV3RecommendationResult,
} from "@/types/campfitV3"

type CampFitV3ResultProps = {
  readonly result: CampfitV3RecommendationResult
  readonly basicInfo: CampfitV3BasicInfo
  readonly conversationState: CampfitV3ConversationState
  readonly onBack: () => void
  readonly onRestart: () => void
}

export function CampFitV3Result({
  result,
  basicInfo,
  conversationState,
  onBack,
  onRestart,
}: CampFitV3ResultProps) {
  const axes = useMemo(
    () => buildDecisionAxes(result, conversationState, basicInfo),
    [basicInfo, conversationState, result],
  )
  const primaryDirection = result.experienceDirections[0]
  const catalogPresentation = programCatalogPresentation(result.catalogSource)

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1280px] px-4 py-4 print:max-w-none print:bg-white print:px-0 print:py-0 sm:px-6 lg:px-10">
      <V3Header />
      <div className="mx-auto max-w-[1120px] py-7 print:max-w-none print:py-5 sm:py-10">
        <section className="apple-glass rounded-[28px] p-5 print:[break-inside:avoid] print:rounded-none print:shadow-none sm:p-8">
          <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">CAMPFIT AI CONSULTING NOTE</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.035em] [word-break:keep-all] sm:text-4xl">이번 가족에게 가장 잘 맞는 방향</h1>
          {primaryDirection ? (
            <p className="mt-4 text-sm font-extrabold text-[var(--accent-primary)]">
              추천 기준 · {primaryDirection.label}
            </p>
          ) : null}
          <p className="mt-4 max-w-4xl text-base font-medium leading-8 text-[var(--text-secondary)] [word-break:keep-all] sm:text-lg">
            {result.consultingConclusion}
          </p>
          {result.limitedResult && result.catalogSource === "supabase" ? (
            <p className="mt-4 rounded-2xl bg-[var(--surface-tint-yellow)] px-4 py-3 text-sm leading-6 text-[var(--status-warning)] [word-break:keep-all]">
              현재 확인된 프로그램 수가 적어 조건과 도시 방향을 중심으로 정리했습니다. 없는 후보를 임의로 만들지 않았어요.
            </p>
          ) : null}
        </section>

        <Section
          title="이렇게 판단했어요"
          subtitle="아이의 경험과 부모의 체류 조건을 함께 놓고 비교했어요. 정확한 내부 점수는 표시하지 않습니다."
        >
          <div className="apple-glass-soft rounded-[24px] p-4 print:[break-inside:avoid] print:shadow-none sm:p-7">
            <CampFitV3DecisionRadar axes={axes} />
            <p className="mx-auto mt-5 max-w-2xl text-center text-sm font-semibold leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
              {decisionAxesSummary(axes)}
            </p>
          </div>
        </Section>

        <Section title="함께 비교할 경험 방향" subtitle="가장 중요한 방향과 함께 비교할 수 있는 선택지를 정리했어요.">
          <div className="grid gap-3 sm:grid-cols-2">
            {result.experienceDirections.map((direction) => (
              <article className="apple-glass-soft rounded-[22px] p-5 print:[break-inside:avoid] print:shadow-none" key={direction.key}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-extrabold [word-break:keep-all]">{direction.label}</h3>
                  <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-primary)]">
                    {direction.fitLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{direction.explanation}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section title="추천 도시" subtitle="도시별 강점과 먼저 확인할 조건, 예상 체류비를 비교해보세요.">
          {result.catalogSource === "demo" ? <p className="mb-4 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">시연용 도시 예시</p> : null}
          <p className="mb-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">도시별 비용은 월평균 비용을 체류기간에 맞춰 환산한 비교용 추정치입니다. 실제 항공·숙소·프로그램 비용은 예약 시점에 달라질 수 있어요.</p>
          {result.destinationRecommendations.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {result.destinationRecommendations.map((city) => <CityCard city={city} demo={result.catalogSource === "demo"} key={city.cityId} />)}
            </div>
          ) : (
            <Empty text="현재 조건에서 근거를 확인할 수 있는 도시가 없습니다." />
          )}
        </Section>

        <Section title={catalogPresentation.sectionTitle} subtitle={catalogPresentation.sectionSubtitle}>
          {catalogPresentation.notice ? (
            <p className="mb-4 rounded-2xl bg-[var(--surface-tint-yellow)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--status-warning)] [word-break:keep-all]" role="status">
              {catalogPresentation.notice}
            </p>
          ) : null}
          {!catalogPresentation.showProgramCards ? (
            <div className="rounded-2xl border border-[var(--border-default)] bg-white px-5 py-8 text-center print:[break-inside:avoid]" role="alert">
              <h3 className="text-lg font-bold [word-break:keep-all]">{catalogPresentation.unavailableTitle}</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{catalogPresentation.unavailableGuidance}</p>
            </div>
          ) : result.programCandidates.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {result.programCandidates.map((program) => <ProgramCard program={program} demo={result.catalogSource === "demo"} key={program.programId} />)}
            </div>
          ) : (
            <Empty text="연령·기간·부모동반 조건을 모두 확인할 수 있는 프로그램 후보가 아직 없습니다." />
          )}
        </Section>

        <Section title="꼭 확인할 사항" subtitle="프로그램 상담 전에 지원 조건과 최신 운영 정보를 함께 확인해주세요.">
          <div className="grid gap-5 lg:grid-cols-2">
            <ListCard title="꼭 필요한 지원 조건" items={result.requiredSupportConditions} />
            <ListCard title="최종 선택 전 확인사항" items={result.verificationChecklist} />
          </div>
        </Section>

        <Section title="조건을 조정하면 가능한 대안">
          {result.alternatives.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.alternatives.map((alternative) => (
                <p className="rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm leading-6 [word-break:keep-all] print:[break-inside:avoid]" key={alternative}>
                  {alternative}
                </p>
              ))}
            </div>
          ) : (
            <Empty text="현재 조건에서 별도로 조정할 대안은 없습니다." />
          )}
        </Section>

        <ResultActions onBack={onBack} onRestart={onRestart} />
      </div>
    </main>
  )
}

function Section({ title, subtitle, children }: { readonly title: string; readonly subtitle?: string; readonly children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-[-.025em] [word-break:keep-all]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function CityCard({ city, demo }: { readonly city: CampfitV3DestinationRecommendation; readonly demo: boolean }) {
  const href = demo ? null : buildAnogroCityHref(city.cityName)
  const card = <CityCardContent city={city} linked={href !== null} />

  if (!href) {
    return <article className="apple-glass-soft overflow-hidden rounded-[22px] print:[break-inside:avoid] print:shadow-none">{card}</article>
  }

  return (
    <a
      className="apple-glass-soft group block overflow-hidden rounded-[22px] border border-transparent transition-transform duration-200 ease-in-out hover:-translate-y-0.5 hover:border-[var(--cta-glass-border)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none print:[break-inside:avoid] print:transform-none print:shadow-none"
      href={href}
      aria-label={`${city.cityName} 도시 자세히 보기`}
    >
      {card}
    </a>
  )
}

function CityCardContent({ city, linked }: { readonly city: CampfitV3DestinationRecommendation; readonly linked: boolean }) {
  return (
    <>
      {city.imageUrl ? (
        <img className="h-36 w-full object-cover" src={city.imageUrl} alt="" />
      ) : (
        <div className="grid h-36 place-items-center bg-[var(--accent-soft)] text-3xl font-black text-[var(--accent-primary)]" aria-hidden>
          {city.cityName.slice(0, 1)}
        </div>
      )}
      <div className="p-5">
        <p className="text-xs font-bold text-[var(--accent-primary)]">{city.role}</p>
        <h3 className="mt-1 text-xl font-black">{city.cityName}</h3>
        {!linked ? <span className="mt-2 inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-primary)]">시연용 예시</span> : null}
        <p className="text-sm text-[var(--text-secondary)]">{city.countryName}</p>
        <p className="mt-3 text-sm leading-6 [word-break:keep-all]">{city.reason}</p>
        <div className="mt-4 rounded-xl bg-white p-3">
          <p className="text-xs font-bold text-[var(--text-secondary)]">{city.costEstimate.label} · 신뢰도 {confidenceLabel(city.costEstimate.confidence)}</p>
          <p className="mt-1 font-extrabold">{costLabel(city.costEstimate.estimatedTotalMinKrw, city.costEstimate.estimatedTotalMaxKrw)}</p>
        </div>
        {city.verify.length ? <p className="mt-3 text-xs leading-5 text-[var(--status-warning)] [word-break:keep-all]">확인: {city.verify.join(" · ")}</p> : null}
        <p className={`mt-5 inline-flex min-h-11 items-center text-sm font-extrabold ${linked ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"}`}>
          {linked ? <>도시 자세히 보기 <span className="ml-2 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden>→</span></> : "상세정보 준비 중"}
        </p>
      </div>
    </>
  )
}

function ProgramCard({ program, demo }: { readonly program: CampfitV3ProgramCandidate; readonly demo: boolean }) {
  const href = demo ? null : safeProgramDetailHref(program.detailUrl)
  const card = <ProgramCardContent program={program} linked={href !== null} />

  if (!href) {
    return <article className="apple-glass-soft flex flex-col overflow-hidden rounded-[22px] print:[break-inside:avoid] print:shadow-none">{card}</article>
  }

  return (
    <a
      className="apple-glass-soft group flex flex-col overflow-hidden rounded-[22px] border border-transparent transition-transform duration-200 ease-in-out hover:-translate-y-0.5 hover:border-[var(--cta-glass-border)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none print:[break-inside:avoid] print:transform-none print:shadow-none"
      href={href}
      aria-label={`${program.name} 프로그램 살펴보기`}
    >
      {card}
    </a>
  )
}

function ProgramCardContent({ program, linked }: { readonly program: CampfitV3ProgramCandidate; readonly linked: boolean }) {
  return (
    <>
      {program.imageUrl ? (
        <img className="h-40 w-full object-cover" src={program.imageUrl} alt="" />
      ) : (
        <div className="grid h-40 place-items-center bg-[var(--surface-secondary)] text-2xl font-black text-[var(--accent-primary)]" aria-hidden>CampFit</div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <span className="self-start rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-bold text-[var(--accent-primary)]">{program.group}</span>
        {!linked ? <span className="mt-2 self-start rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-primary)]">시연용 예시</span> : null}
        <h3 className="mt-3 text-lg font-black leading-6 [word-break:keep-all]">{program.name}</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{program.cityName}, {program.countryName}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-secondary)]">
          <span>{program.ageLabel}</span><span aria-hidden>·</span><span>{program.durationLabel}</span><span aria-hidden>·</span><span>{program.priceLabel}</span>
        </div>
        <p className="mt-4 text-sm leading-6 [word-break:keep-all]">{program.reason}</p>
        {program.verify.length ? <p className="mt-3 text-xs leading-5 text-[var(--status-warning)] [word-break:keep-all]">확인: {program.verify.join(" · ")}</p> : null}
        <p className={`mt-auto inline-flex min-h-11 items-end pt-5 text-sm font-extrabold ${linked ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"}`}>
          {linked ? <>프로그램 살펴보기 <span className="ml-2 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden>→</span></> : "상세정보 준비 중"}
        </p>
      </div>
    </>
  )
}

function ListCard({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return (
    <article className="apple-glass-soft rounded-[22px] p-5 print:[break-inside:avoid] print:shadow-none sm:p-6">
      <h3 className="text-xl font-bold">{title}</h3>
      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li className="flex gap-3 text-sm leading-6 [word-break:keep-all]" key={item}>
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-primary)]" aria-hidden>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">추가로 확인할 항목이 없습니다.</p>
      )}
    </article>
  )
}

function ResultActions({ onBack, onRestart }: { readonly onBack: () => void; readonly onRestart: () => void }) {
  const [notice, setNotice] = useState("")

  function requestRestart(): void {
    if (window.confirm("현재 상담 내용과 결과가 모두 지워집니다. 새 상담을 시작할까요?")) onRestart()
  }

  return (
    <section className="mt-9 border-t border-[var(--border-default)] pt-7 print:hidden" aria-labelledby="result-actions-title">
      <div className="text-center sm:text-left">
        <h2 id="result-actions-title" className="text-xl font-bold">결과 저장 및 다음 단계</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">브라우저 인쇄 창에서 PDF로 저장하거나, 상담 내용을 다시 확인할 수 있어요.</p>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
        <button className="glass-cta min-h-12 rounded-full px-6 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" type="button" onClick={() => window.print()}>
          PDF로 저장하기
        </button>
        <button className={secondaryButtonClass} type="button" onClick={() => setNotice("이메일로 결과를 받는 기능은 준비 중입니다.")}>
          이메일로 받기 · 준비 중
        </button>
        <button className={secondaryButtonClass} type="button" onClick={onBack}>상담 내용 다시 보기</button>
        <button className={tertiaryButtonClass} type="button" onClick={requestRestart}>조건을 바꿔 다시 상담하기</button>
      </div>
      <p className="mt-4 min-h-6 text-sm font-semibold leading-6 text-[var(--accent-primary)] [word-break:keep-all]" role="status" aria-live="polite">
        {notice}
      </p>
    </section>
  )
}

function Empty({ text }: { readonly text: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-white px-5 py-8 text-center text-sm text-[var(--text-secondary)] [word-break:keep-all]">{text}</div>
}

const secondaryButtonClass = "min-h-12 rounded-full border border-[var(--border-default)] bg-white px-5 text-sm font-extrabold text-[var(--text-primary)] transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--cta-glass-border)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none"
const tertiaryButtonClass = "min-h-12 rounded-full px-5 text-sm font-bold text-[var(--text-secondary)] underline decoration-[var(--border-default)] underline-offset-4 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"

function costLabel(min: number | null, max: number | null): string {
  if (min === null || max === null) return "일부 비용 확인 필요"
  return `${Math.round(min / 10_000).toLocaleString("ko-KR")}만~${Math.round(max / 10_000).toLocaleString("ko-KR")}만 원`
}

function confidenceLabel(value: "low" | "medium" | "high"): string {
  return value === "high" ? "높음" : value === "medium" ? "보통" : "낮음"
}
