import { NextResponse } from "next/server"
import { createV2Session, getV2ApiClient } from "@/lib/campfit/v2/apiRepository"
import { findForbiddenLegacyField, StrictCreateV2SessionSchema, toNaturalInput, toRequiredIntake } from "@/lib/campfit/v2/apiSchemas"

export async function POST(request: Request) {
  const body = await request.json()
  const forbidden = findForbiddenLegacyField(body)
  if (forbidden !== null) {
    console.warn(`CampFit v2 session rejected legacy field: ${forbidden}`)
    return NextResponse.json({ message: "v2 상담에서는 학년 또는 항공권 포함 여부 필드를 사용하지 않습니다." }, { status: 400 })
  }

  const parsed = StrictCreateV2SessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: "필수 상담 정보를 다시 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 })
  }

  const client = getV2ApiClient()
  if (client === null) {
    return NextResponse.json({ message: "지금은 상담 내용을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }

  const sessionId = await createV2Session({
    client,
    requiredIntake: toRequiredIntake(parsed.data.requiredIntake),
    naturalInput: toNaturalInput(parsed.data.naturalInput),
    ...(parsed.data.anonymousSessionId === undefined ? {} : { anonymousSessionId: parsed.data.anonymousSessionId }),
  })
  if (sessionId === null) {
    return NextResponse.json({ message: "상담 세션을 저장하지 못했습니다." }, { status: 500 })
  }

  return NextResponse.json({ sessionId, status: "intake_completed" })
}
