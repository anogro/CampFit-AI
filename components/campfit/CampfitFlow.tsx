"use client"

import { useMemo, useState } from "react"
import { z } from "zod"
import { ParentAnalysisSchema, RecommendationResultSchema } from "@/schemas/campfit/campfitSchemas"
import type { CampfitInput, ParentAnalysis, ReadinessAnswers, ReadinessDraftAnswers } from "@/types/campfit"
import { CampfitProgress } from "@/components/campfit/CampfitStepper"
import { CampReadinessCheck, isReadinessChoice } from "@/components/campfit/CampReadinessCheck"
import { CampfitStartHero } from "@/components/campfit/CampfitStartHero"
import { ConcernStep, FollowUpStep, Header, NavButtons } from "@/components/campfit/FlowSections"
import { ParentInputForm } from "@/components/campfit/ParentInputForm"
import { ParentInsightSummary } from "@/components/campfit/ParentInsightSummary"
import { RecommendationDashboard } from "@/components/campfit/RecommendationDashboard"

type RecommendationResultView = z.infer<typeof RecommendationResultSchema>

const AnalyzeResponseSchema = z.object({
  analysis: ParentAnalysisSchema,
  aiUsed: z.boolean(),
})

const initialInput: CampfitInput = {
  childAge: 8,
  grade: "초2",
  englishSelfLevel: "unsure",
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
  parentConcernText: "",
}

const initialReadinessAnswers: ReadinessDraftAnswers = {
  q1: "",
  q2: "",
  q3: "",
  q4: "",
  q5: "",
  q6: "",
}

export function CampfitFlow() {
  const [step, setStep] = useState(0)
  const [input, setInput] = useState<CampfitInput>(initialInput)
  const [analysis, setAnalysis] = useState<ParentAnalysis | null>(null)
  const [analysisAiUsed, setAnalysisAiUsed] = useState(false)
  const [followUpAnswers, setFollowUpAnswers] = useState<readonly string[]>([])
  const [readinessAnswers, setReadinessAnswers] = useState<ReadinessDraftAnswers>(initialReadinessAnswers)
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

    if (step === 5) {
      return getCompleteReadinessAnswers(readinessAnswers) !== null
    }

    return true
  }, [followUpAnswers.length, input.parentConcernText, readinessAnswers, step])

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
      setAnalysisAiUsed(parsed.data.aiUsed)
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

    const completeReadinessAnswers = getCompleteReadinessAnswers(readinessAnswers)
    if (!completeReadinessAnswers) {
      setStatus("영어 체크 문항을 모두 선택한 뒤 추천 결과를 볼 수 있습니다.")
      return
    }

    setIsLoading(true)
    setStatus("캠프 난이도와 완충장치를 비교하고 있습니다.")
    try {
      const response = await fetch("/api/campfit/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          analysis,
          aiUsage: { parentAnalysis: analysisAiUsed },
          followUpAnswers,
          readinessAnswers: completeReadinessAnswers,
        }),
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

  if (step === 0) {
    return <CampfitStartHero onStart={() => setStep(1)} />
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-[1120px] gap-5 px-4 py-5 md:px-6 md:py-8">
      <Header />
      {step > 0 ? <CampfitProgress currentStep={step} /> : null}
      <main className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4 shadow-[var(--shadow-card)] md:p-6">
        {step === 1 ? <ParentInputForm input={input} onChange={setInput} /> : null}
        {step === 2 ? <ConcernStep input={input} onChange={setInput} /> : null}
        {step === 3 && analysis ? <ParentInsightSummary analysis={analysis} aiUsed={analysisAiUsed} /> : null}
        {step === 4 && analysis ? (
          <FollowUpStep analysis={analysis} answers={followUpAnswers} onChange={setFollowUpAnswers} />
        ) : null}
        {step === 5 ? <CampReadinessCheck answers={readinessAnswers} onChange={setReadinessAnswers} /> : null}
        {step === 6 && result ? (
          <RecommendationDashboard result={result} onFeedback={sendFeedback} feedbackStatus={feedbackStatus} />
        ) : null}

        {status ? (
          <p className="mt-5 rounded-md bg-[var(--surface-tint-blue)] px-3 py-2 text-sm font-semibold text-[var(--status-info)]">
            {status}
          </p>
        ) : null}
        {step > 0 && step < 6 ? (
          <NavButtons
            step={step}
            canContinue={canContinue}
            isLoading={isLoading}
            onBack={() => setStep(Math.max(1, step - 1))}
            onNext={step === 2 ? analyze : step === 5 ? recommend : () => setStep(step + 1)}
          />
        ) : null}
      </main>
      <aside className="max-w-3xl px-1 pb-3 text-sm leading-6 text-[var(--text-tertiary)]">
        <p className="[word-break:keep-all]">
          이 결과는 캠프 비교를 돕는 참고자료입니다. 영어 레벨테스트, 심리검사, 전문 상담을 대체하지 않습니다.
        </p>
      </aside>
    </div>
  )
}

function getCompleteReadinessAnswers(answers: ReadinessDraftAnswers): ReadinessAnswers | null {
  if (
    !isReadinessChoice(answers.q1) ||
    !isReadinessChoice(answers.q2) ||
    !isReadinessChoice(answers.q3) ||
    !isReadinessChoice(answers.q4) ||
    !isReadinessChoice(answers.q6)
  ) {
    return null
  }

  return {
    q1: answers.q1,
    q2: answers.q2,
    q3: answers.q3,
    q4: answers.q4,
    q5: answers.q5,
    q6: answers.q6,
  }
}
