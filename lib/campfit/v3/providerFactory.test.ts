import { afterEach, describe, expect, it, vi } from "vitest"
import { createConversationProvider, resolveAiProvider } from "@/lib/campfit/v3/providerFactory"
import { GeminiCampfitV3ProviderCore } from "@/lib/campfit/v3/geminiProviderCore"
import { OpenAICampfitV3ProviderCore } from "@/lib/campfit/v3/openaiProviderCore"

describe("CampFit provider factory", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("selects OpenAI when AI_PROVIDER=openai", () => {
    vi.stubEnv("AI_PROVIDER", "openai")
    expect(resolveAiProvider()).toBe("openai")
    expect(createConversationProvider()).toBeInstanceOf(OpenAICampfitV3ProviderCore)
  })

  it("selects Gemini when AI_PROVIDER=gemini", () => {
    vi.stubEnv("AI_PROVIDER", "gemini")
    expect(resolveAiProvider()).toBe("gemini")
    expect(createConversationProvider()).toBeInstanceOf(GeminiCampfitV3ProviderCore)
  })

  it("keeps Gemini as the safe default when AI_PROVIDER is unset", () => {
    vi.stubEnv("AI_PROVIDER", "")
    expect(resolveAiProvider()).toBe("gemini")
    expect(createConversationProvider()).toBeInstanceOf(GeminiCampfitV3ProviderCore)
  })

  it("rejects provider values outside the explicit allowlist", () => {
    expect(() => resolveAiProvider("anthropic")).toThrow("Unsupported AI provider")
  })

  it("passes the same resolved environment timeout to OpenAI and Gemini", () => {
    vi.stubEnv("AI_TIMEOUT_MS", "20000")

    vi.stubEnv("AI_PROVIDER", "openai")
    const openai = createConversationProvider() as unknown as { readonly timeoutMs: number }

    vi.stubEnv("AI_PROVIDER", "gemini")
    const gemini = createConversationProvider() as unknown as { readonly timeoutMs: number }

    expect(openai.timeoutMs).toBe(20_000)
    expect(gemini.timeoutMs).toBe(20_000)
  })
})
