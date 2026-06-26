"use client"

import { useMemo, useState } from "react"
import { z } from "zod"
import { ParentAnalysisSchema, RecommendationResultSchema } from "@/schemas/campfit/campfitSchemas"
import type { CampfitInput, ParentAnalysis, ReadinessAnswers } from "@/types/campfit"
import { CampfitProgress } from "@/components/campfit/CampfitStepper"
import { CampReadinessCheck } from "@/components/campfit/CampReadinessCheck"
import { ConcernStep, FollowUpStep, Header, NavButtons } from "@/components/campfit/FlowSections"
import { ParentInputForm } from "@/components/campfit/ParentInputForm"
import { ParentInsightSummary } from "@/components/campfit/ParentInsightSummary"
import { RecommendationDashboard } from "@/components/campfit/RecommendationDashboard"

type RecommendationResultView = z.infer<typeof RecommendationResultSchema>

const AnalyzeResponseSchema = z.object({
  analysis: ParentAnalysisSchema,
})

const initialInput: CampfitInput = {
  childAge: 8,
  grade: "초2",
  englishSelfLevel: "almost_none",
  overseasExperience: "none",
  shynessLevel: "high",
  separationTolerance: "medium",
  budgetRange: "3m_5m",
  destinationPreference: "no_preference",
  travelReadiness: "moderate_distance",
  durationWeeks: "2w",
  parentAccompanied: "preferred",
  koreanManagerRequired: "required",
  preferredProgramType: "managed_immersion",
  parentConcernText:
    "초2 아이입니다. 영어는 거의 못하고 낯가림이 있습니다. 그래도 영어 실력과 자신감이 늘었으면 좋겠습니다. 처음 해외캠프라 걱정되지만 한국인 관리자는 있었으면 좋겠습니다.",
}

const initialReadinessAnswers: ReadinessAnswers = {
  q1: "A",
  q2: "A",
  q3: "A",
  q4: "A",
  q5: "I like soccer.",
  q6: "B",
}

export function CampfitFlow() {
  const [step, setStep] = useState(1)
  const [input, setInput] = useState<CampfitInput>(initialInput)
  const [analysis, setAnalysis] = useState<ParentAnalysis | null>(null)
  const [followUpAnswers, setFollowUpAnswers] = useState<readonly string[]>([])
  const [readinessAnswers, setReadinessAnswers] = useState<ReadinessAnswers>(initialReadinessAnswers)
  const [result, setResult] = useState<RecommendationResultView | null>(null)
  const [status, setStatus] = useState("")
  const [feedbackStatus, setFeedbackStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const canContinue = useMemo(() => {
    if (step === 2) {
      return input.parentConcernText.trim().length >= 20
    }

    if (step === 4) {
      return followUpAnswers.length > 0
    }

    return true
  }, [followUpAnswers.length, input.parentConcernText, step])

  async function analyze(): Promise<void> {
    setIsLoading(true)
    setStatus("AI가 학부모 고민을 구조화하고 있습니다.")
    try {
      const response = await fetch("/api/campfit/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      })
      const json = await response.json()
      if (!response.ok) {
        setStatus("입력값을 확인한 뒤 다시 시도해 주세요.")
        return
      }

      const parsed = AnalyzeResponseSchema.safeParse(json)
      if (!parsed.success) {
        setStatus("분석 결과를 읽는 중 문제가 생겨 기본 분석으로 진행해 주세요.")
        return
      }

      setAnalysis(parsed.data.analysis)
      setFollowUpAnswers(parsed.data.analysis.followUpQuestions.map(() => ""))
      setStep(3)
      setStatus("")
    } finally {
      setIsLoading(false)
    }
  }

  async function recommend(): Promise<void> {
    if (!analysis) {
      return
    }

    setIsLoading(true)
    setStatus("캠프 난이도와 완충장치를 비교하고 있습니다.")
    try {
      const response = await fetch("/api/campfit/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, analysis, followUpAnswers, readinessAnswers }),
      })
      const json = await response.json()
      if (!response.ok) {
        setStatus("추천 생성에 필요한 값을 다시 확인해 주세요.")
        return
      }

      const parsed = RecommendationResultSchema.safeParse(json)
      if (!parsed.success) {
        setStatus("추천 결과 형식을 확인하지 못했습니다. 다시 시도해 주세요.")
        return
      }

      setResult(parsed.data)
      setStep(6)
      setStatus("")
    } finally {
      setIsLoading(false)
    }
  }

  async function sendFeedback(feedback: "good_fit" | "different" | "unsure" | "consultation_requested", campId?: string) {
    if (!result) {
      return
    }

    await fetch("/api/campfit/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: result.sessionId, feedback, clickedCampId: campId }),
    })
    setFeedbackStatus(feedback === "consultation_requested" ? "상담 요청 클릭이 저장되었습니다." : "피드백이 저장되었습니다.")
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-[1180px] gap-6 px-4 py-6 md:px-6 md:py-8">
      <Header />
      <CampfitProgress currentStep={step} />
      <main className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4 shadow-[0_14px_40px_rgb(21_94_239_/_0.10)] md:p-7">
        {step === 1 ? <ParentInputForm input={input} onChange={setInput} /> : null}
        {step === 2 ? <ConcernStep input={input} onChange={setInput} /> : null}
        {step === 3 && analysis ? <ParentInsightSummary analysis={analysis} /> : null}
        {step === 4 && analysis ? (
          <FollowUpStep analysis={analysis} answers={followUpAnswers} onChange={setFollowUpAnswers} />
        ) : null}
        {step === 5 ? <CampReadinessCheck answers={readinessAnswers} onChange={setReadinessAnswers} /> : null}
        {step === 6 && result ? (
          <RecommendationDashboard result={result} onFeedback={sendFeedback} feedbackStatus={feedbackStatus} />
        ) : null}

        {status ? <p className="mt-5 text-sm font-bold text-[var(--accent-primary)]">{status}</p> : null}
        {step < 6 ? (
          <NavButtons
            step={step}
            canContinue={canContinue}
            isLoading={isLoading}
            onBack={() => setStep(Math.max(1, step - 1))}
            onNext={step === 2 ? analyze : step === 5 ? recommend : () => setStep(step + 1)}
          />
        ) : null}
      </main>
      <aside className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] px-4 py-3 text-sm leading-6 text-[var(--text-tertiary)]">
        <p className="[word-break:keep-all]">
          이 결과는 캠프 비교를 돕는 참고자료입니다. 영어 레벨테스트, 심리검사, 전문 상담을 대체하지 않습니다.
        </p>
      </aside>
    </div>
  )
}
