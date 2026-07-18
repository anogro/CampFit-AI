import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_AI_TIMEOUT_MS, resolveAiTimeoutMs } from "@/lib/campfit/v3/providerConfig"

describe("CampFit provider timeout configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses a valid 20 second environment timeout without clamping", () => {
    vi.stubEnv("AI_TIMEOUT_MS", "20000")
    expect(resolveAiTimeoutMs()).toBe(20_000)
  })

  it("uses a valid 7 second environment timeout", () => {
    vi.stubEnv("AI_TIMEOUT_MS", "7000")
    expect(resolveAiTimeoutMs()).toBe(7_000)
  })

  it("uses the documented default only when the value is missing or invalid", () => {
    vi.stubEnv("AI_TIMEOUT_MS", "")
    expect(resolveAiTimeoutMs()).toBe(DEFAULT_AI_TIMEOUT_MS)

    vi.stubEnv("AI_TIMEOUT_MS", "not-a-duration")
    expect(resolveAiTimeoutMs()).toBe(DEFAULT_AI_TIMEOUT_MS)

    vi.stubEnv("AI_TIMEOUT_MS", "-1")
    expect(resolveAiTimeoutMs()).toBe(DEFAULT_AI_TIMEOUT_MS)
  })
})
