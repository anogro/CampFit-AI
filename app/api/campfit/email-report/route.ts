import { NextResponse } from "next/server"

const MAX_PDF_BYTES = 10_000_000
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/
const GENERIC_EMAIL_ERROR = "이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요."

export async function POST(request: Request): Promise<Response> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ message: "이메일 요청 형식을 확인해 주세요." }, { status: 400 })
  }

  const email = typeof formData.get("email") === "string" ? String(formData.get("email")).trim() : ""
  const pdf = formData.get("pdf")

  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    return NextResponse.json({ message: "받으실 이메일 주소를 확인해 주세요." }, { status: 400 })
  }
  if (!isPdfFile(pdf)) {
    return NextResponse.json({ message: "PDF 파일을 확인해 주세요." }, { status: 400 })
  }
  if (pdf.size <= 0) {
    return NextResponse.json({ message: "PDF 파일이 비어 있어요." }, { status: 400 })
  }
  if (pdf.size > MAX_PDF_BYTES) {
    return NextResponse.json({ message: "PDF 파일이 너무 커서 보낼 수 없어요." }, { status: 413 })
  }

  const apiKey = process.env["RESEND_API_KEY"]
  const from = process.env["CAMPFIT_EMAIL_FROM"]
  const missingConfiguration = [
    !apiKey ? "RESEND_API_KEY" : null,
    !from ? "CAMPFIT_EMAIL_FROM" : null,
  ].filter((value): value is string => value !== null)
  if (missingConfiguration.length) {
    console.error("CampFit email report configuration is missing", { missing: missingConfiguration })
    return NextResponse.json({ message: GENERIC_EMAIL_ERROR }, { status: 503 })
  }

  const filename = pdf.name || "campfit-report.pdf"
  const content = Buffer.from(await pdf.arrayBuffer()).toString("base64")
  let providerResponse: Response
  try {
    providerResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "[CampFit AI] 우리 가족 해외 캠프 추천 리포트",
        text: "CampFit AI 추천 리포트를 보내드려요. 첨부된 PDF에서 추천 도시와 프로그램을 확인해 주세요.\n\n프로그램 가격과 일정은 예약 전에 최신 정보를 다시 확인해 주세요.",
        attachments: [{ filename, content }],
      }),
    })
  } catch {
    return NextResponse.json({ message: GENERIC_EMAIL_ERROR }, { status: 502 })
  }

  const providerBody = await providerResponse.text()
  if (!providerResponse.ok) {
    console.error("CampFit email provider rejected report", {
      status: providerResponse.status,
      body: providerBody.slice(0, 500),
    })
    return NextResponse.json({ message: GENERIC_EMAIL_ERROR }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}

function isPdfFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== "object") return false
  if (!("arrayBuffer" in value) || typeof value.arrayBuffer !== "function") return false
  if (!("size" in value) || typeof value.size !== "number") return false
  if (!("type" in value) || typeof value.type !== "string") return false
  return value.type.toLowerCase() === "application/pdf"
}
