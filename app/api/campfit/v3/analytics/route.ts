import { NextResponse } from "next/server"
import { CampfitV3AnalyticsEventSchema } from "@/lib/campfit/v3/analyticsSchema"
import { recordCampfitV3AnalyticsEvent } from "@/lib/campfit/v3/analyticsRepository"

export async function POST(request: Request) {
  const parsed = CampfitV3AnalyticsEventSchema.safeParse(await safeJson(request))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "분석 이벤트 형식을 확인해 주세요." }, { status: 400 })
  }

  const result = await recordCampfitV3AnalyticsEvent(parsed.data)
  if (result.status === "failed") {
    return NextResponse.json({ ok: false }, { status: 202 })
  }

  return NextResponse.json({ ok: true, recorded: result.status === "recorded" }, { status: 202 })
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
