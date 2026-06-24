import { Check } from "lucide-react"

const steps = [
  "기본 조건",
  "고민 입력",
  "AI 요약",
  "꼬리질문",
  "3분 체크",
  "추천 결과",
] as const

type CampfitStepperProps = {
  readonly currentStep: number
}

export function CampfitStepper({ currentStep }: CampfitStepperProps) {
  return (
    <ol className="grid gap-2 md:grid-cols-6" aria-label="CampFit 진행 단계">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isCurrent = stepNumber === currentStep
        const isComplete = stepNumber < currentStep

        return (
          <li key={step} className="min-w-0">
            <div
              className={[
                "flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-sm transition",
                isCurrent
                  ? "border-[var(--accent-primary)] bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isComplete
                    ? "bg-[var(--status-success)] text-white"
                    : isCurrent
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--surface-elevated)] text-[var(--text-secondary)]",
                ].join(" ")}
              >
                {isComplete ? <Check size={15} aria-hidden="true" /> : stepNumber}
              </span>
              <span className="truncate">{step}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
