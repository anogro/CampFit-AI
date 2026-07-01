"use client"

import { ArrowRight, CheckCircle2 } from "lucide-react"
import { CampfitHeroShowcase } from "@/components/campfit/CampfitHeroShowcase"

const infoCards = [
  {
    image: "/campfit/hero-tour.png",
    alt: "해외 도시를 둘러보는 가족",
    title: "가족 동반과 도시 경험",
    text: "처음 해외캠프를 준비하는 아이에게는 이동 거리와 보호 장치가 추천의 중요한 기준이 됩니다.",
  },
  {
    image: "/campfit/hero-school.png",
    alt: "해외 학교 수업에 참여하는 아이들",
    title: "현지 학교와 또래 환경",
    text: "호주와 뉴질랜드형 캠프는 교실 문화, 또래 대화, 통학 방식까지 함께 비교해야 합니다.",
  },
  {
    image: "/campfit/hero-camp.png",
    alt: "자연 속 캠프 활동을 하는 아이들",
    title: "몸으로 적응하는 캠프 활동",
    text: "동남아 캠프는 관리 강도뿐 아니라 자연 활동, 생활 루틴, 휴식 환경도 중요한 판단 기준입니다.",
  },
] as const

export function CampfitStartHero({ onStart }: { readonly onStart: () => void }) {
  return (
    <main className="min-h-dvh bg-[var(--surface-primary)]">
      <section className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100svh-32px)] w-full max-w-[1280px] flex-col overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 py-5 shadow-[var(--shadow-card)] sm:min-h-[calc(100svh-48px)] sm:px-8 sm:py-7 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold tracking-[0.01em] text-[var(--text-primary)]">CampFit AI</p>
            <p className="hidden text-sm font-medium text-[var(--text-tertiary)] [word-break:keep-all] sm:block">
              해외캠프 추천 노트
            </p>
          </header>

          <CampfitHeroShowcase onStart={onStart} />
        </div>
      </section>

      <section className="relative z-10 -mt-8 bg-[var(--surface-primary)] px-4 pb-16 pt-10 md:px-6 md:pb-20">
        <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="grid gap-5">
            <p className="text-sm font-bold text-[var(--accent-primary)]">CampFit AI</p>
            <h2 className="max-w-2xl text-3xl font-bold leading-[1.12] tracking-[-0.03em] text-[var(--text-primary)] [word-break:keep-all] sm:text-4xl">
              캠프 선택은 가격표보다 아이의 적응 조건에서 시작해야 합니다.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-secondary)] [word-break:keep-all]">
              동남아의 관리형 몰입 캠프, 호주와 뉴질랜드의 현지 학교형 캠프, 가족 동반형 프로그램은 아이에게 요구하는
              독립성과 영어 노출 방식이 다릅니다. CampFit AI는 부모님의 걱정과 아이의 현재 상태를 함께 읽고 상담 전에
              비교할 수 있는 추천안을 만듭니다.
            </p>
            <ul className="grid gap-2 text-sm font-medium text-[var(--text-secondary)]">
              {["만 나이 기준으로 학년 조건을 자동 반영", "영어 실력보다 적응 부담을 함께 고려", "AI 분석 여부를 결과 화면에 표시"].map((item) => (
                <li key={item} className="flex gap-2 [word-break:keep-all]">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--status-success)]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-5 text-base font-bold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                type="button"
                onClick={onStart}
              >
                추천 시작하기
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:gap-5">
            {infoCards.map((card) => (
              <article
                key={card.title}
                className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[0_12px_32px_rgb(0_0_0_/_0.10)] motion-reduce:transition-none"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[var(--surface-elevated)]">
                  <img src={card.image} alt={card.alt} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="grid gap-2 p-4">
                  <h3 className="text-base font-bold leading-snug text-[var(--text-primary)] [word-break:keep-all]">{card.title}</h3>
                  <p className="text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">{card.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
