import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable, { type RowInput, type UserOptions } from 'jspdf-autotable'

/**
 * Shared building blocks for every PDF (monthly report, recharge statement,
 * work order): A4 portrait, millimetre units. Same look as the on-screen
 * report: Kuroshio-blue header band, light-blue summary boxes, numbered
 * section markers, light-blue table headers with zebra rows, grey footer band.
 */
export const PAGE = { width: 210, height: 297, margin: 15 } as const
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2
const FOOTER_SPACE = 18

type RGB = [number, number, number]
export const COLORS: Record<
  'navy' | 'navyLight' | 'teal' | 'brand' | 'brandSoft' | 'amber' | 'red' | 'green' | 'grey' | 'text' | 'muted' | 'panel' | 'line',
  RGB
> = {
  navy: [15, 34, 75], // navy-900: text
  navyLight: [47, 79, 146], // navy-600
  teal: [1, 76, 195], // Kuroshio logo blue (kept for older callers)
  brand: [1, 76, 195], // Kuroshio logo blue #014CC3
  brandSoft: [238, 244, 255], // teal-50: table headers, summary boxes
  amber: [217, 119, 6],
  red: [220, 38, 38],
  green: [22, 163, 74],
  grey: [197, 211, 238], // navy-200
  text: [15, 34, 75],
  muted: [71, 102, 168], // navy-500
  panel: [243, 246, 253], // navy-50
  line: [227, 234, 248], // navy-100
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
    .replace(/²/g, '2')
    .replace(/[^\x20-\x7E -ÿ\n]/g, '')
}

export function createDoc(): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  return doc
}

/**
 * White Kuroshio logo for the header band. jsPDF needs the image as data, so it
 * is loaded as soon as this module loads; `logoReady` resolves when it is there
 * (or failed: the header is then drawn without it).
 */
let logoDataUrl: string | null = null
const LOGO_RATIO = 203 / 320 // height / width of public/kuroshio-logo-white.png
export const logoReady: Promise<void> = fetch(`${import.meta.env.BASE_URL}kuroshio-logo-white.png`)
  .then((res) => res.blob())
  .then(
    (blob) =>
      new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          logoDataUrl = typeof reader.result === 'string' ? reader.result : null
          resolve()
        }
        reader.onerror = () => resolve()
        reader.readAsDataURL(blob)
      }),
  )
  .catch(() => undefined)

/**
 * Brand-blue header band on page 1: logo, product line, sample tag, title and
 * sub-lines. Returns the y position below it.
 */
export function drawCover(doc: jsPDF, title: string, lines: string[]): number {
  const height = 40 + lines.length * 5
  doc.setFillColor(...COLORS.brand)
  doc.rect(0, 0, PAGE.width, height, 'F')

  // Logo + product line
  let textX = PAGE.margin
  if (logoDataUrl) {
    const w = 14
    doc.addImage(logoDataUrl, 'PNG', PAGE.margin, 8, w, w * LOGO_RATIO)
    textX = PAGE.margin + w + 3
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Kuroshio AI  -  EnergyIQ', textX, 12.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(220, 232, 254)
  doc.text('Prepared for Imdaad', textX, 16.5)

  // "Sample data" tag, top right
  const tag = 'SAMPLE DATA - FOR DEMONSTRATION ONLY'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  const tagWidth = doc.getTextWidth(tag) + 6
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.setFillColor(26, 96, 205)
  doc.roundedRect(PAGE.width - PAGE.margin - tagWidth, 9, tagWidth, 6.5, 1, 1, 'FD')
  doc.setTextColor(255, 255, 255)
  doc.text(tag, PAGE.width - PAGE.margin - tagWidth + 3, 13.4)

  // Title + sub-lines
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(255, 255, 255)
  doc.text(safe(title), PAGE.margin, 31)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(220, 232, 254)
  lines.forEach((line, i) => doc.text(safe(line), PAGE.margin, 38 + i * 5))

  doc.setTextColor(...COLORS.text)
  doc.setFont('helvetica', 'normal')
  return height + 10
}

/** Two-column "label: value" grid (report details). Returns the y below it. */
export function detailsGrid(doc: jsPDF, y: number, pairs: Array<[string, string]>): number {
  const colW = CONTENT_WIDTH / 2
  const labelW = 30
  const rowH = 6
  const rows = Math.ceil(pairs.length / 2)
  y = ensureSpace(doc, y, rows * rowH + 6)
  doc.setFontSize(9)
  pairs.forEach(([label, value], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = PAGE.margin + col * colW
    const ry = y + row * rowH
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.muted)
    doc.text(safe(label), x, ry)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.navy)
    doc.text(safe(value), x + labelW, ry, { maxWidth: colW - labelW - 4 })
  })
  const end = y + rows * rowH
  doc.setDrawColor(...COLORS.line)
  doc.setLineWidth(0.3)
  doc.line(PAGE.margin, end, PAGE.width - PAGE.margin, end)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  return end + 8
}

/** Adds a new page when there isn't `needed` mm left. Returns the y to draw at. */
export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE.height - FOOTER_SPACE) return y
  doc.addPage()
  return 24
}

/** Small uppercase label above a block (e.g. "SUMMARY"). */
export function eyebrow(doc: jsPDF, y: number, text: string): number {
  y = ensureSpace(doc, y, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(safe(text.toUpperCase()), PAGE.margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
  return y + 4
}

/** Section heading with a blue numbered marker (number may be empty). */
export function sectionTitle(doc: jsPDF, y: number, number: string, title: string): number {
  y = ensureSpace(doc, y, 30)
  let x = PAGE.margin
  if (number) {
    doc.setFillColor(...COLORS.brand)
    doc.roundedRect(PAGE.margin, y - 5, 6.5, 6.5, 0.8, 0.8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(number, PAGE.margin + 3.25, y - 0.6, { align: 'center' })
    x = PAGE.margin + 9.5
  } else {
    doc.setFillColor(...COLORS.brand)
    doc.rect(PAGE.margin, y - 4.5, 1.4, 6, 'F')
    x = PAGE.margin + 4
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...COLORS.navy)
  doc.text(safe(title), x, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.text)
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
  /** Colour of the left edge (defaults to brand blue). */
  color?: RGB
}

/** Row(s) of summary boxes: light blue with a coloured left edge. */
export function kpiBoxes(doc: jsPDF, y: number, boxes: KpiBox[], perRow = 4): number {
  const gap = 3
  const w = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow
  const h = 21
  for (let i = 0; i < boxes.length; i += perRow) {
    y = ensureSpace(doc, y, h + 4)
    boxes.slice(i, i + perRow).forEach((box, j) => {
      const x = PAGE.margin + j * (w + gap)
      doc.setFillColor(...COLORS.brandSoft)
      doc.rect(x, y, w, h, 'F')
      doc.setFillColor(...(box.color ?? COLORS.brand))
      doc.rect(x, y, 1.2, h, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...COLORS.navyLight)
      doc.text(safe(box.label), x + 3.5, y + 5.5, { maxWidth: w - 5 })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(perRow > 4 ? 12 : 14)
      doc.setTextColor(...COLORS.navy)
      doc.text(safe(box.value), x + 3.5, y + 12.5)
      doc.setFont('helvetica', 'normal')
      if (box.sub) {
        doc.setFontSize(6.5)
        doc.setTextColor(...COLORS.muted)
        doc.text(safe(box.sub), x + 3.5, y + 17, { maxWidth: w - 5 })
      }
    })
    y += h + gap
  }
  doc.setTextColor(...COLORS.text)
  return y + 3
}

/** Table in the house style (light-blue header, zebra rows, thin lines). Returns the y below it. */
export function table(doc: jsPDF, y: number, options: Omit<UserOptions, 'startY'> & { head: RowInput[]; body: RowInput[] }): number {
  y = ensureSpace(doc, y, 20)
  let finalY = y
  const clean = (rows: RowInput[]) => rows.map((row) => (Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? safe(cell) : cell)) : row))
  autoTable(doc, {
    theme: 'plain',
    margin: { left: PAGE.margin, right: PAGE.margin, top: 24, bottom: FOOTER_SPACE + 2 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, textColor: COLORS.text, lineColor: COLORS.line, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: COLORS.brandSoft, textColor: COLORS.navy, fontStyle: 'bold', fontSize: 8, lineWidth: { bottom: 0.4 }, lineColor: COLORS.grey },
    alternateRowStyles: { fillColor: [248, 250, 254] },
    tableLineColor: COLORS.line,
    tableLineWidth: 0.2,
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
export function barChart(doc: jsPDF, y: number, items: Array<{ label: string; value: number; display: string }>, color: RGB = COLORS.brand): number {
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
    doc.setFillColor(...COLORS.line)
    doc.rect(PAGE.margin + labelW, rowY + 1.4, barMax, 3, 'F')
    doc.setFillColor(...color)
    doc.rect(PAGE.margin + labelW, rowY + 1.4, Math.max(0.5, (item.value / max) * barMax), 3, 'F')
    doc.setTextColor(...COLORS.muted)
    doc.text(safe(item.display), PAGE.width - PAGE.margin, rowY + 4, { align: 'right' })
  })
  doc.setTextColor(...COLORS.text)
  return y + items.length * rowH + 4
}

/** Signature lines side by side ("Prepared by" / "Reviewed by"). Returns the y below. */
export function signatures(doc: jsPDF, y: number, people: Array<{ role: string; title: string; org: string }>): number {
  y = ensureSpace(doc, y + 8, 32)
  const gap = 12
  const w = (CONTENT_WIDTH - gap * (people.length - 1)) / people.length
  people.forEach((p, i) => {
    const x = PAGE.margin + i * (w + gap)
    doc.setDrawColor(...COLORS.grey)
    doc.setLineWidth(0.3)
    doc.line(x, y + 10, x + w, y + 10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.muted)
    doc.text(safe(p.role.toUpperCase()), x, y + 15)
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.navy)
    doc.text(safe(p.title), x, y + 20)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(safe(p.org), x, y + 24.5)
  })
  doc.setTextColor(...COLORS.text)
  return y + 30
}

/** Grey footer band on every page (+ running header from page 2), added once all content is drawn. */
export function addHeadersAndFooters(doc: jsPDF, runningTitle: string): void {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    if (page > 1) {
      doc.setFillColor(...COLORS.brand)
      doc.rect(0, 0, PAGE.width, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.brand)
      doc.text('Kuroshio AI - EnergyIQ', PAGE.margin, 12)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.muted)
      doc.text(safe(runningTitle), PAGE.width - PAGE.margin, 12, { align: 'right' })
      doc.setDrawColor(...COLORS.line)
      doc.setLineWidth(0.3)
      doc.line(PAGE.margin, 15, PAGE.width - PAGE.margin, 15)
    }
    const bandY = PAGE.height - 12
    doc.setFillColor(...COLORS.panel)
    doc.rect(0, bandY, PAGE.width, 12, 'F')
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.3)
    doc.line(0, bandY, PAGE.width, bandY)
    const y = bandY + 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(180, 83, 9)
    doc.text('Sample data - for demonstration only', PAGE.margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.muted)
    doc.text('Kuroshio AI - www.kuroshioai.com', PAGE.width / 2, y, { align: 'center' })
    doc.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.margin, y, { align: 'right' })
  }
}

export function generatedLine(date = new Date()): string {
  return `Generated ${format(date, 'd MMM yyyy, HH:mm')}`
}
