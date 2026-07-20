"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { CampfitStartHero } from "@/components/campfit/CampfitStartHero"
import { CampFitV3Chat } from "@/components/campfit/v3/CampFitV3Chat"
import { CampFitV3Frame, V3Header } from "@/components/campfit/v3/CampFitV3Frame"
import { CampFitV3Intake } from "@/components/campfit/v3/CampFitV3Intake"
import { CampFitV3Result } from "@/components/campfit/v3/CampFitV3Result"
import { useCampFitShellMode } from "@/components/campfit/v3/CampFitShell"
import { sanitizeConversationInput } from "@/components/campfit/v3/conversationInput"
import { appendOptimisticUserMessage } from "@/components/campfit/v3/chatUi"
import {
  shouldDiscardStoredCampfitV3Session,
  shouldRefreshStoredCampfitV3Result,
} from "@/components/campfit/v3/sessionMode"
import { AiAvatar } from "@/components/campfit/v3/AiAvatar"
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
  const mode = useCampFitShellMode()
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
          const refreshEmptyDemoResult = parsedResult.success && shouldRefreshStoredCampfitV3Result({
            demoRequested,
            savedDemoMode: saved.demoMode,
            savedStage: saved.stage,
            destinationCount: parsedResult.data.destinationRecommendations.length,
            programCount: parsedResult.data.programCandidates.length,
          })
          if (parsedBasic.success) {
            setBasicInfo(parsedBasic.data)
            if (parsedDraft === null) setIntakeDraft(intakeDraftFromBasicInfo(parsedBasic.data))
          }
          if (parsedDraft !== null) setIntakeDraft(parsedDraft)
          if (parsedConversation.success) setConversation(parsedConversation.data)
          if (parsedTranscript.success) setTranscript(parsedTranscript.data)
          if (refreshEmptyDemoResult) {
            setStage("chat")
            setResult(null)
          } else if (parsedResult.success) {
            setResult(parsedResult.data)
          }
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
    const nextTranscript = appendOptimisticUserMessage(transcript, safeMessage, conversation.questionKey)
    setTranscript(nextTranscript)
    if (conversation.readyForRecommendation && conversation.updatedState.currentQuestionKey === null && quickReplyKey === null) {
      setTranscript([...nextTranscript, { role: "assistant", content: "추가로 말씀해주신 조건을 반영했어요. 더 답하거나 왼쪽의 결과 보기로 이동할 수 있어요." }])
      return true
    }
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
    <div
      data-campfit-flow="true"
      data-campfit-mode={mode}
      className={`${stage === "chat" ? "h-dvh overflow-hidden" : "min-h-dvh overflow-x-clip"} ${mode === "embedded" ? "bg-transparent" : "bg-[var(--surface-secondary)]"} text-[var(--text-primary)]`}
    >
      {content}
      {error ? <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm font-semibold text-[var(--status-error)] shadow-lg" role="alert">{error}</div> : null}
    </div>
  )
}

function StartScreen({ demoMode, onStart }: { readonly demoMode: boolean; readonly onStart: () => void }) {
  return (
    <div className="relative">
      <CampfitStartHero onStart={onStart} />
      {demoMode ? <p className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">Demo Catalog</p> : null}
    </div>
  )
}



function LoadingScreen() {
  return (
    <CampFitV3Frame>
      <V3Header />
      <section className="flex flex-1 flex-col items-center justify-center py-12 text-center" aria-label="결과 생성 중">
        <AiAvatar className="h-24 w-24 motion-safe:animate-pulse" />
        <h1 className="mt-7 text-2xl font-bold tracking-[-.03em] sm:text-3xl">우리 가족에게 맞는 방향을 정리하고 있어요</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-secondary)] sm:text-base">도시와 프로그램 조건을 함께 비교하고 있어요</p>
      </section>
    </CampFitV3Frame>
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
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "message" in value.error && typeof value.error.message === "string") return value.error.message
  return "요청 처리 중 문제가 생겼습니다."
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "요청 처리 중 문제가 생겼습니다."
}

function isStage(value: unknown): value is Stage {
  return value === "start" || value === "intake" || value === "chat" || value === "loading" || value === "result"
}
