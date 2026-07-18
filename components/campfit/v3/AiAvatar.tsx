import * as React from "react"

type Props = {
  readonly className?: string
}

export function AiAvatar({ className = "h-10 w-10" }: Props) {
  return (
    <span
      className={`inline-block rounded-full bg-[linear-gradient(135deg,#bfdbfe_0%,#fbcfe8_48%,#c4b5fd_100%)] shadow-[0_5px_14px_rgb(154_134_189_/_0.18)] ${className}`}
      aria-label="AI 아이콘"
      role="img"
    />
  )
}
