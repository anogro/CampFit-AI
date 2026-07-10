"use client"

import { useState } from "react"
import { CampfitStartHero } from "@/components/campfit/CampfitStartHero"
import { AIUnderstandingReview } from "@/components/campfit/v2/AIUnderstandingReview"
import { ConsultingReportView } from "@/components/campfit/v2/ConsultingReportView"
import { DynamicQuestionFlow, type DynamicQuestionAnswerDraft } from "@/components/campfit/v2/DynamicQuestionFlow"
import { NaturalConsultationForm } from "@/components/campfit/v2/NaturalConsultationForm"
import { initialRequiredIntake } from "@/components/campfit/v2/options"
import { RequiredIntakeForm } from "@/components/campfit/v2/RequiredIntakeForm"
import type { AnalyzeV2Response, CampFitV2Step, MaterializedQuestionView, RecommendV2Response } from "@/components/campfit/v2/types"
import type { NaturalConsultationInput, RecommendationReportV2, RequiredIntake } from "@/types/campfitV2"

const initialNaturalInput: NaturalConsultationInput = {
  situationText: "",
  childContextText: "",
  successAndConcernsText: "",
}

type CreateV2SessionResponse = {
  readonly sessionId: string
}

export function CampFitV2Flow() {
  const [step, setStep] = useState<CampFitV2Step>("landing")
  const [requiredIntake, setRequiredIntake] = useState<RequiredIntake>(initialRequiredIntake)
  const [naturalInput, setNaturalInput] = useState<NaturalConsultationInput>(initialNaturalInput)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState<AnalyzeV2Response | null>(null)
  const [dynamicQuestions, setDynamicQuestions] = useState<readonly MaterializedQuestionView[]>([])
  const [dynamicAnswers, setDynamicAnswers] = useState<readonly DynamicQuestionAnswerDraft[]>([])
  const [report, setReport] = useState<RecommendationReportV2 | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function startAnalysis(): Promise<void> {
    setLoading(true)
    setError("")
    try {
      const session = await postJson<CreateV2SessionResponse>("/api/campfit/v2/session", {
        requiredIntake,
        naturalInput,
      })
      const nextSessionId = session.sessionId
      if (nextSessionId.length === 0) {
        throw new Error("상담 정보를 먼저 저장하지 못했습니다. 다시 시도해주세요.")
      }

      setSessionId(nextSessionId)
      const analyzed = await analyzeSession(nextSessionId)
      setAiSummary(analyzed)
      setStep("ai_review")
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setLoading(false)
    }
  }

  async function loadQuestionsOrRecommend(): Promise<void> {
    if (sessionId === null) return
    setLoading(true)
    setError("")
    try {
      const json = await getJson<{ readonly questions: readonly MaterializedQuestionView[] }>(`/api/campfit/v2/questions?sessionId=${sessionId}`)
      setDynamicQuestions(json.questions)
      if (json.questions.length > 0) {
        setStep("dynamic_questions")
        return
      }

      await recommend(sessionId)
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setLoading(false)
    }
  }

  async function submitDynamicAnswers(): Promise<void> {
    if (sessionId === null) return
    setLoading(true)
    setError("")
    try {
      await postJson("/api/campfit/v2/answers", { sessionId, answers: dynamicAnswers })
      await recommend(sessionId)
    } catch (caught) {
      setError(messageFromError(caught))
    } finally {
      setLoading(false)
    }
  }

  async function recommend(activeSessionId: string): Promise<void> {
    const result = await postJson<RecommendV2Response>("/api/campfit/v2/recommend", { sessionId: activeSessionId })
    setReport(result.report)
    setStep("report")
  }

  if (step === "landing") {
    return <CampfitStartHero onStart={() => setStep("required_intake")} />
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-[1120px] gap-5 px-4 py-5 md:px-6 md:py-8">
      <header className="apple-glass grid gap-5 rounded-[28px] p-5 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/images/Small Logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} />
            <p className="text-sm font-extrabold tracking-[0.04em] text-[var(--text-primary)]">ANOGRO</p>
          </div>
          {step === "report" ? null : <p className="text-sm font-medium text-[var(--text-tertiary)]">CampFit v2</p>}
        </div>
        <div className="grid gap-3">
          <h1 className="max-w-3xl text-[1.85rem] font-bold leading-[1.08] text-[var(--text-primary)] [word-break:keep-all] sm:text-[2.35rem] md:text-[2.85rem]">
            완벽한 캠프는 없어도, 우리 가족의 기준은 있습니다
          </h1>
          <p className="max-w-3xl text-base font-medium leading-7 text-[var(--text-secondary)] [word-break:keep-all]">
            입력해주신 조건과 상황을 바탕으로, 맞는 점과 확인이 필요한 조건, 조정 가능한 방향을 함께 정리합니다.
          </p>
        </div>
        <Progress step={step} />
      </header>
      <main className="apple-glass rounded-[28px] p-4 md:p-6">
        {step === "required_intake" ? <RequiredIntakeForm value={requiredIntake} onChange={setRequiredIntake} onNext={() => setStep("natural_input")} /> : null}
        {step === "natural_input" ? <NaturalConsultationForm value={naturalInput} loading={loading} onBack={() => setStep("required_intake")} onChange={setNaturalInput} onSubmit={startAnalysis} /> : null}
        {step === "ai_review" && aiSummary ? <AIUnderstandingReview summary={aiSummary} loading={loading} onBack={() => setStep("natural_input")} onContinue={loadQuestionsOrRecommend} /> : null}
        {step === "dynamic_questions" ? <DynamicQuestionFlow questions={dynamicQuestions} answers={dynamicAnswers} loading={loading} onChange={setDynamicAnswers} onSubmit={submitDynamicAnswers} /> : null}
        {step === "report" && report ? <ConsultingReportView report={report} /> : null}
        {error ? <p className="mt-5 rounded-md bg-[var(--surface-tint-yellow)] px-3 py-2 text-sm font-semibold text-[var(--status-warning)]">{error}</p> : null}
      </main>
    </div>
  )
}

async function analyzeSession(sessionId: string): Promise<AnalyzeV2Response> {
  if (sessionId.length === 0) {
    throw new Error("상담 정보를 먼저 저장하지 못했습니다. 다시 시도해주세요.")
  }

  return postJson<AnalyzeV2Response>("/api/campfit/v2/analyze", { sessionId })
}

function Progress({ step }: { readonly step: CampFitV2Step }) {
  const steps: readonly CampFitV2Step[] = ["required_intake", "natural_input", "ai_review", "dynamic_questions", "report"]
  const index = steps.indexOf(step)
  const percent = Math.round(((index + 1) / steps.length) * 100)
  return (
    <div className="grid gap-2">
      <div className="flex justify-between text-xs font-bold text-[var(--text-tertiary)]">
        <span>상담 진행률</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]">
        <div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await response.json()
  if (!response.ok) throw new Error(apiMessage(json))
  return json
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const json = await response.json()
  if (!response.ok) throw new Error(apiMessage(json))
  return json
}

function apiMessage(value: unknown): string {
  if (typeof value === "object" && value !== null && "message" in value && typeof value.message === "string") {
    return value.message
  }
  return "요청 처리 중 문제가 생겼습니다."
}

function messageFromError(value: unknown): string {
  return value instanceof Error ? value.message : "요청 처리 중 문제가 생겼습니다."
}
