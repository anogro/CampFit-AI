"use client"

import { PrimaryButton, SecondaryButton, SectionIntro } from "@/components/campfit/v2/V2Controls"
import type { NaturalConsultationInput } from "@/types/campfitV2"

type NaturalConsultationFormProps = {
  readonly value: NaturalConsultationInput
  readonly loading: boolean
  readonly onBack: () => void
  readonly onChange: (value: NaturalConsultationInput) => void
  readonly onSubmit: () => void
}

export function NaturalConsultationForm({ value, loading, onBack, onChange, onSubmit }: NaturalConsultationFormProps) {
  return (
    <section className="grid gap-6" aria-labelledby="campfit-v2-natural-title">
      <SectionIntro
        eyebrow="자유롭게 적어주세요"
        title="조건표에 담기 어려운 아이의 상황을 편하게 적어주세요."
        description="적어주신 내용을 바탕으로 아이에게 중요한 조건과 확인할 점을 먼저 정리합니다."
      />
      <TextAreaField
        id="situation-text"
        label="지금 해외캠프를 고민하게 된 상황을 편하게 적어주세요."
        placeholder="예: 만 8세 아이 첫 해외캠프를 알아보고 있어요. 영어는 아직 초급이고 부모와 오래 떨어진 경험이 없어서 걱정됩니다. 영어 실력보다 영어에 대한 거부감이 줄었으면 좋겠어요."
        value={value.situationText}
        onChange={(situationText) => onChange({ ...value, situationText })}
      />
      <TextAreaField
        id="child-context-text"
        label="아이에 대해 꼭 고려했으면 하는 점이 있다면 적어주세요."
        placeholder="예: 낯선 곳에서는 처음 1~2일 긴장하지만 익숙해지면 잘 지내요. 영어를 틀리는 걸 싫어해서 말하기 전에 많이 망설입니다."
        value={value.childContextText ?? ""}
        onChange={(childContextText) => onChange({ ...value, childContextText })}
      />
      <TextAreaField
        id="success-concerns-text"
        label="이번 캠프에서 기대하는 점과 가장 걱정되는 점을 적어주세요."
        placeholder="예: 국제학교 분위기를 경험해봤으면 좋겠지만, 아이가 수업을 못 따라가서 영어를 더 싫어하게 되는 건 피하고 싶어요."
        value={value.successAndConcernsText ?? ""}
        onChange={(successAndConcernsText) => onChange({ ...value, successAndConcernsText })}
      />
      <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:justify-between">
        <SecondaryButton disabled={loading} onClick={onBack}>이전으로</SecondaryButton>
        <PrimaryButton disabled={loading || value.situationText.trim().length < 10} onClick={onSubmit}>
          {loading ? "내용 정리하는 중..." : "상담 내용 확인하기"}
        </PrimaryButton>
      </div>
    </section>
  )
}

function TextAreaField({ id, label, placeholder, value, onChange }: {
  readonly id: string
  readonly label: string
  readonly placeholder: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]" htmlFor={id}>
      {label}
      <textarea
        id={id}
        className="min-h-36 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4 text-base font-normal leading-7 text-[var(--text-primary)] transition hover:border-[var(--text-tertiary)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
