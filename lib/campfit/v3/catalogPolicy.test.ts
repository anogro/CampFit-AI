import { describe, expect, it } from "vitest"
import {
  inferDirectionSignals,
  inferExperienceAssessment,
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

  it("keeps explicit child-only residential data distinct from a family-camp name", () => {
    const scope = inferParentScope({
      participationText: "child_alone",
      accommodationText: "residential boarding",
      groupText: "family camp",
      coverageText: "",
      nameText: "Premium Family Camp",
      profileParentAccompanied: true,
    })
    expect(scope).toMatchObject({ participationMode: "child_only_allowed", stayMode: "child_residential", guardianNearbyCompatible: null })
    expect(scope.assessment).toMatchObject({
      childParticipationMode: "residential_child_only",
      parentProgramParticipation: "not_allowed",
      childLodgingMode: "residential_camp",
      parentCityStayCompatibility: "unknown",
      parentFitStatus: "needs_confirmation",
      conflict: true,
    })
  })

  it.each([
    "아이 단독 참여 가능",
    "child-only",
    "보호자 없이 참가",
  ])("separates explicit child-only participation from parent city stay: %s", (participationText) => {
    const scope = inferParentScope({
      participationText,
      accommodationText: "호텔 또는 리조트형 숙소",
      groupText: "가족 캠프",
      coverageText: "",
      nameText: "Camp",
      profileParentAccompanied: true,
    })
    expect(scope.guardianNearbyCompatible).toBeNull()
    expect(scope.participationMode).toBe("child_only_allowed")
    expect(scope.assessment?.parentProgramParticipation).toBe("not_allowed")
    expect(scope.assessment?.parentCityStayCompatibility).toBe("unknown")
    expect(scope.assessment?.parentFitStatus).toBe("needs_confirmation")
  })

  it("prioritizes explicit parent-required participation over a false profile value", () => {
    const scope = inferParentScope({
      participationText: "부모 동반 필수",
      accommodationText: "호텔 객실",
      groupText: "",
      coverageText: "",
      nameText: "Family Camp",
      profileParentAccompanied: false,
    })
    expect(scope.guardianNearbyCompatible).toBe(true)
    expect(scope.assessment?.parentProgramParticipation).toBe("required")
    expect(scope.assessment?.parentFitStatus).toBe("needs_confirmation")
  })

  it("uses a true profile value only when explicit participation is absent", () => {
    const scope = inferParentScope({
      participationText: "",
      accommodationText: "",
      groupText: "",
      coverageText: "",
      nameText: "Camp",
      profileParentAccompanied: true,
    })
    expect(scope.guardianNearbyCompatible).toBe(true)
    expect(scope.assessment?.parentLodgingCompatibility).toBe("unknown")
    expect(scope.assessment?.parentFitStatus).toBe("needs_confirmation")
  })

  it("keeps unknown parent scope as null when profile and lodging are inconclusive", () => {
    const scope = inferParentScope({
      participationText: "",
      accommodationText: "",
      groupText: "",
      coverageText: "",
      nameText: "Camp",
      profileParentAccompanied: null,
    })
    expect(scope.guardianNearbyCompatible).toBeNull()
    expect(scope.assessment?.parentFitStatus).toBe("unknown")
  })

  it("classifies a child-only day program as nearby-lodging compatible", () => {
    const scope = inferParentScope({
      participationText: "아이 단독 참여 가능",
      accommodationText: "낮 프로그램, 숙소 별도",
      groupText: "",
      coverageText: "",
      nameText: "Day Camp",
      profileParentAccompanied: false,
    })
    expect(scope.guardianNearbyCompatible).toBe(true)
    expect(scope.assessment).toMatchObject({
      childParticipationMode: "day_independent",
      parentProgramParticipation: "not_allowed",
      parentCityStayCompatibility: "compatible",
      parentLodgingCompatibility: "nearby_lodging_possible",
      childLodgingMode: "day_only",
      parentFitStatus: "match",
      conflict: false,
    })
  })

  it("does not treat an unstructured child residential label as parent city incompatibility", () => {
    const scope = inferParentScope({
      participationText: "아이 단독 참여 가능",
      accommodationText: "호텔",
      groupText: "",
      coverageText: "",
      nameText: "Junior Camp",
      profileParentAccompanied: null,
    })
    expect(scope.guardianNearbyCompatible).toBeNull()
    expect(scope.assessment?.childLodgingMode).toBe("unknown")
    expect(scope.assessment?.parentLodgingCompatibility).toBe("unknown")
    expect(scope.assessment?.parentFitStatus).toBe("unknown")
  })

  it("keeps nearby lodging compatible when the program does not provide the same lodging", () => {
    const scope = inferParentScope({
      participationText: "부모 동반 권장",
      accommodationText: "숙소 별도",
      groupText: "가족형",
      coverageText: "",
      nameText: "Family Day Program",
      profileParentAccompanied: null,
    })
    expect(scope.assessment).toMatchObject({
      parentCityStayCompatibility: "compatible",
      parentLodgingCompatibility: "nearby_lodging_possible",
      parentFitStatus: "match",
    })
    expect(scope.assessment?.parentLodgingCompatibility).not.toBe("same_lodging_available")
  })

  it("does not mistake child-only class attendance in a family camp for child-only participation", () => {
    const scope = inferParentScope({
      participationText: "부모 동반 필수",
      accommodationText: "가족 숙소",
      groupText: "부모동반 가족형",
      coverageText: "아이만 수업 참여",
      nameText: "Family Camp",
      profileParentAccompanied: false,
    })
    expect(scope.guardianNearbyCompatible).toBe(true)
    expect(scope.participationMode).toBe("parent_required")
    expect(scope.assessment?.childParticipationMode).toBe("parent_joint")
    expect(scope.assessment?.parentProgramParticipation).toBe("required")
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

  it.each(["창의활동", " 창의 활동 "]) ("maps %s to subject-project evidence", (trait) => {
    const signals = inferDirectionSignals({
      profileProgramType: "managed_immersion",
      traits: [trait, "창의활동", "소규모케어", "입문형"],
      structuredText: "방학캠프 영어몰입형",
    })
    expect(signals.englishIntensive).toBe(90)
    expect(signals.subjectProject).toBe(90)
  })

  it("does not classify unrelated care traits as subject-project evidence", () => {
    expect(inferDirectionSignals({ profileProgramType: "managed_immersion", traits: ["소규모케어"] }).subjectProject).toBe(10)
  })

  it("keeps explicit creative projects and sports specialties as project evidence", () => {
    expect(inferDirectionSignals({ profileProgramType: null, traits: ["creative arts project"] }).subjectProject).toBe(90)
    expect(inferDirectionSignals({ profileProgramType: null, traits: ["sports specialty"] }).subjectProject).toBe(90)
  })

  it("parses an explicit departure window without inventing a season", () => {
    expect(parseDepartureRange("2026-07-20 ~ 2026-07-31")).toEqual({ startDate: "2026-07-20", endDate: "2026-07-31" })
    expect(parseDepartureRange("아직 모르겠어요")).toBeNull()
  })

  it("normalizes the experience taxonomy into tags and direction scores", () => {
    const assessment = inferExperienceAssessment({
      profileProgramType: null,
      traits: [" 창의 활동 ", "robotics"],
      sources: [
        { source: "program.subject", text: "STEM science experiments, technology coding robotics maker design and problem solving", confidence: "high" },
        { source: "program.description", text: "local culture, nature and art activities", confidence: "low" },
      ],
    })
    const tags = assessment.tags.map((signal) => signal.tag)
    expect(tags).toEqual(expect.arrayContaining([
      "stem", "science", "technology", "coding", "robotics", "maker", "design", "problem_solving", "creative_project",
      "culture", "local_experience", "nature", "arts",
    ]))
    expect(assessment.directionScores.subjectProject).toBe(90)
    expect(assessment.directionStatuses.subjectProject).toBe("confirmed_strong")
    expect(assessment.confidence).toBe("high")
  })

  it("recognizes school, English, collaboration, presentation and life-skill evidence", () => {
    const assessment = inferExperienceAssessment({
      profileProgramType: null,
      traits: [],
      sources: [{
        source: "program.highlights",
        text: "school classroom English intensive immersion leadership teamwork group project presentation and life skills",
        confidence: "medium",
      }],
    })
    const tags = assessment.tags.map((signal) => signal.tag)
    expect(tags).toEqual(expect.arrayContaining(["school", "english_intensive", "english_immersive", "leadership", "collaboration", "creative_project", "presentation", "life_skills"]))
    expect(assessment.directionScores.schoolSchooling).toBe(55)
    expect(assessment.directionScores.englishIntensive).toBe(55)
    expect(assessment.primaryDirection).toBe("schoolSchooling")
    expect(assessment.secondaryDirections).toEqual(expect.arrayContaining(["englishIntensive"]))
  })

  it("keeps unknown evidence distinct from a confirmed weak signal and avoids common false positives", () => {
    const assessment = inferExperienceAssessment({
      profileProgramType: null,
      traits: [],
      sources: [{ source: "program.description", text: "AI tools and outdoor pool access; start here", confidence: "low" }],
    })
    expect(assessment.tags.map((signal) => signal.tag)).toEqual([])
    expect(Object.values(assessment.directionStatuses).every((status) => status === "unknown")).toBe(true)

    const weak = inferExperienceAssessment({
      profileProgramType: null,
      traits: [],
      sources: [{ source: "program.description", text: "art workshop", confidence: "low" }],
    })
    expect(weak.directionStatuses.cultureActivity).toBe("confirmed_weak")
    expect(weak.directionStatuses.cultureActivity).not.toBe(assessment.directionStatuses.cultureActivity)

    const projectOnly = inferExperienceAssessment({
      profileProgramType: null,
      traits: [],
      sources: [{ source: "program.description", text: "project", confidence: "high" }],
    })
    expect(projectOnly.tags.map((signal) => signal.tag)).toEqual([])
    expect(projectOnly.directionStatuses.subjectProject).toBe("unknown")
  })

  it("recognizes nature, environment, outdoor, sports, culture, arts and performance evidence", () => {
    const assessment = inferExperienceAssessment({
      profileProgramType: null,
      traits: [],
      sources: [{
        source: "program.activity",
        text: "nature ecology environment outdoor hiking sports football local culture museum arts music performance concert",
        confidence: "high",
      }],
    })
    expect(assessment.tags.map((signal) => signal.tag)).toEqual(expect.arrayContaining([
      "nature", "environment", "outdoor", "sports", "culture", "local_experience", "arts", "performance",
    ]))
    expect(assessment.directionScores.cultureActivity).toBe(90)
  })

  it("normalizes early, mid and late month departure phrases to bounded ranges", () => {
    expect(parseDepartureRange("2026\uB144 7\uC6D4 \uCD08")).toEqual({ startDate: "2026-07-01", endDate: "2026-07-10" })
    expect(parseDepartureRange("2026\uB144 7\uC6D4 \uC911\uC21C")).toEqual({ startDate: "2026-07-11", endDate: "2026-07-20" })
    expect(parseDepartureRange("2026\uB144 7\uC6D4 \uB9D0")).toEqual({ startDate: "2026-07-21", endDate: "2026-07-31" })
  })

  it("does not expand a late-July to August phrase to all of July", () => {
    expect(parseDepartureRange("2026\uB144 7\uC6D4 \uB9D0\uBD80\uD130 8\uC6D4 \uC0AC\uC774")).toEqual({
      startDate: "2026-07-21",
      endDate: "2026-08-31",
    })
  })

  it("normalizes a year-spanning month range", () => {
    expect(parseDepartureRange("2026\uB144 7~8\uC6D4")).toEqual({ startDate: "2026-07-01", endDate: "2026-08-31" })
  })

  it("keeps relative date phrases bounded instead of turning them into exact dates", () => {
    expect(parseDepartureRange("2026-07-20 \uC774\uD6C4")).toEqual({ startDate: "2026-07-20", endDate: "2026-10-18" })
    expect(parseDepartureRange("2026-07-20 \uC804\uD6C4")).toEqual({ startDate: "2026-07-06", endDate: "2026-08-03" })
  })
})
