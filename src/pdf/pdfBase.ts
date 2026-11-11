import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable, { type RowInput, type UserOptions } from 'jspdf-autotable'

/**
 * Shared building blocks for every PDF: A4 portrait, millimetre units,
 * Kuroshio header, section titles, KPI boxes, tables, bar charts and the
 * footer required on every page.
 */
export const PAGE = { width: 210, height: 297, margin: 15 } as const
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2
const FOOTER_SPACE = 18

type RGB = [number, number, number]
export const COLORS: Record<'navy' | 'navyLight' | 'teal' | 'amber' | 'red' | 'green' | 'grey' | 'text' | 'muted' | 'panel', RGB> = {
  navy: [15, 34, 75],
  navyLight: [47, 79, 146],
  teal: [1, 76, 195],
  amber: [217, 119, 6],
  red: [220, 38, 38],
  green: [22, 163, 74],
  grey: [148, 163, 184],
  text: [15, 34, 75],
  muted: [71, 102, 168],
  panel: [243, 246, 253],
}

/**
 * The built-in PDF fonts only cover basic Latin characters, so swap the few
 * typographic characters we use in the app for safe equivalents.
 */
export function safe(text: string): string {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, '->')
    .replace(/…/g, '...')
    .replace(/≥/g, '>=')
    .replace(/₂/g, '2')
    .replace(/[^\x20-\x7E -ÿ\n]/g, '')
}

export function createDoc(): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  return doc
}

/**
 * White Kuroshio logo for the cover band, loaded as soon as the PDF code loads
 * (jsPDF needs the image as data). If it isn't ready yet, the cover is drawn
 * without it.
 */
let logoDataUrl: string | null = null
const LOGO_RATIO = 203 / 320 // height / width of public/kuroshio-logo-white.png
void fetch(`${import.meta.env.BASE_URL}kuroshio-logo-white.png`)
  .then((res) => res.blob())
  .then(
    (blob) =>
      new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          logoDataUrl = typeof reader.result === 'string' ? reader.result : null
          resolve()
        }
        reader.readAsDataURL(blob)
      }),
  )
  .catch(() => undefined)

/** Big brand-blue band on page 1. Returns the y position below it. */
export function drawCover(doc: jsPDF, title: string, lines: string[]): number {
  const height = 34 + lines.length * 5
  doc.setFillColor(...COLORS.navy)
  doc.rect(0, 0, PAGE.width, height, 'F')
  if (logoDataUrl) {
    const w = 20
    doc.addImage(logoDataUrl, 'PNG', PAGE.width - PAGE.margin - w, height - w * LOGO_RATIO - 5, w, w * LOGO_RATIO)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(146, 184, 251) // light brand blue
  doc.text('KUROSHIO AI  -  ENERGYIQ  -  PREPARED FOR IMDAAD', PAGE.margin, 14)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(17)
  doc.text(safe(title), PAGE.margin, 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(197, 211, 238)
  lines.forEach((line, i) => doc.text(safe(line), PAGE.margin, 32 + i * 5))

  // "Sample data" tag, top right
  const tag = 'SAMPLE DATA - FOR DEMONSTRATION ONLY'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const tagWidth = doc.getTextWidth(tag) + 6
  doc.setFillColor(254, 243, 199)
  doc.roundedRect(PAGE.width - PAGE.margin - tagWidth, 9, tagWidth, 7, 1.5, 1.5, 'F')
  doc.setTextColor(146, 64, 14)
  doc.text(tag, PAGE.width - PAGE.margin - tagWidth + 3, 13.7)

  doc.setTextColor(...COLORS.text)
  doc.setFont('helvetica', 'normal')
  return height + 10
}

/** Adds a new page when there isn't `needed` mm left. Returns the y to draw at. */
export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE.height - FOOTER_SPACE) return y
  doc.addPage()
  return 22
}

export function sectionTitle(doc: jsPDF, y: number, number: string, title: string): number {
  y = ensureSpace(doc, y, 30)
  doc.setFillColor(...COLORS.teal)
  doc.rect(PAGE.margin, y - 4.5, 1.6, 6.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...COLORS.navy)
  doc.text(safe(number ? `${number}  ${title}` : title), PAGE.margin + 4, y)
  doc.setFont('helvetica', 'normal')
  return y + 6
}

export function paragraph(doc: jsPDF, y: number, text: string, opts: { size?: number; color?: RGB; italic?: boolean } = {}): number {
  doc.setFont('helvetica', opts.italic ? 'italic' : 'normal')
  doc.setFontSize(opts.size ?? 9.5)
  doc.setTextColor(...(opts.color ?? COLORS.muted))
  const lines = doc.splitTextToSize(safe(text), CONTENT_WIDTH) as string[]
  y = ensureSpace(doc, y, lines.length * 4.5)
  doc.text(lines, PAGE.margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  return y + lines.length * 4.3 + 2
}

export interface KpiBox {
  label: string
  value: string
  sub?: string
  color?: RGB
}

/** Row(s) of KPI boxes, 4 per row. */
export function kpiBoxes(doc: jsPDF, y: number, boxes: KpiBox[]): number {
  const perRow = 4
  const gap = 4
  const w = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow
  const h = 24
  for (let i = 0; i < boxes.length; i += perRow) {
    y = ensureSpace(doc, y, h + 4)
    boxes.slice(i, i + perRow).forEach((box, j) => {
      const x = PAGE.margin + j * (w + gap)
      doc.setFillColor(...COLORS.panel)
      doc.roundedRect(x, y, w, h, 2, 2, 'F')
      doc.setFillColor(...(box.color ?? COLORS.teal))
      doc.rect(x, y + 2, 1.2, h - 4, 'F')
      doc.setFontSize(7.5)
      doc.setTextColor(...COLORS.muted)
      doc.text(safe(box.label.toUpperCase()), x + 4, y + 6, { maxWidth: w - 6 })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.setTextColor(...COLORS.navy)
      doc.text(safe(box.value), x + 4, y + 15)
      doc.setFont('helvetica', 'normal')
      if (box.sub) {
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.muted)
        doc.text(safe(box.sub), x + 4, y + 20.5, { maxWidth: w - 6 })
      }
    })
    y += h + gap
  }
  doc.setTextColor(...COLORS.text)
  return y + 2
}

/** Table with the house style. Returns the y below the table. */
export function table(doc: jsPDF, y: number, options: Omit<UserOptions, 'startY'> & { head: RowInput[]; body: RowInput[] }): number {
  y = ensureSpace(doc, y, 20)
  let finalY = y
  const clean = (rows: RowInput[]) =>
    rows.map((row) => (Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? safe(cell) : cell)) : row))
  autoTable(doc, {
    theme: 'grid',
    margin: { left: PAGE.margin, right: PAGE.margin, top: 22, bottom: FOOTER_SPACE + 2 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: COLORS.text, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: COLORS.navy, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    ...options,
    head: clean(options.head),
    body: clean(options.body),
    startY: y,
    // Track where the table ended (works across page breaks).
    didDrawPage: (data) => {
      finalY = data.cursor?.y ?? finalY
    },
  })
  return finalY + 6
}

/** Horizontal bar chart drawn directly with jsPDF shapes. */
export function barChart(
  doc: jsPDF,
  y: number,
  items: Array<{ label: string; value: number; display: string }>,
  color: RGB = COLORS.teal,
): number {
  const rowH = 6.5
  y = ensureSpace(doc, y, items.length * rowH + 4)
  const labelW = 62
  const valueW = 30
  const barMax = CONTENT_WIDTH - labelW - valueW
  const max = Math.max(1, ...items.map((i) => i.value))
  doc.setFontSize(8)
  items.forEach((item, index) => {
    const rowY = y + index * rowH
    doc.setTextColor(...COLORS.text)
    doc.text(safe(item.label), PAGE.margin, rowY + 4, { maxWidth: labelW - 3 })
    doc.setFillColor(...COLORS.panel)
    doc.rect(PAGE.margin + labelW, rowY + 0.8, barMax, 4.2, 'F')
    doc.setFillColor(...color)
    doc.rect(PAGE.margin + labelW, rowY + 0.8, Math.max(0.5, (item.value / max) * barMax), 4.2, 'F')
    doc.setTextColor(...COLORS.muted)
    doc.text(safe(item.display), PAGE.width - PAGE.margin, rowY + 4, { align: 'right' })
  })
  doc.setTextColor(...COLORS.text)
  return y + items.length * rowH + 4
}

/** Footer on every page (+ running header from page 2), added once all content is drawn. */
export function addHeadersAndFooters(doc: jsPDF, runningTitle: string): void {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    if (page > 1) {
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.muted)
      doc.text('Kuroshio AI - EnergyIQ', PAGE.margin, 12)
      doc.text(safe(runningTitle), PAGE.width - PAGE.margin, 12, { align: 'right' })
      doc.setDrawColor(...COLORS.grey)
      doc.setLineWidth(0.2)
      doc.line(PAGE.margin, 14, PAGE.width - PAGE.margin, 14)
    }
    const y = PAGE.height - 10
    doc.setDrawColor(...COLORS.grey)
    doc.setLineWidth(0.2)
    doc.line(PAGE.margin, y - 5, PAGE.width - PAGE.margin, y - 5)
    doc.setFontSize(8)
    doc.setTextColor(146, 64, 14)
    doc.text('Sample data - for demonstration only', PAGE.margin, y)
    doc.setTextColor(...COLORS.muted)
    doc.text('www.kuroshioai.com', PAGE.width / 2, y, { align: 'center' })
    doc.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.margin, y, { align: 'right' })
  }
}

export function generatedLine(date = new Date()): string {
  return `Generated ${format(date, 'd MMM yyyy, HH:mm')}`
}
