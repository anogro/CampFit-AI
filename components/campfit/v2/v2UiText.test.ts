import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const requiredIntakeFormSource = readFileSync(join(process.cwd(), "components/campfit/v2/RequiredIntakeForm.tsx"), "utf8")
const aiUnderstandingReviewSource = readFileSync(join(process.cwd(), "components/campfit/v2/AIUnderstandingReview.tsx"), "utf8")
const dynamicQuestionFlowSource = readFileSync(join(process.cwd(), "components/campfit/v2/DynamicQuestionFlow.tsx"), "utf8")
const campFitV2FlowSource = readFileSync(join(process.cwd(), "components/campfit/v2/CampFitV2Flow.tsx"), "utf8")
const consultingReportViewSource = readFileSync(join(process.cwd(), "components/campfit/v2/ConsultingReportView.tsx"), "utf8")
const destinationRecommendationsSource = readFileSync(join(process.cwd(), "components/campfit/v2/DestinationRecommendationsSection.tsx"), "utf8")

describe("CampFit v2 UI copy", () => {
  it("Given required intake form When checking copy Then school-year question is absent", () => {
    expect(requiredIntakeFormSource).not.toContain("학년")
    expect(requiredIntakeFormSource).not.toContain("grade")
    expect(requiredIntakeFormSource).not.toContain("schoolGrade")
    expect(requiredIntakeFormSource).not.toContain("gradeLevel")
  })

  it("Given required intake form When checking copy Then flight-inclusion question is absent", () => {
    expect(requiredIntakeFormSource).not.toContain("항공권 포함인가요")
    expect(requiredIntakeFormSource).not.toContain("budgetIncludesFlight")
    expect(requiredIntakeFormSource).not.toContain("budget_includes_flight")
    expect(requiredIntakeFormSource).not.toContain("flightIncludedInBudget")
  })

  it("Given required intake form When checking copy Then all-in budget wording is present", () => {
    expect(requiredIntakeFormSource).toContain("항공권부터 현지 이동비까지")
  })

  it("Given AI understanding review When checking copy Then internal process labels are absent", () => {
    expect(aiUnderstandingReviewSource).not.toContain("MVP")
    expect(aiUnderstandingReviewSource).not.toContain("추가로 확인하면 좋은 정보")
    expect(aiUnderstandingReviewSource).not.toContain("missingSlots.map")
  })

  it("Given AI understanding review When checking copy Then raw keys are not hard-coded for display", () => {
    expect(aiUnderstandingReviewSource).not.toContain("oceania")
    expect(aiUnderstandingReviewSource).not.toContain("schooling")
    expect(aiUnderstandingReviewSource).not.toContain("slow_to_adapt")
    expect(aiUnderstandingReviewSource).not.toContain("socially_reserved")
  })

  it("Given AI understanding review When checking copy Then counselor-style button is present", () => {
    expect(aiUnderstandingReviewSource).toContain("네, 몇 가지만 더 확인해주세요")
  })

  it("Given dynamic questions When checking copy Then internal reasoning terms are absent", () => {
    expect(dynamicQuestionFlowSource).not.toContain("AI extraction")
    expect(dynamicQuestionFlowSource).not.toContain("추천 누락")
    expect(dynamicQuestionFlowSource).not.toContain("필요하다고 판단")
    expect(dynamicQuestionFlowSource).not.toContain("missing slot")
    expect(dynamicQuestionFlowSource).not.toContain("question key")
    expect(dynamicQuestionFlowSource).not.toContain("fallback")
    expect(dynamicQuestionFlowSource).not.toContain("schema")
    expect(dynamicQuestionFlowSource).not.toContain("MVP")
  })

  it("Given main v2 flow When checking copy Then internal implementation terms are absent", () => {
    expect(campFitV2FlowSource).not.toContain("question bank")
    expect(campFitV2FlowSource).not.toContain("question_bank")
    expect(campFitV2FlowSource).not.toContain("AI extraction")
    expect(campFitV2FlowSource).not.toContain("MVP")
  })

  it("Given consulting report view When checking copy Then decision report sections are present", () => {
    expect(consultingReportViewSource).toContain("오늘의 결론")
    expect(consultingReportViewSource).toContain("현재 입력 기준 적합도")
    expect(consultingReportViewSource).toContain("추천 조합 TOP 3")
    expect(consultingReportViewSource).toContain("현재 조건에서 먼저 검토할 후보")
    expect(consultingReportViewSource).toContain("이번 조건에서 뒤로 미룬 후보")
    expect(destinationRecommendationsSource).toContain("검토하기 좋은 도시·지역 방향")
    expect(destinationRecommendationsSource).toContain("도시 정보 보기")
  })

  it("Given consulting report view When checking internal output Then run identifiers and version labels are absent", () => {
    expect(consultingReportViewSource).not.toContain("리포트 번호")
    expect(consultingReportViewSource).not.toContain("추천 실행 ID")
    expect(consultingReportViewSource).not.toContain("CampFit v2")
  })

  it("Given consulting report view When checking copy Then failure-first and raw-key language is absent", () => {
    expect(consultingReportViewSource).not.toContain("현재 조건에서 가능한 후보가 없습니다")
    expect(consultingReportViewSource).not.toContain("AI extraction")
    expect(consultingReportViewSource).not.toContain("schema")
    expect(consultingReportViewSource).not.toContain("fallback")
    expect(consultingReportViewSource).not.toContain("question key")
    expect(consultingReportViewSource).not.toContain("unknown_cost_assumption")
    expect(consultingReportViewSource).not.toContain("parent_can_stay")
    expect(consultingReportViewSource).not.toContain("daily_korean_communication")
  })

  it("Given consulting report view When checking list rendering Then text is not used as the React key", () => {
    expect(consultingReportViewSource).not.toContain("key={item}")
    expect(consultingReportViewSource).not.toContain("key={reason}")
    expect(consultingReportViewSource).not.toContain("key={condition}")
  })
})
