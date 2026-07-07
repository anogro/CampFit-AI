"use client"

import { z } from "zod"
import {
  budgetRangeOptions,
  destinationPreferenceOptions,
  durationWeekOptions,
  englishSelfLevels,
  koreanManagerRequiredOptions,
  levelOptions,
  overseasExperienceOptions,
  parentAccompaniedOptions,
  programTypeOptions,
  travelReadinessOptions,
  type CampfitInput,
} from "@/types/campfit"
import { optionLabels } from "@/components/campfit/labels"

type ParentInputFormProps = {
  readonly input: CampfitInput
  readonly onChange: (input: CampfitInput) => void
}

const EnglishSelfLevelSchema = z.enum(englishSelfLevels)
const OverseasExperienceSchema = z.enum(overseasExperienceOptions)
const LevelSchema = z.enum(levelOptions)
const BudgetRangeSchema = z.enum(budgetRangeOptions)
const DestinationPreferenceSchema = z.enum(destinationPreferenceOptions)
const TravelReadinessSchema = z.enum(travelReadinessOptions)
const DurationWeeksSchema = z.enum(durationWeekOptions)
const ParentAccompaniedSchema = z.enum(parentAccompaniedOptions)
const KoreanManagerRequiredSchema = z.enum(koreanManagerRequiredOptions)
const ProgramTypeSchema = z.enum(programTypeOptions)

export function ParentInputForm({ input, onChange }: ParentInputFormProps) {
  const inferredGrade = gradeFromAge(input.childAge)

  return (
    <section className="grid gap-6" aria-labelledby="basic-profile-title">
      <div className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.01em] text-[var(--accent-primary)]">캠프핏 체크 노트</p>
        <h2 id="basic-profile-title" className="text-[1.625rem] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
          아이에게 맞는 시작을 찾기 위해
          <br />
          몇 가지만 먼저 살펴볼게요.
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
          정답은 없어요. 지금 아이와 가장 가까운 모습을 골라주세요.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="apple-glass-soft grid content-start gap-4 rounded-[24px] bg-[var(--surface-elevated)] p-5">
          <SectionLabel eyebrow="우리 아이에 대해" title="아이 나이와 영어 익숙함" />
          <NumberField
            label="아이 나이 (만 나이)"
            hint={`추천에는 ${inferredGrade} 기준을 함께 사용합니다.`}
            value={input.childAge}
            min={6}
            max={15}
            onChange={(childAge) => onChange({ ...input, childAge, grade: gradeFromAge(childAge) })}
          />
          <SelectField
            label="영어를 듣고 말하는 데 얼마나 익숙한가요?"
            value={input.englishSelfLevel}
            options={englishSelfLevels}
            getLabel={(value) => optionLabels.englishSelfLevel[value]}
            onChange={(value) => onChange({ ...input, englishSelfLevel: EnglishSelfLevelSchema.parse(value) })}
          />
          <SelectField
            label="해외나 장거리 여행 경험이 있나요?"
            value={input.overseasExperience}
            options={overseasExperienceOptions}
            getLabel={(value) => optionLabels.overseasExperience[value]}
            onChange={(value) => onChange({ ...input, overseasExperience: OverseasExperienceSchema.parse(value) })}
          />
        </div>

        <div className="apple-glass-soft grid gap-4 rounded-[24px] bg-[var(--surface-elevated)] p-5">
          <SectionLabel eyebrow="가족이 원하는 조건" title="캠프를 고를 때 중요한 조건" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="낯선 사람이나 환경을 어려워하나요?"
              value={input.shynessLevel}
              options={levelOptions}
              getLabel={(value) => optionLabels.level[value]}
              onChange={(value) => onChange({ ...input, shynessLevel: LevelSchema.parse(value) })}
            />
            <SelectField
              label="부모와 떨어져 수업 듣는 적응력은 어떤가요?"
              value={input.separationTolerance}
              options={levelOptions}
              getLabel={(value) => optionLabels.level[value]}
              onChange={(value) => onChange({ ...input, separationTolerance: LevelSchema.parse(value) })}
            />
            <SelectField
              label="생각하는 예산 범위는 어느 정도인가요?"
              value={input.budgetRange}
              options={budgetRangeOptions}
              getLabel={(value) => optionLabels.budgetRange[value]}
              onChange={(value) => onChange({ ...input, budgetRange: BudgetRangeSchema.parse(value) })}
            />
            <SelectField
              label="가족이 마음에 두는 지역이 있나요?"
              value={input.destinationPreference}
              options={destinationPreferenceOptions}
              getLabel={(value) => optionLabels.destinationPreference[value]}
              onChange={(value) => onChange({ ...input, destinationPreference: DestinationPreferenceSchema.parse(value) })}
            />
            <SelectField
              label="비행 거리와 독립 일정은 어느 정도까지 괜찮나요?"
              value={input.travelReadiness}
              options={travelReadinessOptions}
              getLabel={(value) => optionLabels.travelReadiness[value]}
              onChange={(value) => onChange({ ...input, travelReadiness: TravelReadinessSchema.parse(value) })}
            />
            <SelectField
              label="어느 정도 기간을 생각하고 있나요?"
              value={input.durationWeeks}
              options={durationWeekOptions}
              getLabel={(value) => optionLabels.durationWeeks[value]}
              onChange={(value) => onChange({ ...input, durationWeeks: DurationWeeksSchema.parse(value) })}
            />
            <SelectField
              label="부모 동행이 필요한 일정인가요?"
              value={input.parentAccompanied}
              options={parentAccompaniedOptions}
              getLabel={(value) => optionLabels.parentAccompanied[value]}
              onChange={(value) => onChange({ ...input, parentAccompanied: ParentAccompaniedSchema.parse(value) })}
            />
            <SelectField
              label="한국어로 챙겨주는 관리자가 필요할까요?"
              value={input.koreanManagerRequired}
              options={koreanManagerRequiredOptions}
              getLabel={(value) => optionLabels.koreanManagerRequired[value]}
              onChange={(value) => onChange({ ...input, koreanManagerRequired: KoreanManagerRequiredSchema.parse(value) })}
            />
          </div>
        </div>
      </div>

      <div>
        <SelectField
          label="이번 캠프에서 가장 기대하는 것은 무엇인가요?"
          value={input.preferredProgramType}
          options={programTypeOptions}
          getLabel={(value) => optionLabels.preferredProgramType[value]}
          onChange={(value) => onChange({ ...input, preferredProgramType: ProgramTypeSchema.parse(value) })}
        />
      </div>
    </section>
  )
}

type SelectFieldProps<T extends string> = {
  readonly label: string
  readonly value: T
  readonly options: readonly T[]
  readonly getLabel: (value: T) => string
  readonly onChange: (value: string) => void
}

function SelectField<T extends string>({ label, value, options, getLabel, onChange }: SelectFieldProps<T>) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]">
      {label}
      <select
        className="min-h-11 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 text-base text-[var(--text-primary)] transition hover:border-[var(--text-tertiary)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

type NumberFieldProps = {
  readonly label: string
  readonly hint: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (value: number) => void
}

function NumberField({ label, hint, value, min, max, onChange }: NumberFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]">
      {label}
      <input
        className="min-h-11 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 text-base text-[var(--text-primary)] transition hover:border-[var(--text-tertiary)]"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="text-xs font-medium leading-5 text-[var(--text-tertiary)] [word-break:keep-all]">{hint}</span>
    </label>
  )
}

function SectionLabel({ eyebrow, title }: { readonly eyebrow: string; readonly title: string }) {
  return (
    <div className="grid gap-1 border-b border-[var(--border-subtle)] pb-3">
      <p className="text-xs font-semibold text-[var(--text-tertiary)]">{eyebrow}</p>
      <p className="font-semibold text-[var(--text-primary)] [word-break:keep-all]">{title}</p>
    </div>
  )
}

function gradeFromAge(age: number): CampfitInput["grade"] {
  if (age <= 6) {
    return "초1"
  }

  if (age >= 15) {
    return "중3"
  }

  const grades = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3"] as const
  return grades[age - 6] ?? "초2"
}
