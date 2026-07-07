"use client"

import { ArrowRight, ListChecks, UserRound, UsersRound } from "lucide-react"

const guidePoints = [
  {
    label: "아이 성향",
    text: "영어 익숙함 · 낯가림 · 분리 적응",
    Icon: UserRound,
  },
  {
    label: "가족 조건",
    text: "부모 동행 · 예산 · 기간 · 희망 지역",
    Icon: UsersRound,
  },
  {
    label: "선택 기준",
    text: "추천 방향 · 주의할 선택 · 다음 체크포인트",
    Icon: ListChecks,
  },
] as const

const campCategories = ["스쿨링", "방학캠프", "문화체험", "영어몰입"] as const

export function CampfitHeroShowcase({ onStart }: { readonly onStart: () => void }) {
  return (
    <div className="relative grid min-h-0 flex-1 items-center gap-3 py-2 sm:gap-5 sm:py-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)] lg:gap-8 lg:py-4">
      <section className="contents lg:flex lg:flex-col lg:items-start lg:text-left">
        <div className="order-1 grid justify-items-center gap-2 text-center lg:justify-items-start lg:text-left">
          <div className="flex max-w-[20rem] flex-wrap justify-center gap-1.5 lg:max-w-none lg:justify-start">
            {campCategories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-[rgb(9_127_232_/_0.14)] bg-[var(--surface-tint-blue)] px-3 py-1 text-[11px] font-bold leading-none text-[var(--accent-blue)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] [word-break:keep-all] sm:text-xs"
              >
                {category}
              </span>
            ))}
          </div>
          <h1 className="max-w-[34rem] text-[1.72rem] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--text-ink)] [word-break:keep-all] sm:text-[2.65rem] lg:text-[3.35rem]">
            아이의 첫 해외캠프,
            <br />
            감이 아니라 기준에 맞게
            <br className="sm:hidden" /> 고르세요.
          </h1>
        </div>

        <div className="order-2 grid place-items-center lg:order-none lg:absolute lg:right-12 lg:top-1/2 lg:w-[48%] lg:-translate-y-1/2 xl:right-16">
          <div className="relative grid w-full max-w-[250px] place-items-center sm:max-w-[430px] lg:max-w-[560px] xl:max-w-[610px]">
            <div
              className="absolute inset-x-8 bottom-6 top-12 rounded-full bg-[rgb(249_115_22_/_0.08)] opacity-80 blur-3xl lg:inset-x-12 lg:bottom-10 lg:top-16"
              aria-hidden="true"
            />
            <div
              className="absolute right-4 top-7 h-16 w-16 rounded-full bg-[rgb(9_127_232_/_0.08)] blur-2xl lg:right-16 lg:top-12 lg:h-28 lg:w-28"
              aria-hidden="true"
            />
            <img
              src="/images/campfit image.png"
              alt="아이의 첫 해외캠프를 준비하는 부모와 아이 일러스트"
              className="relative mx-auto max-h-[220px] w-full object-contain drop-shadow-[0_22px_34px_rgba(0,0,0,0.12)] sm:max-h-[380px] lg:max-h-[560px] xl:max-h-[610px]"
              draggable={false}
              fetchPriority="high"
            />
          </div>
        </div>

        <div className="order-3 grid justify-items-center gap-3 text-center lg:mt-5 lg:max-w-[35rem] lg:justify-items-start lg:text-left">
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all] sm:text-base sm:leading-7 lg:text-[1.02rem]">
            <span className="block">후기 몇 개, 유명 광고로는</span>
            <span className="block">우리 아이에게 맞는 캠프를 찾을 수 없습니다.</span>
            <span className="mt-1 block">아이 성향과 가족 조건을 함께 보고</span>
            <span className="block">첫 캠프 선택의 기준을 정리합니다.</span>
          </p>
        </div>

        <div className="order-5 grid justify-items-center lg:order-4 lg:mt-4 lg:justify-items-start">
          <button
            className="apple-pill glass-cta inline-flex min-h-11 w-full max-w-[320px] items-center justify-center gap-2 px-6 text-base font-bold ring-1 ring-[rgb(229_231_235_/_0.72)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[52px] lg:max-w-[260px]"
            type="button"
            onClick={onStart}
          >
            캠프핏 진단 시작하기
            <ArrowRight size={18} className="text-[var(--accent-brand-green)]" aria-hidden="true" />
          </button>
        </div>

        <div className="order-4 grid w-full grid-cols-3 gap-2 lg:order-5 lg:mt-5 lg:max-w-[35rem] lg:gap-3">
          {guidePoints.map(({ label, text, Icon }) => (
            <div
              key={label}
              className="grid justify-items-center gap-1 rounded-[16px] border border-[var(--border-subtle)] bg-[rgb(255_255_255_/_0.74)] px-2 py-2 text-center shadow-[0_4px_18px_rgba(0,0,0,0.035)] lg:gap-1.5 lg:rounded-[18px] lg:px-4 lg:py-3 lg:justify-items-start lg:text-left"
            >
              <Icon size={19} strokeWidth={2.2} className="text-[var(--accent-brand-green)] lg:h-6 lg:w-6" aria-hidden="true" />
              <div className="grid gap-1">
                <p className="text-[11px] font-bold leading-tight text-[var(--text-primary)] [word-break:keep-all] sm:text-xs">
                  {label}
                </p>
                <p className="hidden text-[11px] font-medium leading-snug text-[var(--text-secondary)] [word-break:keep-all] sm:block">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
