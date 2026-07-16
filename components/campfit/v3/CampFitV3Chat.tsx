"use client"

import { useEffect, useRef, useState } from "react"
import { CampFitV3Frame } from "@/components/campfit/v3/CampFitV3Frame"
import { V3Header } from "@/components/campfit/v3/CampFitV3Flow"
import { isChatNearBottom, shouldSendChatMessage } from "@/components/campfit/v3/chatUi"
import { TypingIndicator } from "@/components/campfit/v3/TypingIndicator"
import type { CampfitV3BasicInfo, CampfitV3ConversationResponse, CampfitV3TranscriptMessage } from "@/types/campfitV3"

type Props = {
  readonly basicInfo: CampfitV3BasicInfo
  readonly conversation: CampfitV3ConversationResponse
  readonly transcript: readonly CampfitV3TranscriptMessage[]
  readonly onAnswer: (message: string, quickReplyKey: string | null) => Promise<boolean>
  readonly onEditBasic: () => void
  readonly onResult: () => Promise<void>
}

export function CampFitV3Chat({ basicInfo, conversation, transcript, onAnswer, onEditBasic, onResult }: Props) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const messageListRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const compositionRef = useRef(false)
  const sendLockRef = useRef(false)
  const specialCare = conversation.questionKey === "special_care_follow_up"

  useEffect(() => {
    const messageList = messageListRef.current
    if (!messageList || !shouldAutoScrollRef.current) return

    const frame = window.requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight
    })

    return () => window.cancelAnimationFrame(frame)
  }, [sending, transcript])

  async function answer(content: string, quickReplyKey: string | null): Promise<void> {
    const trimmedContent = content.trim()
    if (!trimmedContent || sendLockRef.current) return

    sendLockRef.current = true
    setSending(true)
    setMessage("")
    try {
      const accepted = await onAnswer(trimmedContent, quickReplyKey)
      if (!accepted) return
    } finally {
      sendLockRef.current = false
      setSending(false)
    }
  }

  const summary = (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs lg:block lg:space-y-2">
        <Summary term="아이" value={`${basicInfo.childAges.join("·")}세 · ${basicInfo.childCount}명`} />
        <Summary term="기간" value={`${basicInfo.durationWeeks}주`} />
        <Summary term="인원" value={`성인 ${basicInfo.adultCount} · 아이 ${basicInfo.childCount}`} />
        <Summary term="예산" value={`${formatManwon(basicInfo.budgetMinKrw)}~${formatManwon(basicInfo.budgetMaxKrw)}`} />
      </dl>
      <button className="mt-4 min-h-11 w-full rounded-full border border-[var(--border-default)] bg-white text-sm font-bold transition hover:border-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" type="button" onClick={onEditBasic}>기본정보 수정</button>
    </>
  )

  return (
    <CampFitV3Frame>
      <V3Header />
      <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden py-3 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-4 lg:py-5">
        <details className="apple-glass-soft group shrink-0 rounded-2xl lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
            <AiAvatar className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-xs font-bold">
                <span className="truncate">CampFit AI · 추천 조건 정리 중</span>
                <span className="tabular-nums text-[var(--accent-primary)]">{conversation.progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]"><div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300" style={{ width: `${conversation.progress}%` }} /></div>
            </div>
            <span className="text-sm text-[var(--text-tertiary)] transition-transform group-open:rotate-180" aria-hidden>⌄</span>
          </summary>
          <div className="border-t border-[var(--border-default)] px-4 py-3">
            <p className="mb-3 text-xs leading-5 text-[var(--text-secondary)]">{conversation.progressMessage}</p>
            {summary}
          </div>
        </details>

        <aside className="apple-glass-soft hidden h-full min-h-0 flex-col rounded-[24px] p-5 lg:flex">
          <div className="flex items-center gap-3 border-b border-[var(--border-default)] pb-4">
            <AiAvatar className="h-10 w-10" />
            <div><p className="font-extrabold">CampFit AI 컨설턴트</p><p className="mt-1 text-xs font-bold text-[var(--status-success)]">현재 상담 중</p></div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-bold"><span>추천 조건 정리 중</span><span className="tabular-nums text-[var(--accent-primary)]">{conversation.progress}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]"><div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300" style={{ width: `${conversation.progress}%` }} /></div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{conversation.progressMessage}</p>
          </div>
          <div className="mt-5 border-t border-[var(--border-default)] pt-4">{summary}</div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-white/80 lg:h-full lg:rounded-[28px]">
          <div className="shrink-0 border-b border-[var(--border-default)] px-5 py-3 sm:px-7 sm:py-4">
            <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">STEP 2 · AI 상담</p>
            <h1 className="mt-1 text-lg font-bold tracking-[-.02em] [word-break:keep-all] sm:text-2xl">대화로 우리 가족의 선택 기준을 정리해요</h1>
          </div>

          <div
            ref={messageListRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable] sm:px-7 sm:py-5"
            role="log"
            aria-label="상담 메시지"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={sending}
            onScroll={(event) => {
              shouldAutoScrollRef.current = isChatNearBottom(event.currentTarget)
            }}
          >
            {transcript.map((item, index) => (
              <div className={`flex items-end gap-2 ${item.role === "user" ? "justify-end" : "justify-start"}`} key={`${item.role}-${index}`}>
                {item.role === "assistant" ? <AiAvatar className="h-10 w-10 shrink-0" /> : null}
                <div
                  className={`max-w-[88%] whitespace-pre-line rounded-[20px] px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] [word-break:keep-all] sm:max-w-[72%] ${item.role === "user" ? "rounded-br-md bg-[var(--accent-primary)] text-white" : "rounded-bl-md border border-[var(--border-default)] bg-white text-[var(--text-primary)]"}`}
                  aria-label={item.role === "user" ? "내 답변" : "CampFit AI 안내"}
                >
                  {item.content}
                </div>
              </div>
            ))}
            {sending ? <TypingIndicator /> : null}
          </div>

          <div className="shrink-0 border-t border-[var(--border-default)] bg-white/80 px-4 py-3 sm:px-7 sm:py-4">
            {conversation.warnings.map((warning) => <p className="mb-3 rounded-xl bg-[var(--surface-tint-yellow)] px-3 py-2 text-xs leading-5 text-[var(--status-warning)]" key={warning}>{warning}</p>)}
            {conversation.readyForRecommendation ? (
              <div className="flex justify-center py-1">
                <button className="glass-cta min-h-12 rounded-full px-8 text-base font-extrabold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" type="button" onClick={onResult}>추천 결과 보기 →</button>
              </div>
            ) : (
              <>
                {conversation.quickReplies.length ? <div className="mb-3 flex flex-wrap gap-2" aria-label="빠른 답변">{conversation.quickReplies.map((reply) => <button className="min-h-11 rounded-full border border-[var(--border-default)] bg-white px-4 text-sm font-bold transition hover:border-[var(--accent-primary)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50" disabled={sending} type="button" key={reply.key} onClick={() => void answer(reply.label, reply.key)}>{reply.label}</button>)}</div> : null}
                {specialCare ? <p className="mb-2 text-xs font-semibold leading-5 text-[var(--status-warning)]">질환명이나 약 이름 등 상세정보는 입력하지 마세요. 자세한 내용은 프로그램 상담 시 별도로 확인합니다.</p> : null}
                <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void answer(message, null) }}>
                  <label className="sr-only" htmlFor="campfit-v3-chat-answer">상담 답변</label>
                  <textarea
                    id="campfit-v3-chat-answer"
                    aria-describedby="campfit-v3-chat-key-hint"
                    className="min-h-12 max-h-28 flex-1 resize-none rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3 text-base focus:border-[var(--accent-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)] sm:text-sm"
                    enterKeyHint="send"
                    maxLength={600}
                    placeholder={specialCare ? "상세정보 없이 존재 여부만 알려주세요" : "답변을 직접 입력해도 좋아요"}
                    rows={1}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onCompositionStart={() => { compositionRef.current = true }}
                    onCompositionEnd={() => { compositionRef.current = false }}
                    onKeyDown={(event) => {
                      if (!shouldSendChatMessage({
                        key: event.key,
                        shiftKey: event.shiftKey,
                        isComposing: compositionRef.current || event.nativeEvent.isComposing,
                        keyCode: event.nativeEvent.keyCode,
                        repeat: event.repeat,
                      })) return

                      event.preventDefault()
                      void answer(message, null)
                    }}
                  />
                  <button aria-label="답변 보내기" className="grid min-h-12 min-w-12 place-items-center rounded-2xl bg-[var(--accent-primary)] font-black text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:opacity-40" type="submit" disabled={sending || !message.trim()}>→</button>
                  <span className="sr-only" id="campfit-v3-chat-key-hint">Enter로 전송하고 Shift와 Enter를 함께 누르면 줄을 바꿀 수 있습니다.</span>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </CampFitV3Frame>
  )
}

function AiAvatar({ className }: { readonly className: string }) {
  return (
    <span className={`relative grid place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#bfdbfe_0%,#fbcfe8_48%,#c4b5fd_100%)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.8),0_5px_14px_rgb(154_134_189_/_0.18)] ${className}`} aria-hidden>
      <span className="absolute -left-1 top-1 h-5 w-5 rounded-full bg-white/55 blur-[5px]" />
      <span className="absolute -bottom-1 right-0 h-6 w-6 rounded-full bg-[#8b5cf6]/25 blur-[6px]" />
      <span className="h-3 w-3 rounded-full border border-white/75 bg-white/35 backdrop-blur-sm" />
    </span>
  )
}

function Summary({ term, value }: { readonly term: string; readonly value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-[var(--text-tertiary)]">{term}</dt><dd className="text-right font-bold">{value}</dd></div>
}

function formatManwon(value: number): string {
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`
}
