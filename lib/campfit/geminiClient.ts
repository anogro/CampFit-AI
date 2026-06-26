import { z } from "zod"

const defaultModel = "gemini-2.5-flash"
const requestTimeoutMs = 25_000
const retryStatuses = new Set([429, 503])

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
})

export async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env["GEMINI_API_KEY"]
  if (!apiKey) {
    return null
  }

  const model = process.env["GEMINI_MODEL"] ?? defaultModel
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const text = await requestGemini(endpoint, prompt, attempt)
    if (text !== null) {
      return text
    }
  }

  return null
}

async function requestGemini(endpoint: string, prompt: string, attempt: number): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    })

    if (!response.ok) {
      console.error("Gemini request returned non-OK status", response.status)
      await waitBeforeRetry(response.status, attempt)
      return null
    }

    const json = await response.json()
    const parsed = GeminiResponseSchema.safeParse(json)
    if (!parsed.success) {
      console.error("Gemini response schema validation failed")
      return null
    }

    const text = parsed.data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    if (text === null) {
      console.error("Gemini response did not include text")
    }

    return text
  } catch (error) {
    if (error instanceof Error) {
      console.error("Gemini request failed", error.message)
      return null
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function waitBeforeRetry(status: number, attempt: number): Promise<void> {
  if (!retryStatuses.has(status) || attempt >= 2) {
    return
  }

  await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)))
}
