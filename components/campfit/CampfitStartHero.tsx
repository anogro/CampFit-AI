"use client"

import { ArrowRight, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"

const heroSlides = [
  {
    src: "/campfit/hero-tour.png",
    alt: "해외 도시에서 가족과 즐겁게 여행하는 아이",
    label: "도시 경험",
    title: "낯선 도시도 부모와 함께라면 첫 경험이 됩니다.",
    cardTone: "bg-[var(--surface-tint-yellow)]",
  },
  {
    src: "/campfit/hero-school.png",
    alt: "해외 학교 교실에서 친구들과 대화하는 아이들",
    label: "학교 수업",
    title: "또래와 대화하는 시간이 영어 자신감의 시작이 됩니다.",
    cardTone: "bg-[var(--surface-elevated)]",
  },
  {
    src: "/campfit/hero-oneday-class.png",
    alt: "해외 캠프 쿠킹 클래스에서 피자를 만들며 웃는 아이",
    label: "생활 액티비티",
    title: "영어는 책상 밖에서 더 자연스럽게 시작됩니다.",
    cardTone: "bg-[var(--surface-tint-green)]",
  },
  {
    src: "/campfit/hero-camp.png",
    alt: "자연 속 캠프장에서 함께 놀이 활동을 하는 아이들",
    label: "자연 캠프",
    title: "몸으로 부딪히는 활동은 적응의 긴장을 낮춰줍니다.",
    cardTone: "bg-[var(--surface-tint-yellow)]",
  },
  {
    src: "/campfit/hero-steam.png",
    alt: "해외 STEAM 수업에서 친구들과 실험하는 아이들",
    label: "또래 STEAM",
    title: "함께 웃는 순간이 적응의 속도를 바꿉니다.",
    cardTone: "bg-[var(--surface-tint-blue)]",
  },
] as const

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

const carouselPositions = [
  "-translate-x-[175%] -translate-y-1/2 -rotate-3 scale-[0.72] opacity-0 sm:opacity-35",
  "-translate-x-[112%] -translate-y-1/2 -rotate-2 scale-[0.86] opacity-0 sm:opacity-70",
  "-translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 opacity-100",
  "translate-x-[12%] -translate-y-1/2 rotate-2 scale-[0.86] opacity-0 sm:opacity-70",
  "translate-x-[75%] -translate-y-1/2 rotate-3 scale-[0.72] opacity-0 sm:opacity-35",
] as const

export function CampfitStartHero({ onStart }: { readonly onStart: () => void }) {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length)
    }, 4800)

    return () => window.clearInterval(timer)
  }, [])

  const currentSlide = heroSlides[activeSlide] ?? heroSlides[0]

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

          <div className="flex flex-1 flex-col justify-center gap-7 py-8 lg:gap-9 lg:py-10">
            <div className="mx-auto grid w-full max-w-5xl gap-4 text-center">
              <p className="mx-auto inline-flex w-fit items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" aria-hidden="true" />
                {currentSlide.label}
              </p>
              <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-[var(--text-primary)] [word-break:keep-all] sm:text-5xl lg:text-6xl">
                아이의 첫 해외캠프,
                <br />
                잘 맞는 곳부터 시작하세요.
              </h1>
            </div>

            <div className="relative mx-auto h-[270px] w-full max-w-5xl sm:h-[330px] lg:h-[390px]">
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px bg-[var(--border-subtle)]" aria-hidden="true" />
              {heroSlides.map((slide, index) => {
                const offset = getCarouselOffset(index, activeSlide, heroSlides.length)
                const position = carouselPositions[offset + 2] ?? carouselPositions[2]

                return (
                  <button
                    key={slide.src}
                    className={`absolute left-1/2 top-1/2 w-[84%] max-w-[340px] overflow-hidden rounded-lg border border-[var(--border-default)] p-2 text-left shadow-[var(--shadow-card)] transition duration-700 ease-[cubic-bezier(0.2,0.6,0.25,1)] motion-reduce:transition-none sm:w-[34%] sm:max-w-[360px] ${slide.cardTone} ${position} ${
                      offset === 0 ? "z-20" : Math.abs(offset) === 1 ? "z-10" : "z-0"
                    }`}
                    type="button"
                    aria-label={`${slide.label} 이미지 보기`}
                    onClick={() => setActiveSlide(index)}
                  >
                    <span className="sr-only">{slide.label}</span>
                    <span className="block aspect-[5/4] overflow-hidden rounded-md bg-[var(--surface-secondary)]">
                      <img
                        src={slide.src}
                        alt={slide.alt}
                        className="h-full w-full object-contain"
                        fetchPriority={index === 0 ? "high" : "auto"}
                      />
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid gap-3">
                <p className="max-w-2xl text-base font-medium leading-7 text-[var(--text-primary)] [word-break:keep-all] sm:text-lg">
                  {currentSlide.title}
                </p>
                <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">
                  영어 수준, 낯가림, 분리 적응, 지역 성향까지 함께 보고 무리한 선택지를 먼저 덜어냅니다.
                </p>
              </div>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-5 text-base font-bold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                type="button"
                onClick={onStart}
              >
                우리 아이 캠프 찾기
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
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

function getCarouselOffset(index: number, activeIndex: number, total: number): number {
  const rawOffset = (index - activeIndex + total) % total
  return rawOffset > total / 2 ? rawOffset - total : rawOffset
}
