import type { CampfitV3BasicInfo } from "@/types/campfitV3"

export const campfitV3BudgetOptions = [
  { key: "preset-0", label: "300만~500만 원", min: 3_000_000, max: 5_000_000 },
  { key: "preset-1", label: "500만~800만 원", min: 5_000_000, max: 8_000_000 },
  { key: "preset-2", label: "800만~1,200만 원", min: 8_000_000, max: 12_000_000 },
  { key: "preset-3", label: "1,200만~2,000만 원", min: 12_000_000, max: 20_000_000 },
] as const

export const CAMPFIT_V3_MAX_DURATION_WEEKS = 52
export const CAMPFIT_V3_MAX_TRAVEL_CHILDREN = 8

export type CampfitV3BudgetMode = "" | (typeof campfitV3BudgetOptions)[number]["key"] | "custom"
export type CampfitV3DurationMode = "preset" | "custom"

export type CampfitV3IntakeDraft = {
  readonly childAges: readonly string[]
  readonly departureWindow: string
  readonly durationWeeks: number | null
  readonly durationMode: CampfitV3DurationMode
  readonly durationCustomWeeks: string
  readonly budgetMode: CampfitV3BudgetMode
  readonly budgetMinManwon: string
  readonly budgetMaxManwon: string
  readonly adultCount: number | null
  readonly childCount: number
}

export type CampfitV3IntakeErrors = {
  readonly childAges: readonly (string | null)[]
  readonly departureWindow: string | null
  readonly durationWeeks: string | null
  readonly childCount: string | null
  readonly budget: string | null
  readonly adultCount: string | null
}

export type CampfitV3IntakeValidation = {
  readonly value: CampfitV3BasicInfo | null
  readonly errors: CampfitV3IntakeErrors
}

export const emptyCampfitV3IntakeDraft: CampfitV3IntakeDraft = {
  childAges: [""],
  departureWindow: "",
  durationWeeks: null,
  durationMode: "preset",
  durationCustomWeeks: "",
  budgetMode: "",
  budgetMinManwon: "",
  budgetMaxManwon: "",
  adultCount: 1,
  childCount: 0,
}

export function validateCampfitV3IntakeDraft(draft: CampfitV3IntakeDraft): CampfitV3IntakeValidation {
  const parsedAges = draft.childAges.map(parseAge)
  const childAges = draft.childAges.map((input, index) => ageError(input, parsedAges[index] ?? null))
  const departureWindow = departureError(draft.departureWindow)
  const durationValue = selectedDurationWeeks(draft)
  const durationWeeks = durationValue === null
    ? "가능한 기간을 선택해 주세요."
    : Number.isInteger(durationValue) && durationValue >= 1 && durationValue <= CAMPFIT_V3_MAX_DURATION_WEEKS
      ? null
      : `기간은 1주부터 ${CAMPFIT_V3_MAX_DURATION_WEEKS}주까지 입력할 수 있어요.`
  const adultCount = draft.adultCount === null
    ? "함께 이동하는 성인 수를 선택해 주세요."
      : Number.isInteger(draft.adultCount) && draft.adultCount >= 1 && draft.adultCount <= 8
      ? null
      : "성인 수는 1명부터 8명까지 선택할 수 있어요."
  const completedChildCount = countCompletedChildRows(draft)
  const childCount = !Number.isInteger(draft.childCount) || draft.childCount < 1
    ? "함께 이동하는 아이 수를 1명 이상 입력해 주세요."
    : draft.childCount < completedChildCount
      ? `입력한 캠프 참가 아이 ${completedChildCount}명보다 적을 수 없어요.`
      : draft.childCount > CAMPFIT_V3_MAX_TRAVEL_CHILDREN
        ? `이동하는 아이 수는 ${CAMPFIT_V3_MAX_TRAVEL_CHILDREN}명까지 입력할 수 있어요.`
        : null
  const budget = budgetValue(draft)

  const errors: CampfitV3IntakeErrors = {
    childAges,
    departureWindow,
    durationWeeks,
    budget: budget.error,
    adultCount,
    childCount,
  }
  const hasError = childAges.some((error) => error !== null)
    || departureWindow !== null
    || durationWeeks !== null
    || budget.error !== null
    || adultCount !== null
    || childCount !== null

  if (hasError || parsedAges.some((age) => age === null) || durationValue === null || draft.adultCount === null || budget.value === null) {
    return { value: null, errors }
  }

  return {
    value: {
      childAges: parsedAges as number[],
      departureWindow: draft.departureWindow.trim(),
      durationWeeks: durationValue,
      budgetMinKrw: budget.value.min,
      budgetMaxKrw: budget.value.max,
      adultCount: draft.adultCount,
      childCount: draft.childCount,
      guardianStaysNearby: true,
    },
    errors,
  }
}

export function countCompletedChildRows(draft: CampfitV3IntakeDraft): number {
  return draft.childAges.reduce((count, input) => {
    const age = parseAge(input)
    return age !== null && ageError(input, age) === null ? count + 1 : count
  }, 0)
}

export function intakeDraftFromBasicInfo(value: CampfitV3BasicInfo): CampfitV3IntakeDraft {
  const preset = campfitV3BudgetOptions.find((option) => option.min === value.budgetMinKrw && option.max === value.budgetMaxKrw)
  return {
    childAges: value.childAges.map(String),
    departureWindow: value.departureWindow,
    durationWeeks: value.durationWeeks <= 4 ? value.durationWeeks : null,
    durationMode: value.durationWeeks <= 4 ? "preset" : "custom",
    durationCustomWeeks: value.durationWeeks <= 4 ? "" : String(value.durationWeeks),
    budgetMode: preset?.key ?? "custom",
    budgetMinManwon: formatManwon(value.budgetMinKrw),
    budgetMaxManwon: formatManwon(value.budgetMaxKrw),
    adultCount: value.adultCount,
    childCount: value.childCount,
  }
}

export function parseStoredIntakeDraft(value: unknown): CampfitV3IntakeDraft | null {
  if (!isRecord(value)) return null
  const childAges = value["childAges"]
  const departureWindow = value["departureWindow"]
  const durationWeeks = value["durationWeeks"]
  const durationMode = value["durationMode"]
  const durationCustomWeeks = value["durationCustomWeeks"]
  const budgetMode = value["budgetMode"]
  const budgetMinManwon = value["budgetMinManwon"]
  const budgetMaxManwon = value["budgetMaxManwon"]
  const adultCount = value["adultCount"]
  const childCount = value["childCount"]

  if (!Array.isArray(childAges) || childAges.length < 1 || childAges.length > 5 || !childAges.every((item) => typeof item === "string" && item.length <= 10)) return null
  if (typeof departureWindow !== "string" || departureWindow.length > 200) return null
  if (durationWeeks !== null && (!Number.isInteger(durationWeeks) || Number(durationWeeks) < 1 || Number(durationWeeks) > CAMPFIT_V3_MAX_DURATION_WEEKS)) return null
  if (durationMode !== undefined && durationMode !== "preset" && durationMode !== "custom") return null
  if (durationCustomWeeks !== undefined && (typeof durationCustomWeeks !== "string" || durationCustomWeeks.length > 3)) return null
  if (!isBudgetMode(budgetMode)) return null
  if (typeof budgetMinManwon !== "string" || budgetMinManwon.length > 20) return null
  if (typeof budgetMaxManwon !== "string" || budgetMaxManwon.length > 20) return null
  if (adultCount !== null && (!Number.isInteger(adultCount) || Number(adultCount) < 1 || Number(adultCount) > 8)) return null
  if (childCount !== undefined && childCount !== null && (!Number.isInteger(childCount) || Number(childCount) < 0 || Number(childCount) > CAMPFIT_V3_MAX_TRAVEL_CHILDREN)) return null

  return {
    childAges,
    departureWindow,
    durationWeeks: durationWeeks === null ? null : Number(durationWeeks),
    durationMode: durationMode === "custom" || (durationMode === undefined && typeof durationWeeks === "number" && durationWeeks > 4) ? "custom" : "preset",
    durationCustomWeeks: typeof durationCustomWeeks === "string" ? durationCustomWeeks : typeof durationWeeks === "number" && durationWeeks > 4 ? String(durationWeeks) : "",
    budgetMode,
    budgetMinManwon,
    budgetMaxManwon,
    adultCount: adultCount === null ? 1 : Number(adultCount),
    childCount: typeof childCount === "number" ? childCount : countCompletedChildRows({
      childAges,
      departureWindow,
      durationWeeks: durationWeeks === null ? null : Number(durationWeeks),
      durationMode: durationMode === "custom" ? "custom" : "preset",
      durationCustomWeeks: typeof durationCustomWeeks === "string" ? durationCustomWeeks : "",
      budgetMode,
      budgetMinManwon,
      budgetMaxManwon,
      adultCount: adultCount === null ? 1 : Number(adultCount),
      childCount: 0,
    }),
  }
}

function selectedDurationWeeks(draft: CampfitV3IntakeDraft): number | null {
  if (draft.durationMode === "custom") {
    if (draft.durationCustomWeeks.trim() === "") return null
    const parsed = Number(draft.durationCustomWeeks)
    return Number.isFinite(parsed) ? parsed : null
  }
  return draft.durationWeeks
}

function parseAge(input: string): number | null {
  if (input.trim() === "") return null
  const age = Number(input)
  return Number.isFinite(age) ? age : null
}

function ageError(input: string, age: number | null): string | null {
  if (input.trim() === "") return "아이의 만 나이를 입력해 주세요."
  if (age === null || !Number.isInteger(age)) return "만 나이는 정수로 입력해 주세요."
  if (age < 5 || age > 12) return "만 5세부터 12세까지 입력해 주세요."
  return null
}

function departureError(input: string): string | null {
  const value = input.trim()
  if (value.length === 0) return "희망 출발 시기를 입력해 주세요."
  if (value.length < 2) return "출발 시기를 두 글자 이상 입력해 주세요."
  if (value.length > 80) return "출발 시기는 80자 이내로 입력해 주세요."
  return null
}

function budgetValue(draft: CampfitV3IntakeDraft): { readonly value: { readonly min: number; readonly max: number } | null; readonly error: string | null } {
  if (draft.budgetMode === "") return { value: null, error: "가족 전체 예산 범위를 선택해 주세요." }
  if (draft.budgetMode !== "custom") {
    const preset = campfitV3BudgetOptions.find((option) => option.key === draft.budgetMode)
    return preset
      ? { value: { min: preset.min, max: preset.max }, error: null }
      : { value: null, error: "예산 범위를 다시 선택해 주세요." }
  }

  if (draft.budgetMinManwon.trim() === "" || draft.budgetMaxManwon.trim() === "") {
    return { value: null, error: "최소·최대 예산을 모두 입력해 주세요." }
  }
  const minManwon = Number(draft.budgetMinManwon)
  const maxManwon = Number(draft.budgetMaxManwon)
  if (!Number.isFinite(minManwon) || !Number.isFinite(maxManwon) || minManwon < 0 || maxManwon <= 0) {
    return { value: null, error: "예산은 0보다 큰 금액 범위로 입력해 주세요." }
  }
  const min = Math.round(minManwon * 10_000)
  const max = Math.round(maxManwon * 10_000)
  if (min > max) return { value: null, error: "최소 예산이 최대 예산보다 크지 않게 입력해 주세요." }
  return { value: { min, max }, error: null }
}

function formatManwon(value: number): string {
  return String(value / 10_000)
}

function isBudgetMode(value: unknown): value is CampfitV3BudgetMode {
  return value === "" || value === "custom" || campfitV3BudgetOptions.some((option) => option.key === value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
