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
  cityCheckItems,
  cityCostDetails,
  cityWhyBullets,
  programCautions,
  programStrengths,
  rankLabel,
} from "@/components/campfit/v3/resultCopy"
import type { CampfitV3TripCost } from "@/lib/campfit/v3/cost/types"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3ProgramCandidate,
  CampfitV3RecommendationResult,
} from "@/types/campfitV3"
import type { CampfitV3CityComparison, CampfitV3CityCostSummary } from "@/components/campfit/v3/resultPresentation"

type CampFitV3ResultProps = {
  readonly result: CampfitV3RecommendationResult
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
  return Array.from(new Set([...directions, parentGoal].filter((value): value is string => Boolean(value)))).slice(0, 3)
}

export function CampFitV3Result({
  result,
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

  return (
    <CampFitV3Frame>
      <V3Header />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div ref={reportRef} data-campfit-result-report data-campfit-export-root="true" className="mx-auto max-w-[1120px] px-0 py-7 sm:py-10">
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

          <ReportSection title="우리 가족 조건" subtitle="상담에서 확인한 가족 조건을 한눈에 정리했습니다.">
            <FamilyConditionGrid basicInfo={basicInfo} conversationState={conversationState} result={result} />
          </ReportSection>

          <ReportSection title="AI 요약" subtitle="새로운 해석을 덧붙이지 않고, 상담과 추천 결과에서 확인된 내용을 정리했습니다.">
            <article data-campfit-report-section="summary" className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5 sm:p-6">
              <p className="max-w-3xl text-base font-semibold leading-8 [word-break:keep-all]">{result.consultingConclusion}</p>
              {cityComparisons[0] ? <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] [word-break:keep-all]">{cityComparisons[0].city.reason}</p> : null}
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
                  <CityCard comparison={comparison} index={index} basicInfo={basicInfo} conversationState={conversationState} result={result} showProgramCards={catalogPresentation.showProgramCards} key={comparison.city.cityId} />
                ))}
              </div>
            ) : (
              <Empty text="현재 조건에서 실제로 비교할 도시를 찾지 못했어요. 출발 시기나 기간을 조금 넓히면 다시 비교할 수 있어요." />
            )}
          </ReportSection>

          <ReportSection title="도시 비교" subtitle="현재 결과에 포함된 도시별 비용과 선택 역할을 비교했습니다.">
            <CityComparisonTable cityComparisons={cityComparisons} basicInfo={basicInfo} />
          </ReportSection>

          <ReportSection title="확인해야 할 사항" subtitle="신청 전에 최신 운영 조건과 실제 가족 비용을 확인하세요.">
            <ListCard title="최종 선택 전 확인사항" items={result.verificationChecklist} />
          </ReportSection>

          <details className="group mt-8 rounded-[22px] border border-[var(--border-default)] bg-white">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold [word-break:keep-all] [&::-webkit-details-marker]:hidden sm:px-6">
              <span>판단 근거와 세부 확인사항 보기</span>
              <span className="text-xl text-[var(--accent-primary)] transition-transform group-open:rotate-45" aria-hidden>＋</span>
            </summary>
            <div className="border-t border-[var(--border-default)] px-5 pb-6 sm:px-6">
              <div className="pt-6">
                <h2 className="text-xl font-bold">이번 상담에서 중요하게 본 것</h2>
                <div className="mt-4 flex flex-col gap-5 rounded-[22px] bg-[var(--surface-elevated)] p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="w-full shrink-0 sm:w-[36%] lg:w-[320px]"><CampFitV3DecisionRadar axes={axes} /></div>
                  <div className="flex w-full flex-col gap-3 border-t border-[var(--border-default)] pt-4 sm:border-t-0 sm:pt-0">
                    {axes.map((axis) => (
                      <div key={axis.key} className="flex flex-col justify-between gap-1 border-b border-[var(--border-default)] pb-2 text-sm sm:flex-row sm:items-center">
                        <span className="font-extrabold text-[var(--text-secondary)]">{axis.label}</span>
                        <span className="font-bold text-[var(--text-primary)]">{getAxisDetail(axis.key, conversationState)}</span>
                      </div>
                    ))}
                    <p className="mt-2 text-xs font-semibold leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{decisionAxesSummary(axes)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                <ListCard title="꼭 필요한 지원 조건" items={result.requiredSupportConditions} />
              </div>

              {result.alternatives.length ? (
                <div className="mt-8">
                  <h2 className="text-xl font-bold">조건을 조정하면 가능한 대안</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {result.alternatives.map((alternative) => <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 py-3 text-sm leading-6 [word-break:keep-all]" key={alternative}>{alternative}</p>)}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        </div>

        <div data-campfit-export-ignore="true">
          <CampFitV3ResultActions
            reportRef={reportRef}
            result={result}
            basicInfo={basicInfo}
            {...(onRequestEmail ? { onRequestEmail } : {})}
            onBack={onBack}
            onRestart={onRestart}
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

function CityComparisonTable({
  cityComparisons,
  basicInfo,
}: {
  readonly cityComparisons: readonly CampfitV3CityComparison[]
  readonly basicInfo: CampfitV3BasicInfo
}) {
  if (!cityComparisons.length) return <Empty text="비교할 도시가 아직 없습니다." />

  return (
    <div data-campfit-report-section="city-comparison" className="overflow-x-auto rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-elevated)]">
      <table className="min-w-[640px] w-full text-left text-sm">
        <caption className="sr-only">도시별 총여행비와 추천 조건 비교</caption>
        <thead className="border-b border-[var(--border-default)] text-xs font-black text-[var(--text-secondary)]">
          <tr>
            <th className="px-4 py-4 sm:px-5" scope="col">도시</th>
            <th className="px-4 py-4 sm:px-5" scope="col">총여행비</th>
            <th className="px-4 py-4 sm:px-5" scope="col">선택 역할</th>
            <th className="px-4 py-4 sm:px-5" scope="col">추천 기간</th>
            <th className="px-4 py-4 sm:px-5" scope="col">실제 프로그램</th>
          </tr>
        </thead>
        <tbody>
          {cityComparisons.map(({ city, programs, tripCost }, index) => (
            <tr className="border-b border-[var(--border-default)] last:border-b-0" key={city.cityId}>
              <th className="px-4 py-4 font-black sm:px-5" scope="row">{index + 1}. {city.cityName}</th>
              <td className="px-4 py-4 font-bold sm:px-5">{tripCost ? tripCostLabel(tripCost.totalLow, tripCost.totalHigh) : "금액 확인 필요"}</td>
              <td className="px-4 py-4 leading-6 text-[var(--text-secondary)] sm:px-5">{city.role}</td>
              <td className="px-4 py-4 text-[var(--text-secondary)] sm:px-5">{basicInfo.durationWeeks}주</td>
              <td className="px-4 py-4 text-[var(--text-secondary)] sm:px-5">{programs.length}개</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CityCard({
  comparison,
  index,
  basicInfo,
  conversationState,
  result,
  showProgramCards,
}: {
  readonly comparison: CampfitV3CityComparison
  readonly index: number
  readonly basicInfo: CampfitV3BasicInfo
  readonly conversationState: CampfitV3ConversationState
  readonly result: CampfitV3RecommendationResult
  readonly showProgramCards: boolean
}) {
  const { city, programs, tripCost } = comparison
  const href = buildAnogroCityHref(city.cityName)
  const checks = cityCheckItems(city)
  const costDetails = cityCostDetails(city)
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
        <h4 className="text-sm font-black text-[var(--text-primary)]">추천 이유와 장점</h4>
        <ul className="mt-3 space-y-2.5">
          {cityWhyBullets(city, basicInfo, conversationState, result).map((item) => (
            <li className="flex gap-2.5 text-sm leading-6 [word-break:keep-all]" key={item}>
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-primary)]" aria-hidden>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {checks.length ? (
          <div className="mt-5 rounded-2xl bg-[var(--surface-tint-yellow)] p-4">
            <h4 className="text-sm font-black text-[var(--status-warning)]">확인이 필요한 사항</h4>
            <ul className="mt-2 space-y-1.5">
              {checks.map((item) => <li className="text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]" key={item}>• {item}</li>)}
            </ul>
          </div>
        ) : null}
        {tripCost ? <TripCostSummary cost={tripCost} /> : null}
        <div className="mt-6 border-t border-[var(--border-default)] pt-5">
          <h4 className="text-sm font-black">이 도시에서 볼 프로그램</h4>
          {!showProgramCards ? (
            <div className="mt-3 rounded-2xl bg-[var(--surface-tint-yellow)] p-4 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]" role="alert">
              프로그램 정보를 불러오지 못했어요. 잠시 후 최신 후보를 다시 확인해 주세요.
            </div>
          ) : programs.length ? (
            <div className="mt-3 space-y-3">
              {programs.map((program, programIndex) => <ProgramInlineCard program={program} index={programIndex} key={program.programId} />)}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-[var(--surface-secondary)] p-4 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">현재 조건에서 이 도시의 추천 프로그램은 확인되지 않았어요.</p>
          )}
        </div>
        <details className="group mt-5 border-t border-[var(--border-default)] pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[var(--accent-primary)] [&::-webkit-details-marker]:hidden">
            <span>비용과 세부 정보 보기</span>
            <span className="text-lg transition-transform group-open:rotate-45" aria-hidden>＋</span>
          </summary>
          <div className="mt-3 rounded-2xl bg-white p-4 text-sm">
            <p className="font-bold">{city.costEstimate.label} · 신뢰도 {confidenceLabel(city.costEstimate.confidence)}</p>
            <p className="mt-1 text-lg font-black">{costLabel(city.costEstimate.estimatedTotalMinKrw, city.costEstimate.estimatedTotalMaxKrw)}</p>
            {costDetails.included.length ? <p className="mt-3 leading-6 text-[var(--text-secondary)] [word-break:keep-all]">포함된 참고값: {costDetails.included.join(" · ")}</p> : null}
            {costDetails.missing.length ? <p className="mt-2 leading-6 text-[var(--text-secondary)] [word-break:keep-all]">추가 확인: {costDetails.missing.join(" · ")}</p> : null}
          </div>
        </details>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center self-start text-sm font-extrabold text-[var(--accent-primary)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" aria-label={`${city.cityName} 도시 자세히 보기 (새 창 열림)`}>도시 자세히 보기<span className="ml-1.5" aria-hidden>↗</span></a> : null}
      </div>
    </article>
  )
}

function ProgramInlineCard({ program, index }: { readonly program: CampfitV3ProgramCandidate; readonly index: number }) {
  const href = safeProgramDetailHref(program.detailUrl)
  const strengths = programStrengths(program)
  const cautions = programCautions(program)
  return (
    <article data-campfit-program-card data-program-id={program.programId} data-city-name={program.cityName} className="rounded-2xl border border-[var(--border-default)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.08em] text-[var(--accent-primary)]">프로그램 {index + 1} · {rankLabel(index)}</p>
          <h5 className="mt-1 text-base font-black leading-6 [word-break:keep-all]">{program.name}</h5>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{program.ageLabel} · {program.durationLabel}</p>
        </div>
        {program.imageUrl ? <img className="h-14 w-16 shrink-0 rounded-xl object-cover" src={program.imageUrl} alt="" /> : null}
      </div>
      <div className="mt-3">
        <p className="text-xs font-black text-[var(--text-primary)]">추천 이유</p>
        <p className="mt-1 text-sm leading-6 [word-break:keep-all]">{strengths[0]}</p>
        {program.tripCost ? <TripCostSummary cost={program.tripCost} /> : null}
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
            <p className="mt-1 font-bold">{program.priceLabel}</p>
            {program.verify.length ? <p className="mt-3 text-[var(--text-secondary)]">추가 확인: {program.verify.join(" · ")}</p> : null}
            {program.tripCost ? <TripCostDetails cost={program.tripCost} /> : null}
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

function costLabel(min: number | null, max: number | null): string {
  if (min === null || max === null) return "일부 비용 확인 필요"
  return `${Math.round(min / 10_000).toLocaleString("ko-KR")}만~${Math.round(max / 10_000).toLocaleString("ko-KR")}만 원`
}

function TripCostSummary({ cost }: { readonly cost: CampfitV3TripCost | CampfitV3CityCostSummary }) {
  const includedLabels = "breakdown" in cost ? tripCostIncludedLabels(cost) : []
  return (
    <div className="mt-5 rounded-2xl border border-[var(--border-default)] bg-white p-4">
      <p className="text-xs font-black tracking-[.08em] text-[var(--accent-primary)]">우리 가족 예상 총여행비</p>
      <p className="mt-1 text-xl font-black tracking-[-.02em]">{tripCostLabel(cost.totalLow, cost.totalHigh)}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{tripPriceStatusLabel(cost.priceStatus)} · 신뢰도 {confidenceLabel(cost.confidence)}</p>
      {includedLabels.length ? <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)] [word-break:keep-all]">계산에 반영: {includedLabels.join(" · ")}</p> : null}
      {cost.unresolvedItems.length ? <p className="mt-2 text-xs font-semibold leading-5 text-[var(--status-warning)] [word-break:keep-all]">확인 필요: {cost.unresolvedItems.slice(0, 2).join(" · ")}</p> : null}
    </div>
  )
}

function TripCostDetails({ cost }: { readonly cost: CampfitV3TripCost }) {
  const lines = [
    ["프로그램", cost.breakdown.program],
    ["숙소", cost.breakdown.accommodation],
    ["항공", cost.breakdown.flights],
    ["생활", cost.breakdown.living],
    ["현지 교통", cost.breakdown.localTransport],
    ["기타", cost.breakdown.other],
  ] as const
  return (
    <div className="mt-4 border-t border-[var(--border-default)] pt-3">
      <p className="text-xs font-black text-[var(--text-primary)]">총여행비 구성</p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--text-secondary)]">
        {lines.map(([label, line]) => (
          <li className="flex justify-between gap-3" key={label}>
            <span>{label} · {tripLineStatusLabel(line.status)}</span>
            <span className="font-bold text-[var(--text-primary)]">{tripCostLabel(line.low, line.high)}</span>
          </li>
        ))}
      </ul>
      {cost.assumptions.length ? <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)] [word-break:keep-all]">기준: {cost.assumptions.slice(0, 3).join(" · ")}</p> : null}
    </div>
  )
}

function tripCostLabel(low: number | null, high: number | null): string {
  if (low === null || high === null) return "금액 확인 필요"
  if (low === high) return `${Math.round(low / 10_000).toLocaleString("ko-KR")}만 원`
  return `${Math.round(low / 10_000).toLocaleString("ko-KR")}만~${Math.round(high / 10_000).toLocaleString("ko-KR")}만 원`
}

function tripPriceStatusLabel(value: CampfitV3TripCost["priceStatus"]): string {
  if (value === "exact") return "확인된 가격 중심"
  if (value === "partial") return "일부 항목 확인 필요"
  if (value === "estimated") return "일부 추정 포함"
  return "일부 비용 문의 필요"
}

function tripLineStatusLabel(value: CampfitV3TripCost["breakdown"]["program"]["status"]): string {
  if (value === "included") return "포함"
  if (value === "exact") return "확인됨"
  if (value === "partial") return "일부 확인"
  if (value === "estimated") return "추정"
  if (value === "not_available") return "사용 불가"
  return "문의"
}

function tripCostIncludedLabels(cost: CampfitV3TripCost): readonly string[] {
  const lines = [
    ["프로그램", cost.breakdown.program],
    ["숙소", cost.breakdown.accommodation],
    ["항공", cost.breakdown.flights],
    ["생활", cost.breakdown.living],
    ["교통", cost.breakdown.localTransport],
  ] as const
  return lines.filter(([, line]) => line.low !== null || line.high !== null).map(([label]) => label)
}

function confidenceLabel(value: "low" | "medium" | "high"): string {
  return value === "high" ? "높음" : value === "medium" ? "보통" : "낮음"
}
