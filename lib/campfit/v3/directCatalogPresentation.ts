import type { V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"

export function directAgeLabel(program: V3CatalogProgram): string | null {
  const direct = program.directCatalog
  if (!direct) return null
  if (program.ageMin !== null && program.ageMax !== null) return `만 ${program.ageMin}~${program.ageMax}세`
  return direct.yearLevels.length ? `${direct.yearLevels.join(" · ")} · 학년별 확인` : "연령·학년 확인 필요"
}

export function directDurationLabel(program: V3CatalogProgram): string | null {
  const direct = program.directCatalog
  if (!direct) return null
  const min = direct.minAttendanceWeeks
  const max = direct.maxAttendanceWeeks
  const participation = min !== null && max !== null ? `참여 ${min}~${max}주`
    : min !== null ? `최소 참여 ${min}주` : max !== null ? `최대 참여 ${max}주`
      : program.durationWeeks.length ? `${program.durationWeeks.join("·")}주 회차` : "참여기간 확인 필요"
  return direct.minPayableWeeks !== null ? `${participation} · 최소 결제 ${direct.minPayableWeeks}주` : participation
}

export function directPriceLabel(program: V3CatalogProgram): string | null {
  const direct = program.directCatalog
  if (!direct) return null
  const fees = direct.fees.filter((fee) => fee.amount !== null && fee.currency)
  if (fees.length !== 1) return fees.length ? "기간·학년·회차별 요금 확인" : "참가비 확인 필요"
  const fee = fees[0]!
  const unit = fee.unit === "per_week" ? "/주" : fee.unit === "per_day" ? "/일"
    : fee.unit === "fixed_period" && fee.periodWeeks !== null ? `/${fee.periodWeeks}주` : " · 단위 확인 필요"
  return `${fee.currency} ${fee.amount!.toLocaleString("ko-KR")}${unit}${fee.appliesTo ? " · 적용 조건 확인" : ""}`
}

export function directVerification(program: V3CatalogProgram, weeks: number): readonly string[] {
  const direct = program.directCatalog
  if (!direct) return []
  return [
    ...direct.verificationNotes,
    ...direct.fees.flatMap((fee) => fee.notes ? [`요금 조건: ${fee.notes}`] : []),
    ...(direct.availabilityMode === "enquiry_required" ? ["학년·희망기간별 학교 확인 필요"] : []),
    ...(direct.minPayableWeeks !== null && direct.minPayableWeeks > weeks
      ? [`참여 ${weeks}주와 별개로 최소 ${direct.minPayableWeeks}주 결제 조건`] : []),
    ...(direct.fees.some((fee) => fee.appliesTo) ? ["공개 요금의 학년·기간·회차 적용 조건"] : []),
  ]
}
