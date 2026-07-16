import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CampFitV3Frame } from "@/components/campfit/v3/CampFitV3Frame"

describe("CampFitV3Frame", () => {
  it("keeps every workflow stage inside the landing-sized viewport frame", () => {
    const markup = renderToStaticMarkup(createElement(CampFitV3Frame, null, createElement("span", null, "content")))

    expect(markup).toContain("h-dvh")
    expect(markup).toContain("max-w-[1280px]")
    expect(markup).toContain("rounded-[24px]")
    expect(markup).toContain("sm:rounded-[32px]")
    expect(markup).toContain("campfit-v3-frame-surface")
    expect(markup).toContain("content")
  })
})
