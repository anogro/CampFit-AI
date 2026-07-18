import { GeminiCampfitV3ProviderCore } from "@/lib/campfit/v3/geminiProviderCore"
import { OpenAICampfitV3ProviderCore } from "@/lib/campfit/v3/openaiProviderCore"
import type { CampfitV3LLMProvider } from "@/lib/campfit/v3/provider"

export const campfitProviderIds = ["gemini", "openai"] as const
export type CampfitProviderId = (typeof campfitProviderIds)[number]

export type CampfitProviderFactoryOptions = {
  readonly maxProviderRequests?: 1 | 2
  readonly timeoutMs?: number
}

export function resolveAiProvider(value: string | undefined = process.env["AI_PROVIDER"]): CampfitProviderId {
  const normalized = value?.trim().toLocaleLowerCase()
  if (normalized === undefined || normalized === "") return "gemini"
  if (normalized === "gemini" || normalized === "openai") return normalized
  throw new Error("Unsupported AI provider")
}

export function createConversationProvider(
  options: CampfitProviderFactoryOptions = {},
): CampfitV3LLMProvider {
  const provider = resolveAiProvider()
  return provider === "openai"
    ? new OpenAICampfitV3ProviderCore(options)
    : new GeminiCampfitV3ProviderCore(options)
}
