"use client"

import { useRef, useState, type RefObject } from "react"
import * as React from "react"
import {
  createCampFitExportLock,
  downloadCampFitResult,
  getCampFitReportFilename,
  type CampFitResultExportFormat,
} from "@/components/campfit/v3/resultExport"
import { trackCampfitV3AnalyticsEvent } from "@/components/campfit/v3/analyticsClient"

type CampFitV3ResultActionsProps = {
  readonly reportRef: RefObject<HTMLElement | null>
  readonly resultId: string | null
  readonly onBack: () => void
  readonly onRestart: () => void
}

export function CampFitV3ResultActions({
  reportRef,
  resultId,
  onBack,
  onRestart,
}: CampFitV3ResultActionsProps) {
  const [exportBusy, setExportBusy] = useState<CampFitResultExportFormat | null>(null)
  const exportLock = useRef(createCampFitExportLock())
  const [notice, setNotice] = useState("")

  async function saveReport(format: CampFitResultExportFormat): Promise<void> {
    const report = reportRef.current
    if (!report || !exportLock.current.acquire()) return
    setExportBusy(format)
    setNotice("")
    try {
      await downloadCampFitResult(report, getCampFitReportFilename(format), format)
      trackCampfitV3AnalyticsEvent({ eventName: "campfit_report_action", stage: "result", resultId, action: format === "pdf" ? "pdf_saved" : "png_saved" })
      setNotice(format === "pdf" ? "결과 PDF를 저장했어요." : "결과 PNG 이미지를 저장했어요.")
    } catch {
      setNotice("리포트를 저장하지 못했어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setExportBusy(null)
      exportLock.current.release()
    }
  }

  function requestRestart(): void {
    if (window.confirm("현재 상담 내용과 결과가 모두 지워집니다. 새 상담을 시작할까요?")) onRestart()
  }

  const actionBusy = exportBusy !== null

  return (
    <section className="mt-8 border-t border-[var(--border-default)] pb-8 pt-7 sm:pb-12" aria-labelledby="result-actions-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">NEXT STEP</p>
          <h2 id="result-actions-title" className="mt-2 text-xl font-bold [word-break:keep-all]">결과를 저장해두세요</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">PDF나 PNG 이미지로 저장해 두고 언제든 다시 볼 수 있어요.</p>
        </div>
        <p className="min-h-6 text-sm font-semibold text-[var(--accent-primary)]" role="status" aria-live="polite">{notice}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="glass-cta min-h-12 rounded-full px-6 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-wait disabled:opacity-60" type="button" onClick={() => saveReport("pdf")} disabled={actionBusy}>
          {exportBusy === "pdf" ? "PDF 만드는 중…" : "PDF 저장하기"}
        </button>
        <button className="glass-cta min-h-12 rounded-full px-5 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-wait disabled:opacity-60" type="button" onClick={() => saveReport("png")} disabled={actionBusy}>
          {exportBusy === "png" ? "PNG 만드는 중…" : "PNG 이미지 저장"}
        </button>
        <button className={secondaryButtonClass} type="button" onClick={onBack} disabled={actionBusy}>상담 내용 다시 보기</button>
        <button className={tertiaryButtonClass} type="button" onClick={requestRestart} disabled={actionBusy}>조건을 바꿔 다시 상담하기</button>
      </div>
    </section>
  )
}

const secondaryButtonClass = "min-h-12 rounded-full border border-[var(--border-default)] bg-white px-5 text-sm font-extrabold text-[var(--text-primary)] transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--cta-glass-border)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none"
const tertiaryButtonClass = "min-h-12 rounded-full px-5 text-sm font-bold text-[var(--text-secondary)] underline decoration-[var(--border-default)] underline-offset-4 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
