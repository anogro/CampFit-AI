import { describe, expect, it } from "vitest"
import { campFitShellClassName } from "@/components/campfit/v3/CampFitShell"

describe("campFitShellClassName", () => {
  it("keeps the standalone surface opaque", () => {
    expect(campFitShellClassName("standalone")).toContain("bg-[var(--surface-secondary)]")
  })

  it("removes an extra outer surface for embedded use", () => {
    expect(campFitShellClassName("embedded")).toContain("bg-transparent")
  })
})
