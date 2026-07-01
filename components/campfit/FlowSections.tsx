import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import type { CampfitInput, ParentAnalysis } from "@/types/campfit"
import { ExamplePicker } from "@/components/campfit/ExamplePicker"

export const PARENT_CONCERN_EXAMPLE =
  "초2 아이입니다. 영어는 거의 못하고 낯가림이 있습니다. 그래도 영어 실력과 자신감이 늘었으면 좋겠습니다. 처음 해외캠프라 걱정되지만 한국인 관리자는 있었으면 좋겠습니다."

const parentConcernExamples = [
  PARENT_CONCERN_EXAMPLE,
  "만 10세 아이입니다. 가족여행은 몇 번 갔지만 혼자 해외에 가본 적은 없습니다. 영어는 짧은 문장 정도 가능하고, 친구를 사귀는 데 시간이 걸립니다. 너무 학습만 강한 캠프보다는 적응을 챙겨주는 곳을 원합니다.",
  "만 12세 아이이고 영어 회화는 어느 정도 됩니다. 이번에는 독립심과 현지 친구 경험을 기대하고 있습니다. 다만 장거리 이동과 기숙사 생활은 처음이라 생활 관리가 어느 정도 있는지 확인하고 싶습니다.",
] as const

const followUpExampleSets = [
  [
    "첫날 밤 잠자리와 낯선 환경을 가장 힘들어할 것 같아요.",
    "영어로 도움을 요청하지 못하고 혼자 참을까 봐 걱정됩니다.",
    "처음 며칠은 한국어로 상황을 확인해 줄 수 있으면 좋겠습니다.",
  ],
  [
    "친구 관계가 어색해 보이면 선생님이 먼저 짝 활동이나 소그룹 활동으로 연결해 주면 좋겠습니다.",
    "아이가 혼자 있거나 말수가 줄어들 때 한국어로 짧게 상태를 확인해 주면 좋겠습니다.",
    "초반에는 룸메이트나 같은 조 친구와 자연스럽게 어울릴 수 있도록 생활 관리자가 한 번씩 챙겨주면 좋겠습니다.",
  ],
] as const

export function Header() {
  return (
    <header className="grid gap-6 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-5 shadow-[var(--shadow-card)] md:p-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="grid gap-3">
          <p className="text-xs font-semibold tracking-[0.01em] text-[var(--accent-primary)]">CampFit AI</p>
          <h1 className="max-w-3xl text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)] [word-break:keep-all] sm:text-[2.75rem] md:text-[3.5rem]">
            <span className="block">우리 아이에게 맞는</span>
            <span className="block">캠프를 찾아보세요.</span>
          </h1>
        </div>
        <p className="text-base font-medium leading-7 text-[var(--text-secondary)] [word-break:keep-all]">
          아이 성향에 맞는 도시와 체류 방식을 먼저 보고, 그다음 실제 프로그램 후보를 좁혀갑니다.
        </p>
      </div>
      <ul className="grid gap-2 border-t border-[var(--border-subtle)] pt-4 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
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

export function StartScreen({ onStart }: { readonly onStart: () => void }) {
  return (
    <section className="grid gap-6" aria-labelledby="campfit-start-title">
      <div className="grid gap-3">
        <p className="text-xs font-semibold tracking-[0.01em] text-[var(--accent-primary)]">시작 전 안내</p>
        <h2
          id="campfit-start-title"
          className="max-w-2xl text-[1.625rem] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]"
        >
          몇 가지 조건만 확인하고 맞지 않는 캠프부터 걸러볼게요.
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
          처음부터 모든 정보를 정확히 적을 필요는 없습니다. 만 나이, 현재 영어 노출, 분리 적응, 희망 지역을 대략 입력하면 상담 전에 비교할 추천안을 만들 수 있습니다.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 text-sm leading-6 text-[var(--text-secondary)] sm:grid-cols-3">
        {["만 나이 기준으로 학년 자동 반영", "영어 테스트 없이 부모 관찰 기준 반영", "예시 문구는 눌러서 바로 입력"].map((item) => (
          <div key={item} className="flex gap-2 [word-break:keep-all]">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--status-success)]" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-5 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          type="button"
          onClick={onStart}
        >
          추천 시작하기
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
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
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <label className="grid gap-2 text-sm font-semibold text-[var(--text-primary)]" htmlFor="parent-concern-text">
          학부모 고민과 기대를 자유롭게 적어 주세요.
          <span className="text-sm font-normal leading-6 text-[var(--text-tertiary)] [word-break:keep-all]">
            자녀 실명, 학교명, 여권번호, 건강 민감정보는 입력하지 마세요.
          </span>
        </label>
        <ExamplePicker
          examples={parentConcernExamples}
          onSelect={(example) => onChange({ ...input, parentConcernText: example })}
        />
      </div>
      <textarea
        id="parent-concern-text"
        className="min-h-56 rounded-md border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4 text-base font-normal leading-7 text-[var(--text-primary)] transition hover:border-[var(--text-tertiary)]"
        value={input.parentConcernText}
        onChange={(event) => onChange({ ...input, parentConcernText: event.target.value })}
        placeholder="아이의 현재 소통 수준, 걱정되는 점, 기대하는 변화, 꼭 필요한 관리 조건을 적어 주세요."
      />
    </div>
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
        <div key={question} className="grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]" htmlFor={`follow-up-${index}`}>
              {question}
            </label>
            <ExamplePicker
              examples={followUpExampleSets[index] ?? followUpExampleSets[0]}
              onSelect={(example) =>
                onChange(answers.map((answer, answerIndex) => (answerIndex === index ? example : answer)))
              }
            />
          </div>
          <input
            id={`follow-up-${index}`}
            className="min-h-11 rounded-md border border-[var(--border-default)] px-3 text-base font-normal transition hover:border-[var(--text-tertiary)]"
            value={answers[index] ?? ""}
            onChange={(event) => onChange(answers.map((answer, answerIndex) => (answerIndex === index ? event.target.value : answer)))}
          />
        </div>
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
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:justify-between">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 text-[15px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-elevated)] active:scale-[0.98] disabled:opacity-50"
        type="button"
        onClick={onBack}
        disabled={step === 1 || isLoading}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        이전
      </button>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-5 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-50"
        type="button"
        onClick={onNext}
        disabled={!canContinue || isLoading}
      >
        {isLoading ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : null}
        {step === 1 ? "아이 상황 이어서 입력" : step === 2 ? "AI 분석하기" : step === 4 ? "도시와 프로그램 추천 보기" : "다음"}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </div>
  )
}
