import { afterEach, describe, expect, it, vi } from "vitest"
import { requestProviderJson } from "@/lib/campfit/v3/providerTransport"

describe("provider transport diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("preserves only safe fetch cause metadata for a network failure", async () => {
    const cause = Object.assign(new Error("connect ECONNRESET"), {
      code: "ECONNRESET",
      errno: -104,
      syscall: "connect",
      hostname: "api.openai.com",
    })
    const error = Object.assign(new TypeError("fetch failed"), { cause })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error))

    const result = await requestProviderJson({
      endpoint: "https://api.openai.com/v1/responses",
      headers: { Authorization: "Bearer should-not-be-logged" },
      body: { input: "should-not-be-logged" },
      timeoutMs: 7_000,
    })

    expect(result).toMatchObject({
      code: "network_error",
      requestMade: true,
      providerResponseReceived: false,
      httpStatus: null,
      error: {
        errorName: "TypeError",
        errorMessage: "fetch failed",
        causeName: "Error",
        causeCode: "ECONNRESET",
        causeErrno: -104,
        causeSyscall: "connect",
        causeHostname: "api.openai.com",
        causeMessage: "connect ECONNRESET",
      },
    })
    expect(JSON.stringify(result)).not.toContain("should-not-be-logged")
  })
})
