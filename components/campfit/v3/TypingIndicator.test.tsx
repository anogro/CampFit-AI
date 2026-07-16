import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TypingIndicator } from "@/components/campfit/v3/TypingIndicator"

describe("CampFit v3 typing indicator", () => {
  it("renders an accessible status with reduced-motion-safe dots", () => {
    const markup = renderToStaticMarkup(createElement(TypingIndicator))

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-label="답변을 준비하고 있어요"')
    expect(markup).toContain("motion-safe:animate-bounce")
    expect(markup).toContain("motion-reduce:animate-none")
    expect((markup.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
