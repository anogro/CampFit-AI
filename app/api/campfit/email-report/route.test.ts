import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/campfit/email-report/route"

const originalFetch = globalThis.fetch

describe("CampFit email report route", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "resend_test_key")
    vi.stubEnv("CAMPFIT_EMAIL_FROM", "CampFit AI <reports@example.com>")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 })))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.stubGlobal("fetch", originalFetch)
    vi.restoreAllMocks()
  })

  it("rejects an invalid email before calling the provider", async () => {
    const response = await POST(emailRequest("not-an-email", pdfFile()))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ message: "받으실 이메일 주소를 확인해 주세요." })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("rejects a non-PDF attachment before calling the provider", async () => {
    const response = await POST(emailRequest("parent@example.com", new File(["text"], "report.txt", { type: "text/plain" })))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ message: "PDF 파일을 확인해 주세요." })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("returns a safe unavailable response when email credentials are missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "")

    const response = await POST(emailRequest("parent@example.com", pdfFile()))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ message: "이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("sends only the recipient and generated PDF through the provider", async () => {
    const response = await POST(emailRequest("parent@example.com", pdfFile()))
    const payload = await response.json()
    const providerRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    if (!providerRequest) throw new Error("provider request was not made")
    const body = JSON.parse(providerRequest[1].body as string) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true })
    expect(providerRequest[0]).toBe("https://api.resend.com/emails")
    expect(providerRequest[1].headers).toEqual({ Authorization: "Bearer resend_test_key", "Content-Type": "application/json" })
    expect(body).toMatchObject({
      from: "CampFit AI <reports@example.com>",
      to: ["parent@example.com"],
      subject: "[CampFit AI] 우리 가족 해외 캠프 추천 리포트",
    })
    expect(body).not.toHaveProperty("result")
    expect(body).not.toHaveProperty("basicInfo")
    expect(body["attachments"]).toEqual([{ filename: "campfit-report-2026-07-19.pdf", content: "cGRm" }])
  })

  it("hides provider failures behind a user-safe response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider failure", { status: 500 })))

    const response = await POST(emailRequest("parent@example.com", pdfFile()))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ message: "이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." })
  })
})

function pdfFile(): File {
  return new File(["pdf"], "campfit-report-2026-07-19.pdf", { type: "application/pdf" })
}

function emailRequest(email: string, pdf: File): Request {
  const formData = new FormData()
  formData.append("email", email)
  formData.append("pdf", pdf)
  return new Request("http://localhost/api/campfit/email-report", { method: "POST", body: formData })
}
