"use client"

import { useMemo, useState, type ReactNode } from "react"
import { V3Header } from "@/components/campfit/v3/CampFitV3Flow"
import {
  campfitV3BudgetOptions,
  countCompletedChildRows,
  validateCampfitV3IntakeDraft,
  type CampfitV3IntakeDraft,
} from "@/components/campfit/v3/intakeDraft"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

type Props = {
  readonly draft: CampfitV3IntakeDraft
  readonly onDraftChange: (value: CampfitV3IntakeDraft) => void
  readonly onBack: () => void
  readonly onSubmit: (value: CampfitV3BasicInfo) => Promise<void>
}

type TouchedFields = Readonly<Record<string, boolean>>

export function CampFitV3Intake({ draft, onDraftChange, onBack, onSubmit }: Props) {
  const [touched, setTouched] = useState<TouchedFields>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const validation = useMemo(() => validateCampfitV3IntakeDraft(draft), [draft])
  const completedChildCount = useMemo(() => countCompletedChildRows(draft), [draft])

  function updateDraft(patch: Partial<CampfitV3IntakeDraft>): void {
    onDraftChange({ ...draft, ...patch })
  }

  function updateAge(index: number, age: string): void {
    updateDraft({ childAges: draft.childAges.map((value, itemIndex) => itemIndex === index ? age : value) })
  }

  function addChild(): void {
    if (draft.childAges.length >= 5) return
    clearChildTouches()
    updateDraft({ childAges: [...draft.childAges, ""] })
  }

  function removeChild(index: number): void {
    if (draft.childAges.length === 1) return
    clearChildTouches()
    updateDraft({ childAges: draft.childAges.filter((_, itemIndex) => itemIndex !== index) })
  }

  function markTouched(key: string): void {
    setTouched((current) => ({ ...current, [key]: true }))
  }

  function clearChildTouches(): void {
    setTouched((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("child-"))))
  }

  function showError(key: string): boolean {
    return submitted || touched[key] === true
  }

  async function submit(): Promise<void> {
    setSubmitted(true)
    const current = validateCampfitV3IntakeDraft(draft)
    if (current.value === null || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(current.value)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-4 py-2 sm:px-6 lg:px-10">
      <V3Header />
      <section className="mx-auto grid w-full max-w-[1120px] flex-1 items-center py-3">
        <form className="apple-glass overflow-hidden rounded-[28px]" noValidate onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <div className="border-b border-[var(--border-default)] px-5 py-4 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div>
              <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">STEP 1 · 기본 조건</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-.03em] sm:text-3xl">먼저 기본 조건만 알려주세요</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">각 항목을 직접 확인하면 채팅을 시작할 수 있어요. 자세한 기대와 걱정은 다음 대화에서 편하게 말씀해 주세요.</p>
            </div>
            <p className="mt-3 text-xs font-semibold text-[var(--text-tertiary)] lg:mt-0">부모·보호자가 같은 도시나 인근에 머무는 1~4주 프로그램 기준</p>
          </div>

          <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:px-8 lg:grid-cols-2">
            <Field id="child-ages" title="1. 캠프 시작 시점 아이 만 나이" helper="아이별로 만 5세부터 12세까지 입력해 주세요.">
              <div className="flex flex-wrap items-start gap-2">
                {draft.childAges.map((age, index) => {
                  const error = validation.errors.childAges[index] ?? null
                  const errorId = `child-age-${index}-error`
                  return (
                    <label className="min-w-[132px] flex-1" key={index}>
                      <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">{index + 1}번째 아이</span>
                      <span className="flex items-center gap-2">
                        <input
                          aria-describedby={showError(`child-${index}`) && error ? errorId : undefined}
                          aria-invalid={showError(`child-${index}`) && error !== null}
                          aria-label={`${index + 1}번째 아이 만 나이`}
                          className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-3 font-bold outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                          inputMode="numeric"
                          max={12}
                          min={5}
                          placeholder="5~12"
                          step={1}
                          type="number"
                          value={age}
                          onBlur={() => markTouched(`child-${index}`)}
                          onChange={(event) => updateAge(index, event.target.value)}
                        />
                        {draft.childAges.length > 1 ? <button className="min-h-12 shrink-0 rounded-xl border border-[var(--border-default)] px-3 text-xs font-bold text-[var(--text-secondary)]" type="button" onClick={() => removeChild(index)}>삭제</button> : null}
                      </span>
                      <ErrorText id={errorId} show={showError(`child-${index}`)}>{error}</ErrorText>
                    </label>
                  )
                })}
                <button className="min-h-12 whitespace-nowrap rounded-2xl border border-[var(--cta-glass-border)] bg-[var(--accent-soft)] px-4 text-sm font-extrabold text-[var(--accent-primary)] disabled:opacity-40" type="button" disabled={draft.childAges.length >= 5} onClick={addChild}>+ 아이 추가</button>
              </div>
            </Field>

            <Field id="departure" title="2. 출발 시기" helper="정확한 날짜가 아니어도 괜찮아요.">
              <input
                aria-describedby={showError("departureWindow") && validation.errors.departureWindow ? "departure-error" : undefined}
                aria-invalid={showError("departureWindow") && validation.errors.departureWindow !== null}
                aria-labelledby="departure-title"
                className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                maxLength={80}
                placeholder="예: 다음 여름방학, 2027년 1월"
                type="text"
                value={draft.departureWindow}
                onBlur={() => markTouched("departureWindow")}
                onChange={(event) => updateDraft({ departureWindow: event.target.value })}
              />
              <ErrorText id="departure-error" show={showError("departureWindow")}>{validation.errors.departureWindow}</ErrorText>
            </Field>

            <Field id="duration" title="3. 가능한 기간" helper="가족이 해외에 머물 수 있는 기간을 골라주세요.">
              <div aria-labelledby="duration-title" className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((week) => (
                  <button
                    aria-pressed={draft.durationWeeks === week}
                    className={`min-h-12 whitespace-nowrap rounded-2xl border px-2 text-sm font-bold outline-none focus:ring-4 focus:ring-[var(--focus-ring)] ${draft.durationWeeks === week ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "border-[var(--border-default)] bg-white"}`}
                    type="button"
                    key={week}
                    onBlur={() => markTouched("durationWeeks")}
                    onClick={() => updateDraft({ durationWeeks: week })}
                  >{week}주</button>
                ))}
              </div>
              <ErrorText id="duration-error" show={showError("durationWeeks")}>{validation.errors.durationWeeks}</ErrorText>
            </Field>

            <Field id="budget" title="4. 가족 전체 예산" helper="항공·숙소·생활비를 포함한 범위를 선택해 주세요.">
              <select
                aria-describedby={showError("budget") && validation.errors.budget ? "budget-error" : undefined}
                aria-invalid={showError("budget") && validation.errors.budget !== null}
                aria-labelledby="budget-title"
                className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4 font-semibold outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                value={draft.budgetMode}
                onBlur={() => markTouched("budget")}
                onChange={(event) => updateDraft({ budgetMode: event.target.value as CampfitV3IntakeDraft["budgetMode"] })}
              >
                <option value="" disabled>예산 범위를 선택해 주세요</option>
                {campfitV3BudgetOptions.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}
                <option value="custom">직접 입력</option>
              </select>
              {draft.budgetMode === "custom" ? (
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-sm">
                  <input aria-label="최소 예산" className="min-h-11 min-w-0 rounded-xl border border-[var(--border-default)] px-3 outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]" inputMode="numeric" min={0} placeholder="최소" step={1} type="number" value={draft.budgetMinManwon} onBlur={() => markTouched("budget")} onChange={(event) => updateDraft({ budgetMinManwon: event.target.value })} />
                  <span>~</span>
                  <input aria-label="최대 예산" className="min-h-11 min-w-0 rounded-xl border border-[var(--border-default)] px-3 outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]" inputMode="numeric" min={1} placeholder="최대" step={1} type="number" value={draft.budgetMaxManwon} onBlur={() => markTouched("budget")} onChange={(event) => updateDraft({ budgetMaxManwon: event.target.value })} />
                  <span>만원</span>
                </div>
              ) : null}
              <ErrorText id="budget-error" show={showError("budget")}>{validation.errors.budget}</ErrorText>
            </Field>

            <Field id="travelers" title="5. 이동 인원" helper="완료한 아이 나이 행의 수가 아동 인원에 자동 반영됩니다.">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">성인</span>
                  <select
                    aria-describedby={showError("adultCount") && validation.errors.adultCount ? "adult-count-error" : undefined}
                    aria-invalid={showError("adultCount") && validation.errors.adultCount !== null}
                    className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4 font-bold outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                    value={draft.adultCount ?? ""}
                    onBlur={() => markTouched("adultCount")}
                    onChange={(event) => updateDraft({ adultCount: event.target.value === "" ? null : Number(event.target.value) })}
                  >
                    <option value="" disabled>선택</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option value={count} key={count}>{count}명</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">아이</span>
                  <input aria-label="입력이 완료된 아이 수" className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 font-bold" readOnly value={`${completedChildCount}명`} />
                </label>
              </div>
              <ErrorText id="adult-count-error" show={showError("adultCount")}>{validation.errors.adultCount}</ErrorText>
            </Field>

            <div className="flex items-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-tint-green)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
              <span className="mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-black text-[var(--accent-primary)]">✓</span>
              아이가 낮 프로그램에 참여하는 동안 보호자는 같은 도시나 인근에 머무르는 조건입니다.
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-3 sm:px-8">
            <button className="glass-button-muted min-h-12 rounded-full px-5 text-sm font-bold" type="button" onClick={onBack}>이전</button>
            <div className="flex min-w-0 items-center gap-3">
              <p className="hidden text-right text-xs font-semibold text-[var(--text-tertiary)] sm:block">필수 항목을 모두 확인하면 채팅을 시작할 수 있어요.</p>
              <button className="glass-cta min-h-12 whitespace-nowrap rounded-full px-7 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={validation.value === null || submitting}>{submitting ? "상담을 준비하는 중…" : "채팅 시작하기 →"}</button>
            </div>
          </div>
        </form>
      </section>
    </main>
  )
}

function Field({ id, title, helper, children }: { readonly id: string; readonly title: string; readonly helper: string; readonly children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-extrabold text-[var(--text-primary)]" id={`${id}-title`}>{title}</legend>
      <p className="mb-2 mt-1 text-xs leading-5 text-[var(--text-tertiary)] [word-break:keep-all]">{helper}</p>
      {children}
    </fieldset>
  )
}

function ErrorText({ id, show, children }: { readonly id: string; readonly show: boolean; readonly children: string | null }) {
  if (!show || children === null) return null
  return <p className="mt-1 text-xs font-semibold leading-5 text-[var(--status-error)]" id={id} role="alert">{children}</p>
}
