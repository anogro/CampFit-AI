export type CampFitResultExportFormat = "pdf" | "png"

const REPORT_EXPORT_PIXEL_RATIO = 2
const REPORT_PDF_BASE_WIDTH_PT = 595
const REPORT_PDF_MAX_DIMENSION_PT = 14_400
const REPORT_IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100"><rect width="160" height="100" rx="18" fill="#f1f5f2"/></svg>',
)}`

export async function downloadCampFitResult(
  element: HTMLElement,
  filename: string,
  format: CampFitResultExportFormat = "pdf",
): Promise<void> {
  if (format === "png") {
    const dataUrl = await captureCampFitResult(element)
    downloadDataUrl(dataUrl, filename.endsWith(".png") ? filename : `${filename}.png`)
    return
  }

  const blob = await createCampFitResultPdfBlob(element)
  downloadBlob(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
}

export async function createCampFitResultPdfBlob(element: HTMLElement): Promise<Blob> {
  const dataUrl = await captureCampFitResult(element)
  const { jsPDF } = await import("jspdf")
  const image = await loadImage(dataUrl)
  const dimensions = singlePagePdfDimensions(image.naturalWidth, image.naturalHeight)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [dimensions.width, dimensions.height],
    compress: true,
  })
  pdf.addImage(dataUrl, "PNG", 0, 0, dimensions.width, dimensions.height, undefined, "FAST")
  return pdf.output("blob")
}

export async function sendCampFitResultEmail({
  email,
  pdf,
  filename,
}: {
  readonly email: string
  readonly pdf: Blob
  readonly filename: string
}): Promise<void> {
  const formData = new FormData()
  formData.append("email", email)
  formData.append("pdf", pdf, filename)
  const response = await fetch("/api/campfit/email-report", { method: "POST", body: formData })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) {
    throw new Error(apiMessage(payload))
  }
}

export function getCampFitReportFilename(format: CampFitResultExportFormat, date = new Date()): string {
  const dateStamp = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value) => String(value).padStart(2, "0"))
    .join("-")
  return `campfit-report-${dateStamp}.${format}`
}

export function singlePagePdfDimensions(imageWidth: number, imageHeight: number): { readonly width: number; readonly height: number } {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new Error("PDF 이미지 크기를 확인할 수 없습니다.")
  }
  const ratio = imageHeight / imageWidth
  const unscaledHeight = REPORT_PDF_BASE_WIDTH_PT * ratio
  const scale = Math.min(1, REPORT_PDF_MAX_DIMENSION_PT / Math.max(REPORT_PDF_BASE_WIDTH_PT, unscaledHeight))
  return {
    width: REPORT_PDF_BASE_WIDTH_PT * scale,
    height: unscaledHeight * scale,
  }
}

export function createCampFitExportLock(): { acquire: () => boolean; release: () => void } {
  let locked = false
  return {
    acquire: () => {
      if (locked) return false
      locked = true
      return true
    },
    release: () => {
      locked = false
    },
  }
}

export function shouldIncludeCampFitExportNode(node: HTMLElement): boolean {
  const dataset = (node as HTMLElement & { readonly dataset?: DOMStringMap }).dataset
  return dataset?.["campfitExportIgnore"] !== "true"
}

async function captureCampFitResult(element: HTMLElement): Promise<string> {
  const restore = prepareReportForCapture(element)
  try {
    await waitForReportAssets(element)
    const { toPng } = await import("html-to-image")
    const width = Math.max(1, Math.ceil(element.getBoundingClientRect().width || element.scrollWidth))
    return toPng(element, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      filter: shouldIncludeCampFitExportNode,
      imagePlaceholder: REPORT_IMAGE_PLACEHOLDER,
      pixelRatio: REPORT_EXPORT_PIXEL_RATIO,
      width,
      style: {
        width: `${width}px`,
        maxWidth: "none",
        backgroundColor: "#ffffff",
      },
      fetchRequestInit: { credentials: "same-origin" },
      onImageErrorHandler: () => undefined,
    })
  } finally {
    restore()
  }
}

function prepareReportForCapture(element: HTMLElement): () => void {
  const previous = {
    exporting: element.dataset["campfitExporting"],
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    overflow: element.style.overflow,
    backgroundColor: element.style.backgroundColor,
  }
  const details = Array.from(element.querySelectorAll("details"))
  const detailStates = details.map((detail) => ({ detail, open: detail.open }))
  const styledNodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))]
  const exportStyle = typeof document !== "undefined" && typeof element.prepend === "function" ? document.createElement("style") : null
  if (exportStyle) {
    exportStyle.textContent = `[data-campfit-exporting="true"] * { scrollbar-width: none !important; } [data-campfit-exporting="true"] *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; } [data-campfit-exporting="true"] [data-campfit-report-section="city-comparison"] { overflow: visible !important; }`
    element.prepend(exportStyle)
  }
  const styleStates = styledNodes.map((node) => ({
    node,
    animation: node.style.animation,
    transition: node.style.transition,
    position: node.style.position,
    overflow: node.style.overflow,
    overflowX: node.style.overflowX,
    overflowY: node.style.overflowY,
    scrollbarWidth: node.style.getPropertyValue("scrollbar-width"),
  }))

  element.dataset["campfitExporting"] = "true"
  const width = Math.max(1, Math.ceil(element.getBoundingClientRect().width || element.scrollWidth))
  element.style.width = `${width}px`
  element.style.maxWidth = "none"
  element.style.overflow = "visible"
  element.style.backgroundColor = "#ffffff"
  styledNodes.forEach((node) => {
    node.style.animation = "none"
    node.style.transition = "none"
    if (typeof window !== "undefined") {
      const position = window.getComputedStyle(node).position
      if (position === "fixed" || position === "sticky") node.style.position = "static"
      const overflow = window.getComputedStyle(node)
      if (overflow.overflowX === "auto" || overflow.overflowX === "scroll" || overflow.overflowY === "auto" || overflow.overflowY === "scroll") {
        node.style.setProperty("overflow", "visible", "important")
        node.style.setProperty("overflow-x", "visible", "important")
        node.style.setProperty("overflow-y", "visible", "important")
        node.style.setProperty("scrollbar-width", "none", "important")
      }
    }
  })

  return () => {
    exportStyle?.remove()
    if (previous.exporting === undefined) delete element.dataset["campfitExporting"]
    else element.dataset["campfitExporting"] = previous.exporting
    element.style.width = previous.width
    element.style.maxWidth = previous.maxWidth
    element.style.overflow = previous.overflow
    element.style.backgroundColor = previous.backgroundColor
    detailStates.forEach(({ detail, open }) => { detail.open = open })
    styleStates.forEach(({ node, animation, transition, position, overflow, overflowX, overflowY, scrollbarWidth }) => {
      node.style.animation = animation
      node.style.transition = transition
      node.style.position = position
      node.style.removeProperty("overflow")
      node.style.removeProperty("overflow-x")
      node.style.removeProperty("overflow-y")
      node.style.removeProperty("scrollbar-width")
      if (overflow) node.style.setProperty("overflow", overflow)
      if (overflowX) node.style.setProperty("overflow-x", overflowX)
      if (overflowY) node.style.setProperty("overflow-y", overflowY)
      if (scrollbarWidth) node.style.setProperty("scrollbar-width", scrollbarWidth)
    })
  }
}

async function waitForReportAssets(element: HTMLElement): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) await withTimeout(document.fonts.ready, 5_000)
  await Promise.all(Array.from(element.querySelectorAll("img")).map(waitForImage))
  await waitForPaint()
}

async function waitForImage(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await withTimeout(new Promise<void>((resolve) => {
      const finish = () => resolve()
      image.addEventListener("load", finish, { once: true })
      image.addEventListener("error", finish, { once: true })
    }), 3_000)
  }
  if (typeof image.decode === "function") {
    try {
      await withTimeout(image.decode(), 3_000)
    } catch {
      // html-to-image will use the configured placeholder for a failed image.
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), milliseconds)),
  ])
}

function waitForPaint(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("PDF 이미지 변환에 실패했습니다."))
    image.src = dataUrl
  })
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement("a")
  anchor.href = dataUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function apiMessage(value: unknown): string {
  if (typeof value === "object" && value !== null && "message" in value && typeof value.message === "string") return value.message
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "message" in value.error && typeof value.error.message === "string") return value.error.message
  return "이메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요."
}
