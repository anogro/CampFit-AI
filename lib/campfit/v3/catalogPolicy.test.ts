import { describe, expect, it } from "vitest"
import {
  inferDirectionSignals,
  inferParentScope,
  isPublicV3ProgramRow,
  isVisibleV3CityRow,
  parseDepartureRange,
} from "@/lib/campfit/v3/catalogPolicy"

describe("CampFit v3 catalog policy", () => {
  it("requires active, visible and listed for production programs", () => {
    const publicRow = { status: "active", visible: true, is_listed: true }
    expect(isPublicV3ProgramRow(publicRow, "2026-07-13")).toBe(true)
    expect(isPublicV3ProgramRow({ ...publicRow, status: "draft" }, "2026-07-13")).toBe(false)
    expect(isPublicV3ProgramRow({ ...publicRow, visible: false }, "2026-07-13")).toBe(false)
    expect(isPublicV3ProgramRow({ ...publicRow, is_listed: false }, "2026-07-13")).toBe(false)
    expect(isPublicV3ProgramRow({ ...publicRow, list_expired_at: "2026-07-12T23:59:59Z" }, "2026-07-13")).toBe(false)
  })

  it("keeps legacy Cities rows when is_listed is absent and excludes explicit false", () => {
    expect(isVisibleV3CityRow({ id: "legacy" })).toBe(true)
    expect(isVisibleV3CityRow({ id: "public", is_listed: true })).toBe(true)
    expect(isVisibleV3CityRow({ id: "private", is_listed: false })).toBe(false)
  })

  it("lets explicit child-only residential data outrank a family-camp name", () => {
    const scope = inferParentScope({
      participationText: "child_alone",
      accommodationText: "residential boarding",
      groupText: "family camp",
      coverageText: "",
      nameText: "Premium Family Camp",
      profileParentAccompanied: true,
    })
    expect(scope).toEqual({ participationMode: "child_only_allowed", stayMode: "child_residential", guardianNearbyCompatible: false })
  })

  it("keeps conflicting parent-required and residential structure conditional", () => {
    const scope = inferParentScope({
      participationText: "parent_required",
      accommodationText: "residential",
      groupText: "",
      coverageText: "",
      nameText: "Camp",
      profileParentAccompanied: true,
    })
    expect(scope.guardianNearbyCompatible).toBeNull()
    expect(scope.stayMode).toBe("mixed")
  })

  it("does not let a free-text STEM mention override a structured family ESL profile", () => {
    const signals = inferDirectionSignals({
      profileProgramType: "family_esl",
      traits: ["beginner-friendly"],
      structuredText: "english immersion",
      fallbackText: "participants can join a STEM project and art workshop",
    })
    expect(signals.englishIntensive).toBe(90)
    expect(signals.subjectProject).toBe(10)
  })

  it("uses bounded fallback keywords only when structured direction data is absent", () => {
    const ordinary = inferDirectionSignals({ profileProgramType: null, traits: [], fallbackText: "parent participation details" })
    const stem = inferDirectionSignals({ profileProgramType: null, traits: [], fallbackText: "STEM robotics project" })
    expect(ordinary.subjectProject).toBe(10)
    expect(stem.subjectProject).toBe(90)
  })

  it("does not treat a generic creative activity trait as STEM or project evidence", () => {
    const signals = inferDirectionSignals({
      profileProgramType: "managed_immersion",
      traits: ["창의활동", "소규모케어", "입문형"],
      structuredText: "방학캠프 영어몰입형",
    })
    expect(signals.englishIntensive).toBe(90)
    expect(signals.subjectProject).toBe(10)
  })

  it("keeps explicit creative projects and sports specialties as project evidence", () => {
    expect(inferDirectionSignals({ profileProgramType: null, traits: ["creative arts project"] }).subjectProject).toBe(90)
    expect(inferDirectionSignals({ profileProgramType: null, traits: ["sports specialty"] }).subjectProject).toBe(90)
  })

  it("parses an explicit departure window without inventing a season", () => {
    expect(parseDepartureRange("2026-07-20 ~ 2026-07-31")).toEqual({ startDate: "2026-07-20", endDate: "2026-07-31" })
    expect(parseDepartureRange("아직 모르겠어요")).toBeNull()
  })
})
