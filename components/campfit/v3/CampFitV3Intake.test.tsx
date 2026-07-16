import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CampFitV3Intake } from "@/components/campfit/v3/CampFitV3Intake"
import { emptyCampfitV3IntakeDraft } from "@/components/campfit/v3/intakeDraft"

describe("CampFit v3 intake layout safeguards", () => {
  it("keeps focus and CTA shadow space inside the clipped frame", () => {
    const markup = renderToStaticMarkup(createElement(CampFitV3Intake, {
      draft: emptyCampfitV3IntakeDraft,
      onDraftChange: vi.fn(),
      onBack: vi.fn(),
      onSubmit: vi.fn(async () => undefined),
    }))

    expect(markup).toContain("gap-x-8 gap-y-4 px-2 py-4 sm:px-1 lg:grid-cols-2")
    expect(markup).toContain("border-t border-[var(--border-default)] px-2 pb-4 pt-3 sm:px-1 lg:px-0")
    expect(markup).toContain("focus:ring-4 focus:ring-[var(--focus-ring)]")
  })
})
