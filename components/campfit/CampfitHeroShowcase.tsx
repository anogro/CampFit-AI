"use client"

import { ArrowRight } from "lucide-react"
import type { CSSProperties, PointerEvent } from "react"
import { useEffect, useRef, useState } from "react"

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

const carouselPositions = [
  { translateX: "-175%", rotate: "-3deg", scale: 0.72, opacityClass: "opacity-0 sm:opacity-35" },
  { translateX: "-112%", rotate: "-2deg", scale: 0.86, opacityClass: "opacity-0 sm:opacity-70" },
  { translateX: "-50%", rotate: "0deg", scale: 1, opacityClass: "opacity-100" },
  { translateX: "12%", rotate: "2deg", scale: 0.86, opacityClass: "opacity-0 sm:opacity-70" },
  { translateX: "75%", rotate: "3deg", scale: 0.72, opacityClass: "opacity-0 sm:opacity-35" },
] as const

type DragState = {
  readonly pointerId: number
  readonly startX: number
  readonly currentX: number
}

type PointerOffset = {
  readonly x: number
  readonly y: number
}

const swipeThreshold = 52
const maxDragOffset = 128

export function CampfitHeroShowcase({ onStart }: { readonly onStart: () => void }) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [pointerOffset, setPointerOffset] = useState<PointerOffset>({ x: 0, y: 0 })
  const suppressSlideClickRef = useRef(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length)
    }, 4800)

    return () => window.clearInterval(timer)
  }, [])

  const currentSlide = heroSlides[activeSlide] ?? heroSlides[0]
  const dragDelta = dragState ? clamp(dragState.currentX - dragState.startX, -maxDragOffset, maxDragOffset) : 0

  function moveSlide(direction: "previous" | "next") {
    setActiveSlide((current) => getAdjacentSlideIndex(current, heroSlides.length, direction))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({ pointerId: event.pointerId, startX: event.clientX, currentX: event.clientX })
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragState) {
      if (event.pointerId !== dragState.pointerId) {
        return
      }

      setDragState({ ...dragState, currentX: event.clientX })
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    setPointerOffset({
      x: clamp((event.clientX - centerX) / bounds.width, -0.5, 0.5) * 18,
      y: clamp((event.clientY - centerY) / bounds.height, -0.5, 0.5) * 10,
    })
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalDelta = event.clientX - dragState.startX
    setDragState(null)
    setPointerOffset({ x: 0, y: 0 })

    if (Math.abs(finalDelta) < swipeThreshold) {
      return
    }

    suppressSlideClickRef.current = true
    window.setTimeout(() => {
      suppressSlideClickRef.current = false
    }, 0)
    moveSlide(finalDelta > 0 ? "previous" : "next")
  }

  function handlePointerLeave() {
    if (!dragState) {
      setPointerOffset({ x: 0, y: 0 })
    }
  }

  return (
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

      <div
        className={`relative mx-auto h-[270px] w-full max-w-5xl touch-pan-y select-none ${
          dragState ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerLeave}
      >
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px bg-[var(--border-subtle)]" aria-hidden="true" />
        {heroSlides.map((slide, index) => {
          const offset = getCarouselOffset(index, activeSlide, heroSlides.length)
          const position = carouselPositions[offset + 2] ?? carouselPositions[2]
          const isActive = offset === 0
          const translateX = isActive ? `calc(${position.translateX} + ${dragDelta + pointerOffset.x}px)` : position.translateX
          const translateY = isActive ? `calc(-50% + ${pointerOffset.y}px)` : "-50%"
          const cardStyle: CSSProperties = {
            transform: `translate(${translateX}, ${translateY}) rotate(${position.rotate}) scale(${position.scale})`,
          }

          return (
            <button
              key={slide.src}
              className={`absolute left-1/2 top-1/2 w-[84%] max-w-[340px] overflow-hidden rounded-lg border border-[var(--border-default)] p-2 text-left shadow-[var(--shadow-card)] transition ease-[cubic-bezier(0.2,0.6,0.25,1)] motion-reduce:transition-none sm:w-[34%] sm:max-w-[360px] ${slide.cardTone} ${position.opacityClass} ${
                dragState ? "duration-0" : "duration-700"
              } ${isActive ? "z-20" : Math.abs(offset) === 1 ? "z-10" : "z-0"}`}
              style={cardStyle}
              type="button"
              aria-label={`${slide.label} 이미지 보기`}
              onClick={() => {
                if (suppressSlideClickRef.current) {
                  return
                }
                setActiveSlide(index)
              }}
            >
              <span className="sr-only">{slide.label}</span>
              <span className="block aspect-[5/4] overflow-hidden rounded-md bg-[var(--surface-secondary)]">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="h-full w-full object-contain"
                  draggable={false}
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
            영어 소통 수준, 낯가림, 분리 적응, 지역 성향까지 함께 보고 무리한 선택지를 먼저 덜어냅니다.
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
  )
}

function getCarouselOffset(index: number, activeIndex: number, total: number): number {
  const rawOffset = (index - activeIndex + total) % total
  return rawOffset > total / 2 ? rawOffset - total : rawOffset
}

function getAdjacentSlideIndex(current: number, total: number, direction: "previous" | "next"): number {
  if (direction === "previous") {
    return (current - 1 + total) % total
  }

  return (current + 1) % total
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
