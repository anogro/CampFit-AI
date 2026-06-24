import { NextResponse } from "next/server"
import { AnalyzeRequestSchema } from "@/schemas/campfit/campfitSchemas"
import { analyzeParentInput } from "@/lib/campfit/gemini"

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = AnalyzeRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { message: "입력값을 다시 확인해 주세요.", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const analysis = await analyzeParentInput(parsed.data.input)
  return NextResponse.json({ analysis })
}
