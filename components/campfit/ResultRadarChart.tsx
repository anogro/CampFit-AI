export type AxisScore = {
  readonly label: string
  readonly value: number
}

type RadarPoint = {
  readonly x: number
  readonly y: number
}

export function RadarPanel({ title, scores }: { readonly title: string; readonly scores: readonly AxisScore[] }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <div className="mt-3 flex justify-center overflow-hidden rounded-md bg-[var(--surface-secondary)] p-3">
        <RadarChart scores={scores} />
      </div>
    </div>
  )
}

function RadarChart({ scores }: { readonly scores: readonly AxisScore[] }) {
  const gridLevels = [0.25, 0.5, 0.75, 1] as const
  const polygon = scores.map((score, index) => formatPoint(getRadarPoint({ index, total: scores.length, value: score.value }))).join(" ")

  return (
    <svg className="h-[280px] w-full max-w-[360px]" viewBox="0 0 220 220" role="img" aria-label="부모 선택 기준 레이더 차트">
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={scores.map((_, index) => formatPoint(getRadarPoint({ index, total: scores.length, value: level }))).join(" ")}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="1"
        />
      ))}
      {scores.map((score, index) => {
        const axisEnd = getRadarPoint({ index, total: scores.length, value: 1 })
        const labelPoint = getRadarPoint({ index, total: scores.length, value: 1.18 })

        return (
          <g key={score.label}>
            <line x1="110" y1="110" x2={axisEnd.x} y2={axisEnd.y} stroke="var(--border-subtle)" strokeWidth="1" />
            <text
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--text-secondary)] text-[10px] font-semibold"
            >
              {score.label}
            </text>
          </g>
        )
      })}
      <polygon points={polygon} fill="rgb(47 111 82 / 0.16)" stroke="var(--accent-primary)" strokeWidth="2" />
    </svg>
  )
}

function getRadarPoint(input: { readonly index: number; readonly total: number; readonly value: number }): RadarPoint {
  const angle = -Math.PI / 2 + (Math.PI * 2 * input.index) / input.total
  const radius = 64 * input.value
  return {
    x: 110 + Math.cos(angle) * radius,
    y: 110 + Math.sin(angle) * radius,
  }
}

function formatPoint(point: RadarPoint): string {
  return `${point.x},${point.y}`
}
