"use client"

import * as React from "react"
import { useMemo, useState, type ReactNode } from "react"
import { CampFitV3Frame, V3Header } from "@/components/campfit/v3/CampFitV3Frame"
import {
  CAMPFIT_V3_MAX_DURATION_WEEKS,
  CAMPFIT_V3_MAX_TRAVEL_CHILDREN,
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
  const [childCountTouched, setChildCountTouched] = useState(() => draft.childCount !== countCompletedChildRows(draft))
  const validation = useMemo(() => validateCampfitV3IntakeDraft(draft), [draft])
  const completedChildCount = useMemo(() => countCompletedChildRows(draft), [draft])

  function updateDraft(patch: Partial<CampfitV3IntakeDraft>): void {
    onDraftChange({ ...draft, ...patch })
  }

  function updateAge(index: number, age: string): void {
    const childAges = draft.childAges.map((value, itemIndex) => itemIndex === index ? age : value)
    const nextDraft = { ...draft, childAges }
    updateDraft(childCountTouched ? { childAges } : { childAges, childCount: countCompletedChildRows(nextDraft) })
  }

  function addChild(): void {
    if (draft.childAges.length >= 5) return
    clearChildTouches()
    const childAges = [...draft.childAges, ""]
    updateDraft(childCountTouched ? { childAges } : { childAges, childCount: countCompletedChildRows({ ...draft, childAges }) })
  }

  function removeChild(index: number): void {
    if (draft.childAges.length === 1) return
    clearChildTouches()
    const childAges = draft.childAges.filter((_, itemIndex) => itemIndex !== index)
    updateDraft(childCountTouched ? { childAges } : { childAges, childCount: countCompletedChildRows({ ...draft, childAges }) })
  }

  function changeChildCount(value: string): void {
    setChildCountTouched(true)
    updateDraft({ childCount: value === "" ? 0 : Number(value) })
  }

  function selectPresetDuration(week: number): void {
    updateDraft({ durationWeeks: week, durationMode: "preset", durationCustomWeeks: "" })
  }

  function selectCustomDuration(): void {
    updateDraft({ durationWeeks: null, durationMode: "custom", durationCustomWeeks: draft.durationCustomWeeks || "5" })
  }

  function selectDepartureMonth(value: string): void {
    if (!/^\d{4}-\d{2}$/.test(value)) return
    const [year, month] = value.split("-")
    updateDraft({ departureWindow: `${year}년 ${Number(month)}월` })
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
    <CampFitV3Frame>
      <V3Header />
      <form className="flex min-h-0 flex-1 flex-col overflow-hidden" noValidate onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <div className="shrink-0 border-b border-[var(--border-default)] px-1 py-4 sm:px-0 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div>
              <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">STEP 1 · 기본 조건</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-.03em] sm:text-3xl">먼저 기본 조건만 알려주세요</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">프로그램비뿐 아니라 항공·숙소·현지 체류비를 함께 비교하기 위해 가족 기준으로 확인합니다. 자세한 기대와 걱정은 다음 대화에서 편하게 말씀해주세요.</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-x-8 gap-y-4 px-2 py-4 sm:px-1 lg:grid-cols-2">
            <Field id="child-ages" title="1. 아이 나이" helper="캠프에 참석하는 자녀의 만나이를 입력해주세요. (캠프 시작시점 기준)">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  {draft.childAges.map((age, index) => {
                    const error = validation.errors.childAges[index] ?? null
                    const errorId = `child-age-${index}-error`
                    return (
                      <label className="min-w-0" key={index}>
                        <span className="flex items-center gap-2">
                          <input
                            aria-describedby={showError(`child-${index}`) && error ? errorId : undefined}
                            aria-invalid={showError(`child-${index}`) && error !== null}
                            aria-label={`아이 ${index + 1} 만 나이`}
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
                          {draft.childAges.length > 1 ? <button aria-label={`아이 ${index + 1} 입력 삭제`} className="min-h-12 shrink-0 rounded-xl border border-[var(--border-default)] px-3 text-xs font-bold text-[var(--text-secondary)]" type="button" onClick={() => removeChild(index)}>삭제</button> : null}
                        </span>
                        <ErrorText id={errorId} show={showError(`child-${index}`)}>{error}</ErrorText>
                      </label>
                    )
                  })}
                </div>
                <button className="min-h-12 whitespace-nowrap rounded-2xl border border-[var(--cta-glass-border)] bg-[var(--accent-soft)] px-4 text-sm font-extrabold text-[var(--accent-primary)] disabled:opacity-40" type="button" disabled={draft.childAges.length >= 5} onClick={addChild}>+ 아이 추가</button>
              </div>
            </Field>

            <Field id="departure" title="2. 출발 시기" helper="정확한 날짜가 아니어도 괜찮아요.">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  aria-describedby={showError("departureWindow") && validation.errors.departureWindow ? "departure-error" : undefined}
                  aria-invalid={showError("departureWindow") && validation.errors.departureWindow !== null}
                  aria-labelledby="departure-title"
                  className="min-h-12 min-w-0 rounded-2xl border border-[var(--border-default)] bg-white px-4 outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                  maxLength={80}
                  placeholder="예: 다음 여름방학, 2027년 1월"
                  type="text"
                  value={draft.departureWindow}
                  onBlur={() => markTouched("departureWindow")}
                  onChange={(event) => updateDraft({ departureWindow: event.target.value })}
                />
                <input
                  aria-label="출발 시기 달력에서 선택"
                  className="min-h-12 w-[9.5rem] rounded-2xl border border-[var(--border-default)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                  type="month"
                  onInput={(event) => selectDepartureMonth(event.currentTarget.value)}
                  onChange={(event) => selectDepartureMonth(event.target.value)}
                />
              </div>
              <ErrorText id="departure-error" show={showError("departureWindow")}>{validation.errors.departureWindow}</ErrorText>
            </Field>

            <Field id="duration" title="3. 가능한 기간" helper="가족이 해외에 머물 수 있는 기간을 골라주세요.">
              <div aria-labelledby="duration-title" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[1, 2, 3, 4].map((week) => (
                  <button
                    aria-pressed={draft.durationWeeks === week}
                    className={`min-h-12 whitespace-nowrap rounded-2xl border px-2 text-sm font-bold outline-none focus:ring-4 focus:ring-[var(--focus-ring)] ${draft.durationWeeks === week ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "border-[var(--border-default)] bg-white"}`}
                    type="button"
                    key={week}
                    onBlur={() => markTouched("durationWeeks")}
                    onClick={() => selectPresetDuration(week)}
                  >{week}주</button>
                ))}
                <button
                  aria-pressed={draft.durationMode === "custom"}
                  className={`min-h-12 whitespace-nowrap rounded-2xl border px-2 text-sm font-bold outline-none focus:ring-4 focus:ring-[var(--focus-ring)] ${draft.durationMode === "custom" ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "border-[var(--border-default)] bg-white"}`}
                  type="button"
                  onBlur={() => markTouched("durationWeeks")}
                  onClick={selectCustomDuration}
                >4주 이상</button>
              </div>
              {draft.durationMode === "custom" ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    aria-label="직접 입력할 체류 기간"
                    className="min-h-11 w-32 rounded-xl border border-[var(--border-default)] bg-white px-3 font-bold outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                    inputMode="numeric"
                    max={CAMPFIT_V3_MAX_DURATION_WEEKS}
                    min={5}
                    placeholder="예: 6"
                    step={1}
                    type="number"
                    value={draft.durationCustomWeeks}
                    onBlur={() => markTouched("durationWeeks")}
                    onChange={(event) => updateDraft({ durationWeeks: null, durationCustomWeeks: event.target.value })}
                  />
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">주</span>
                </div>
              ) : null}
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

            <Field id="travelers" title="5. 이동 인원" helper="캠프에 참여하지 않는 어린 자녀도 포함해 함께 이동하는 인원을 입력해 주세요.">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">성인</span>
                  <input
                    aria-describedby={showError("adultCount") && validation.errors.adultCount ? "adult-count-error" : undefined}
                    aria-invalid={showError("adultCount") && validation.errors.adultCount !== null}
                    aria-label="이동하는 성인 수"
                    className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4 font-bold outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                    inputMode="numeric"
                    max={8}
                    min={1}
                    step={1}
                    type="number"
                    value={draft.adultCount ?? 1}
                    onBlur={() => markTouched("adultCount")}
                    onChange={(event) => updateDraft({ adultCount: event.target.value === "" ? null : Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">아이</span>
                  <input
                    aria-describedby={showError("childCount") && validation.errors.childCount ? "child-count-error" : undefined}
                    aria-invalid={showError("childCount") && validation.errors.childCount !== null}
                    aria-label="이동하는 아이 수"
                    className="min-h-12 w-full rounded-2xl border border-[var(--border-default)] bg-white px-4 font-bold outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                    inputMode="numeric"
                    max={CAMPFIT_V3_MAX_TRAVEL_CHILDREN}
                    min={completedChildCount}
                    step={1}
                    type="number"
                    value={draft.childCount}
                    onBlur={() => markTouched("childCount")}
                    onChange={(event) => changeChildCount(event.target.value)}
                  />
                </label>
              </div>
              <ErrorText id="adult-count-error" show={showError("adultCount")}>{validation.errors.adultCount}</ErrorText>
              <ErrorText id="child-count-error" show={showError("childCount")}>{validation.errors.childCount}</ErrorText>
            </Field>

            <div className="flex items-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-tint-green)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
              <span className="mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white font-black text-[var(--accent-primary)]">✓</span>
              아이가 낮 프로그램에 참여하는 동안 보호자는 같은 도시나 인근에 머무르는 조건입니다.
            </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-default)] px-2 pb-4 pt-3 sm:px-1 lg:px-0">
            <button className="glass-button-muted min-h-12 rounded-full px-5 text-sm font-bold" type="button" onClick={onBack}>이전</button>
            <div className="flex min-w-0 items-center gap-3">
              <p className="hidden text-right text-xs font-semibold text-[var(--text-tertiary)] sm:block">필수 항목을 모두 확인하면 채팅을 시작할 수 있어요.</p>
              <button className="glass-cta min-h-12 whitespace-nowrap rounded-full px-7 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={validation.value === null || submitting}>{submitting ? "상담을 준비하는 중…" : "채팅 시작하기 →"}</button>
            </div>
          </div>
      </form>
    </CampFitV3Frame>
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
