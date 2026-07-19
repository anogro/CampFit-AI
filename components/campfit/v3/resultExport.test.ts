import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createCampFitExportLock,
  createCampFitResultPdfBlob,
  downloadCampFitResult,
  getCampFitReportFilename,
  sendCampFitResultEmail,
  shouldIncludeCampFitExportNode,
  singlePagePdfDimensions,
} from "@/components/campfit/v3/resultExport"

const exportMocks = vi.hoisted(() => ({
  toPng: vi.fn(),
  pdfOptions: null as Record<string, unknown> | null,
  addImageCalls: [] as unknown[][],
  downloadedFiles: [] as string[],
  revokedUrls: [] as string[],
}))

vi.mock("html-to-image", () => ({ toPng: exportMocks.toPng }))
vi.mock("jspdf", () => ({
  jsPDF: class MockJsPdf {
    constructor(options: Record<string, unknown>) {
      exportMocks.pdfOptions = options
    }

    addImage(...args: unknown[]) {
      exportMocks.addImageCalls.push(args)
      return this
    }

    output(type: string) {
      expect(type).toBe("blob")
      return new Blob(["pdf"], { type: "application/pdf" })
    }
  },
}))

describe("CampFit result export", () => {
  beforeEach(() => {
    exportMocks.toPng.mockReset()
    exportMocks.toPng.mockResolvedValue("data:image/png;base64,report")
    exportMocks.pdfOptions = null
    exportMocks.addImageCalls.length = 0
    exportMocks.downloadedFiles.length = 0
    exportMocks.revokedUrls.length = 0
    vi.stubGlobal("fetch", vi.fn())
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:campfit-report")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => { exportMocks.revokedUrls.push(url) })
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        fonts: { ready: Promise.resolve() },
        createElement: () => ({
          href: "",
          download: "",
          click: () => undefined,
          remove: () => undefined,
        }),
        body: { appendChild: (anchor: { download: string }) => exportMocks.downloadedFiles.push(anchor.download) },
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(globalThis, "document")
    Reflect.deleteProperty(globalThis, "Image")
  })

  it("creates local filenames with the requested date", () => {
    const date = new Date(2026, 6, 19)
    expect(getCampFitReportFilename("png", date)).toBe("campfit-report-2026-07-19.png")
    expect(getCampFitReportFilename("pdf", date)).toBe("campfit-report-2026-07-19.pdf")
  })

  it("excludes the action area from the export tree", () => {
    expect(shouldIncludeCampFitExportNode({ dataset: { campfitExportIgnore: "true" } } as unknown as HTMLElement)).toBe(false)
    expect(shouldIncludeCampFitExportNode({ dataset: {} } as unknown as HTMLElement)).toBe(true)
  })

  it("blocks duplicate export runs until the first one releases the lock", () => {
    const lock = createCampFitExportLock()
    expect(lock.acquire()).toBe(true)
    expect(lock.acquire()).toBe(false)
    lock.release()
    expect(lock.acquire()).toBe(true)
  })

  it("exports PNG and restores the saved DOM state", async () => {
    const detail = { open: false }
    const child = { style: { animation: "fade", transition: "all", position: "sticky" } }
    const root = createExportRoot(detail, child)
    exportMocks.toPng.mockImplementation(async () => {
      expect(detail.open).toBe(false)
      expect(child.style.animation).toBe("none")
      return "data:image/png;base64,report"
    })

    await downloadCampFitResult(root, "campfit-report-2026-07-19.png", "png")

    expect(exportMocks.toPng).toHaveBeenCalledOnce()
    expect(exportMocks.downloadedFiles).toEqual(["campfit-report-2026-07-19.png"])
    expect(detail.open).toBe(false)
    expect(child.style.animation).toBe("fade")
    expect(child.style.transition).toBe("all")
    expect(child.style.position).toBe("sticky")
    expect(root.dataset["campfitExporting"]).toBeUndefined()
  })

  it("creates a single dynamic PDF page from the same PNG", async () => {
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: class MockImage {
        naturalWidth = 400
        naturalHeight = 4_000
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
        onload?: () => void
        onerror?: () => void
      },
    })

    await downloadCampFitResult(createExportRoot({ open: false }, { style: {} }), "campfit-report-2026-07-19.pdf", "pdf")

    expect(exportMocks.pdfOptions?.["format"]).toEqual([595, 5_950])
    expect(exportMocks.addImageCalls).toHaveLength(1)
    expect(exportMocks.downloadedFiles).toEqual(["campfit-report-2026-07-19.pdf"])
    expect(exportMocks.revokedUrls).toEqual(["blob:campfit-report"])
  })

  it("exposes the same single-page PDF as a Blob for email delivery", async () => {
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: class MockImage {
        naturalWidth = 400
        naturalHeight = 4_000
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
        onload?: () => void
        onerror?: () => void
      },
    })

    const pdf = await createCampFitResultPdfBlob(createExportRoot({ open: false }, { style: {} }))
    expect(pdf).toBeInstanceOf(Blob)
    expect(pdf.type).toBe("application/pdf")
  })

  it("sends the PDF as multipart form data without a JSON payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    const pdf = new Blob(["pdf"], { type: "application/pdf" })

    await sendCampFitResultEmail({ email: "parent@example.com", pdf, filename: "campfit-report-2026-07-19.pdf" })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(fetchMock).toHaveBeenCalledWith("/api/campfit/email-report", expect.objectContaining({ method: "POST" }))
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeInstanceOf(FormData)
    const formData = init.body as FormData
    expect(formData.get("email")).toBe("parent@example.com")
    expect(formData.get("pdf")).toBeTruthy()
  })

  it("calculates one-page dimensions without changing the image ratio", () => {
    expect(singlePagePdfDimensions(1_000, 2_000)).toEqual({ width: 595, height: 1_190 })
    const limited = singlePagePdfDimensions(1_000, 100_000)
    expect(limited.height).toBe(14_400)
    expect(limited.width).toBe(144)
  })
})

function createExportRoot(detail: { open: boolean }, child: { style: Record<string, string> }): HTMLElement {
  const enhanceStyle = (input: Record<string, string>) => input as Record<string, string> & {
    getPropertyValue: (property: string) => string
    setProperty: (property: string, value: string) => void
    removeProperty: (property: string) => void
  }
  const childStyle = enhanceStyle(child.style)
  childStyle.getPropertyValue = (property) => childStyle[property] ?? ""
  childStyle.setProperty = (property, value) => { childStyle[property] = value }
  childStyle.removeProperty = (property) => { delete childStyle[property] }
  const rootStyle = enhanceStyle({ width: "", maxWidth: "", overflow: "", backgroundColor: "" })
  rootStyle.getPropertyValue = (property) => rootStyle[property] ?? ""
  rootStyle.setProperty = (property, value) => { rootStyle[property] = value }
  rootStyle.removeProperty = (property) => { delete rootStyle[property] }
  return {
    dataset: {},
    style: rootStyle,
    scrollWidth: 400,
    getBoundingClientRect: () => ({ width: 400 }),
    querySelectorAll: (selector: string) => {
      if (selector === "details") return [detail]
      if (selector === "img") return []
      return [child]
    },
  } as unknown as HTMLElement
}
