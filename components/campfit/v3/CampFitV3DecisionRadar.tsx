import * as React from "react"
import {
  decisionAxisGeometry,
  decisionAxisLevelLabel,
  type DecisionAxis,
} from "@/components/campfit/v3/resultPresentation"

type CampFitV3DecisionRadarProps = {
  readonly axes: readonly DecisionAxis[]
}

const viewBoxWidth = 360
const viewBoxHeight = 340
const centerX = viewBoxWidth / 2
const centerY = 164
const radius = 112
const gridLevels = [34, 62, 88] as const

export function CampFitV3DecisionRadar({ axes }: CampFitV3DecisionRadarProps) {
  const captionId = React.useId()
  const chartAxes = axes.slice(0, 6)
  const accessibleSummary = chartAxes
    .map((axis) => `${axis.label} ${decisionAxisLevelLabel(axis.level)}`)
    .join(", ")

  return (
    <figure className="grid gap-5" aria-labelledby={captionId}>
      <svg
        className="mx-auto h-auto w-full max-w-[420px] overflow-visible"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        role="img"
        aria-label={`현재 입력을 바탕으로 중요하게 본 요소: ${accessibleSummary}`}
      >
        <title>상담 판단축 육각형 차트</title>
        <desc>정확한 내부 점수 대신 여섯 판단축의 낮음, 보통, 높음 수준을 보여줍니다.</desc>
        {gridLevels.map((level) => (
          <polygon
            key={`decision-grid-${level}`}
            points={pointsFor(Array.from({ length: chartAxes.length }, () => level), chartAxes.length)}
            fill="none"
            stroke="var(--border-default)"
            strokeWidth="1"
          />
        ))}
        {chartAxes.map((axis, index) => {
          const end = pointAt(88, index, chartAxes.length)
          return (
            <line
              key={`decision-spoke-${axis.key}`}
              x1={centerX}
              y1={centerY}
              x2={end.x}
              y2={end.y}
              stroke="var(--border-default)"
              strokeWidth="1"
            />
          )
        })}
        <polygon
          points={pointsFor(chartAxes.map((axis) => decisionAxisGeometry(axis.level)), chartAxes.length)}
          fill="var(--accent-soft)"
          stroke="var(--accent-primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {chartAxes.map((axis, index) => {
          const point = pointAt(decisionAxisGeometry(axis.level), index, chartAxes.length)
          return (
            <circle
              key={`decision-point-${axis.key}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--accent-primary)"
              stroke="var(--surface-primary)"
              strokeWidth="2"
            />
          )
        })}
        {chartAxes.map((axis, index) => {
          const label = labelPointAt(index, chartAxes.length)
          return (
            <text
              key={`decision-label-${axis.key}`}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              dominantBaseline="middle"
              fill="var(--text-secondary)"
              fontSize="11"
              fontWeight="700"
            >
              {axis.label}
            </text>
          )
        })}
      </svg>
      <figcaption id={captionId} className="sr-only">
        판단 근거 그래프: 영어 경험, 학교·학습, 주제·프로젝트, 문화·활동, 지원 필요, 가족 체류 현실성의 6개 축별 분석 수준을 시각적으로 나타내는 차트입니다. 상세 분석 수치는 우측의 요약 리스트를 참조해 주세요.
      </figcaption>
    </figure>
  )
}

function pointsFor(levels: readonly number[], total: number): string {
  return levels.map((level, index) => {
    const point = pointAt(level, index, total)
    return `${point.x},${point.y}`
  }).join(" ")
}

function pointAt(level: number, index: number, total: number): { readonly x: number; readonly y: number } {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total)
  const distance = radius * (level / 100)
  return {
    x: Number((centerX + (Math.cos(angle) * distance)).toFixed(2)),
    y: Number((centerY + (Math.sin(angle) * distance)).toFixed(2)),
  }
}

function labelPointAt(index: number, total: number): { readonly x: number; readonly y: number; readonly anchor: "start" | "middle" | "end" } {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total)
  const distance = radius + 34
  const cosine = Math.cos(angle)
  return {
    x: Number((centerX + (cosine * distance)).toFixed(2)),
    y: Number((centerY + (Math.sin(angle) * distance)).toFixed(2)),
    anchor: Math.abs(cosine) < 0.2 ? "middle" : cosine > 0 ? "start" : "end",
  }
}
