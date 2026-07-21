"use client"

import { CampfitHeroShowcase } from "@/components/campfit/CampfitHeroShowcase"

export function CampfitStartHero({ onStart }: { readonly onStart: () => void }) {
  return (
    <main className="h-dvh overflow-hidden bg-transparent">
      <section className="h-full px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <div className="apple-glass campfit-v3-frame-surface mx-auto flex h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-[24px] px-4 py-4 sm:rounded-[32px] sm:px-8 sm:py-7 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <a className="flex items-center gap-2.5" href="https://www.anogro.com/" aria-label="ANOGRO 홈페이지로 이동">
              <img src="/images/Small Logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} />
              <p className="text-sm font-extrabold tracking-[0.04em] text-[var(--text-primary)]">ANOGRO</p>
            </a>
            <p className="hidden text-sm font-medium text-[var(--text-tertiary)] [word-break:keep-all] sm:block">
              첫 해외캠프 선택 노트
            </p>
          </header>

          <CampfitHeroShowcase onStart={onStart} />
        </div>
      </section>
    </main>
  )
}
