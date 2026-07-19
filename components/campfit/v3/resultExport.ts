export type CampFitResultExportFormat = "pdf" | "png"

export async function downloadCampFitResult(
  element: HTMLElement,
  filename: string,
  format: CampFitResultExportFormat = "pdf",
): Promise<void> {
  const dataUrl = await captureCampFitResult(element)
  if (format === "png") {
    downloadDataUrl(dataUrl, filename.endsWith(".png") ? filename : `${filename}.png`)
    return
  }

  const { jsPDF } = await import("jspdf")
  const image = await loadImage(dataUrl)
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imageHeight = image.naturalHeight / image.naturalWidth * pageWidth
  let offset = 0
  let isFirstPage = true
  while (offset < imageHeight) {
    if (!isFirstPage) pdf.addPage()
    pdf.addImage(dataUrl, "PNG", 0, -offset, pageWidth, imageHeight, undefined, "FAST")
    offset += pageHeight
    isFirstPage = false
  }
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
}

async function captureCampFitResult(element: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image")
  return toPng(element, {
    backgroundColor: "#ffffff",
    cacheBust: true,
    filter: (node) => !(node instanceof HTMLElement && node.dataset["campfitExportIgnore"] === "true"),
    pixelRatio: 2,
    width: 1120,
    style: {
      width: "1120px",
      maxWidth: "none",
      backgroundColor: "#ffffff",
    },
  })
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
  anchor.click()
}
