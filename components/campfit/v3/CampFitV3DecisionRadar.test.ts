import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CampFitV3DecisionRadar } from "@/components/campfit/v3/CampFitV3DecisionRadar"
import type { DecisionAxis } from "@/components/campfit/v3/resultPresentation"

describe("CampFitV3DecisionRadar", () => {
  it("renders six qualitative axes without exposing an internal score", () => {
    const axes: readonly DecisionAxis[] = [
      axis("english", "영어 경험", "high"),
      axis("school", "학교·학습", "medium"),
      axis("project", "주제·프로젝트", "low"),
      axis("culture", "문화·활동", "high"),
      axis("support", "지원 필요", "medium"),
      axis("family", "가족 체류 현실성", "high"),
    ]
    const markup = renderToStaticMarkup(createElement(CampFitV3DecisionRadar, { axes }))

    expect(markup).toContain("상담 판단축 육각형 차트")
    expect(markup).toContain("영어 경험 높음")
    expect(markup).toContain("가족 체류 현실성 높음")
    expect(markup).not.toMatch(/\d+점/)
  })
})

function axis(key: DecisionAxis["key"], label: string, level: DecisionAxis["level"]): DecisionAxis {
  return { key, label, summaryLabel: label, level }
}
