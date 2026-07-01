"use client"

import { useState } from "react"

type ExamplePickerProps = {
  readonly examples: readonly string[]
  readonly onSelect: (example: string) => void
}

export function ExamplePicker({ examples, onSelect }: ExamplePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative shrink-0">
      <button
        className="apple-pill inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap border border-[var(--border-default)] bg-[var(--surface-glass)] px-4 text-sm font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-tint-blue)]"
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
          className="apple-glass absolute left-0 z-10 mt-2 grid w-[min(82vw,420px)] gap-2 rounded-[22px] p-3 sm:left-auto sm:right-0"
          onMouseLeave={() => setIsOpen(false)}
        >
          <p className="text-xs font-semibold text-[var(--text-tertiary)]">누르면 입력칸에 넣습니다.</p>
          {examples.map((example) => (
            <button
              key={example}
              className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-glass)] px-3 py-2 text-left text-sm leading-6 text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-tint-blue)] [word-break:keep-all]"
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
