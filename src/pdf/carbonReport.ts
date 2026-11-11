import { format } from 'date-fns'
import type { CarbonOpportunity, CarbonSummary, MonthPoint } from '../lib/carbon'
import { EMISSION_FACTOR_NOTE, GRID_FACTOR_KG_PER_KWH } from '../lib/co2'
import { fromISODate } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { COLORS, addHeadersAndFooters, barChart, createDoc, detailsGrid, drawCover, ensureSpace, eyebrow, kpiBoxes, logoReady, paragraph, sectionTitle, signatures, table } from './pdfBase'

const right = { halign: 'right' as const }
const bold = (content: string) => ({ content, styles: { fontStyle: 'bold' as const } })
const t = (v: number, digits = 1) => `${formatNumber(v, digits)} t`

export interface CarbonReportInput {
  summary: CarbonSummary
  monthly: MonthPoint[]
  sites: Array<{ id: string; name: string }>
  opportunities: CarbonOpportunity[]
  periodLabel: string
  fileName: string
  recipient: string
  scopeLabel: string
  reference: string
  issued: string
}

/** Scope 2 carbon emissions report (same house style as the monthly report). Builds and downloads the PDF. */
export async function downloadCarbonReport(input: CarbonReportInput): Promise<string> {
  await logoReady
  const { summary: s, monthly, opportunities } = input
  const doc = createDoc()
  const title = 'Scope 2 Carbon Emissions Report'

  let y = drawCover(doc, title, [input.periodLabel])

  // ---------- Details ----------
  y = detailsGrid(doc, y, [
    ['Prepared for', input.recipient],
    ['Scope', input.scopeLabel],
    ['Reporting period', `${format(fromISODate(s.from), 'd MMM yyyy')} - ${format(fromISODate(s.to), 'd MMM yyyy')}`],
    ['Reference', input.reference],
    ['Method', 'Location-based (GHG Protocol)'],
    ['Issued', input.issued],
  ])

  // ---------- Summary ----------
  const avoidable = opportunities.reduce((sum, o) => sum + o.tonnesPerYear, 0)
  y = eyebrow(doc, y, 'Summary')
  y = kpiBoxes(
    doc,
    y,
    [
      { label: 'Scope 2 emissions', value: t(s.tonnes), sub: s.changePct === null ? `${s.days} days metered` : `${s.changePct > 0 ? '+' : ''}${s.changePct}% vs previous period` },
      { label: 'Electricity', value: `${formatNumber(s.kwh / 1000, 1)} MWh`, sub: 'Metered at the SMDBs' },
      { label: 'Grid factor (DEWA)', value: `${GRID_FACTOR_KG_PER_KWH.toFixed(2)} kg/kWh`, sub: 'Indicative' },
      { label: 'Carbon intensity', value: `${formatNumber(s.intensityKgM2Yr, 0)} kg/m2`, sub: 'kg CO2e per m2 per year' },
      { label: 'Avoidable', value: `${t(avoidable)}/yr`, sub: `${opportunities.length} open waste pattern${opportunities.length === 1 ? '' : 's'}`, color: avoidable > 0 ? COLORS.amber : COLORS.green },
    ],
    5,
  )
  y += 4

  // ---------- 1. By site ----------
  y = sectionTitle(doc, y, '1', 'Emissions by site')
  y = table(doc, y, {
    head: [['Site', 'Client', 'Electricity', 't CO2e', 'Share', 'kg CO2e/m2/yr']],
    body: [
      ...s.bySite.map((r) => [r.site.name, r.clientName, `${formatNumber(r.kwh / 1000, 1)} MWh`, formatNumber(r.tonnes, 1), `${formatNumber(r.sharePct, 0)}%`, formatNumber(r.intensityKgM2Yr, 0)]),
      ...(s.bySite.length > 1
        ? [[bold('Total'), '', bold(`${formatNumber(s.kwh / 1000, 1)} MWh`), bold(formatNumber(s.tonnes, 1)), bold('100%'), bold(formatNumber(s.intensityKgM2Yr, 0))]]
        : []),
    ],
    columnStyles: { 2: right, 3: right, 4: right, 5: right },
  })
  y = paragraph(
    doc,
    y,
    `Electricity used outside opening hours accounts for ${t(s.afterHoursTonnes)} (${formatNumber(s.tonnes ? (s.afterHoursTonnes / s.tonnes) * 100 : 0, 0)}%) of the emissions. Intensity is scaled to a full year.`,
  )

  // ---------- 2. By load type ----------
  y = sectionTitle(doc, y + 4, '2', 'Emissions by type of load')
  y = table(doc, y, {
    head: [['Load type', 't CO2e', 'Share']],
    body: s.byLoadType.map((l) => [l.label, formatNumber(l.tonnes, 1), `${formatNumber(l.sharePct, 0)}%`]),
    columnStyles: { 1: right, 2: right },
  })

  // ---------- 3. Monthly trend ----------
  // Keep the heading with its chart (12 rows).
  y = ensureSpace(doc, y + 4, monthly.length * 6.5 + 22)
  y = sectionTitle(doc, y, '3', 'Monthly trend (last 12 months)')
  y = barChart(
    doc,
    y,
    monthly.map((m) => ({ label: format(fromISODate(`${m.month}-01`), 'MMMM yyyy'), value: Number(m.total), display: t(Number(m.total)) })),
  )
  y = paragraph(doc, y, 'The current month is shown to date. Summer months are higher because of cooling load.', { size: 8 })

  // ---------- 4. Opportunities ----------
  y = sectionTitle(doc, y + 4, '4', 'Reduction opportunities')
  if (opportunities.length) {
    y = table(doc, y, {
      head: [['Finding', 'Site', 't CO2e / year*', 'AED / year*']],
      body: [
        ...opportunities.map((o) => [o.title, o.siteName, formatNumber(o.tonnesPerYear, 1), formatNumber(o.aedPerYear)]),
        [bold('Total'), '', bold(formatNumber(avoidable, 1)), bold(formatNumber(opportunities.reduce((sum, o) => sum + o.aedPerYear, 0)))],
      ],
      columnStyles: { 0: { cellWidth: 80 }, 2: right, 3: right },
    })
    y = paragraph(doc, y, '* If the pattern continues unchanged. Actual reductions are to be measured during the pilot.', { size: 8 })
  } else {
    y = paragraph(doc, y, 'No open energy waste patterns in the sites covered by this report.')
  }

  // ---------- 5. Method ----------
  y = sectionTitle(doc, y + 4, '5', 'Method and emission factor')
  y = paragraph(
    doc,
    y,
    'Scope 2 emissions are calculated with the location-based method of the GHG Protocol Scope 2 Guidance: ' +
      'electricity metered by Selec energy meters on each SMDB (read by Kuroshio IoT nodes) multiplied by the DEWA grid emission factor. ' +
      `t CO2e = kWh x ${GRID_FACTOR_KG_PER_KWH.toFixed(2)} kg CO2e/kWh / 1,000.`,
    { color: COLORS.text },
  )
  y = paragraph(doc, y, EMISSION_FACTOR_NOTE, { size: 8 })

  // ---------- Sign-off ----------
  signatures(doc, y + 4, [
    { role: 'Prepared by', title: 'Energy & MEP Engineer', org: 'Imdaad - FM provider' },
    { role: 'Reviewed by', title: 'FM Operations Manager', org: 'Imdaad - FM provider' },
  ])

  addHeadersAndFooters(doc, `${title} - ${input.periodLabel}`)
  doc.save(input.fileName)
  return input.fileName
}
