import type { ReactNode } from "react"
import type { SelectOption } from "@/components/campfit/v2/options"

export function SectionIntro({ eyebrow, title, description }: { readonly eyebrow: string; readonly title: string; readonly description: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold tracking-[0.01em] text-[var(--accent-primary)]">{eyebrow}</p>
      <h2 className="text-[1.625rem] font-bold leading-tight text-[var(--text-primary)] [word-break:keep-all]">
        {title}
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{description}</p>
    </div>
  )
}

export function NumberField({ id, label, value, min, max, onChange }: {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (value: number) => void
}) {
  return (
    <label className="grid self-start gap-2 text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]" htmlFor={id}>
      {label}
      <input
        id={id}
        className="h-11 min-h-11 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 text-base text-[var(--text-primary)] transition hover:border-[var(--text-tertiary)]"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function SelectField<T extends string>({ id, label, value, options, onChange }: {
  readonly id: string
  readonly label: string
  readonly value: T
  readonly options: readonly SelectOption<T>[]
  readonly onChange: (value: T) => void
}) {
  return (
    <label className="grid self-start gap-2 text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]" htmlFor={id}>
      {label}
      <select
        id={id}
        className="h-11 min-h-11 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 text-base text-[var(--text-primary)] transition hover:border-[var(--text-tertiary)]"
        value={value}
        onChange={(event) => {
          const selected = options.find((option) => option.value === event.target.value)
          if (selected !== undefined) onChange(selected.value)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

export function TileGroup<T extends string>({ label, options, values, allowEmpty = true, onChange }: {
  readonly label: string
  readonly options: readonly SelectOption<T>[]
  readonly values: readonly T[]
  readonly allowEmpty?: boolean
  readonly onChange: (values: readonly T[]) => void
}) {
  return (
    <fieldset className="grid self-start gap-3">
      <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = values.includes(option.value)
          return (
            <button
              key={option.value}
              className={`rounded-[18px] border px-3 py-3 text-left text-sm font-semibold leading-5 transition [word-break:keep-all] ${selected ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--text-secondary)]"}`}
              type="button"
              onClick={() => {
                const next = selected ? values.filter((value) => value !== option.value) : [...values, option.value]
                if (!allowEmpty && next.length === 0) return
                onChange(next)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function PrimaryButton({ children, disabled, onClick }: { readonly children: ReactNode; readonly disabled?: boolean; readonly onClick: () => void }) {
  return (
    <button className="apple-pill glass-cta inline-flex min-h-11 items-center justify-center px-6 text-[15px] font-semibold transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-45" type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

export function SecondaryButton({ children, disabled, onClick }: { readonly children: ReactNode; readonly disabled?: boolean; readonly onClick: () => void }) {
  return (
    <button className="apple-pill glass-button-muted inline-flex min-h-11 items-center justify-center px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-45" type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
