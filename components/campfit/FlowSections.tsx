import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import type { CampfitInput, ParentAnalysis } from "@/types/campfit"

export function Header() {
  return (
    <header className="grid gap-6 rounded-lg bg-[var(--surface-secondary)] p-5 shadow-[0_1px_2px_rgb(16_32_51_/_0.04)] md:p-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
        <div className="grid gap-4">
          <p className="text-sm font-bold text-[var(--accent-primary)]">CampFit AI</p>
          <h1 className="max-w-3xl text-3xl font-black leading-tight text-[var(--text-primary)] [word-break:keep-all] sm:text-4xl md:text-5xl">
            <span className="block">우리 아이에게 맞는</span>
            <span className="block">캠프를 찾아보세요.</span>
          </h1>
        </div>
        <p className="text-base leading-7 text-[var(--text-secondary)] [word-break:keep-all]">
          영어 수준, 분리 적응, 예산, 보호 장치를 함께 보고 무리한 추천을 걸러냅니다.
        </p>
      </div>
      <ul className="grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
        {["나이만 입력하면 학년은 자동 반영", "처음엔 대략 선택해도 추천 가능", "상담 전 비교용 결과 저장"].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <CheckCircle2 size={17} className="text-[var(--status-success)]" aria-hidden="true" />
            <span className="[word-break:keep-all]">{item}</span>
          </li>
        ))}
      </ul>
    </header>
  )
}

export function ConcernStep({
  input,
  onChange,
}: {
  readonly input: CampfitInput
  readonly onChange: (input: CampfitInput) => void
}) {
  return (
    <label className="grid gap-3 text-sm font-bold text-[var(--text-primary)]">
      학부모 고민과 기대를 자유롭게 적어 주세요.
      <span className="text-sm font-normal text-[var(--text-tertiary)]">
        자녀 실명, 학교명, 여권번호, 건강 민감정보는 입력하지 마세요.
      </span>
      <textarea
        className="min-h-56 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4 text-base font-normal leading-7 text-[var(--text-primary)]"
        value={input.parentConcernText}
        onChange={(event) => onChange({ ...input, parentConcernText: event.target.value })}
        placeholder="예: 아이가 영어는 초급이고 낯가림이 있습니다. 그래도 이번 캠프를 통해 영어 자신감이 생겼으면 좋겠고, 처음 해외캠프라 한국인 관리자가 있었으면 합니다."
      />
    </label>
  )
}

export function FollowUpStep({
  analysis,
  answers,
  onChange,
}: {
  readonly analysis: ParentAnalysis
  readonly answers: readonly string[]
  readonly onChange: (answers: readonly string[]) => void
}) {
  return (
    <div className="grid gap-5">
      {analysis.followUpQuestions.map((question, index) => (
        <label key={question} className="grid gap-3 text-sm font-bold text-[var(--text-primary)]">
          {question}
          <input
            className="min-h-12 rounded-lg border border-[var(--border-default)] px-3 text-base font-normal"
            value={answers[index] ?? ""}
            onChange={(event) => onChange(answers.map((answer, answerIndex) => (answerIndex === index ? event.target.value : answer)))}
          />
        </label>
      ))}
    </div>
  )
}

export function NavButtons({
  step,
  canContinue,
  isLoading,
  onBack,
  onNext,
}: {
  readonly step: number
  readonly canContinue: boolean
  readonly isLoading: boolean
  readonly onBack: () => void
  readonly onNext: () => void
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] px-4 font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface-elevated)] active:translate-y-px disabled:opacity-50"
        type="button"
        onClick={onBack}
        disabled={step === 1 || isLoading}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        이전
      </button>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-5 font-bold text-white transition hover:bg-[var(--accent-hover)] active:translate-y-px disabled:opacity-50"
        type="button"
        onClick={onNext}
        disabled={!canContinue || isLoading}
      >
        {isLoading ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : null}
        {step === 1 ? "아이 상황 이어서 입력" : step === 2 ? "AI 분석하기" : step === 5 ? "추천 결과 보기" : "다음"}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  )
}
