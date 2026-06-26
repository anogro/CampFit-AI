"use client"

import { useState } from "react"

type ExamplePickerProps = {
  readonly examples: readonly string[]
  readonly onSelect: (example: string) => void
}

export function ExamplePicker({ examples, onSelect }: ExamplePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        className="rounded-md border border-[var(--border-default)] bg-[var(--surface-secondary)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-elevated)]"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        aria-expanded={isOpen}
      >
        예시 보기
      </button>
      {isOpen ? (
        <div
          className="absolute left-0 z-10 mt-2 grid w-[min(82vw,420px)] gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-3 shadow-[var(--shadow-card)] sm:left-auto sm:right-0"
          onMouseLeave={() => setIsOpen(false)}
        >
          <p className="text-xs font-semibold text-[var(--text-tertiary)]">누르면 입력칸에 넣습니다.</p>
          {examples.map((example) => (
            <button
              key={example}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-left text-sm leading-6 text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-tint-blue)] [word-break:keep-all]"
              type="button"
              onClick={() => {
                onSelect(example)
                setIsOpen(false)
              }}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
