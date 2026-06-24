"use client"

import type { ReadinessAnswers } from "@/types/campfit"

type CampReadinessCheckProps = {
  readonly answers: ReadinessAnswers
  readonly onChange: (answers: ReadinessAnswers) => void
}

const choiceQuestions = [
  {
    key: "q1",
    title: "Your teacher says, “Please sit down.” What should you do?",
    options: ["Sit down", "Eat lunch", "Go home", "Open the bag"],
  },
  {
    key: "q2",
    title: "You don't understand your teacher. What would you say?",
    options: ["I don't understand. Can you help me?", "I like soccer.", "I am eight.", "It is sunny."],
  },
  {
    key: "q3",
    title: "You are thirsty. What would you say?",
    options: ["Can I have some water?", "I am happy.", "This is my pencil.", "I like blue."],
  },
  {
    key: "q4",
    title: "A friend says, “Do you want to play?” What would you say?",
    options: ["Yes, let's play.", "I am hungry.", "It is a book.", "I go to school."],
  },
] as const

const letters = ["A", "B", "C", "D"] as const

export function CampReadinessCheck({ answers, onChange }: CampReadinessCheckProps) {
  return (
    <div className="grid gap-5">
      {choiceQuestions.map((question) => (
        <fieldset
          key={question.key}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4"
        >
          <legend className="px-1 text-base font-bold text-[var(--text-primary)]">{question.title}</legend>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {question.options.map((option, index) => {
              const letter = letters[index]
              if (!letter) {
                return null
              }

              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)] has-[:checked]:border-[var(--accent-primary)] has-[:checked]:bg-[var(--surface-elevated)]"
                >
                  <input
                    type="radio"
                    name={question.key}
                    value={letter}
                    checked={answers[question.key] === letter}
                    onChange={() => onChange({ ...answers, [question.key]: letter })}
                  />
                  <span>
                    <strong>{letter}.</strong> {option}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <label className="grid gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4 text-sm font-bold text-[var(--text-primary)]">
        Q5. Write one short sentence about what you like.
        <input
          className="min-h-12 rounded-lg border border-[var(--border-default)] px-3 text-base font-normal"
          value={answers.q5}
          onChange={(event) => onChange({ ...answers, q5: event.target.value })}
          placeholder="I like soccer."
        />
      </label>
      <fieldset className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4">
        <legend className="px-1 text-base font-bold text-[var(--text-primary)]">
          Q6. 모르는 영어 질문을 받으면 보통 어떻게 반응하나요?
        </legend>
        <div className="mt-3 grid gap-2">
          {[
            "틀려도 대답해보는 편이다",
            "부모나 선생님을 먼저 찾는다",
            "얼어붙거나 대답을 피한다",
            "상황에 따라 다르다",
          ].map((option, index) => {
            const letter = letters[index]
            if (!letter) {
              return null
            }

            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)] has-[:checked]:border-[var(--accent-primary)] has-[:checked]:bg-[var(--surface-elevated)]"
              >
                <input
                  type="radio"
                  name="q6"
                  value={letter}
                  checked={answers.q6 === letter}
                  onChange={() => onChange({ ...answers, q6: letter })}
                />
                <span>
                  <strong>{letter}.</strong> {option}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
