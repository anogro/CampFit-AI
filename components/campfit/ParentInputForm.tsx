"use client"

import { z } from "zod"
import {
  budgetRangeOptions,
  durationWeekOptions,
  englishSelfLevels,
  gradeOptions,
  koreanManagerRequiredOptions,
  levelOptions,
  overseasExperienceOptions,
  parentAccompaniedOptions,
  programTypeOptions,
  type CampfitInput,
} from "@/types/campfit"
import { optionLabels } from "@/components/campfit/labels"

type ParentInputFormProps = {
  readonly input: CampfitInput
  readonly onChange: (input: CampfitInput) => void
}

const GradeSchema = z.enum(gradeOptions)
const EnglishSelfLevelSchema = z.enum(englishSelfLevels)
const OverseasExperienceSchema = z.enum(overseasExperienceOptions)
const LevelSchema = z.enum(levelOptions)
const BudgetRangeSchema = z.enum(budgetRangeOptions)
const DurationWeeksSchema = z.enum(durationWeekOptions)
const ParentAccompaniedSchema = z.enum(parentAccompaniedOptions)
const KoreanManagerRequiredSchema = z.enum(koreanManagerRequiredOptions)
const ProgramTypeSchema = z.enum(programTypeOptions)

export function ParentInputForm({ input, onChange }: ParentInputFormProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <NumberField
        label="아이 나이"
        value={input.childAge}
        min={6}
        max={15}
        onChange={(childAge) => onChange({ ...input, childAge })}
      />
      <SelectField
        label="학년"
        value={input.grade}
        options={gradeOptions}
        getLabel={(value) => value}
        onChange={(value) => onChange({ ...input, grade: GradeSchema.parse(value) })}
      />
      <SelectField
        label="영어 자가 수준"
        value={input.englishSelfLevel}
        options={englishSelfLevels}
        getLabel={(value) => optionLabels.englishSelfLevel[value]}
        onChange={(value) => onChange({ ...input, englishSelfLevel: EnglishSelfLevelSchema.parse(value) })}
      />
      <SelectField
        label="해외 경험"
        value={input.overseasExperience}
        options={overseasExperienceOptions}
        getLabel={(value) => optionLabels.overseasExperience[value]}
        onChange={(value) => onChange({ ...input, overseasExperience: OverseasExperienceSchema.parse(value) })}
      />
      <SelectField
        label="낯가림"
        value={input.shynessLevel}
        options={levelOptions}
        getLabel={(value) => optionLabels.level[value]}
        onChange={(value) => onChange({ ...input, shynessLevel: LevelSchema.parse(value) })}
      />
      <SelectField
        label="분리 적응"
        value={input.separationTolerance}
        options={levelOptions}
        getLabel={(value) => optionLabels.level[value]}
        onChange={(value) => onChange({ ...input, separationTolerance: LevelSchema.parse(value) })}
      />
      <SelectField
        label="예산 범위"
        value={input.budgetRange}
        options={budgetRangeOptions}
        getLabel={(value) => optionLabels.budgetRange[value]}
        onChange={(value) => onChange({ ...input, budgetRange: BudgetRangeSchema.parse(value) })}
      />
      <SelectField
        label="희망 기간"
        value={input.durationWeeks}
        options={durationWeekOptions}
        getLabel={(value) => optionLabels.durationWeeks[value]}
        onChange={(value) => onChange({ ...input, durationWeeks: DurationWeeksSchema.parse(value) })}
      />
      <SelectField
        label="부모 동반"
        value={input.parentAccompanied}
        options={parentAccompaniedOptions}
        getLabel={(value) => optionLabels.parentAccompanied[value]}
        onChange={(value) => onChange({ ...input, parentAccompanied: ParentAccompaniedSchema.parse(value) })}
      />
      <SelectField
        label="한국인 관리자"
        value={input.koreanManagerRequired}
        options={koreanManagerRequiredOptions}
        getLabel={(value) => optionLabels.koreanManagerRequired[value]}
        onChange={(value) => onChange({ ...input, koreanManagerRequired: KoreanManagerRequiredSchema.parse(value) })}
      />
      <div className="lg:col-span-2">
        <SelectField
          label="선호 프로그램"
          value={input.preferredProgramType}
          options={programTypeOptions}
          getLabel={(value) => optionLabels.preferredProgramType[value]}
          onChange={(value) => onChange({ ...input, preferredProgramType: ProgramTypeSchema.parse(value) })}
        />
      </div>
    </div>
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
    <label className="grid gap-2 text-sm font-bold text-[var(--text-primary)]">
      {label}
      <select
        className="min-h-12 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 text-base text-[var(--text-primary)]"
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
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (value: number) => void
}

function NumberField({ label, value, min, max, onChange }: NumberFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--text-primary)]">
      {label}
      <input
        className="min-h-12 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 text-base text-[var(--text-primary)]"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
