"use client"

import { PrimaryButton, SectionIntro } from "@/components/campfit/v2/V2Controls"
import type { MaterializedQuestionView } from "@/components/campfit/v2/types"

export type DynamicQuestionAnswerDraft = {
  readonly dynamicQuestionId: string
  readonly questionKey: string
  readonly answer: unknown
  readonly answerText?: string
}

type DynamicQuestionFlowProps = {
  readonly questions: readonly MaterializedQuestionView[]
  readonly answers: readonly DynamicQuestionAnswerDraft[]
  readonly loading: boolean
  readonly onChange: (answers: readonly DynamicQuestionAnswerDraft[]) => void
  readonly onSubmit: () => void
}

export function DynamicQuestionFlow({ questions, answers, loading, onChange, onSubmit }: DynamicQuestionFlowProps) {
  const canSubmit = questions.every((question) => isDynamicQuestionAnswered(question, findAnswer(answers, question)))

  return (
    <section className="grid gap-6" aria-labelledby="campfit-v2-dynamic-title">
      <SectionIntro
        eyebrow="추가 확인"
        title="정확한 추천을 위해 몇 가지만 더 확인할게요."
        description="아래 질문에 답하면 현재 조건에서 맞는 후보와 조정이 필요한 조건을 함께 정리해드릴게요."
      />
      <div className="grid gap-4">
        {questions.map((question) => (
          <QuestionCard
            key={question.dynamicQuestionId}
            question={question}
            answer={findAnswer(answers, question)}
            onChange={(answer) => onChange(upsertDynamicQuestionAnswer(answers, answer))}
          />
        ))}
      </div>
      <div className="flex justify-end border-t border-[var(--border-subtle)] pt-5">
        <PrimaryButton disabled={loading || !canSubmit} onClick={onSubmit}>
          {loading ? "추천 생성 중..." : "컨설팅 리포트 보기"}
        </PrimaryButton>
      </div>
    </section>
  )
}

function QuestionCard({ question, answer, onChange }: {
  readonly question: MaterializedQuestionView
  readonly answer: DynamicQuestionAnswerDraft | undefined
  readonly onChange: (answer: DynamicQuestionAnswerDraft) => void
}) {
  return (
    <article className="apple-glass-soft grid gap-3 rounded-[24px] p-5">
      <div className="grid gap-1">
        <h3 className="text-base font-bold text-[var(--text-primary)] [word-break:keep-all]">{question.title}</h3>
        {question.helperText ? <p className="text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{question.helperText}</p> : null}
      </div>
      {question.questionType === "single_choice" ? <SingleChoice question={question} answer={answer} onChange={onChange} /> : null}
      {question.questionType === "multi_choice" ? <MultiChoice question={question} answer={answer} onChange={onChange} /> : null}
      {question.questionType === "number" ? <NumberAnswer question={question} answer={answer} onChange={onChange} /> : null}
      {question.questionType === "text" ? <TextAnswer question={question} answer={answer} onChange={onChange} /> : null}
    </article>
  )
}

function SingleChoice({ question, answer, onChange }: QuestionInputProps) {
  const value = getSingleChoiceValue(answer)
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {question.options.map((option) => (
        <button
          key={option.value}
          className={`rounded-[18px] border px-3 py-3 text-left text-sm font-semibold leading-5 transition [word-break:keep-all] ${value === option.value ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--text-secondary)]"}`}
          type="button"
          onClick={() => onChange(baseAnswer(question, { value: option.value, score: option.score }, option.label))}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function MultiChoice({ question, answer, onChange }: QuestionInputProps) {
  const values = getMultiChoiceValues(answer)
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {question.options.map((option) => {
        const selected = values.includes(option.value)
        const next = selected ? values.filter((value) => value !== option.value) : [...values, option.value]
        return (
          <button key={option.value} className={`rounded-[18px] border px-3 py-3 text-left text-sm font-semibold leading-5 transition [word-break:keep-all] ${selected ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--text-secondary)]"}`} type="button" onClick={() => onChange(baseAnswer(question, next, selectedOptionLabels(question, next).join(", ")))}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function NumberAnswer({ question, answer, onChange }: QuestionInputProps) {
  const value = typeof answer?.answer === "number" ? String(answer.answer) : ""
  return (
    <input
      className="h-11 min-h-11 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 text-base"
      type="number"
      value={value}
      onChange={(event) => {
        const next = event.target.value
        onChange(baseAnswer(question, next.trim().length > 0 ? Number(next) : "", next))
      }}
    />
  )
}

function TextAnswer({ question, answer, onChange }: QuestionInputProps) {
  const value = typeof answer?.answer === "string" ? answer.answer : ""
  return (
    <textarea className="min-h-28 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4 text-base leading-7" value={value} placeholder={question.exampleText ?? question.placeholder ?? ""} onChange={(event) => onChange(baseAnswer(question, event.target.value, event.target.value))} />
  )
}

type QuestionInputProps = {
  readonly question: MaterializedQuestionView
  readonly answer: DynamicQuestionAnswerDraft | undefined
  readonly onChange: (answer: DynamicQuestionAnswerDraft) => void
}

export function getSingleChoiceValue(answer: DynamicQuestionAnswerDraft | undefined): string {
  if (typeof answer?.answer === "string") return answer.answer
  if (isRecord(answer?.answer) && typeof answer.answer["value"] === "string") return answer.answer["value"]
  return ""
}

export function isDynamicQuestionAnswered(question: MaterializedQuestionView, answer: DynamicQuestionAnswerDraft | undefined): boolean {
  if (answer === undefined) return false

  switch (question.questionType) {
    case "single_choice":
      return getSingleChoiceValue(answer).trim().length > 0
    case "multi_choice":
      return getMultiChoiceValues(answer).length > 0
    case "number":
      return typeof answer.answer === "number" && Number.isFinite(answer.answer)
    case "text":
      return typeof answer.answer === "string" && answer.answer.trim().length > 0
  }
}

export function upsertDynamicQuestionAnswer(answers: readonly DynamicQuestionAnswerDraft[], answer: DynamicQuestionAnswerDraft): readonly DynamicQuestionAnswerDraft[] {
  const exists = answers.some((item) => item.dynamicQuestionId === answer.dynamicQuestionId)
  return exists ? answers.map((item) => item.dynamicQuestionId === answer.dynamicQuestionId ? answer : item) : [...answers, answer]
}

function findAnswer(answers: readonly DynamicQuestionAnswerDraft[], question: MaterializedQuestionView): DynamicQuestionAnswerDraft | undefined {
  return answers.find((item) => item.dynamicQuestionId === question.dynamicQuestionId)
}

function baseAnswer(question: MaterializedQuestionView, answer: unknown, answerText: string): DynamicQuestionAnswerDraft {
  return { dynamicQuestionId: question.dynamicQuestionId, questionKey: question.questionKey, answer, answerText }
}

function getMultiChoiceValues(answer: DynamicQuestionAnswerDraft | undefined): readonly string[] {
  return Array.isArray(answer?.answer) ? answer.answer.filter((item): item is string => typeof item === "string") : []
}

function selectedOptionLabels(question: MaterializedQuestionView, values: readonly string[]): readonly string[] {
  return question.options.filter((option) => values.includes(option.value)).map((option) => option.label)
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
