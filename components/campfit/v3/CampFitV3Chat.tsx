"use client"

import { useEffect, useRef, useState } from "react"
import { V3Header } from "@/components/campfit/v3/CampFitV3Flow"
import type { CampfitV3BasicInfo, CampfitV3ConversationResponse, CampfitV3TranscriptMessage } from "@/types/campfitV3"

type Props = {
  readonly basicInfo: CampfitV3BasicInfo
  readonly conversation: CampfitV3ConversationResponse
  readonly transcript: readonly CampfitV3TranscriptMessage[]
  readonly onAnswer: (message: string, quickReplyKey: string | null) => Promise<void>
  readonly onEditBasic: () => void
  readonly onResult: () => Promise<void>
}

export function CampFitV3Chat({ basicInfo, conversation, transcript, onAnswer, onEditBasic, onResult }: Props) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const specialCare = conversation.questionKey === "special_care_follow_up"

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [transcript])

  async function answer(content: string, quickReplyKey: string | null): Promise<void> {
    if (!content.trim() || sending) return
    setSending(true)
    setMessage("")
    try {
      await onAnswer(content.trim(), quickReplyKey)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-4 py-4 sm:px-6 lg:px-10">
      <V3Header />
      <section className="mx-auto grid w-full max-w-[1120px] flex-1 gap-4 py-5 lg:grid-cols-[260px_1fr] lg:py-7">
        <aside className="apple-glass-soft self-start rounded-[24px] p-5 lg:sticky lg:top-5">
          <div className="flex items-center gap-3 border-b border-[var(--border-default)] pb-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-primary)] text-sm font-black text-white">CF</div>
            <div><p className="font-extrabold">CampFit AI 컨설턴트</p><p className="mt-1 text-xs font-bold text-[var(--status-success)]">현재 상담 중</p></div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-bold"><span>상담 진행</span><span className="tabular-nums text-[var(--accent-primary)]">{conversation.progress}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]"><div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300" style={{ width: `${conversation.progress}%` }} /></div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{conversation.progressMessage}</p>
          </div>
          <dl className="mt-5 space-y-2 border-t border-[var(--border-default)] pt-4 text-xs">
            <Summary term="아이" value={`${basicInfo.childAges.join("·")}세 · ${basicInfo.childCount}명`} />
            <Summary term="기간" value={`${basicInfo.durationWeeks}주`} />
            <Summary term="인원" value={`성인 ${basicInfo.adultCount} · 아이 ${basicInfo.childCount}`} />
            <Summary term="예산" value={`${formatManwon(basicInfo.budgetMinKrw)}~${formatManwon(basicInfo.budgetMaxKrw)}`} />
          </dl>
          <button className="mt-5 min-h-11 w-full rounded-full border border-[var(--border-default)] bg-white text-sm font-bold" type="button" onClick={onEditBasic}>기본정보 수정</button>
        </aside>

        <div className="apple-glass flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-[28px]">
          <div className="border-b border-[var(--border-default)] px-5 py-4 sm:px-7">
            <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">STEP 2 · AI 상담</p>
            <h1 className="mt-1 text-xl font-bold tracking-[-.02em] sm:text-2xl">우리 가족의 선택 기준을 함께 정리해요</h1>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-7" aria-live="polite">
            {transcript.map((item, index) => (
              <div className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`} key={`${item.role}-${index}`}>
                <div className={`max-w-[88%] whitespace-pre-line rounded-[20px] px-4 py-3 text-sm leading-6 [word-break:keep-all] sm:max-w-[72%] ${item.role === "user" ? "rounded-br-md bg-[var(--accent-primary)] text-white" : "rounded-bl-md border border-[var(--border-default)] bg-white text-[var(--text-primary)]"}`}>{item.content}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="border-t border-[var(--border-default)] bg-white/70 px-4 py-4 sm:px-7">
            {conversation.warnings.map((warning) => <p className="mb-3 rounded-xl bg-[var(--surface-tint-yellow)] px-3 py-2 text-xs leading-5 text-[var(--status-warning)]" key={warning}>{warning}</p>)}
            {conversation.readyForRecommendation || conversation.questionKey === null ? (
              <div className="flex justify-center py-2">
                <button className="glass-cta min-h-14 rounded-full px-8 text-base font-extrabold" type="button" onClick={onResult}>결과 확인하기 →</button>
              </div>
            ) : (
              <>
                {conversation.quickReplies.length ? <div className="mb-3 flex flex-wrap gap-2">{conversation.quickReplies.map((reply) => <button className="min-h-11 rounded-full border border-[var(--border-default)] bg-white px-4 text-sm font-bold transition hover:border-[var(--accent-primary)] hover:bg-[var(--accent-soft)] disabled:opacity-50" disabled={sending} type="button" key={reply.key} onClick={() => answer(reply.label, reply.key)}>{reply.label}</button>)}</div> : null}
                {specialCare ? <p className="mb-2 text-xs font-semibold leading-5 text-[var(--status-warning)]">질환명이나 약 이름 등 상세정보는 입력하지 마세요. 자세한 내용은 프로그램 상담 시 별도로 확인합니다.</p> : null}
                <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void answer(message, null) }}>
                  <textarea aria-label="상담 답변" className="min-h-12 max-h-28 flex-1 resize-none rounded-2xl border border-[var(--border-default)] bg-white px-4 py-3 text-sm" maxLength={600} placeholder={specialCare ? "상세정보 없이 존재 여부만 알려주세요" : "답변을 직접 입력해도 좋아요"} rows={1} value={message} onChange={(event) => setMessage(event.target.value)} />
                  <button aria-label="답변 보내기" className="grid min-h-12 min-w-12 place-items-center rounded-2xl bg-[var(--accent-primary)] font-black text-white disabled:opacity-40" type="submit" disabled={sending || !message.trim()}>→</button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function Summary({ term, value }: { readonly term: string; readonly value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-[var(--text-tertiary)]">{term}</dt><dd className="text-right font-bold">{value}</dd></div>
}

function formatManwon(value: number): string {
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`
}
