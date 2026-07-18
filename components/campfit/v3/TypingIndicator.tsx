"use client"

import * as React from "react"

import { AiAvatar } from "@/components/campfit/v3/AiAvatar"

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2" role="status" aria-label="답변을 준비하고 있어요">
      <AiAvatar className="h-10 w-10 shrink-0" />
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
