import { GeminiCampfitV3ProviderCore } from "@/lib/campfit/v3/geminiProviderCore"
import { OpenAICampfitV3ProviderCore } from "@/lib/campfit/v3/openaiProviderCore"
import { UpstageCampfitV3ProviderCore } from "@/lib/campfit/v3/upstageProviderCore"
import type { CampfitV3LLMProvider } from "@/lib/campfit/v3/provider"

export const campfitProviderIds = ["gemini", "openai", "upstage"] as const
export type CampfitProviderId = (typeof campfitProviderIds)[number]

export type CampfitProviderFactoryOptions = {
  readonly maxProviderRequests?: 1 | 2
  readonly timeoutMs?: number
}

export function resolveAiProvider(value: string | undefined = process.env["AI_PROVIDER"]): CampfitProviderId {
  const normalized = value?.trim().toLocaleLowerCase()
  if (normalized === undefined || normalized === "") return "gemini"
  if (normalized === "gemini" || normalized === "openai" || normalized === "upstage") return normalized
  throw new Error("Unsupported AI provider")
}

export function createConversationProvider(
  options: CampfitProviderFactoryOptions = {},
): CampfitV3LLMProvider {
  const provider = resolveAiProvider()
  if (provider === "openai") return new OpenAICampfitV3ProviderCore(options)
  if (provider === "upstage") return new UpstageCampfitV3ProviderCore(options)
  return new GeminiCampfitV3ProviderCore(options)
}
