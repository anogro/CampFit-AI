"use client"

import { useRef, useState, type FormEvent, type RefObject } from "react"
import * as React from "react"
import {
  createCampFitResultPdfBlob,
  createCampFitExportLock,
  downloadCampFitResult,
  getCampFitReportFilename,
  sendCampFitResultEmail,
  type CampFitResultExportFormat,
} from "@/components/campfit/v3/resultExport"

export type CampFitV3EmailRequest = {
  readonly email: string
  readonly pdf: Blob
  readonly filename: string
}

type CampFitV3ResultActionsProps = {
  readonly reportRef: RefObject<HTMLElement | null>
  readonly onRequestEmail?: (request: CampFitV3EmailRequest) => void | Promise<void>
  readonly onBack: () => void
  readonly onRestart: () => void
}

export function CampFitV3ResultActions({
  reportRef,
  onRequestEmail,
  onBack,
  onRestart,
}: CampFitV3ResultActionsProps) {
  const [exportBusy, setExportBusy] = useState<CampFitResultExportFormat | null>(null)
  const exportLock = useRef(createCampFitExportLock())
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [email, setEmail] = useState("")
  const [notice, setNotice] = useState("")
  const [emailError, setEmailError] = useState("")

  async function saveReport(format: CampFitResultExportFormat): Promise<void> {
    const report = reportRef.current
    if (!report || !exportLock.current.acquire()) return
    setExportBusy(format)
    setNotice("")
    try {
      await downloadCampFitResult(report, getCampFitReportFilename(format), format)
      setNotice(format === "pdf" ? "결과 PDF를 저장했어요." : "결과 PNG 이미지를 저장했어요.")
    } catch {
      setNotice("리포트를 저장하지 못했어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setExportBusy(null)
      exportLock.current.release()
    }
  }

  async function requestEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const normalizedEmail = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setEmailError("받으실 이메일 주소를 확인해 주세요.")
      return
    }
    const report = reportRef.current
    if (!report || !exportLock.current.acquire()) return
    setEmailError("")
    setNotice("")
    setEmailBusy(true)
    try {
      const filename = getCampFitReportFilename("pdf")
      const pdf = await createCampFitResultPdfBlob(report)
      if (onRequestEmail) await onRequestEmail({ email: normalizedEmail, pdf, filename })
      else await sendCampFitResultEmail({ email: normalizedEmail, pdf, filename })
      setEmail("")
      setEmailOpen(false)
      setNotice("추천 리포트를 이메일로 보내드렸어요.")
    } catch {
      setEmailError("이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setEmailBusy(false)
      exportLock.current.release()
    }
  }

  function requestRestart(): void {
    if (window.confirm("현재 상담 내용과 결과가 모두 지워집니다. 새 상담을 시작할까요?")) onRestart()
  }

  const actionBusy = exportBusy !== null || emailBusy

  return (
    <section className="mt-8 border-t border-[var(--border-default)] pt-7" aria-labelledby="result-actions-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.12em] text-[var(--accent-primary)]">NEXT STEP</p>
          <h2 id="result-actions-title" className="mt-2 text-xl font-bold [word-break:keep-all]">결과를 저장해두세요</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)] [word-break:keep-all]">PDF로 저장하거나, 이메일 주소를 입력해 같은 결과를 받아볼 수 있어요.</p>
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
        <button className={secondaryButtonClass} type="button" onClick={() => { setEmailError(""); setEmailOpen(true) }} disabled={actionBusy}>
          {emailBusy ? "이메일 보내는 중…" : "이메일로 받기"}
        </button>
        <button className={secondaryButtonClass} type="button" onClick={onBack} disabled={actionBusy}>상담 내용 다시 보기</button>
        <button className={tertiaryButtonClass} type="button" onClick={requestRestart} disabled={actionBusy}>조건을 바꿔 다시 상담하기</button>
      </div>
      {emailOpen ? (
        <div className="mt-4 max-w-xl rounded-[20px] border border-[var(--border-default)] bg-white p-5" role="dialog" aria-labelledby="email-result-title" aria-modal="false">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="email-result-title" className="font-bold">결과를 받을 이메일</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">추천 결과를 보관할 이메일 주소를 입력해 주세요.</p>
            </div>
            <button className="text-sm font-bold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => setEmailOpen(false)} disabled={emailBusy}>닫기</button>
          </div>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={requestEmail} noValidate>
            <label className="sr-only" htmlFor="campfit-result-email">이메일 주소</label>
            <input id="campfit-result-email" className="min-h-11 flex-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 text-sm outline-none focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" disabled={emailBusy} />
            <button className="glass-cta min-h-11 rounded-full px-5 text-sm font-extrabold disabled:cursor-wait disabled:opacity-60" type="submit" disabled={emailBusy}>{emailBusy ? "보내는 중…" : "이메일 보내기"}</button>
          </form>
          {emailError ? <p className="mt-2 text-sm font-semibold text-[var(--status-error)]" role="alert">{emailError}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

const secondaryButtonClass = "min-h-12 rounded-full border border-[var(--border-default)] bg-white px-5 text-sm font-extrabold text-[var(--text-primary)] transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--cta-glass-border)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none"
const tertiaryButtonClass = "min-h-12 rounded-full px-5 text-sm font-bold text-[var(--text-secondary)] underline decoration-[var(--border-default)] underline-offset-4 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
