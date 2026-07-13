"use client"

import { useMemo, useState } from "react"
import { V3Header } from "@/components/campfit/v3/CampFitV3Flow"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

type Props = {
  readonly initialValue: CampfitV3BasicInfo | null
  readonly onBack: () => void
  readonly onSubmit: (value: CampfitV3BasicInfo) => Promise<void>
}

const budgetOptions = [
  { label: "300만~500만 원", min: 3_000_000, max: 5_000_000 },
  { label: "500만~800만 원", min: 5_000_000, max: 8_000_000 },
  { label: "800만~1,200만 원", min: 8_000_000, max: 12_000_000 },
  { label: "1,200만~2,000만 원", min: 12_000_000, max: 20_000_000 },
] as const

export function CampFitV3Intake({ initialValue, onBack, onSubmit }: Props) {
  const [childAges, setChildAges] = useState<number[]>(initialValue ? [...initialValue.childAges] : [8])
  const [departureWindow, setDepartureWindow] = useState(initialValue?.departureWindow ?? "")
  const [durationWeeks, setDurationWeeks] = useState(initialValue?.durationWeeks ?? 2)
  const initialBudgetIndex = initialValue
    ? budgetOptions.findIndex((option) => option.min === initialValue.budgetMinKrw && option.max === initialValue.budgetMaxKrw)
    : 1
  const [budgetMode, setBudgetMode] = useState(initialBudgetIndex >= 0 ? String(initialBudgetIndex) : "custom")
  const [budgetMin, setBudgetMin] = useState(initialValue ? Math.round(initialValue.budgetMinKrw / 10_000) : 500)
  const [budgetMax, setBudgetMax] = useState(initialValue ? Math.round(initialValue.budgetMaxKrw / 10_000) : 800)
  const [adultCount, setAdultCount] = useState(initialValue?.adultCount ?? 1)
  const [submitting, setSubmitting] = useState(false)

  const selectedBudget = budgetMode === "custom" ? null : budgetOptions[Number(budgetMode)]
  const minKrw = selectedBudget?.min ?? budgetMin * 10_000
  const maxKrw = selectedBudget?.max ?? budgetMax * 10_000
  const valid = useMemo(
    () => childAges.length >= 1
      && childAges.every((age) => Number.isInteger(age) && age >= 5 && age <= 12)
      && departureWindow.trim().length >= 2
      && durationWeeks >= 1 && durationWeeks <= 4
      && adultCount >= 1
      && minKrw >= 0
      && maxKrw > 0
      && minKrw <= maxKrw,
    [adultCount, childAges, departureWindow, durationWeeks, maxKrw, minKrw],
  )

  function updateAge(index: number, age: number): void {
    setChildAges((current) => current.map((value, itemIndex) => itemIndex === index ? age : value))
  }

  function addChild(): void {
    setChildAges((current) => current.length >= 5 ? current : [...current, 8])
  }

  function removeChild(index: number): void {
    setChildAges((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function submit(): Promise<void> {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        childAges,
        departureWindow: departureWindow.trim(),
        durationWeeks,
        budgetMinKrw: minKrw,
        budgetMaxKrw: maxKrw,
        adultCount,
        childCount: childAges.length,
        guardianStaysNearby: true,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-4 py-2 sm:px-6 lg:px-10">
      <V3Header />
      <section className="mx-auto grid w-full max-w-[1120px] flex-1 items-center py-3">
        <div className="apple-glass overflow-hidden rounded-[28px]">
          <div className="border-b border-[var(--border-default)] px-5 py-4 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div>
              <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">STEP 1 · 기본 조건</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-.03em] sm:text-3xl">먼저 기본 조건만 알려주세요</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">자세한 기대와 걱정은 다음 대화에서 편하게 말씀해 주세요.</p>
            </div>
            <p className="mt-3 text-xs font-semibold text-[var(--text-tertiary)] lg:mt-0">부모·보호자가 같은 도시나 인근에 머무는 1~4주 프로그램 기준</p>
          </div>

          <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:px-8 lg:grid-cols-2">
            <Field title="1. 캠프 시작 시점 아이 만 나이" helper="아이를 추가하면 이동 인원의 아동 수도 함께 바뀝니다.">
              <div className="flex flex-wrap items-end gap-2">
                {childAges.map((age, index) => (
                  <label className="min-w-[112px] flex-1" key={index}>
                    <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">{index + 1}번째 아이</span>
                    <span className="flex items-center gap-2">
                      <input aria-label={`${index + 1}번째 아이 나이`} className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-3 font-bold" min={5} max={12} inputMode="numeric" type="number" value={age} onChange={(event) => updateAge(index, Number(event.target.value))} />
                      {childAges.length > 1 ? <button className="min-h-12 shrink-0 rounded-xl border border-[var(--border-default)] px-3 text-xs font-bold text-[var(--text-secondary)]" type="button" onClick={() => removeChild(index)}>삭제</button> : null}
                    </span>
                  </label>
                ))}
                <button className="min-h-12 whitespace-nowrap rounded-2xl border border-[var(--cta-glass-border)] bg-[var(--accent-soft)] px-4 text-sm font-extrabold text-[var(--accent-primary)] disabled:opacity-40" type="button" disabled={childAges.length >= 5} onClick={addChild}>+ 아이 추가</button>
              </div>
            </Field>

            <Field title="2. 출발 시기" helper="정확한 날짜가 아니어도 괜찮아요.">
              <input className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4" type="text" placeholder="예: 다음 여름방학, 2027년 1월" value={departureWindow} onChange={(event) => setDepartureWindow(event.target.value)} />
            </Field>

            <Field title="3. 가능한 기간" helper="가족이 해외에 머물 수 있는 기간을 골라주세요.">
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((week) => <button className={`min-h-12 whitespace-nowrap rounded-2xl border px-2 text-sm font-bold ${durationWeeks === week ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "border-[var(--border-default)] bg-white"}`} type="button" key={week} onClick={() => setDurationWeeks(week)}>{week}주</button>)}
              </div>
            </Field>

            <Field title="4. 가족 전체 예산" helper="항공·숙소·생활비를 포함한 범위입니다.">
              <select className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4 font-semibold" value={budgetMode} onChange={(event) => setBudgetMode(event.target.value)}>
                {budgetOptions.map((option, index) => <option value={index} key={option.label}>{option.label}</option>)}
                <option value="custom">직접 입력</option>
              </select>
              {budgetMode === "custom" ? (
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-sm">
                  <input aria-label="최소 예산" className="min-h-11 min-w-0 rounded-xl border border-[var(--border-default)] px-3" min={0} type="number" value={budgetMin} onChange={(event) => setBudgetMin(Number(event.target.value))} />
                  <span>~</span>
                  <input aria-label="최대 예산" className="min-h-11 min-w-0 rounded-xl border border-[var(--border-default)] px-3" min={1} type="number" value={budgetMax} onChange={(event) => setBudgetMax(Number(event.target.value))} />
                  <span>만원</span>
                </div>
              ) : null}
            </Field>

            <Field title="5. 이동 인원" helper="아동 수는 위 나이 입력과 자동으로 연결됩니다.">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">성인</span>
                  <select className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4 font-bold" value={adultCount} onChange={(event) => setAdultCount(Number(event.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count}명</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">아이</span>
                  <input className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 font-bold" readOnly value={`${childAges.length}명`} />
                </label>
              </div>
            </Field>

            <div className="flex items-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-tint-green)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
              <span className="mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-black text-[var(--accent-primary)]">✓</span>
              아이가 낮 프로그램에 참여하는 동안 보호자는 같은 도시나 인근에 머무르는 조건입니다.
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-3 sm:px-8">
            <button className="glass-button-muted min-h-12 rounded-full px-5 text-sm font-bold" type="button" onClick={onBack}>이전</button>
            <button className="glass-cta min-h-12 whitespace-nowrap rounded-full px-7 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={!valid || submitting} onClick={submit}>{submitting ? "상담을 준비하는 중…" : "채팅 시작하기 →"}</button>
          </div>
        </div>
      </section>
    </main>
  )
}

function Field({ title, helper, children }: { readonly title: string; readonly helper: string; readonly children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-extrabold text-[var(--text-primary)]">{title}</legend>
      <p className="mb-2 mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{helper}</p>
      {children}
    </fieldset>
  )
}
