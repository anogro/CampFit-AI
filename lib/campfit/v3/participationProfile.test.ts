import { describe, expect, it } from "vitest"
import {
  extractParticipationProfile,
  participationProfileAcknowledgement,
  participationProfileValueIsGrounded,
  participationRecommendationSufficiency,
} from "@/lib/campfit/v3/participationProfile"

describe("participation profile", () => {
  const cases = [
    {
      message: "처음에는 낯을 좀 가리는데 친해지면 잘 놀아요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.peer_interaction_style.level).toBe("initially_cautious_after_warm_up")
        expect(profile.peer_interaction_style.subject).toBe("child_state")
      },
    },
    {
      message: "새로운 곳에 가면 첫날은 긴장하는데 다음날부터는 괜찮아요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.adaptation_to_new_environment.level).toBe("warm_up_needed")
      },
    },
    {
      message: "수업은 혼자 잘 들어가는데 제가 멀리 있는 건 불안해해요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.independent_class_participation).toBe("ready")
        expect(profile.parent_distance_comfort.level).toBe("proximity_needed")
      },
    },
    {
      message: "같은 호텔 안에서 수업하면 좋을 것 같아요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.parent_preference_evidence).toHaveLength(1)
        expect(profile.parent_distance_comfort.level).toBe("unknown")
      },
    },
    {
      message: "엄마 없이 하루 종일 있어도 괜찮고 새로운 활동도 바로 해보는 편이에요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.parent_distance_comfort.level).toBe("comfortable_without_parent")
        expect(profile.participation_style.level).toBe("active_starter")
      },
    },
    {
      message: "처음에는 지켜보다가 다른 아이들이 하는 걸 보고 따라 해요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.participation_style.level).toBe("observation_first")
      },
    },
    {
      message: "사람 많은 곳에서는 조용해지는데 몇 명이랑 있을 때는 말을 잘해요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.peer_interaction_style.level).toBe("small_group_comfortable")
      },
    },
    {
      message: "외국인 앞에서는 말을 잘 못해요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.ambiguous_evidence).toHaveLength(1)
        expect(profile.peer_interaction_style.level).toBe("unknown")
        expect(profile.participation_style.level).toBe("unknown")
      },
    },
    {
      message: "아이가 낯을 많이 가려서 이번에 자신감을 좀 얻었으면 좋겠어요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.peer_interaction_style.level).toBe("initially_cautious_after_warm_up")
      },
    },
    {
      message: "처음 해외 프로그램이라 제가 가까이 있으면 좋긴 한데, 아이 자체는 혼자 수업 잘 들어갈 수 있어요.",
      check: (profile: NonNullable<ReturnType<typeof extractParticipationProfile>>) => {
        expect(profile.parent_preference_evidence).toHaveLength(1)
        expect(profile.independent_class_participation).toBe("ready")
        expect(profile.parent_distance_comfort.level).toBe("unknown")
      },
    },
  ] as const

  for (const testCase of cases) {
    it("extracts grounded evidence: " + testCase.message, () => {
      const profile = extractParticipationProfile(testCase.message)
      expect(profile).not.toBeNull()
      testCase.check(profile as NonNullable<typeof profile>)
      expect(participationProfileValueIsGrounded(profile, testCase.message, testCase.message)).toBe(true)
    })
  }

  it("does not classify an ambiguous foreigner-speaking statement as a social deficit", () => {
    const profile = extractParticipationProfile("외국인 앞에서는 말을 잘 못해요.")
    expect(profile).not.toBeNull()
    expect(participationRecommendationSufficiency(profile)).toBe(false)
    expect(participationProfileAcknowledgement(profile)).toContain("아직 단정하지 않을게요")
  })

  it("keeps child independence separate from a parent's proximity preference", () => {
    const profile = extractParticipationProfile("처음 해외 프로그램이라 제가 가까이 있으면 좋긴 한데, 아이 자체는 혼자 수업 잘 들어갈 수 있어요.")
    expect(profile).not.toBeNull()
    expect(participationProfileAcknowledgement(profile)).toContain("혼자 수업에 참여할 수 있고")
    expect(participationProfileAcknowledgement(profile)).toContain("부모님은 가까이")
  })
})
