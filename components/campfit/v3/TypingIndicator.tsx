"use client"

import * as React from "react"

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2" role="status" aria-label="답변을 준비하고 있어요">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#bfdbfe_0%,#fbcfe8_48%,#c4b5fd_100%)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.8),0_5px_14px_rgb(154_134_189_/_0.18)]" aria-hidden="true">
        <span className="absolute -left-1 top-1 h-5 w-5 rounded-full bg-white/55 blur-[5px]" />
        <span className="absolute -bottom-1 right-0 h-6 w-6 rounded-full bg-[#8b5cf6]/25 blur-[6px]" />
        <span className="h-3 w-3 rounded-full border border-white/75 bg-white/35 backdrop-blur-sm" />
      </span>
      <div className="rounded-[20px] rounded-bl-md border border-[var(--border-default)] bg-white px-4 py-3" aria-hidden="true">
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] motion-safe:animate-bounce motion-reduce:animate-none"
              key={index}
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
