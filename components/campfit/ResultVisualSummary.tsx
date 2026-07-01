"use client"

import { Download, FileText } from "lucide-react"
import type { z } from "zod"
import type { RecommendationResultSchema } from "@/schemas/campfit/campfitSchemas"
import { AiUsageBadge } from "@/components/campfit/AiUsageBadge"
import { readinessLabel } from "@/components/campfit/labels"
import { RadarPanel, type AxisScore } from "@/components/campfit/ResultRadarChart"

type RecommendationResultView = z.infer<typeof RecommendationResultSchema>

type MetricCard = {
  readonly label: string
  readonly value: string
  readonly helper: string
}

const supportLabels = {
  beginner_class: "초급반",
  korean_manager: "한국어 케어",
  korean_dorm_option: "한국 기숙 옵션",
  parent_accompanied: "부모 동반",
  buddy_system: "버디 시스템",
  early_adaptation_support: "초기 적응",
  daily_parent_report: "생활 리포트",
  low_pressure_speaking_environment: "저압박 말하기",
  small_group_care: "소그룹 케어",
} as const

export function ResultVisualSummary({ result }: { readonly result: RecommendationResultView }) {
  const goalScores = getGoalScores(result)
  const childScores = getChildScores(result)
  const topRecommendation = result.recommendations[0]
  const metricCards: readonly MetricCard[] = [
    {
      label: "진단 유형",
      value: result.analysis.parentType,
      helper: result.aiUsage.parentAnalysis ? "Gemini가 부모 입력을 분석" : "기본 규칙으로 분석",
    },
    {
      label: "소통·적응 준비도",
      value: readinessLabel(result.readiness.overallReadiness),
      helper: "부모 관찰 기준의 영어 소통과 적응 신호 반영",
    },
    {
      label: "우선 추천 도시",
      value: topRecommendation ? `${topRecommendation.camp.city}, ${topRecommendation.camp.country}` : "후보 재조정 필요",
      helper: topRecommendation ? `${topRecommendation.score}점 · 대표 후보 ${topRecommendation.camp.name}` : "조건을 조금 완화해 주세요",
    },
  ] as const

  return (
    <section className="apple-glass rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--accent-primary)]">결과 리포트</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
            한눈에 보는 도시와 체류 적합도
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <AiUsageBadge
            used={result.aiUsage.parentAnalysis}
            usedLabel="Gemini 분석 사용"
            fallbackLabel="기본 분석 사용"
          />
          <AiUsageBadge
            used={result.aiUsage.recommendationExplanation}
            usedLabel="Gemini 문장 보강"
            fallbackLabel="기본 추천 문장"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {metricCards.map((metric) => (
          <Metric key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <RadarPanel title="부모 선택 기준" scores={goalScores} />
        <div className="grid gap-5">
          <ScoreList title="아이 적응 신호" scores={childScores} />
          <SupportPanel result={result} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--border-subtle)] pt-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid gap-2">
          {result.analysis.summaryForParent.slice(0, 2).map((summary) => (
            <p key={summary} className="text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
              {summary}
            </p>
          ))}
        </div>
        <button
          className="apple-pill inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--border-default)] bg-[var(--surface-glass)] px-5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-tint-blue)] active:scale-[0.98]"
          type="button"
          onClick={() => downloadReport(result)}
        >
          <Download size={17} aria-hidden="true" />
          상세 리포트 다운로드
        </button>
      </div>
    </section>
  )
}

function Metric({ metric }: { readonly metric: MetricCard }) {
  return (
    <div className="apple-glass-soft rounded-[22px] p-4">
      <p className="text-xs font-semibold text-[var(--text-tertiary)]">{metric.label}</p>
      <p className="mt-2 line-clamp-2 font-semibold leading-6 text-[var(--text-primary)] [word-break:keep-all]">{metric.value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)] [word-break:keep-all]">{metric.helper}</p>
    </div>
  )
}

function ScoreList({ title, scores }: { readonly title: string; readonly scores: readonly AxisScore[] }) {
  return (
    <div className="apple-glass-soft rounded-[22px] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <div className="mt-3 grid gap-3">
        {scores.map((score) => (
          <ScoreRow key={score.label} score={score} />
        ))}
      </div>
    </div>
  )
}

function ScoreRow({ score }: { readonly score: AxisScore }) {
  const percent = Math.round(score.value * 100)

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--text-secondary)]">{score.label}</span>
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">{percent}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--border-subtle)]" aria-hidden="true">
        <div className="h-full rounded-full bg-[var(--accent-primary)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function SupportPanel({ result }: { readonly result: RecommendationResultView }) {
  const supportItems = [...new Set([...result.analysis.supportNeeded, ...result.readiness.recommendedSupport])].slice(0, 6)

  return (
    <div className="rounded-[22px] border border-[rgb(255_204_0_/_0.32)] bg-[rgb(255_204_0_/_0.12)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <FileText size={17} className="text-[var(--status-warning)]" aria-hidden="true" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">상담 전 확인할 보호 장치</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {supportItems.map((item) => (
          <span key={item} className="apple-pill bg-[var(--surface-glass)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {supportLabels[item]}
          </span>
        ))}
      </div>
    </div>
  )
}

function getGoalScores(result: RecommendationResultView): readonly AxisScore[] {
  const goal = result.analysis.parentGoal
  return [
    { label: "영어", value: goal.englishGrowth },
    { label: "자신감", value: goal.confidenceGrowth },
    { label: "독립", value: goal.independenceGrowth },
    { label: "또래", value: goal.socialGrowth },
    { label: "안전", value: goal.safetyPriority },
    { label: "경험", value: goal.experiencePriority },
  ] as const
}

function getChildScores(result: RecommendationResultView): readonly AxisScore[] {
  const profile = result.analysis.childProfile
  return [
    { label: "영어 준비", value: profile.englishReadiness },
    { label: "사회성", value: profile.socialConfidence },
    { label: "분리 적응", value: profile.separationTolerance },
    { label: "환경 적응", value: profile.newEnvironmentAdaptability },
    { label: "도전 수용", value: profile.challengeTolerance },
  ] as const
}

function downloadReport(result: RecommendationResultView) {
  const blob = new Blob([formatReport(result)], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `campfit-report-${result.sessionId}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

function formatReport(result: RecommendationResultView): string {
  const recommendations = result.recommendations
    .map((item, index) => {
      return [
        `${index + 1}. ${item.camp.name} (${item.score}점)`,
        `- 지역: ${item.camp.country} ${item.camp.city}`,
        `- 추천 이유: ${item.explanation.reason}`,
        `- 주의점: ${item.explanation.caution}`,
        `- 상담 질문: ${item.explanation.questionsBeforeConsultation.join(" / ")}`,
      ].join("\n")
    })
    .join("\n\n")

  return [
    "CampFit AI 상세 리포트",
    "",
    `진단 유형: ${result.analysis.parentType}`,
    `아이 준비도: ${readinessLabel(result.readiness.overallReadiness)}`,
    "",
    "요약",
    ...result.analysis.summaryForParent.map((summary) => `- ${summary}`),
    "",
    "추천 프로그램",
    recommendations || "조건을 완화해 후보를 다시 확인해 주세요.",
  ].join("\n")
}
