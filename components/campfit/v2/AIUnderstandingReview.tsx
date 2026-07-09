"use client"

import { PrimaryButton, SecondaryButton, SectionIntro } from "@/components/campfit/v2/V2Controls"
import type { AnalyzeV2Response } from "@/components/campfit/v2/types"
import { buildAIUnderstandingDisplaySections } from "@/lib/campfit/v2/aiUnderstandingDisplay"

type AIUnderstandingReviewProps = {
  readonly summary: AnalyzeV2Response
  readonly loading: boolean
  readonly onBack: () => void
  readonly onContinue: () => void
}

export function AIUnderstandingReview({ summary, loading, onBack, onContinue }: AIUnderstandingReviewProps) {
  const sections = buildAIUnderstandingDisplaySections(summary)

  return (
    <section className="grid gap-6" aria-labelledby="campfit-v2-ai-review-title">
      <SectionIntro
        eyebrow="상담 내용 확인"
        title="말씀해주신 내용을 바탕으로, 중요한 부분만 먼저 정리했어요."
        description="틀린 부분이 있다면 이전으로 돌아가 수정할 수 있어요. 다음 단계에서 몇 가지만 더 확인할게요."
      />
      <div className="apple-glass-soft grid gap-4 rounded-[24px] p-5">
        <ReviewBlock title="부모님이 원하는 방향" items={sections.parentDirection} />
        <ReviewBlock title="아이에게 고려해야 할 점" items={sections.childConsiderations} />
        <ReviewBlock title="현재 조건에서 주의할 점" items={sections.cautionPoints} />
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:justify-between">
        <SecondaryButton disabled={loading} onClick={onBack}>이전으로 돌아가 수정하기</SecondaryButton>
        <PrimaryButton disabled={loading} onClick={onContinue}>
          {loading ? "질문 준비 중..." : "네, 몇 가지만 더 확인해주세요"}
        </PrimaryButton>
      </div>
    </section>
  )
}

function ReviewBlock({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  const visible = items.filter((item) => item.trim().length > 0)
  return (
    <div className="grid gap-2 border-b border-[var(--border-subtle)] pb-4 last:border-b-0 last:pb-0">
      <h3 className="text-sm font-bold text-[var(--text-primary)] [word-break:keep-all]">{title}</h3>
      {visible.length > 0 ? (
        <ul className="grid gap-1 text-sm leading-6 text-[var(--text-secondary)]">
          {visible.map((item, index) => <li key={`${index}-${item}`} className="[word-break:keep-all]">{item}</li>)}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-[var(--text-tertiary)]">아직 정리할 만한 내용을 찾지 못했어요. 다음 질문에서 더 확인할게요.</p>
      )}
    </div>
  )
}
