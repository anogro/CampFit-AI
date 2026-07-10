import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FitRadarChart } from "@/components/campfit/v2/FitRadarChart"

describe("FitRadarChart", () => {
  it("Given six display axes When rendering Then each parent-facing label and score is visible", () => {
    const markup = renderToStaticMarkup(createElement(FitRadarChart, {
      axes: [
        { label: "아이 적응", score: 88, comment: "확인" },
        { label: "영어 준비", score: 74, comment: "확인" },
        { label: "부모 조건", score: 82, comment: "확인" },
        { label: "지원/안전", score: 76, comment: "확인" },
        { label: "성장 자극", score: 80, comment: "확인" },
        { label: "비용 현실성", score: 64, comment: "확인" },
      ],
    }))

    expect(markup).toContain("아이 적응")
    expect(markup).toContain("영어 준비")
    expect(markup).toContain("부모 조건")
    expect(markup).toContain("지원/안전")
    expect(markup).toContain("성장 자극")
    expect(markup).toContain("비용 현실성")
    expect(markup).not.toContain("child_fit")
  })

  it("Given an invalid score When rendering Then the chart does not emit NaN coordinates", () => {
    const markup = renderToStaticMarkup(createElement(FitRadarChart, {
      axes: [{ label: "아이 적응", score: Number.NaN, comment: "확인" }],
    }))

    expect(markup).not.toContain("NaN")
  })
})
