"use client"

import { accommodationOptions, budgetOptions, budgetScopeOptions, departureWindowOptions, durationOptions, koreanSupportOptions, parentAccompanimentOptions, regionOptions, regionPriorityOptions } from "@/components/campfit/v2/options"
import { NumberField, PrimaryButton, SectionIntro, SelectField, TileGroup } from "@/components/campfit/v2/V2Controls"
import type { AccommodationPreference, RegionGroup, RequiredIntake } from "@/types/campfitV2"

type RequiredIntakeFormProps = {
  readonly value: RequiredIntake
  readonly onChange: (value: RequiredIntake) => void
  readonly onNext: () => void
}

export function canContinueRequiredIntake(value: RequiredIntake): boolean {
  return value.preferredRegionGroups.length > 0
}

export function RequiredIntakeForm({ value, onChange, onNext }: RequiredIntakeFormProps) {
  return (
    <section className="grid gap-6" aria-labelledby="campfit-v2-required-title">
      <SectionIntro
        eyebrow="CampFit v2 상담 시작"
        title="먼저 바꿀 수 없는 조건과 가족 기준을 정리할게요."
        description="캠프 시작 시점의 아이 나이, 항공권을 포함한 전체 예산, 부모 동행 가능 형태를 기준으로 먼저 방향을 좁혀갑니다."
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="apple-glass-soft grid gap-4 rounded-[24px] p-5">
          <NumberField
            id="child-age-at-start"
            label="캠프 시작 시점 기준 아이 만 나이는 어떻게 되나요?"
            value={value.childAgeAtStart}
            min={3}
            max={18}
            onChange={(childAgeAtStart) => onChange({ ...value, childAgeAtStart })}
          />
          <SelectField
            id="departure-window"
            label="희망 출발 시기는 언제인가요?"
            value={value.departureWindow}
            options={departureWindowOptions}
            onChange={(departureWindow) => onChange({ ...value, departureWindow })}
          />
          <SelectField
            id="duration-weeks"
            label="가능한 캠프 기간은 어느 정도인가요?"
            value={durationValue(value)}
            options={durationOptions}
            onChange={(duration) => onChange({ ...value, ...durationPatch(duration) })}
          />
        </div>
        <div className="apple-glass-soft grid gap-4 rounded-[24px] p-5">
          <SelectField
            id="total-budget-all-in"
            label="항공권부터 현지 이동비까지, 이번 캠프에 쓸 수 있는 전체 예산은 어느 정도인가요?"
            value={budgetValue(value)}
            options={budgetOptions}
            onChange={(budget) => onChange({ ...value, ...budgetPatch(budget) })}
          />
          <SelectField
            id="budget-scope"
            label="이 예산은 누구 기준인가요?"
            value={value.budgetScope}
            options={budgetScopeOptions}
            onChange={(budgetScope) => onChange({ ...value, budgetScope })}
          />
          <div className="grid items-start gap-3 sm:grid-cols-3">
            <NumberField id="traveler-child" label="아이 인원" value={value.travelerCounts.child} min={1} max={6} onChange={(child) => onChange({ ...value, travelerCounts: { ...value.travelerCounts, child } })} />
            <NumberField id="traveler-parent" label="부모 인원" value={value.travelerCounts.parent} min={0} max={4} onChange={(parent) => onChange({ ...value, travelerCounts: { ...value.travelerCounts, parent } })} />
            <NumberField id="traveler-sibling" label="형제자매 인원" value={value.travelerCounts.sibling} min={0} max={4} onChange={(sibling) => onChange({ ...value, travelerCounts: { ...value.travelerCounts, sibling } })} />
          </div>
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <TileGroup<RegionGroup>
          label="선호 지역이 있나요?"
          options={regionOptions}
          values={value.preferredRegionGroups}
          allowEmpty={false}
          onChange={(preferredRegionGroups) => onChange({ ...value, preferredRegionGroups })}
        />
        <div className="grid gap-5">
          <SelectField
            id="region-priority"
            label="지역 선호는 얼마나 중요한가요?"
            value={value.regionPriority}
            options={regionPriorityOptions}
            onChange={(regionPriority) => onChange({ ...value, regionPriority })}
          />
          <SelectField
            id="parent-accompaniment"
            label="부모 동행 가능 형태는 어떤가요?"
            value={value.parentAccompanimentMode}
            options={parentAccompanimentOptions}
            onChange={(parentAccompanimentMode) => onChange({ ...value, parentAccompanimentMode })}
          />
          <SelectField
            id="korean-support"
            label="한국어 지원 필요 수준은 어느 정도인가요?"
            value={value.koreanSupportNeed}
            options={koreanSupportOptions}
            onChange={(koreanSupportNeed) => onChange({ ...value, koreanSupportNeed })}
          />
        </div>
      </div>
      <TileGroup<AccommodationPreference>
        label="허용 가능한 숙소 형태를 골라주세요."
        options={accommodationOptions}
        values={value.accommodationPreferences}
        allowEmpty={false}
        onChange={(accommodationPreferences) => onChange({ ...value, accommodationPreferences })}
      />
      <div className="flex justify-end">
        <PrimaryButton disabled={!canContinueRequiredIntake(value)} onClick={onNext}>상황 입력으로 이동</PrimaryButton>
      </div>
    </section>
  )
}

function durationValue(value: RequiredIntake): (typeof durationOptions)[number]["value"] {
  const max = value.durationWeeksMax
  if (max === undefined) return "undecided"
  if (max <= 1) return "1"
  if (max <= 2) return "2"
  if (max <= 3) return "3"
  if (max <= 4) return "4"
  return "5"
}

function durationPatch(value: string): Pick<RequiredIntake, "durationWeeksMin" | "durationWeeksMax"> {
  const option = durationOptions.find((item) => item.value === value)
  return option === undefined || option.value === "undecided" ? {} : { durationWeeksMin: option.min, durationWeeksMax: option.max }
}

function budgetValue(value: RequiredIntake): (typeof budgetOptions)[number]["value"] {
  const max = value.totalBudgetAllInKrwMax
  if (max === undefined) return "unknown"
  const option = budgetOptions.find((item) => "max" in item && item.max === max)
  return option?.value ?? "unknown"
}

function budgetPatch(value: string): Pick<RequiredIntake, "totalBudgetAllInKrwMin" | "totalBudgetAllInKrwMax"> {
  const option = budgetOptions.find((item) => item.value === value)
  return option === undefined || option.value === "unknown" ? {} : { totalBudgetAllInKrwMin: option.min, totalBudgetAllInKrwMax: option.max }
}
