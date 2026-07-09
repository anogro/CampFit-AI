import { describe, expect, it } from "vitest"
import { getSingleChoiceValue, isDynamicQuestionAnswered, upsertDynamicQuestionAnswer } from "@/components/campfit/v2/DynamicQuestionFlow"
import type { DynamicQuestionAnswerDraft } from "@/components/campfit/v2/DynamicQuestionFlow"
import type { MaterializedQuestionView } from "@/components/campfit/v2/types"

const singleChoiceQuestion: MaterializedQuestionView = {
  dynamicQuestionId: "question-1",
  questionKey: "child_support",
  title: "아이가 초반에 어떤 도움을 받으면 좋을까요?",
  helperText: "가장 가까운 답을 골라주세요.",
  questionType: "single_choice",
  options: [
    { value: "daily_check", label: "매일 확인이 필요해요", score: 3 },
    { value: "light_check", label: "가끔 확인이면 충분해요", score: 1 },
  ],
  reason: "internal reason",
  priority: 1,
}

const multiChoiceQuestion: MaterializedQuestionView = {
  ...singleChoiceQuestion,
  dynamicQuestionId: "question-2",
  questionKey: "activity_style",
  questionType: "multi_choice",
}

describe("DynamicQuestionFlow answer state", () => {
  it("Given single choice answer object When reading selected value Then selected button value is returned", () => {
    const answer: DynamicQuestionAnswerDraft = {
      dynamicQuestionId: "question-1",
      questionKey: "child_support",
      answer: { value: "daily_check", score: 3 },
      answerText: "매일 확인이 필요해요",
    }

    expect(getSingleChoiceValue(answer)).toBe("daily_check")
    expect(isDynamicQuestionAnswered(singleChoiceQuestion, answer)).toBe(true)
  })

  it("Given empty multi choice answer When checking submit readiness Then it is not answered", () => {
    const answer: DynamicQuestionAnswerDraft = {
      dynamicQuestionId: "question-2",
      questionKey: "activity_style",
      answer: [],
      answerText: "",
    }

    expect(isDynamicQuestionAnswered(multiChoiceQuestion, answer)).toBe(false)
  })

  it("Given existing answer When upserting next answer Then the answer is replaced without changing length", () => {
    const first: DynamicQuestionAnswerDraft = {
      dynamicQuestionId: "question-1",
      questionKey: "child_support",
      answer: { value: "light_check", score: 1 },
      answerText: "가끔 확인이면 충분해요",
    }
    const next: DynamicQuestionAnswerDraft = {
      dynamicQuestionId: "question-1",
      questionKey: "child_support",
      answer: { value: "daily_check", score: 3 },
      answerText: "매일 확인이 필요해요",
    }

    expect(upsertDynamicQuestionAnswer([first], next)).toEqual([next])
  })
})
