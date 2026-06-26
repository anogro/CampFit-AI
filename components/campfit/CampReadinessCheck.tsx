"use client"

import type { ReadinessChoice, ReadinessDraftAnswers } from "@/types/campfit"
import { ExamplePicker } from "@/components/campfit/ExamplePicker"

type CampReadinessCheckProps = {
  readonly answers: ReadinessDraftAnswers
  readonly onChange: (answers: ReadinessDraftAnswers) => void
}

const choiceQuestions = [
  {
    key: "q1",
    title: "Your teacher says, “Please sit down.” What should you do?",
    options: [
      { value: "A", label: "Open the bag" },
      { value: "B", label: "Sit down" },
      { value: "C", label: "Eat lunch" },
      { value: "D", label: "Go home" },
    ],
  },
  {
    key: "q2",
    title: "You don't understand your teacher. What would you say?",
    options: [
      { value: "A", label: "I like soccer." },
      { value: "B", label: "I am eight." },
      { value: "C", label: "I don't understand. Can you help me?" },
      { value: "D", label: "It is sunny." },
    ],
  },
  {
    key: "q3",
    title: "You are thirsty. What would you say?",
    options: [
      { value: "A", label: "I am happy." },
      { value: "B", label: "This is my pencil." },
      { value: "C", label: "I like blue." },
      { value: "D", label: "Can I have some water?" },
    ],
  },
  {
    key: "q4",
    title: "A friend says, “Do you want to play?” What would you say?",
    options: [
      { value: "A", label: "I am hungry." },
      { value: "B", label: "Yes, let's play." },
      { value: "C", label: "It is a book." },
      { value: "D", label: "I go to school." },
    ],
  },
] as const

const observationOptions = [
  { value: "A", label: "틀려도 대답해보는 편이다" },
  { value: "B", label: "부모나 선생님을 먼저 찾는다" },
  { value: "C", label: "얼어붙거나 대답을 피한다" },
  { value: "D", label: "상황에 따라 다르다" },
] as const

const selfExpressionExamples = [
  "I like soccer.",
  "I like drawing.",
  "I like science and new friends.",
] as const

export function CampReadinessCheck({ answers, onChange }: CampReadinessCheckProps) {
  return (
    <div className="grid gap-5">
      {choiceQuestions.map((question) => (
        <fieldset
          key={question.key}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4"
        >
          <legend className="px-1 text-base font-semibold text-[var(--text-primary)] [word-break:keep-all]">
            {question.title}
          </legend>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {question.options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-elevated)] has-[:checked]:border-[var(--accent-primary)] has-[:checked]:bg-[var(--surface-tint-blue)]"
              >
                <input
                  type="radio"
                  name={question.key}
                  value={option.value}
                  checked={answers[question.key] === option.value}
                  onChange={() => onChange({ ...answers, [question.key]: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="grid gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label
            className="text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]"
            htmlFor="readiness-q5"
          >
            Q5. Write one short sentence about what you like.
          </label>
          <ExamplePicker
            examples={selfExpressionExamples}
            onSelect={(example) => onChange({ ...answers, q5: example })}
          />
        </div>
        <input
          id="readiness-q5"
          className="min-h-11 rounded-md border border-[var(--border-default)] px-3 text-base font-normal transition hover:border-[var(--text-tertiary)]"
          value={answers.q5}
          onChange={(event) => onChange({ ...answers, q5: event.target.value })}
          placeholder="한 문장을 직접 적어 주세요."
        />
      </div>
      <fieldset className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4">
        <legend className="px-1 text-base font-semibold text-[var(--text-primary)] [word-break:keep-all]">
          Q6. 모르는 영어 질문을 받으면 보통 어떻게 반응하나요?
        </legend>
        <div className="mt-3 grid gap-2">
          {observationOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-elevated)] has-[:checked]:border-[var(--accent-primary)] has-[:checked]:bg-[var(--surface-tint-blue)]"
            >
              <input
                type="radio"
                name="q6"
                value={option.value}
                checked={answers.q6 === option.value}
                onChange={() => onChange({ ...answers, q6: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export function isReadinessChoice(value: ReadinessDraftAnswers["q1"]): value is ReadinessChoice {
  return value === "A" || value === "B" || value === "C" || value === "D"
}
