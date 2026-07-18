"use client"

import * as React from "react"
import { useMemo, useState, type ReactNode } from "react"
import { CampFitV3DecisionRadar } from "@/components/campfit/v3/CampFitV3DecisionRadar"
import { CampFitV3Frame, V3Header } from "@/components/campfit/v3/CampFitV3Frame"
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

function getAxisDetail(axisKey: string, state: CampfitV3ConversationState, basicInfo: CampfitV3BasicInfo): string {
  switch (axisKey) {
    case "english": {
      const level = state.facts.childEnglishLevel?.value
      if (level === "beginner") return "영어 초급자 수준"
      if (level === "basic") return "단어·짧은 표현 수준"
      if (level === "intermediate") return "영어 수업 참여 가능"
      if (level === "advanced") return "유창한 영어 소통 가능"
      return "어학 수준에 맞춤"
    }
    case "school": {
      const strength = (state.facts.experienceGoals?.value as Record<string, unknown> | undefined)?.['schoolSchooling']
      if (strength === "primary") return "스쿨링·현지 수업 선호"
      if (strength === "secondary") return "학교 분위기 체험"
      return "방학 단기 활동 중심"
    }
    case "project": {
      const strength = (state.facts.experienceGoals?.value as Record<string, unknown> | undefined)?.['subjectProject']
      if (strength === "primary") return "로봇·과학·결과물 선호"
      if (strength === "secondary") return "창의·프로젝트 관심"
      return "일반 활동형 경험"
    }
    case "culture": {
      const strength = (state.facts.experienceGoals?.value as Record<string, unknown> | undefined)?.['cultureActivity']
      if (strength === "primary") return "자연·야외 활동 선호"
      if (strength === "secondary") return "다양한 문화 체험"
      return "실내외 균형 활동"
    }
    case "support": {
      const care = state.facts.specialCareFollowUp?.value
      const support = state.facts.koreanSupportNeed?.value
      if (care === "required") return "특별관리 지원 필요"
      if (support === "must_daily") return "매일 한국어 지원 필요"
      if (support === "emergency_only") return "비상시 한국어 대응 필요"
      return "자율적인 현지 적응 가능"
    }
    case "family": {
      const stay = state.facts.parentStayGoals?.value
      if (Array.isArray(stay) && stay.length > 0) {
        if (stay.includes("remoteWork")) return "원격근무 선호"
        if (stay.includes("restWellness")) return "휴식·웰니스 선호"
        if (stay.includes("cafeDining")) return "현지 생활·카페 탐방"
        if (stay.includes("natureBeach")) return "자연·해변 휴양"
        if (stay.includes("childScheduleFirst")) return "아이 일정 동행 우선"
      }
      return "부모 현지 동반 체류"
    }
    default:
      return ""
  }
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
    <CampFitV3Frame className="print:h-auto print:overflow-visible print:bg-white print:px-0 print:py-0" contentClassName="print:h-auto print:overflow-visible print:rounded-none print:border-0 print:bg-white print:px-0 print:py-0 print:shadow-none">
      <V3Header />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1120px] py-7 print:max-w-none print:py-5 sm:py-10">
        <section className="border-b border-[var(--border-default)] pb-6 print:[break-inside:avoid] print:border-0 print:pb-0 sm:pb-8">
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
              현재 확인된 프로그램 수가 적어 조건과 도시 방향을 중심으로 정리했습니다.
            </p>
          ) : null}
        </section>

        <Section
          title="이렇게 판단했어요"
          subtitle="아이의 경험과 부모의 체류 조건을 함께 놓고 비교했어요. 정확한 내부 점수는 표시하지 않습니다."
        >
          <div className="apple-glass-soft rounded-[24px] p-4 print:[break-inside:avoid] print:shadow-none sm:p-5 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="w-full lg:w-[38%] max-w-[320px] shrink-0">
              <CampFitV3DecisionRadar axes={axes} />
            </div>
            <div className="w-full lg:w-[58%] flex flex-col gap-3 border-t border-[var(--border-default)] pt-4 lg:border-t-0 lg:pt-0">
              {axes.map((axis) => (
                <div key={axis.key} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border-default)] pb-2 gap-1 text-sm">
                  <span className="font-extrabold text-[var(--text-secondary)]">{axis.label}</span>
                  <span className="font-bold text-[var(--text-primary)]">{getAxisDetail(axis.key, conversationState, basicInfo)}</span>
                </div>
              ))}
              <p className="mt-2 text-xs font-semibold leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
                {decisionAxesSummary(axes)}
              </p>
            </div>
          </div>
        </Section>

        <Section title="함께 비교할 경험 방향" subtitle="가장 중요한 방향과 함께 비교할 수 있는 선택지를 정리했어요.">
          <div className="grid gap-3 sm:grid-cols-2">
            {result.experienceDirections
              .filter((direction) => direction.fitLabel !== "현재 우선순위가 낮음")
              .map((direction) => (
                <article className="apple-glass-soft rounded-[22px] p-5 print:[break-inside:avoid] print:shadow-none" key={direction.key}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-extrabold [word-break:keep-all]">{direction.label}</h3>
                    <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-primary)]">
                      {direction.fitLabel === "조건을 조정하면 가능" ? "조건을 조정하면 함께 검토할 수 있어요" : direction.fitLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{direction.explanation}</p>
                </article>
              ))}
          </div>
        </Section>

        <Section title="추천 도시" subtitle="도시별 강점과 먼저 확인할 조건, 예상 체류비를 비교해보세요.">
          <p className="mb-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">도시별 비용은 월평균 비용을 체류기간에 맞춰 환산한 비교용 추정치입니다. 실제 항공·숙소·프로그램 비용은 예약 시점에 달라질 수 있어요.</p>
          {result.destinationRecommendations.length ? (
            <div className={`grid gap-4 ${
              result.destinationRecommendations.length === 1
                ? "grid-cols-1 max-w-md"
                : result.destinationRecommendations.length === 2
                  ? "grid-cols-1 md:grid-cols-2 max-w-4xl"
                  : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            }`}>
              {result.destinationRecommendations.map((city) => <CityCard city={city} key={city.cityId} />)}
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
            <div className={`grid gap-4 ${
              result.programCandidates.length === 1
                ? "grid-cols-1 max-w-md"
                : result.programCandidates.length === 2
                  ? "grid-cols-1 md:grid-cols-2 max-w-4xl"
                  : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            }`}>
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
      </div>
    </CampFitV3Frame>
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

function CityCard({ city }: { readonly city: CampfitV3DestinationRecommendation }) {
  const href = buildAnogroCityHref(city.cityName)
  return (
    <article className="apple-glass-soft flex flex-col overflow-hidden rounded-[22px] print:[break-inside:avoid] print:shadow-none">
      <CityCardContent city={city} href={href} />
    </article>
  )
}

function CityCardContent({ city, href }: { readonly city: CampfitV3DestinationRecommendation; readonly href: string | null }) {
  return (
    <>
      {city.imageUrl ? (
        <img className="h-36 w-full object-cover" src={city.imageUrl} alt="" />
      ) : (
        <div className="grid h-36 place-items-center bg-[var(--accent-soft)] text-3xl font-black text-[var(--accent-primary)]" aria-hidden>
          {city.cityName.slice(0, 1)}
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold text-[var(--accent-primary)]">{city.role}</p>
        <h3 className="mt-1 text-xl font-black">{city.cityName}</h3>
        <p className="text-sm text-[var(--text-secondary)]">{city.countryName}</p>
        <p className="mt-3 text-sm leading-6 [word-break:keep-all] flex-1">{city.reason}</p>
        <div className="mt-4 rounded-xl bg-white p-3">
          <p className="text-xs font-bold text-[var(--text-secondary)]">{city.costEstimate.label} · 신뢰도 {confidenceLabel(city.costEstimate.confidence)}</p>
          <p className="mt-1 font-extrabold">{costLabel(city.costEstimate.estimatedTotalMinKrw, city.costEstimate.estimatedTotalMaxKrw)}</p>
        </div>
        {city.verify.length ? <p className="mt-3 text-xs leading-5 text-[var(--status-warning)] [word-break:keep-all]">확인: {city.verify.join(" · ")}</p> : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center self-start text-sm font-extrabold text-[var(--accent-primary)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            aria-label={`${city.cityName} 도시 자세히 보기 (새 창 열림)`}
          >
            도시 자세히 보기
            <span className="ml-1.5" aria-hidden>↗</span>
          </a>
        ) : null}
      </div>
    </>
  )
}

function ProgramCard({ program, demo }: { readonly program: CampfitV3ProgramCandidate; readonly demo: boolean }) {
  const href = demo ? null : safeProgramDetailHref(program.detailUrl)
  return (
    <article className="apple-glass-soft flex flex-col overflow-hidden rounded-[22px] print:[break-inside:avoid] print:shadow-none">
      <ProgramCardContent program={program} href={href} />
    </article>
  )
}

function ProgramCardContent({ program, href }: { readonly program: CampfitV3ProgramCandidate; readonly href: string | null }) {
  return (
    <>
      {program.imageUrl ? (
        <img className="h-40 w-full object-cover" src={program.imageUrl} alt="" />
      ) : (
        <div className="grid h-40 place-items-center bg-[var(--surface-secondary)] text-2xl font-black text-[var(--accent-primary)]" aria-hidden>CampFit</div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <span className="self-start rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-bold text-[var(--accent-primary)]">{program.group}</span>
        <h3 className="mt-3 text-lg font-black leading-6 [word-break:keep-all]">{program.name}</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{program.cityName}, {program.countryName}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-secondary)]">
          <span>{program.ageLabel}</span><span aria-hidden>·</span><span>{program.durationLabel}</span><span aria-hidden>·</span><span>{program.priceLabel}</span>
        </div>
        <p className="mt-4 text-sm leading-6 [word-break:keep-all] flex-1">{program.reason}</p>
        {program.verify.length ? <p className="mt-3 text-xs leading-5 text-[var(--status-warning)] [word-break:keep-all]">확인: {program.verify.join(" · ")}</p> : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center self-start text-sm font-extrabold text-[var(--accent-primary)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            aria-label={`${program.name} 프로그램 살펴보기 (새 창 열림)`}
          >
            프로그램 살펴보기
            <span className="ml-1.5" aria-hidden>↗</span>
          </a>
        ) : null}
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
        <button className={secondaryButtonClass} type="button" onClick={() => setNotice("이메일로 결과를 받는 기능은 곧 제공될 예정이에요.")}>
          이메일로 받기
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
