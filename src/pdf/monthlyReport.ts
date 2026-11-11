import { EMISSION_FACTOR_NOTE } from '../lib/co2'
import { formatNumber } from '../lib/format'
import { reportFileName, type MonthlyReport } from '../lib/report'
import { TARIFF_NOTE } from '../lib/tariff'
import { COLORS, addHeadersAndFooters, createDoc, detailsGrid, drawCover, eyebrow, kpiBoxes, logoReady, paragraph, sectionTitle, signatures, table } from './pdfBase'

const right = { halign: 'right' as const }
const bold = (content: string) => ({ content, styles: { fontStyle: 'bold' as const } })

/** Header details shown on the report (same as the on-screen preview). */
export interface ReportDetails {
  recipient: string
  recipientSub: string
  reference: string
  issued: string
}

/**
 * Builds the monthly energy & SMDB report PDF and downloads it.
 * Same layout as the on-screen report: header band, details, summary boxes,
 * five numbered sections, sign-off lines and footer.
 */
export async function downloadMonthlyReport(report: MonthlyReport, scopeKey: string, details: ReportDetails): Promise<string> {
  await logoReady
  const doc = createDoc()
  const e = report.energy
  const title = 'Monthly Energy & SMDB Report'

  let y = drawCover(doc, title, [report.monthLabel])

  // ---------- Report details ----------
  y = detailsGrid(doc, y, [
    ['Prepared for', details.recipient],
    ['Client / scope', details.recipientSub],
    ['Reporting period', `${report.periodLabel}${report.isPartial ? ' (month to date)' : ''}`],
    ['Reference', details.reference],
    ['Issued', details.issued],
    ['Data source', 'Selec meters via Kuroshio IoT'],
  ])

  // ---------- Summary ----------
  y = eyebrow(doc, y, 'Summary')
  y = kpiBoxes(
    doc,
    y,
    [
      {
        label: 'Electricity',
        value: `${formatNumber(e.totalKwh / 1000, 1)} MWh`,
        sub: e.changePct === null ? `${e.days} days metered` : `${e.changePct > 0 ? '+' : ''}${e.changePct}% / day vs prior month`,
      },
      { label: 'Estimated cost', value: `AED ${formatNumber(report.cost.totalAed / 1000, 1)}k`, sub: 'DEWA tariff, indicative' },
      { label: 'Peak demand', value: `${formatNumber(e.peakKw)} kW`, sub: `${formatNumber(e.afterHoursPct, 0)}% used after hours` },
      { label: 'Waste identified', value: `AED ${formatNumber(report.waste.excessAed)}`, sub: `${report.waste.patterns.length} pattern${report.waste.patterns.length === 1 ? '' : 's'}` },
      { label: 'Scope 2 CO2', value: `${formatNumber(report.co2.tonnes, 1)} t`, sub: 'Indicative grid factor' },
    ],
    5,
  )
  y += 4

  // ---------- 1. Electricity by building ----------
  y = sectionTitle(doc, y, '1', 'Electricity by building')
  if (!e.days) {
    y = paragraph(doc, y, 'No meter data yet for this period.')
  } else {
    y = table(doc, y, {
      head: [['Building', 'Electricity', 'Share', 'EUI (kWh/m2/yr)', 'After hours']],
      body: [
        ...e.byBuilding.map((b) => [b.name, `${formatNumber(b.kwh / 1000, 1)} MWh`, `${formatNumber(e.totalKwh ? (b.kwh / e.totalKwh) * 100 : 0, 0)}%`, formatNumber(b.eui), `${formatNumber(b.afterHoursPct, 0)}%`]),
        [bold('Total'), bold(`${formatNumber(e.totalKwh / 1000, 1)} MWh`), bold('100%'), '', ''],
      ],
      columnStyles: { 1: right, 2: right, 3: right, 4: right },
    })
    const dayTypes = e.byDayType.map((d) => `${d.label} ${formatNumber(d.avgKwhPerDay)} kWh${d.vsWorkdayPct !== null ? ` (${d.vsWorkdayPct}% of a normal day)` : ''}`).join('  -  ')
    y = paragraph(doc, y, `Average per day by day type: ${dayTypes}.`)
  }

  // ---------- 2. Waste ----------
  y = sectionTitle(doc, y + 4, '2', 'Energy waste & savings opportunities')
  if (!report.waste.patterns.length) {
    y = paragraph(doc, y, 'No waste patterns were detected this month.')
  } else {
    y = table(doc, y, {
      head: [['Finding', 'Days', 'AED this month', 'AED / year*', 'Status']],
      body: report.waste.patterns.map((p) => [`${p.title}\n${p.site}`, p.days, formatNumber(p.aed), formatNumber(p.annualAed), p.status]),
      columnStyles: { 0: { cellWidth: 80 }, 1: right, 2: right, 3: right, 4: right },
    })
  }
  y = paragraph(doc, y, '* If the pattern continues unchanged. Actual savings are to be measured during the pilot.', { size: 8 })

  // ---------- 3. Cost ----------
  y = sectionTitle(doc, y + 4, '3', 'Estimated electricity cost')
  y = table(doc, y, {
    head: [['Site', 'DEWA account', 'kWh', 'AED', 'fils / kWh']],
    body: [
      ...report.cost.bySite.map((s) => [s.name, s.account, formatNumber(s.kwh), formatNumber(s.aed), s.filsPerKwh.toFixed(1)]),
      ...(report.cost.bySite.length > 1 ? [[bold('Total'), '', '', bold(formatNumber(report.cost.totalAed)), '']] : []),
    ],
    columnStyles: { 2: right, 3: right, 4: right },
  })
  if (report.cost.topCostCentres.length) {
    const centres = report.cost.topCostCentres.slice(0, 4).map((c) => `${c.name} (${c.site}) AED ${formatNumber(c.aed)}`).join('  -  ')
    y = paragraph(doc, y, `Largest cost centres: ${centres}.`)
  }
  y = paragraph(doc, y, TARIFF_NOTE, { size: 8 })

  // ---------- 4. Power quality, assets, actions ----------
  y = sectionTitle(doc, y + 4, '4', 'Power quality, asset health & actions')
  if (report.powerQuality.length) {
    y = table(doc, y, {
      head: [['Board', 'Finding', 'Value']],
      body: report.powerQuality.map((p) => [`${p.board} - ${p.site}`, p.issue, p.value]),
      columnStyles: { 2: right },
    })
  } else {
    y = paragraph(doc, y, 'All boards were within their power-quality limits at the time of the report.')
  }
  y = paragraph(
    doc,
    y,
    `${report.assets.monitored} monitored assets: ${report.assets.ok} healthy, ${report.assets.watch} under watch, ${report.assets.alert} in alert. ` +
      `${report.alerts.total} alerts (${report.alerts.critical} critical) and ${report.workOrders.raised} work orders raised, ${report.workOrders.closed} closed.`,
    { color: COLORS.text },
  )

  // ---------- 5. CO2 ----------
  y = sectionTitle(doc, y + 4, '5', 'Scope 2 emissions')
  y = paragraph(doc, y, `Estimated location-based Scope 2 emissions for the period: ${formatNumber(report.co2.tonnes, 1)} t CO2e.`, { color: COLORS.text, size: 10 })
  y = paragraph(doc, y, EMISSION_FACTOR_NOTE, { size: 8 })

  // ---------- Sign-off ----------
  signatures(doc, y + 4, [
    { role: 'Prepared by', title: 'Energy & MEP Engineer', org: 'Imdaad - FM provider' },
    { role: 'Reviewed by', title: 'FM Operations Manager', org: 'Imdaad - FM provider' },
  ])

  addHeadersAndFooters(doc, `${title} - ${report.monthLabel}`)
  const fileName = reportFileName(report.month, scopeKey)
  doc.save(fileName)
  return fileName
}
