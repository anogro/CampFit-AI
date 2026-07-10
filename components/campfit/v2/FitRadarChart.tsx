import * as React from "react"
import type { DisplayFitAxis } from "@/lib/campfit/v2/fitDisplay"

type FitRadarChartProps = {
  readonly axes: readonly DisplayFitAxis[]
}

const viewBoxSize = 300
const center = viewBoxSize / 2
const radius = 92
const gridLevels = [25, 50, 75, 100] as const

export function FitRadarChart({ axes }: FitRadarChartProps) {
  const chartAxes = axes.slice(0, 6).map((axis) => ({ ...axis, score: normalizedScore(axis.score) }))
  const polygonPoints = pointsFor(chartAxes.map((axis) => axis.score))
  const accessibleSummary = chartAxes.map((axis) => `${axis.label} ${axis.score}점`).join(", ")

  return (
    <figure className="grid gap-4" aria-labelledby="fit-radar-caption">
      <svg
        className="mx-auto w-full max-w-[320px] overflow-visible"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        role="img"
        aria-label={`6개 축 적합도: ${accessibleSummary}`}
      >
        <title>6개 축 적합도 차트</title>
        {gridLevels.map((level) => (
          <polygon
            key={`fit-radar-grid-${level}`}
            points={pointsFor(Array.from({ length: chartAxes.length }, () => level))}
            fill="none"
            stroke="var(--border-default)"
            strokeWidth="1"
          />
        ))}
        {chartAxes.map((axis, index) => {
          const point = pointAt(100, index, chartAxes.length)
          return <line key={`fit-radar-spoke-${index}-${axis.label}`} x1={center} y1={center} x2={point.x} y2={point.y} stroke="var(--border-default)" strokeWidth="1" />
        })}
        <polygon points={polygonPoints} fill="rgb(47 111 82 / 0.18)" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinejoin="round" />
        {chartAxes.map((axis, index) => {
          const point = pointAt(axis.score, index, chartAxes.length)
          return <circle key={`fit-radar-score-${index}-${axis.label}`} cx={point.x} cy={point.y} r="4" fill="var(--accent-primary)" stroke="var(--surface-primary)" strokeWidth="2" />
        })}
      </svg>
      <figcaption id="fit-radar-caption" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {chartAxes.map((axis, index) => (
          <div key={`fit-radar-legend-${index}-${axis.label}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-2">
            <span className="truncate text-xs font-semibold text-[var(--text-secondary)]">{axis.label}</span>
            <span className="shrink-0 text-xs font-extrabold tabular-nums text-[var(--accent-primary)]">{axis.score}점</span>
          </div>
        ))}
      </figcaption>
    </figure>
  )
}

function pointsFor(scores: readonly number[]): string {
  return scores.map((score, index) => {
    const point = pointAt(score, index, scores.length)
    return `${point.x},${point.y}`
  }).join(" ")
}

function pointAt(score: number, index: number, total: number): { readonly x: number; readonly y: number } {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total)
  const distance = radius * (normalizedScore(score) / 100)
  return {
    x: Number((center + (Math.cos(angle) * distance)).toFixed(2)),
    y: Number((center + (Math.sin(angle) * distance)).toFixed(2)),
  }
}

function normalizedScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}
