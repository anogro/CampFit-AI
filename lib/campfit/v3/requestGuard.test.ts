import { afterEach, describe, expect, it } from "vitest"
import {
  guardCampfitRequest,
  resetCampfitRequestCounters,
  type CampfitRequestPolicy,
} from "@/lib/campfit/v3/requestGuard"

const policy: CampfitRequestPolicy = { bucket: "test", limit: 2, windowMs: 1_000, maxBodyBytes: 100 }

function requestFrom(ip: string, contentLength?: number): Request {
  const headers = new Headers({ "x-forwarded-for": `${ip}, 10.0.0.1` })
  if (contentLength !== undefined) headers.set("content-length", String(contentLength))
  return new Request("https://example.com/api", { method: "POST", headers })
}

describe("guardCampfitRequest", () => {
  afterEach(() => resetCampfitRequestCounters())

  it("allows requests up to the limit and then refuses with 429", () => {
    expect(guardCampfitRequest(requestFrom("1.1.1.1"), policy, 0)).toBeNull()
    expect(guardCampfitRequest(requestFrom("1.1.1.1"), policy, 10)).toBeNull()
    const refused = guardCampfitRequest(requestFrom("1.1.1.1"), policy, 20)
    expect(refused?.status).toBe(429)
    expect(refused?.headers.get("Retry-After")).toBe("1")
  })

  it("counts each visitor separately", () => {
    guardCampfitRequest(requestFrom("1.1.1.1"), policy, 0)
    guardCampfitRequest(requestFrom("1.1.1.1"), policy, 0)
    expect(guardCampfitRequest(requestFrom("2.2.2.2"), policy, 0)).toBeNull()
  })

  it("starts a new window after the previous one ends", () => {
    guardCampfitRequest(requestFrom("1.1.1.1"), policy, 0)
    guardCampfitRequest(requestFrom("1.1.1.1"), policy, 0)
    expect(guardCampfitRequest(requestFrom("1.1.1.1"), policy, 1_000)).toBeNull()
  })

  it("refuses bodies larger than the policy allows with 413", () => {
    expect(guardCampfitRequest(requestFrom("1.1.1.1", 101), policy, 0)?.status).toBe(413)
    expect(guardCampfitRequest(requestFrom("1.1.1.1", 100), policy, 0)).toBeNull()
  })
})
