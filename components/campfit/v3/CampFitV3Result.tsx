"use client"

import { useMemo, useRef, type ReactNode } from "react"
import * as React from "react"
import { CampFitV3DecisionRadar } from "@/components/campfit/v3/CampFitV3DecisionRadar"
import { CampFitV3Frame, V3Header } from "@/components/campfit/v3/CampFitV3Frame"
import { CampFitV3ResultActions, type CampFitV3EmailRequest } from "@/components/campfit/v3/CampFitV3ResultActions"
import {
  buildAnogroCityHref,
  buildCityComparisons,
  buildDecisionAxes,
  decisionAxesSummary,
  programCatalogPresentation,
  safeProgramDetailHref,
} from "@/components/campfit/v3/resultPresentation"
import {
  cityWhyBullets,
  programCautions,
  programRecommendationReasons,
  programStrengths,
  rankLabel,
} from "@/components/campfit/v3/resultCopy"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3DestinationRecommendation,
  CampfitV3ProgramCandidate,
  CampfitV3RecommendationResult,
} from "@/types/campfitV3"
import { trackCampfitV3AnalyticsEvent } from "@/components/campfit/v3/analyticsClient"
import type { CampfitV3CityComparison } from "@/components/campfit/v3/resultPresentation"

type CampFitV3ResultProps = {
  readonly result: CampfitV3RecommendationResult
  readonly resultId?: string | null
  readonly basicInfo: CampfitV3BasicInfo
  readonly conversationState: CampfitV3ConversationState
  readonly onBack: () => void
  readonly onRestart: () => void
  readonly onRequestEmail?: (request: CampFitV3EmailRequest) => void | Promise<void>
}

function getAxisDetail(axisKey: string, state: CampfitV3ConversationState): string {
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
      const strength = (state.facts.experienceGoals?.value as Record<string, unknown> | undefined)?.["schoolSchooling"]
      if (strength === "primary") return "스쿨링·현지 수업 선호"
      if (strength === "secondary") return "학교 분위기 체험"
      return "방학 단기 활동 중심"
    }
    case "project": {
      const strength = (state.facts.experienceGoals?.value as Record<string, unknown> | undefined)?.["subjectProject"]
      if (strength === "primary") return "로봇·과학·결과물 선호"
      if (strength === "secondary") return "창의·프로젝트 관심"
      return "일반 활동형 경험"
    }
    case "culture": {
      const strength = (state.facts.experienceGoals?.value as Record<string, unknown> | undefined)?.["cultureActivity"]
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

function englishLevelLabel(state: CampfitV3ConversationState): string {
  const level = state.facts.childEnglishLevel?.value
  if (level === "beginner") return "영어 초급자 수준"
  if (level === "basic") return "단어·짧은 표현 수준"
  if (level === "intermediate") return "영어 수업 참여 가능"
  if (level === "advanced") return "자연스러운 영어 소통 가능"
  return "상담 중 확인한 맞춤"
}

function reportDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date)
}

function importantCriteria(
  result: CampfitV3RecommendationResult,
  state: CampfitV3ConversationState,
): readonly string[] {
  const directions = result.experienceDirections.slice(0, 2).map((direction) => direction.label.replace(/ 경험$/, ""))
  const stayGoals = state.facts.parentStayGoals?.value
  const parentGoal = Array.isArray(stayGoals) && stayGoals.length ? getAxisDetail("family", state) : null
  const commute = state.facts.programCommuteNeed?.value === "simple_only"
    ? "프로그램 이동이 간단한 후보"
    : state.facts.programCommuteNeed?.value === "shuttle_preferred" ? "셔틀·차량 이동"
      : null
  const meal = state.facts.programMealNeed?.value === "lunch_required"
    ? "점심·식사 제공"
    : state.facts.programMealNeed?.value === "meals_preferred" ? "식사 포함 여부"
      : null
  return Array.from(new Set([...directions, parentGoal, commute, meal].filter((value): value is string => Boolean(value)))).slice(0, 4)
}

export function CampFitV3Result({
  result,
  resultId,
  basicInfo,
  conversationState,
  onBack,
  onRestart,
  onRequestEmail,
}: CampFitV3ResultProps) {
  const reportRef = useRef<HTMLDivElement | null>(null)
  const axes = useMemo(
    () => buildDecisionAxes(result, conversationState, basicInfo),
    [basicInfo, conversationState, result],
  )
  const cityComparisons = useMemo(() => buildCityComparisons(result), [result])
  const catalogPresentation = programCatalogPresentation(result.catalogSource)

  function handleResultClick(event: React.MouseEvent<HTMLDivElement>): void {
    const anchor = (event.target as HTMLElement).closest("a")
    if (!anchor) return

    const programCard = anchor.closest<HTMLElement>("[data-campfit-program-card]")
    if (programCard?.dataset["programId"]) {
      const program = result.programCandidates.find((candidate) => candidate.programId === programCard.dataset["programId"])
      const rank = result.programCandidates.findIndex((candidate) => candidate.programId === programCard.dataset["programId"])
      trackCampfitV3AnalyticsEvent({
        eventName: "campfit_program_clicked",
        stage: "result",
        resultId: resultId ?? null,
        itemType: "program",
        itemId: programCard.dataset["programId"],
        itemNameSnapshot: program?.name ?? null,
        cityNameSnapshot: program?.cityName ?? null,
        countryNameSnapshot: program?.countryName ?? null,
        itemRank: rank >= 0 ? rank + 1 : null,
        linkTarget: "program_detail",
        catalogSource: result.catalogSource,
      })
      return
    }

    const cityCard = anchor.closest<HTMLElement>("[data-campfit-city-card]")
    if (cityCard?.dataset["cityName"]) {
      const city = result.destinationRecommendations.find((candidate) => candidate.cityName === cityCard.dataset["cityName"])
      const rank = result.destinationRecommendations.findIndex((candidate) => candidate.cityName === cityCard.dataset["cityName"])
      trackCampfitV3AnalyticsEvent({
        eventName: "campfit_city_clicked",
        stage: "result",
        resultId: resultId ?? null,
        itemType: "city",
        itemId: city?.cityId ?? cityCard.dataset["cityName"],
        itemNameSnapshot: cityCard.dataset["cityName"],
        cityId: city?.cityId ?? null,
        cityNameSnapshot: cityCard.dataset["cityName"],
        countryNameSnapshot: city?.countryName ?? null,
        itemRank: rank >= 0 ? rank + 1 : null,
        linkTarget: "anogro_city",
        catalogSource: result.catalogSource,
      })
    }
  }

  return (
    <CampFitV3Frame className="!h-auto !min-h-dvh !overflow-visible pb-10 sm:pb-16" contentClassName="!h-auto !min-h-full !overflow-visible">
      <V3Header />
      <div className="flex-1">
        <div ref={reportRef} onClickCapture={handleResultClick} data-campfit-result-report data-campfit-export-root="true" className="mx-auto max-w-[1120px] px-0 py-7 sm:py-10">
          <section data-campfit-report-section="title" className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">
              <img className="h-6 w-auto object-contain" src="/images/Small Logo.png" alt="" />
              <span>CAMPFIT AI</span>
              <span className="h-1 w-1 rounded-full bg-[var(--accent-primary)]" aria-hidden />
              <span>저장용 결과 리포트</span>
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-.035em] [word-break:keep-all] sm:text-4xl">CampFit AI 추천 리포트</h1>
            <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">생성일 {reportDateLabel()}</p>
          </section>

          <ReportSection title="이번 상담에서 중요하게 본 것" subtitle="상담에서 확인한 우선순위와 가족 조건을 육각형 그래프로 정리했습니다.">
            <div data-campfit-decision-criteria className="rounded-[22px] bg-[var(--surface-elevated)] p-5 sm:p-8 lg:p-10">
              <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-20">
                <div className="mx-auto w-full max-w-[360px] shrink-0 lg:w-[360px]"><CampFitV3DecisionRadar axes={axes} /></div>
                <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3 border-t border-[var(--border-default)] pt-6 lg:pt-0 lg:border-t-0">
                  {axes.map((axis) => (
                    <div key={axis.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-b border-[var(--border-default)] pb-2 text-sm">
                      <span className="font-extrabold text-[var(--text-secondary)]">{axis.label}</span>
                      <span className="text-right font-bold text-[var(--text-primary)]">{getAxisDetail(axis.key, conversationState)}</span>
                    </div>
                  ))}
                  <p className="mt-2 text-xs font-semibold leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{decisionAxesSummary(axes)}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-5 border-t border-[var(--border-default)] pt-5 lg:grid-cols-2">
                <SupportConditionPanel items={result.requiredSupportConditions} />
                <AlternativePanel items={result.alternatives} />
              </div>
            </div>
          </ReportSection>

          <ReportSection title="AI 요약" subtitle="새로운 해석을 덧붙이지 않고, 상담과 추천 결과에서 확인된 내용을 정리했습니다.">
            <article data-campfit-report-section="summary" className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5 sm:p-6">
              <p className="max-w-none text-base font-semibold leading-8 [word-break:keep-all]">{result.consultingConclusion}</p>
            </article>
          </ReportSection>

          <ReportSection title="추천 도시 Top3" subtitle="서로 다른 도시를 먼저 비교하고, 각 도시 안에서 실제 프로그램을 살펴보세요.">
            {catalogPresentation.notice ? (
              <p className="mb-4 rounded-2xl bg-[var(--surface-tint-yellow)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--status-warning)] [word-break:keep-all]" role="status">
                {catalogPresentation.notice}
              </p>
            ) : null}
            {cityComparisons.length ? (
              <div className="grid gap-5 lg:grid-cols-3">
                {cityComparisons.map((comparison, index) => (
                  <CityCard comparison={comparison} index={index} basicInfo={basicInfo} conversationState={conversationState} result={result} resultId={resultId ?? null} key={comparison.city.cityId} />
                ))}
              </div>
            ) : (
              <Empty text="현재 조건에서 실제로 비교할 도시를 찾지 못했어요. 출발 시기나 기간을 조금 넓히면 다시 비교할 수 있어요." />
            )}
          </ReportSection>

          <ReportSection title="추천 프로그램 Top3" subtitle="도시 순위와 별개로, 가족 조건에 가장 잘 맞는 프로그램을 골랐습니다.">
            <div data-campfit-program-section="top3">
              {catalogPresentation.showProgramCards && result.programCandidates.length ? (
                (() => {
                  const programs = result.programCandidates.slice(0, 3)
                  const reasons = programRecommendationReasons(programs)
                  return <div className="grid gap-5 lg:grid-cols-3">{programs.map((program, index) => <ProgramInlineCard program={program} index={index} reasonOverride={reasons[index]} key={program.programId} />)}</div>
                })()
              ) : <Empty text="현재 조건에 맞는 프로그램 후보를 확인하지 못했습니다." />}
            </div>
          </ReportSection>

          <ReportSection title="확인사항" subtitle="신청 전에 최신 운영 조건과 실제 가족 비용을 확인하세요.">
            <ListCard
              title="최종 선택 전 확인사항"
              items={[
                ...result.verificationChecklist.filter((item) => !result.requiredSupportConditions.includes(item)),
                "알레르기·복약 등 건강 관련 사항은 프로그램 운영 업체에 사전 문의하세요.",
              ]}
            />
          </ReportSection>
        </div>

        <div data-campfit-export-ignore="true">
          <CampFitV3ResultActions
            reportRef={reportRef}
            {...(onRequestEmail ? { onRequestEmail } : {})}
            onBack={onBack}
            onRestart={onRestart}
            resultId={resultId ?? null}
          />
        </div>
      </div>
    </CampFitV3Frame>
  )
}

function ReportSection({ title, subtitle, children }: { readonly title: string; readonly subtitle?: string; readonly children: ReactNode }) {
  return (
    <section className="mt-8" data-campfit-report-section={title}>
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-[-.025em] [word-break:keep-all]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function FamilyConditionGrid({
  basicInfo,
  conversationState,
  result,
}: {
  readonly basicInfo: CampfitV3BasicInfo
  readonly conversationState: CampfitV3ConversationState
  readonly result: CampfitV3RecommendationResult
}) {
  const criteria = importantCriteria(result, conversationState)
  const items = [
    ["아이 나이", basicInfo.childAges.map((age) => `만 ${age}세`).join(" · ") || "상담 중 확인"],
    ["여행 기간", `${basicInfo.durationWeeks}주`],
    ["가족 구성", `성인 ${basicInfo.adultCount}명 · 아동 ${basicInfo.childCount}명`],
    ["예산", budgetLabel(basicInfo.budgetMinKrw, basicInfo.budgetMaxKrw)],
    ["영어 수준", englishLevelLabel(conversationState)],
    ["중요하게 생각한 조건", criteria.length ? criteria.join(" · ") : "가족 체류와 아이의 경험을 함께 고려"],
  ] as const

  return (
    <dl data-campfit-report-section="family-conditions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4" key={label}>
          <dt className="text-xs font-black tracking-[.06em] text-[var(--text-secondary)]">{label}</dt>
          <dd className="mt-2 text-sm font-extrabold leading-6 [word-break:keep-all]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function SupportConditionPanel({ items }: { readonly items: readonly string[] }) {
  return (
    <article className="rounded-[22px] border border-[var(--border-default)] bg-white p-5 sm:p-6">
      <h3 className="text-lg font-bold [word-break:keep-all]">꼭 필요한 지원 조건</h3>
      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li className="flex gap-3 text-sm leading-6 [word-break:keep-all]" key={item}>
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-primary)]" aria-hidden>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">현재 상담에서 별도로 확인된 필수 지원 조건은 없습니다.</p>}
    </article>
  )
}

function AlternativePanel({ items }: { readonly items: readonly string[] }) {
  return (
    <article className="rounded-[22px] border border-[var(--border-default)] bg-white p-5 sm:p-6">
      <h3 className="text-lg font-bold [word-break:keep-all]">조건을 조정하면 가능한 대안</h3>
      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((alternative) => (
            <li className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3 text-sm leading-6 [word-break:keep-all]" key={alternative}>{alternative}</li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">현재 조건에서 별도로 제안할 대안은 없습니다.</p>}
    </article>
  )
}

function CityCard({
  comparison,
  index,
  basicInfo,
  conversationState,
  result,
  resultId,
}: {
  readonly comparison: CampfitV3CityComparison
  readonly index: number
  readonly basicInfo: CampfitV3BasicInfo
  readonly conversationState: CampfitV3ConversationState
  readonly result: CampfitV3RecommendationResult
  readonly resultId: string | null
}) {
  const { city } = comparison
  const href = buildAnogroCityHref(city.cityName)
  return (
    <article data-campfit-city-card data-city-name={city.cityName} className="apple-glass-soft flex flex-col overflow-hidden rounded-[22px]">
      <div className="flex items-start justify-between gap-3 p-5 pb-0 sm:p-6 sm:pb-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[.1em] text-[var(--accent-primary)]">{index === 0 ? "01" : `0${index + 1}`} · {rankLabel(index)}</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-.03em]">{city.cityName}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{city.countryName}</p>
        </div>
        {city.imageUrl ? <img className="h-20 w-24 rounded-2xl object-cover" src={city.imageUrl} alt="" /> : <div className="grid h-20 w-24 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-2xl font-black text-[var(--accent-primary)]" aria-hidden>{city.cityName.slice(0, 1)}</div>}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {city.description ? (
          <p className="mb-4 rounded-2xl bg-[var(--bg-secondary)] p-3 text-xs leading-5 text-[var(--text-secondary)] [word-break:keep-all]">
            “ {city.description} ”
          </p>
        ) : null}
        <h4 className="text-sm font-black text-[var(--text-primary)]">추천 이유와 장점</h4>
        <ul className="mt-3 space-y-2.5">
          {(city.bullets ?? cityWhyBullets(city, basicInfo, conversationState, result)).map((item) => (
            <li className="flex gap-2.5 text-sm leading-6 [word-break:keep-all]" key={item}>
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-primary)]" aria-hidden>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <CityLivingCostSummary city={city} />
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackCampfitV3AnalyticsEvent({ eventName: "campfit_city_clicked", stage: "result", resultId, itemType: "city", itemId: city.cityId, itemNameSnapshot: city.cityName, cityId: city.cityId, cityNameSnapshot: city.cityName, countryNameSnapshot: city.countryName, itemRank: index + 1, linkTarget: "anogro_city", catalogSource: result.catalogSource })} className="mt-5 inline-flex min-h-11 items-center self-start text-sm font-extrabold text-[var(--accent-primary)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" aria-label={`${city.cityName} 도시 자세히 보기 (새 창 열림)`}>도시 자세히 보기<span className="ml-1.5" aria-hidden>↗</span></a> : null}
      </div>
    </article>
  )
}

function CityLivingCostSummary({ city }: { readonly city: CampfitV3DestinationRecommendation }) {
  const living = city.livingCostMonthlyKrw ?? null

  if (living === null) return null

  return (
    <div className="mt-5 rounded-2xl bg-[var(--surface-tint-yellow)] p-4 text-xs font-semibold leading-6 text-[var(--text-secondary)]">
      <h4 className="text-sm font-black text-[var(--status-warning)]">도시 평균 생활비</h4>
      <p className="mt-1 text-lg font-black text-[var(--text-primary)]">월 약 {formatKrw(living)}</p>
      <p className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)] [word-break:keep-all] opacity-80">도시 기준 월 평균 참고값이며, 가족 구성과 생활 방식에 따라 달라질 수 있어요.</p>
    </div>
  )
}

function ProgramInlineCard({ program, index, reasonOverride }: { readonly program: CampfitV3ProgramCandidate; readonly index: number; readonly reasonOverride?: string | undefined }) {
  const href = safeProgramDetailHref(program.detailUrl)
  const strengths = programStrengths(program, reasonOverride)
  const cautions = programCautions(program)
  return (
    <article data-campfit-program-card data-program-id={program.programId} data-city-name={program.cityName} className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.08em] text-[var(--accent-primary)]">프로그램 {index + 1} · {rankLabel(index)}</p>
          <h5 className="mt-1 text-base font-black leading-6 [word-break:keep-all]">{program.name}</h5>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{program.ageLabel} · {program.durationLabel}</p>
        </div>
        {program.imageUrl ? (
          <img className="h-14 w-16 shrink-0 rounded-xl object-cover" src={program.imageUrl} alt="" />
        ) : (
          <img className="h-14 w-16 shrink-0 rounded-xl object-cover opacity-80 bg-[var(--accent-soft)]" src="/campfit/campfit-guide-illustration.png" alt="" />
        )}
      </div>
      <div className="mt-3">
        {program.description ? (
          <div className="mb-3 rounded-2xl bg-[var(--bg-secondary)] p-3 [word-break:keep-all]">
            <p className="text-xs font-black text-[var(--text-primary)]">프로그램 소개</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{program.description}</p>
          </div>
        ) : null}
        <p className="text-xs font-black text-[var(--text-primary)]">추천 이유</p>
        <p className="mt-1 text-sm leading-6 [word-break:keep-all]">{strengths[0]}</p>
        {(() => {
          const tripCost = program.tripCost
          let estimatedTotalText = program.priceLabel
          let hasTotalSum = false

          if (tripCost && tripCost.breakdown) {
            const prog = tripCost.breakdown.program
            const flight = tripCost.breakdown.flights
            const living = tripCost.breakdown.living

            if (prog.low !== null && flight.low !== null && living.low !== null) {
              const low = prog.low + flight.low + living.low
              const high = (prog.high ?? prog.low) + (flight.high ?? flight.low) + (living.high ?? living.low)
              
              const lowMan = Math.round(low / 10_000)
              if (low === high) {
                estimatedTotalText = `약 ${lowMan.toLocaleString("ko-KR")}만 원~`
              } else {
                const highMan = Math.round(high / 10_000)
                estimatedTotalText = `약 ${lowMan.toLocaleString("ko-KR")}만~${highMan.toLocaleString("ko-KR")}만 원`
              }
              hasTotalSum = true
            }
          }

          return (
            <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
              <p className="flex items-center gap-1.5 text-xs font-black tracking-[.08em] text-[var(--accent-primary)]">
                <span>{hasTotalSum ? "총 예상 금액" : "프로그램 가격"}</span>
                {hasTotalSum && (
                  <span 
                    className="inline-grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[var(--text-tertiary)]/20 text-[9px] font-black text-[var(--text-secondary)] cursor-help" 
                    title="프로그램 비용 + 생활비 + 항공료 포함"
                  >
                    ?
                  </span>
                )}
              </p>
              <p className="mt-1 text-xl font-black tracking-[-.02em]">{estimatedTotalText}</p>
            </div>
          )
        })()}
        <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--text-secondary)]">
          <p><span className="font-black text-[var(--status-success)]">좋은 점</span> · {strengths.slice(1).join(" · ") || "조건에 맞는 기본 정보를 확인했어요."}</p>
          <p><span className="font-black text-[var(--status-warning)]">아쉬운 점</span> · {cautions.join(" · ")}</p>
        </div>
        <details className="group mt-5 border-t border-[var(--border-default)] pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[var(--accent-primary)] [&::-webkit-details-marker]:hidden">
            <span>프로그램 상세 보기</span>
            <span className="text-lg transition-transform group-open:rotate-45" aria-hidden>＋</span>
          </summary>
          <div className="mt-3 rounded-2xl bg-white p-4 text-sm leading-6 [word-break:keep-all]">
            {program.verify.length ? <p className="mt-3 text-[var(--text-secondary)]">추가 확인: {program.verify.join(" · ")}</p> : null}
          </div>
        </details>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center self-start text-sm font-extrabold text-[var(--accent-primary)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" aria-label={`${program.name} 프로그램 살펴보기 (새 창 열림)`}>프로그램 살펴보기<span className="ml-1.5" aria-hidden>↗</span></a> : null}
      </div>
    </article>
  )
}

function ListCard({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return (
    <article className="rounded-[22px] bg-[var(--surface-elevated)] p-5 sm:p-6">
      <h3 className="text-lg font-bold">{title}</h3>
      {items.length ? <ul className="mt-4 space-y-3">{items.map((item) => <li className="flex gap-3 text-sm leading-6 [word-break:keep-all]" key={item}><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-primary)]" aria-hidden>✓</span><span>{item}</span></li>)}</ul> : <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">추가로 확인할 항목이 없습니다.</p>}
    </article>
  )
}

function Empty({ text }: { readonly text: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-white px-5 py-8 text-center text-sm text-[var(--text-secondary)] [word-break:keep-all]">{text}</div>
}

function budgetLabel(min: number, max: number): string {
  return `${Math.round(min / 10_000).toLocaleString("ko-KR")}만~${Math.round(max / 10_000).toLocaleString("ko-KR")}만 원`
}

function formatKrw(value: number): string {
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만 원`
}

function tripCostLabel(low: number | null, high: number | null): string {
  if (low === null || high === null) return "금액 확인 필요"
  if (low === high) return `${Math.round(low / 10_000).toLocaleString("ko-KR")}만 원`
  return `${Math.round(low / 10_000).toLocaleString("ko-KR")}만~${Math.round(high / 10_000).toLocaleString("ko-KR")}만 원`
}
