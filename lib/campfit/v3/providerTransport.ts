import type { CampfitV3ProviderDiagnosticCode } from "@/lib/campfit/v3/provider"

export type ProviderTransportResult = {
  readonly body: unknown | null
  readonly code: Exclude<CampfitV3ProviderDiagnosticCode, "schema_validation_failed" | "semantic_validation_failed">
  readonly requestMade: boolean
  readonly providerResponseReceived: boolean
  readonly httpStatus: number | null
  readonly errorStatus: string | null
}

type ProviderTransportInput = {
  readonly endpoint: string
  readonly headers: Record<string, string>
  readonly body: unknown
  readonly timeoutMs: number
}

export async function requestProviderJson(input: ProviderTransportInput): Promise<ProviderTransportResult> {
  const controller = new AbortController()
  let timedOut = false
  const request = (async (): Promise<ProviderTransportResult> => {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: input.headers,
      signal: controller.signal,
      body: JSON.stringify(input.body),
    })

    let responseBody: unknown = null
    try {
      responseBody = await response.json()
    } catch (error) {
      if (isAbortError(error)) throw error
    }

    if (!response.ok) {
      return {
        body: responseBody,
        code: providerCodeFromHttpStatus(response.status),
        requestMade: true,
        providerResponseReceived: true,
        httpStatus: response.status,
        errorStatus: readProviderErrorStatus(responseBody),
      }
    }

    if (responseBody === null) {
      return {
        body: null,
        code: "json_parse_failed",
        requestMade: true,
        providerResponseReceived: true,
        httpStatus: response.status,
        errorStatus: null,
      }
    }

    return {
      body: responseBody,
      code: "ok",
      requestMade: true,
      providerResponseReceived: true,
      httpStatus: response.status,
      errorStatus: null,
    }
  })()

  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutSignal = new Promise<ProviderTransportResult>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new ProviderTimeoutError())
    }, input.timeoutMs)
  })

  try {
    return await Promise.race([request, timeoutSignal])
  } catch (error) {
    return {
      body: null,
      code: error instanceof ProviderTimeoutError || (isAbortError(error) && timedOut)
        ? "timeout"
        : isAbortError(error) ? "provider_cancelled" : "network_error",
      requestMade: true,
      providerResponseReceived: false,
      httpStatus: null,
      errorStatus: null,
    }
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    void request.catch(() => undefined)
  }
}

class ProviderTimeoutError extends Error {
  constructor() {
    super("AI provider request timed out")
    this.name = "ProviderTimeoutError"
  }
}

function providerCodeFromHttpStatus(status: number): Exclude<CampfitV3ProviderDiagnosticCode, "ok" | "schema_validation_failed" | "semantic_validation_failed"> {
  if (status === 400 || status === 422) return "invalid_request"
  if (status === 401 || status === 403) return "permission_denied"
  if (status === 404) return "model_not_found"
  if (status === 429) return "rate_limited"
  if (status === 499) return "provider_cancelled"
  if (status === 500) return "provider_internal"
  if (status === 502 || status === 503 || status === 504) return "provider_unavailable"
  return "unknown_provider_error"
}

function readProviderErrorStatus(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("error" in value)) return null
  const error = value.error
  if (typeof error !== "object" || error === null || !("status" in error)) return null
  return typeof error.status === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.status)
    ? error.status
    : null
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
}
