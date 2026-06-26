import type { ParentAnalysis } from "@/types/campfit"
import { AiUsageBadge } from "@/components/campfit/AiUsageBadge"

type FamilyPersona = {
  readonly name: string
  readonly image: string
  readonly alt: string
  readonly headline: string
  readonly description: string
  readonly caution: string
}

type ChildInsight = {
  readonly typeName: string
  readonly headline: string
  readonly description: string
  readonly coachingPoint: string
  readonly familyPersona: FamilyPersona
}

type FamilyPersonaKey =
  | "experience_free_open"
  | "experience_free_protected"
  | "experience_structured_open"
  | "experience_structured_protected"
  | "growth_free_open"
  | "growth_free_protected"
  | "growth_structured_open"
  | "growth_structured_protected"

type ParentInsightSummaryProps = {
  readonly analysis: ParentAnalysis
  readonly aiUsed: boolean
}

export function ParentInsightSummary({ analysis, aiUsed }: ParentInsightSummaryProps) {
  const childInsight = getChildInsight(analysis)

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_220px] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--accent-primary)]">AI 아이 성향 진단</p>
              <AiUsageBadge
                used={aiUsed}
                usedLabel="Gemini가 부모 입력을 분석했어요"
                fallbackLabel="기본 규칙으로 분석했어요"
              />
            </div>
            <h3 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
              {childInsight.typeName}
            </h3>
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)] [word-break:keep-all]">
              {childInsight.headline}
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-secondary)] [word-break:keep-all]">
              {childInsight.description}
            </p>
            <div className="mt-3 grid gap-2 rounded-md bg-[var(--surface-tint-yellow)] px-3 py-2 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
              <p>{childInsight.coachingPoint}</p>
              <p>
                참고 프레임: <span className="font-semibold text-[var(--text-primary)]">{childInsight.familyPersona.name}</span> ·{" "}
                {childInsight.familyPersona.headline}
              </p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-2 shadow-[var(--shadow-card)]">
            <img
              src={childInsight.familyPersona.image}
              alt={childInsight.familyPersona.alt}
              className="aspect-square w-full object-contain"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--accent-primary)]">부모 선택 성향</p>
          <p className="text-xs font-semibold text-[var(--text-tertiary)]">추천 기준에 함께 반영</p>
        </div>
        <p className="mt-2 text-xl font-bold tracking-[-0.02em] text-[var(--text-primary)] [word-break:keep-all]">
          {analysis.parentType}
        </p>
      </div>
      <div className="grid gap-3">
        {analysis.summaryForParent.map((summary) => (
          <p
            key={summary}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4 leading-7 text-[var(--text-secondary)] [word-break:keep-all]"
          >
            {summary}
          </p>
        ))}
      </div>
      {analysis.detectedTensions.length > 0 ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-tint-yellow)] p-5 text-[var(--text-primary)]">
          <p className="text-sm font-semibold text-[var(--status-warning)]">함께 확인할 지점</p>
          <ul className="mt-3 grid gap-2 leading-7 [word-break:keep-all]">
            {analysis.detectedTensions.map((tension) => (
              <li key={tension.description}>{tension.description}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function getChildInsight(analysis: ParentAnalysis): ChildInsight {
  const profile = analysis.childProfile
  const familyPersona = getFamilyPersona(analysis)
  const safetyPriority = analysis.parentGoal.safetyPriority

  if (profile.englishReadiness < 0.38 && profile.socialConfidence < 0.55 && safetyPriority >= 0.7) {
    return {
      typeName: "초기 적응형 세이프 스타터",
      headline: "영어보다 먼저 안정감과 첫 성공 경험이 필요한 아이",
      description:
        "Gemini 분석상 영어 준비도와 또래 자신감이 아직 낮은 편이고, 보호 장치에 대한 부모 우선순위가 높게 잡혀 있습니다. 캠프를 고를 때는 수업 강도보다 초반 적응 루틴, 한국어 케어, 소그룹 관리가 먼저입니다.",
      coachingPoint:
        "8유형으로는 보호적 성향에 가깝지만, 실제 추천에서는 아이의 영어 준비도와 낯가림 신호까지 함께 반영해 부담이 낮은 캠프부터 비교합니다.",
      familyPersona,
    }
  }

  if (profile.separationTolerance >= 0.68 && profile.newEnvironmentAdaptability >= 0.62 && profile.challengeTolerance >= 0.62) {
    return {
      typeName: "독립 탐색형 챌린지 무버",
      headline: "낯선 환경에서도 스스로 해볼 여지가 있는 아이",
      description:
        "분리 적응, 새로운 환경 적응, 도전 수용도가 함께 높게 나타납니다. 보호 장치가 전혀 필요 없다는 뜻은 아니지만, 지나치게 안전한 선택지만 고르면 성장 자극이 부족할 수 있습니다.",
      coachingPoint:
        "8유형의 개방형/성장형 요소를 참고하되, 추천에서는 실제 영어 수준과 캠프 난이도의 간격을 함께 계산합니다.",
      familyPersona,
    }
  }

  if (profile.challengeTolerance >= 0.62 && profile.englishReadiness >= 0.42) {
    return {
      typeName: "호기심 몰입형 액티브 러너",
      headline: "수업과 활동이 연결될 때 몰입하기 쉬운 아이",
      description:
        "도전 수용도와 영어 준비도가 일정 수준 이상으로 보여, 단순 회화 수업보다 만들기, 실험, 프로젝트, 액티비티가 섞인 캠프에서 반응이 좋을 가능성이 있습니다.",
      coachingPoint:
        "8유형의 창의/탐구 성향을 참고하지만, 추천에서는 학습 강도와 피로도를 함께 봐 과부하를 줄이는 방향으로 조정합니다.",
      familyPersona,
    }
  }

  if (profile.socialConfidence >= 0.62 && profile.challengeTolerance < 0.62) {
    return {
      typeName: "관계 적응형 소셜 빌더",
      headline: "또래와 안정적으로 연결될 때 자신감이 올라가는 아이",
      description:
        "사회적 자신감은 비교적 괜찮지만 도전 강도에는 조심스러운 신호가 있습니다. 경쟁적인 몰입 캠프보다 친구를 만들고 자연스럽게 말할 기회가 있는 환경이 좋습니다.",
      coachingPoint:
        "8유형의 경험/보호 성향을 가볍게 입히되, 실제 추천에서는 버디 시스템과 저압박 말하기 환경을 더 크게 반영합니다.",
      familyPersona,
    }
  }

  if (profile.newEnvironmentAdaptability >= 0.55 || profile.englishReadiness >= 0.42) {
    return {
      typeName: "균형 성장형 스텝업 러너",
      headline: "안전한 구조 안에서 한 단계씩 넓어지는 아이",
      description:
        "적응과 성장 가능성이 모두 보이지만, 아직 무리한 도전으로 밀어붙이기보다는 관리와 자유 경험의 균형이 중요합니다. 캠프의 루틴과 완충 장치를 함께 봐야 합니다.",
      coachingPoint:
        "8유형은 결과를 설명하는 언어로만 사용하고, 실제 추천은 Gemini가 분석한 아이 준비도와 부모 목표의 균형값을 기준으로 조정합니다.",
      familyPersona,
    }
  }

  return {
    typeName: "안전 적응형 웜업 러너",
    headline: "충분한 준비와 돌봄을 통해 천천히 속도가 나는 아이",
    description:
      "현재 입력만 놓고 보면 새로운 환경과 영어 노출에 대한 부담을 먼저 낮춰주는 접근이 필요합니다. 첫 캠프에서는 결과보다 적응 경험을 안전하게 만드는 것이 우선입니다.",
    coachingPoint:
      "8유형으로는 보호적 성향이 강하지만, 추천에서는 아이의 실제 부담 신호를 더 세밀하게 반영해 초반 적응 지원이 있는 캠프를 우선합니다.",
    familyPersona,
  }
}

function getFamilyPersona(analysis: ParentAnalysis): FamilyPersona {
  const profile = analysis.childProfile
  const goal = analysis.parentGoal
  const growthScore =
    (goal.englishGrowth + goal.confidenceGrowth + goal.independenceGrowth + goal.socialGrowth + goal.academicResultPriority) / 5
  const experienceScore = (goal.experiencePriority + profile.newEnvironmentAdaptability + profile.socialConfidence) / 3
  const structuredScore = (goal.academicResultPriority + goal.safetyPriority + (1 - profile.challengeTolerance)) / 3
  const openScore = (profile.separationTolerance + profile.newEnvironmentAdaptability + profile.challengeTolerance) / 3

  const purpose = growthScore >= experienceScore ? "growth" : "experience"
  const schedule = structuredScore >= 0.58 ? "structured" : "free"
  const environment = goal.safetyPriority >= openScore ? "protected" : "open"
  const key = `${purpose}_${schedule}_${environment}` as FamilyPersonaKey

  return familyPersonas[key]
}

const familyPersonas: Record<FamilyPersonaKey, FamilyPersona> = {
  experience_free_open: {
    name: "마르코폴로 패밀리",
    image: "/images/마르코폴로 패밀리.png",
    alt: "배를 타고 지도를 보는 마르코폴로 패밀리 캐릭터",
    headline: "세상을 넓히는 무한 탐험",
    description:
      "낯선 세상을 직접 만나며 배우고, 로컬 문화와 이웃에 빠르게 동화되는 탐험가형 가족입니다. 현지 적응력과 열린 마음이 강점입니다.",
    caution: "자유도가 높으면 루틴이 흐트러질 수 있어 부모가 동선과 기본 정보를 직접 챙겨야 합니다.",
  },
  experience_free_protected: {
    name: "제인 구달 패밀리",
    image: "/images/제인구달 패밀리.png",
    alt: "자연 속에서 관찰하고 기록하는 제인구달 패밀리 캐릭터",
    headline: "자연 속에서 스며드는 배움",
    description:
      "아이의 속도를 믿고 기다려주며, 안전한 환경에서 자연스럽게 세상을 넓혀가는 가족입니다. 정서적 안정감과 호기심을 함께 봅니다.",
    caution: "보호 기준이 높으면 현지 경험의 폭이 좁아질 수 있어 안전한 범위 안의 활동 선택지가 필요합니다.",
  },
  experience_structured_open: {
    name: "장영실 패밀리",
    image: "/images/장영실 패밀리.png",
    alt: "관찰 도구와 장치를 살펴보는 장영실 패밀리 캐릭터",
    headline: "좋은 환경이 만드는 잠재력",
    description:
      "체계적인 프로그램과 좋은 멘토를 통해 아이의 가능성을 열어주는 가족입니다. 새로운 도구와 지식을 받아들이는 힘을 기대합니다.",
    caution: "프로그램 운영 품질에 만족도가 크게 좌우되므로 수업 방식과 멘토 역량을 꼭 확인해야 합니다.",
  },
  experience_structured_protected: {
    name: "나이팅게일 패밀리",
    image: "/images/나이팅게일 패밀리.png",
    alt: "따뜻한 돌봄 물품을 준비한 나이팅게일 패밀리 캐릭터",
    headline: "단단한 안심 위에 피어나는 경험",
    description:
      "안정된 루틴과 따뜻한 돌봄 환경 속에서 차분하게 경험을 넓히는 가족입니다. 첫 해외캠프라면 초기 적응과 보호 장치가 핵심입니다.",
    caution: "관리 강도가 높을수록 비용이 오르고 자유 경험은 줄어들 수 있어 아이가 답답해하지 않을 균형이 필요합니다.",
  },
  growth_free_open: {
    name: "다빈치 패밀리",
    image: "/images/다빈치 패밀리.png",
    alt: "창의적인 제작 활동을 하는 다빈치 패밀리 캐릭터",
    headline: "창의적인 틀 밖의 성장",
    description:
      "정해진 틀보다 자유로운 시도 속에서 창의적 문제해결력을 키우는 가족입니다. 아이의 흥미에 맞춘 깊은 몰입을 지지합니다.",
    caution: "가시적인 영어 성과는 더딜 수 있어 프로젝트와 영어 노출이 자연스럽게 연결되는지 확인해야 합니다.",
  },
  growth_free_protected: {
    name: "에디슨 패밀리",
    image: "/images/에디슨 패밀리.png",
    alt: "책과 실험 도구를 앞에 둔 에디슨 패밀리 캐릭터",
    headline: "아이 맞춤형 고유한 속도",
    description:
      "아이의 기질과 컨디션을 세밀하게 파악해 아이만의 배움 방식을 찾아주는 가족입니다. 보호막 안에서 주도성을 키웁니다.",
    caution: "맞춤형 선택지가 많을수록 비용과 조율 부담이 커질 수 있어 우선순위를 미리 정하는 편이 좋습니다.",
  },
  growth_structured_open: {
    name: "암스트롱 패밀리",
    image: "/images/암스트롱 패밀리.png",
    alt: "도전을 향해 출발하는 암스트롱 패밀리 캐릭터",
    headline: "확실한 변화와 거침없는 도전",
    description:
      "명확한 미션과 높은 목표를 세우고 한 단계 성장을 기대하는 가족입니다. 낯선 환경의 경쟁과 단체 생활에도 도전할 수 있습니다.",
    caution: "아이의 실제 영어 수준이나 성향과 맞지 않으면 과부하가 올 수 있어 도전 강도를 세밀하게 조절해야 합니다.",
  },
  growth_structured_protected: {
    name: "맹자 패밀리",
    image: "/images/맹자 패밀리.png",
    alt: "새로운 학교와 환경을 살펴보는 맹자 패밀리 캐릭터",
    headline: "검증된 환경의 가치",
    description:
      "최적의 교육 인프라와 안전이 검증된 환경을 중요하게 보는 가족입니다. 치안, 교육 환경, 투자 대비 성과를 꼼꼼히 비교합니다.",
    caution: "기대치가 높으면 초기 정착 스트레스가 커질 수 있어 아이의 자율성과 부모의 관리 사이 균형이 필요합니다.",
  },
}
