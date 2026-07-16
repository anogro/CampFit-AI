"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CampFitV3Chat } from "@/components/campfit/v3/CampFitV3Chat"
import { CampFitV3Intake } from "@/components/campfit/v3/CampFitV3Intake"
import { CampFitV3Result } from "@/components/campfit/v3/CampFitV3Result"
import { sanitizeConversationInput } from "@/components/campfit/v3/conversationInput"
import { shouldDiscardStoredCampfitV3Session } from "@/components/campfit/v3/sessionMode"
import {
  emptyCampfitV3IntakeDraft,
  intakeDraftFromBasicInfo,
  parseStoredIntakeDraft,
  type CampfitV3IntakeDraft,
} from "@/components/campfit/v3/intakeDraft"
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
  readonly intakeDraft: CampfitV3IntakeDraft
  readonly basicInfo: CampfitV3BasicInfo | null
  readonly conversation: CampfitV3ConversationResponse | null
  readonly transcript: readonly CampfitV3TranscriptMessage[]
  readonly result: CampfitV3RecommendationResult | null
  readonly demoMode?: boolean
}

const storageKey = "campfit-v3-conversational-mvp"

export function CampFitV3Flow() {
  const [stage, setStage] = useState<Stage>("start")
  const [intakeDraft, setIntakeDraft] = useState<CampfitV3IntakeDraft>(emptyCampfitV3IntakeDraft)
  const [basicInfo, setBasicInfo] = useState<CampfitV3BasicInfo | null>(null)
  const [conversation, setConversation] = useState<CampfitV3ConversationResponse | null>(null)
  const [transcript, setTranscript] = useState<readonly CampfitV3TranscriptMessage[]>([])
  const [result, setResult] = useState<CampfitV3RecommendationResult | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState("")
  const skipNextSessionWriteRef = useRef(false)

  useEffect(() => {
    try {
      const demoRequested = new URLSearchParams(window.location.search).get("demo") === "1"
      if (demoRequested) setDemoMode(true)
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredSession>
        if (shouldDiscardStoredCampfitV3Session(demoRequested, saved.demoMode)) {
          sessionStorage.removeItem(storageKey)
        } else {
          if (saved.demoMode === true) setDemoMode(true)
          if (isStage(saved.stage)) setStage(saved.stage === "loading" ? "chat" : saved.stage)
          const parsedBasic = CampfitV3BasicInfoSchema.safeParse(saved.basicInfo)
          const parsedConversation = CampfitV3ConversationResponseSchema.safeParse(saved.conversation)
          const parsedTranscript = CampfitV3TranscriptSchema.safeParse(saved.transcript)
          const parsedResult = CampfitV3RecommendationResultSchema.safeParse(saved.result)
          const parsedDraft = parseStoredIntakeDraft(saved.intakeDraft)
          if (parsedBasic.success) {
            setBasicInfo(parsedBasic.data)
            if (parsedDraft === null) setIntakeDraft(intakeDraftFromBasicInfo(parsedBasic.data))
          }
          if (parsedDraft !== null) setIntakeDraft(parsedDraft)
          if (parsedConversation.success) setConversation(parsedConversation.data)
          if (parsedTranscript.success) setTranscript(parsedTranscript.data)
          if (parsedResult.success) setResult(parsedResult.data)
          if ((saved.basicInfo && !parsedBasic.success) || (saved.conversation && !parsedConversation.success) || (saved.result && !parsedResult.success)) {
            throw new Error("invalid stored session")
          }
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
    if (skipNextSessionWriteRef.current) {
      skipNextSessionWriteRef.current = false
      sessionStorage.removeItem(storageKey)
      return
    }
    const value: StoredSession = { stage, intakeDraft, basicInfo, conversation, transcript, result, demoMode }
    sessionStorage.setItem(storageKey, JSON.stringify(value))
  }, [basicInfo, conversation, demoMode, hydrated, intakeDraft, result, stage, transcript])

  async function beginConversation(info: CampfitV3BasicInfo): Promise<void> {
    setError("")
    try {
      const response = await postJson<CampfitV3ConversationResponse>("/api/campfit/v3/conversation/start", { basicInfo: info })
      const first: CampfitV3TranscriptMessage = response.questionKey
        ? { role: "assistant", content: response.assistantMessage, questionKey: response.questionKey }
        : { role: "assistant", content: response.assistantMessage }
      setBasicInfo(response.updatedBasicInfo)
      setIntakeDraft(intakeDraftFromBasicInfo(response.updatedBasicInfo))
      setConversation(response)
      setTranscript([first])
      setResult(null)
      setStage("chat")
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function submitAnswer(message: string, quickReplyKey: string | null): Promise<boolean> {
    if (!basicInfo || !conversation) return false
    setError("")
    const sensitiveQuestion = conversation.questionKey === "special_care_follow_up"
    const safeMessage = quickReplyKey === null
      ? sanitizeConversationInput(message, sensitiveQuestion).safeMessage
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
      setBasicInfo(response.updatedBasicInfo)
      setIntakeDraft(intakeDraftFromBasicInfo(response.updatedBasicInfo))
      return true
    } catch (caught) {
      setError(errorMessage(caught))
      return false
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
        demo: demoMode,
      })
      setResult(response)
      setStage("result")
    } catch (caught) {
      setStage("chat")
      setError(errorMessage(caught))
    }
  }

  function reset(): void {
    skipNextSessionWriteRef.current = true
    sessionStorage.removeItem(storageKey)
    setStage("start")
    setIntakeDraft({ ...emptyCampfitV3IntakeDraft, childAges: [""] })
    setBasicInfo(null)
    setConversation(null)
    setTranscript([])
    setResult(null)
    setError("")
  }

  const content = useMemo(() => {
    if (stage === "start") return <StartScreen demoMode={demoMode} onStart={() => setStage("intake")} />
    if (stage === "intake") return <CampFitV3Intake draft={intakeDraft} onDraftChange={setIntakeDraft} onBack={() => setStage("start")} onSubmit={beginConversation} />
    if (stage === "chat" && conversation && basicInfo) {
      return <CampFitV3Chat basicInfo={basicInfo} conversation={conversation} transcript={transcript} onAnswer={submitAnswer} onEditBasic={() => setStage("intake")} onResult={generateResult} />
    }
    if (stage === "loading") return <LoadingScreen />
    if (stage === "result" && result && basicInfo && conversation) {
      return (
        <CampFitV3Result
          result={result}
          basicInfo={basicInfo}
          conversationState={conversation.updatedState}
          onBack={() => setStage("chat")}
          onRestart={reset}
        />
      )
    }
    return <StartScreen demoMode={demoMode} onStart={() => setStage("intake")} />
  }, [basicInfo, conversation, demoMode, intakeDraft, result, stage, transcript])

  return (
    <div className={`${stage === "chat" ? "h-dvh overflow-hidden" : "min-h-dvh overflow-x-hidden"} bg-[var(--surface-secondary)] text-[var(--text-primary)]`}>
      {content}
      {error ? <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm font-semibold text-[var(--status-error)] shadow-lg" role="alert">{error}</div> : null}
    </div>
  )
}

function StartScreen({ demoMode, onStart }: { readonly demoMode: boolean; readonly onStart: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-4 py-3 sm:px-6 sm:py-5 lg:px-10">
      <V3Header />
      <section className="grid flex-1 items-center gap-6 py-6 sm:gap-8 sm:py-10 lg:grid-cols-[1.02fr_.98fr] lg:gap-12 lg:py-12">
        <div className="order-1">
          <div className="mb-4 flex flex-wrap gap-2 sm:mb-5" aria-label="주요 경험 방향">
            {["스쿨링", "방학캠프", "문화체험", "영어몰입"].map((item) => <span className="rounded-full border border-[var(--cta-glass-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]" key={item}>{item}</span>)}
          </div>
          <h1 className="max-w-[720px] text-[2rem] font-bold leading-[1.08] tracking-[-.035em] [word-break:keep-all] sm:text-[3rem] lg:text-[3.5rem]">
            우리 가족에게 맞는 해외 캠프와 도시를<br />AI 상담으로 찾아보세요
          </h1>
          <p className="mt-4 max-w-[620px] text-base font-medium leading-7 text-[var(--text-secondary)] [word-break:keep-all] sm:mt-6 sm:text-lg sm:leading-8">
            아이에게 맞는 해외 캠프뿐 아니라 부모가 함께 머물기 좋은 도시까지, 대화로 찾아드립니다. 아이의 영어 수준과 성향, 원하는 경험, 부모의 체류 조건을 함께 살펴 후보를 비교해드려요.
          </p>
          <button className="glass-cta mt-6 inline-flex min-h-14 items-center justify-center rounded-full px-7 text-base font-extrabold transition hover:-translate-y-0.5 sm:mt-8" type="button" onClick={onStart}>
            AI 상담 시작하기 <span className="ml-2" aria-hidden>→</span>
          </button>
          {demoMode ? <p className="mt-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">시연용 예시 카탈로그</p> : null}
          <p className="mt-3 text-sm text-[var(--text-tertiary)] sm:mt-4">일반적으로 5~8개, 복합 조건은 최대 10개의 짧은 질문 · 입력 내용은 현재 브라우저 세션에만 보관</p>
        </div>
        <div className="order-2 mx-auto w-full max-w-[320px] sm:max-w-[480px] lg:max-w-[560px]">
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
      <span className="text-xs font-extrabold text-[var(--accent-primary)] sm:text-sm">CampFit AI</span>
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
