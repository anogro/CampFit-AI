"use client"

import { useEffect, useMemo, useState } from "react"
import { CampFitV3Chat } from "@/components/campfit/v3/CampFitV3Chat"
import { CampFitV3Intake } from "@/components/campfit/v3/CampFitV3Intake"
import { CampFitV3Result } from "@/components/campfit/v3/CampFitV3Result"
import {
  CampfitV3BasicInfoSchema,
  CampfitV3ConversationResponseSchema,
  CampfitV3RecommendationResultSchema,
  CampfitV3TranscriptSchema,
} from "@/lib/campfit/v3/schemas"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationResponse,
  CampfitV3ConversationState,
  CampfitV3RecommendationResult,
  CampfitV3TranscriptMessage,
} from "@/types/campfitV3"

type Stage = "start" | "intake" | "chat" | "loading" | "result"
type StoredSession = {
  readonly stage: Stage
  readonly basicInfo: CampfitV3BasicInfo | null
  readonly conversation: CampfitV3ConversationResponse | null
  readonly transcript: readonly CampfitV3TranscriptMessage[]
  readonly result: CampfitV3RecommendationResult | null
}

const storageKey = "campfit-v3-conversational-mvp"

export function CampFitV3Flow() {
  const [stage, setStage] = useState<Stage>("start")
  const [basicInfo, setBasicInfo] = useState<CampfitV3BasicInfo | null>(null)
  const [conversation, setConversation] = useState<CampfitV3ConversationResponse | null>(null)
  const [transcript, setTranscript] = useState<readonly CampfitV3TranscriptMessage[]>([])
  const [result, setResult] = useState<CampfitV3RecommendationResult | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredSession>
        if (isStage(saved.stage)) setStage(saved.stage === "loading" ? "chat" : saved.stage)
        const parsedBasic = CampfitV3BasicInfoSchema.safeParse(saved.basicInfo)
        const parsedConversation = CampfitV3ConversationResponseSchema.safeParse(saved.conversation)
        const parsedTranscript = CampfitV3TranscriptSchema.safeParse(saved.transcript)
        const parsedResult = CampfitV3RecommendationResultSchema.safeParse(saved.result)
        if (parsedBasic.success) setBasicInfo(parsedBasic.data)
        if (parsedConversation.success) setConversation(parsedConversation.data)
        if (parsedTranscript.success) setTranscript(parsedTranscript.data)
        if (parsedResult.success) setResult(parsedResult.data)
        if ((saved.basicInfo && !parsedBasic.success) || (saved.conversation && !parsedConversation.success) || (saved.result && !parsedResult.success)) {
          throw new Error("invalid stored session")
        }
      }
    } catch {
      sessionStorage.removeItem(storageKey)
      setError("이전 상담 정보를 복원하지 못해 새 상담을 시작합니다.")
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const value: StoredSession = { stage, basicInfo, conversation, transcript, result }
    sessionStorage.setItem(storageKey, JSON.stringify(value))
  }, [basicInfo, conversation, hydrated, result, stage, transcript])

  async function beginConversation(info: CampfitV3BasicInfo): Promise<void> {
    setError("")
    try {
      const response = await postJson<CampfitV3ConversationResponse>("/api/campfit/v3/conversation/start", { basicInfo: info })
      const first: CampfitV3TranscriptMessage = response.questionKey
        ? { role: "assistant", content: response.assistantMessage, questionKey: response.questionKey }
        : { role: "assistant", content: response.assistantMessage }
      setBasicInfo(info)
      setConversation(response)
      setTranscript([first])
      setResult(null)
      setStage("chat")
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function submitAnswer(message: string, quickReplyKey: string | null): Promise<void> {
    if (!basicInfo || !conversation) return
    setError("")
    const sensitiveQuestion = conversation.questionKey === "special_care_follow_up"
    const safeMessage = sensitiveQuestion && quickReplyKey === null
      ? "있어요. 상담할 때 별도로 확인할게요"
      : message
    const userMessage: CampfitV3TranscriptMessage = conversation.questionKey
      ? { role: "user", content: safeMessage, questionKey: conversation.questionKey }
      : { role: "user", content: safeMessage }
    const nextTranscript = [...transcript, userMessage]
    try {
      const response = await postJson<CampfitV3ConversationResponse>("/api/campfit/v3/conversation/message", {
        transcript: nextTranscript,
        currentState: conversation.updatedState,
        basicInfo,
        userMessage: safeMessage,
        quickReplyKey,
      })
      const assistantMessage: CampfitV3TranscriptMessage = response.questionKey
        ? { role: "assistant", content: response.assistantMessage, questionKey: response.questionKey }
        : { role: "assistant", content: response.assistantMessage }
      setTranscript([...nextTranscript, assistantMessage])
      setConversation(response)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function generateResult(): Promise<void> {
    if (!basicInfo || !conversation) return
    setStage("loading")
    setError("")
    try {
      const response = await postJson<CampfitV3RecommendationResult>("/api/campfit/v3/recommend", {
        transcript,
        finalState: conversation.updatedState,
        basicInfo,
      })
      setResult(response)
      setStage("result")
    } catch (caught) {
      setStage("chat")
      setError(errorMessage(caught))
    }
  }

  function reset(): void {
    sessionStorage.removeItem(storageKey)
    setStage("start")
    setBasicInfo(null)
    setConversation(null)
    setTranscript([])
    setResult(null)
    setError("")
  }

  const content = useMemo(() => {
    if (stage === "start") return <StartScreen onStart={() => setStage("intake")} />
    if (stage === "intake") return <CampFitV3Intake initialValue={basicInfo} onBack={() => setStage("start")} onSubmit={beginConversation} />
    if (stage === "chat" && conversation && basicInfo) {
      return <CampFitV3Chat basicInfo={basicInfo} conversation={conversation} transcript={transcript} onAnswer={submitAnswer} onEditBasic={() => setStage("intake")} onResult={generateResult} />
    }
    if (stage === "loading") return <LoadingScreen />
    if (stage === "result" && result) return <CampFitV3Result result={result} onRestart={reset} />
    return <StartScreen onStart={() => setStage("intake")} />
  }, [basicInfo, conversation, result, stage, transcript])

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[var(--surface-secondary)] text-[var(--text-primary)]">
      {content}
      {error ? <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm font-semibold text-[var(--status-error)] shadow-lg" role="alert">{error}</div> : null}
    </div>
  )
}

function StartScreen({ onStart }: { readonly onStart: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-4 py-5 sm:px-6 lg:px-10">
      <V3Header />
      <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.02fr_.98fr] lg:gap-12 lg:py-12">
        <div className="order-2 lg:order-1">
          <div className="mb-5 flex flex-wrap gap-2" aria-label="주요 경험 방향">
            {["스쿨링", "방학캠프", "문화체험", "영어몰입"].map((item) => <span className="rounded-full border border-[var(--cta-glass-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]" key={item}>{item}</span>)}
          </div>
          <h1 className="max-w-[720px] text-[2.25rem] font-bold leading-[1.08] tracking-[-.035em] [word-break:keep-all] sm:text-[3rem] lg:text-[3.5rem]">
            완벽한 캠프는 없어도,<br />우리 가족의 기준은 있습니다
          </h1>
          <p className="mt-6 max-w-[620px] text-base font-medium leading-7 text-[var(--text-secondary)] [word-break:keep-all] sm:text-lg sm:leading-8">
            후기와 광고만으로 알기 어려운 아이의 경험 목표, 필요한 지원, 가족의 체류 조건을 대화로 차근차근 정리해드려요.
          </p>
          <button className="glass-cta mt-8 inline-flex min-h-14 items-center justify-center rounded-full px-7 text-base font-extrabold transition hover:-translate-y-0.5" type="button" onClick={onStart}>
            AI 상담 시작하기 <span className="ml-2" aria-hidden>→</span>
          </button>
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">약 5~8개의 짧은 질문 · 입력 내용은 현재 브라우저 세션에만 보관</p>
        </div>
        <div className="order-1 mx-auto w-full max-w-[560px] lg:order-2">
          <img className="h-auto w-full object-contain" src="/images/campfit image.png" alt="노트북으로 해외 교육 경험을 준비하는 부모와 아이" />
        </div>
      </section>
    </main>
  )
}

export function V3Header() {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--border-default)]">
      <div className="flex items-center gap-2.5">
        <img className="h-6 w-auto object-contain" src="/images/Small Logo.png" alt="" />
        <span className="text-lg font-black tracking-[-.03em] text-[#18382a]">ANOGRO</span>
      </div>
      <span className="rounded-full border border-[var(--border-default)] bg-white px-3 py-2 text-xs font-extrabold text-[var(--accent-primary)] sm:text-sm">CampFit AI</span>
    </header>
  )
}

function LoadingScreen() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col px-4 py-5 sm:px-6">
      <V3Header />
      <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <div className="grid h-24 w-24 place-items-center rounded-[32px] bg-[var(--accent-soft)] text-3xl font-black text-[var(--accent-primary)] motion-safe:animate-pulse">CF</div>
        <h1 className="mt-7 text-2xl font-bold tracking-[-.03em] sm:text-3xl">상담 내용을 정리하고 있어요</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-secondary)] sm:text-base">경험 방향, 도시 현실성, 실제 프로그램 후보와 마지막 확인사항을 함께 비교합니다.</p>
      </section>
    </main>
  )
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await response.json() as unknown
  if (!response.ok) throw new Error(apiMessage(json))
  return json as T
}

function apiMessage(value: unknown): string {
  if (typeof value === "object" && value !== null && "message" in value && typeof value.message === "string") return value.message
  return "요청 처리 중 문제가 생겼습니다."
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "요청 처리 중 문제가 생겼습니다."
}

function isStage(value: unknown): value is Stage {
  return value === "start" || value === "intake" || value === "chat" || value === "loading" || value === "result"
}
