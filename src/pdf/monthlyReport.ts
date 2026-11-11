import { format } from 'date-fns'
import { EMISSION_FACTOR_NOTE, GRID_FACTOR_KG_PER_KWH } from '../lib/co2'
import { fromISODate } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { reportFileName, type MonthlyReport } from '../lib/report'
import { TARIFF_NOTE } from '../lib/tariff'
import { COLORS, addHeadersAndFooters, barChart, createDoc, drawCover, generatedLine, kpiBoxes, paragraph, sectionTitle, table } from './pdfBase'

const kwh = (value: number) => `${formatNumber(Math.round(value))} kWh`
const aed = (value: number) => `AED ${formatNumber(Math.round(value))}`
const dateShort = (iso: string) => format(fromISODate(iso), 'd MMM yyyy')
const right = { halign: 'right' as const }

/** Builds the monthly energy & SMDB report PDF (for Imdaad to send to its client) and downloads it. */
export function downloadMonthlyReport(report: MonthlyReport, scopeKey: string): string {
  const doc = createDoc()
  const e = report.energy
  let y = drawCover(doc, `Monthly Energy & SMDB Report - ${report.monthLabel}`, [
    `${report.scopeLabel}`,
    `Period: ${report.periodLabel}  ·  ${generatedLine(new Date(report.generatedAt))}`,
  ])
  let n = 0
  const next = () => String(++n)

  if (report.isPartial) y = paragraph(doc, y, 'This month is still in progress: all figures are month-to-date.', { italic: true })

  // ---------- 1. Executive summary ----------
  y = sectionTitle(doc, y, next(), 'Executive summary')
  y = kpiBoxes(doc, y, [
    {
      label: 'Electricity',
      value: `${formatNumber(e.totalKwh / 1000, 1)} MWh`,
      sub: e.changePct === null ? `${e.days} days of meter data` : `${e.changePct > 0 ? '+' : ''}${e.changePct}% per day vs last month`,
      color: COLORS.navyLight,
    },
    { label: 'Estimated cost', value: aed(report.cost.totalAed), sub: 'DEWA tariff (indicative)' },
    { label: 'Peak demand', value: `${formatNumber(e.peakKw)} kW`, sub: 'Highest daily peak', color: COLORS.navyLight },
    { label: 'Scope 2 CO2', value: `${formatNumber(report.co2.tonnes, 1)} t`, sub: `@ ${GRID_FACTOR_KG_PER_KWH} kg/kWh (indicative)`, color: COLORS.green },
    { label: 'Waste found', value: aed(report.waste.excessAed), sub: `${report.waste.patterns.length} pattern(s) this month`, color: report.waste.patterns.length ? COLORS.amber : COLORS.green },
    { label: 'Alerts', value: String(report.alerts.total), sub: `${report.alerts.critical} critical`, color: report.alerts.critical ? COLORS.red : COLORS.amber },
    { label: 'Work orders', value: String(report.workOrders.raised), sub: `${report.workOrders.closed} closed · ${report.workOrders.open} open` },
    { label: 'Data completeness', value: `${report.devices.completenessPct.toFixed(1)}%`, sub: `${report.devices.online}/${report.devices.nodes} IoT nodes online` },
  ])
  const highlights: string[] = []
  if (e.bySite[0] && e.bySite.length > 1) highlights.push(`Largest consumer: ${e.bySite[0].name} (${formatNumber(e.bySite[0].sharePct, 0)}% of electricity).`)
  if (report.waste.patterns[0]) highlights.push(`Biggest waste pattern: ${report.waste.patterns[0].title} - about ${aed(report.waste.patterns[0].annualAed)} per year if not fixed.`)
  if (report.assets.alert + report.assets.watch) highlights.push(`${report.assets.alert + report.assets.watch} monitored asset(s) need attention (see Asset health).`)
  if (report.powerQuality.length) highlights.push(`${report.powerQuality.length} power-quality finding(s) on the SMDBs (see Power quality).`)
  if (highlights.length) y = paragraph(doc, y, highlights.map((h) => `-  ${h}`).join('\n'), { color: COLORS.text })

  // ---------- 2. Energy ----------
  y = sectionTitle(doc, y + 2, next(), 'Electricity by site and building')
  if (!e.days) {
    y = paragraph(doc, y, 'No meter data yet for this period.')
  } else {
    if (e.bySite.length > 1) {
      y = table(doc, y, {
        head: [['Site', 'Client', 'Electricity', 'Share']],
        body: [
          ...e.bySite.map((s) => [s.name, s.client, kwh(s.kwh), `${formatNumber(s.sharePct, 1)}%`]),
          [{ content: 'Total', styles: { fontStyle: 'bold' } }, '', { content: kwh(e.totalKwh), styles: { fontStyle: 'bold' } }, '100%'],
        ],
        columnStyles: { 2: right, 3: right },
      })
    }
    y = barChart(doc, y, e.byBuilding.map((b) => ({ label: b.name, value: b.kwh, display: `${formatNumber(b.kwh / 1000, 1)} MWh` })), COLORS.navyLight)
    y = table(doc, y, {
      head: [['Building', 'Electricity', 'EUI (kWh/m2/yr)', 'After-hours share']],
      body: e.byBuilding.map((b) => [b.name, kwh(b.kwh), formatNumber(b.eui), `${formatNumber(b.afterHoursPct, 0)}%`]),
      columnStyles: { 1: right, 2: right, 3: right },
    })
    y = paragraph(doc, y, 'Average electricity per day by day type', { size: 10, color: COLORS.navy })
    y = table(doc, y, {
      head: [['Day type', 'Days', 'Avg per day', 'vs normal day']],
      body: e.byDayType.map((d) => [d.label, d.days, kwh(d.avgKwhPerDay), d.vsWorkdayPct === null ? '-' : `${d.vsWorkdayPct}%`]),
      columnStyles: { 1: right, 2: right, 3: right },
    })
    if (e.dataThrough) y = paragraph(doc, y, `Meter data through ${dateShort(e.dataThrough)}. Day types follow each site's opening hours and the operating calendar (UAE public holidays, Ramadan, shutdowns). Each % compares the same sites' normal days.`)
  }

  // ---------- 3. Waste ----------
  y = sectionTitle(doc, y + 2, next(), 'Energy waste & savings opportunities')
  if (!report.waste.patterns.length) {
    y = paragraph(doc, y, 'No waste patterns detected this month.')
  } else {
    y = table(doc, y, {
      head: [['Pattern', 'Site', 'Days', 'Excess', 'AED (month)', 'AED / yr if not fixed', 'Status']],
      body: report.waste.patterns.map((p) => [p.title, p.site, p.days, kwh(p.excessKwh), formatNumber(p.aed), formatNumber(p.annualAed), p.status]),
      columnStyles: { 2: right, 3: right, 4: right, 5: right },
      headStyles: { fillColor: COLORS.amber },
    })
    y = paragraph(doc, y, 'Excess = metered energy above the expected use for the site\'s opening hours and day type. Annual figures assume the pattern continues; savings are to be measured during the pilot.', { italic: true, size: 8.5 })
  }

  // ---------- 4. Cost ----------
  y = sectionTitle(doc, y + 2, next(), 'Estimated electricity cost & recharge')
  y = table(doc, y, {
    head: [['Site', 'DEWA account', 'Electricity', 'Estimated charges', 'Avg fils/kWh']],
    body: report.cost.bySite.map((s) => [s.name, s.account, kwh(s.kwh), aed(s.aed), s.filsPerKwh.toFixed(1)]),
    columnStyles: { 2: right, 3: right, 4: right },
  })
  if (report.cost.topCostCentres.length) {
    y = paragraph(doc, y, 'Largest cost centres (sub-metered recharge)', { size: 10, color: COLORS.navy })
    y = table(doc, y, {
      head: [['Site', 'Cost centre', 'Electricity', 'Recharge']],
      body: report.cost.topCostCentres.map((c) => [c.site, c.name, kwh(c.kwh), aed(c.aed)]),
      columnStyles: { 2: right, 3: right },
    })
  }
  y = paragraph(doc, y, TARIFF_NOTE, { italic: true, size: 8.5 })

  // ---------- 5. CO2 ----------
  y = sectionTitle(doc, y + 2, next(), 'Scope 2 CO2 estimate (indicative)')
  y = table(doc, y, {
    head: [['Site', 't CO2e']],
    body: [...report.co2.bySite.map((s) => [s.name, formatNumber(s.tonnes, 1)]), [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: formatNumber(report.co2.tonnes, 1), styles: { fontStyle: 'bold' } }]],
    columnStyles: { 1: right },
  })
  y = paragraph(doc, y, EMISSION_FACTOR_NOTE, { italic: true, size: 8.5 })

  // ---------- 6. Power quality ----------
  y = sectionTitle(doc, y + 2, next(), 'Power quality (snapshot at report time)')
  y = report.powerQuality.length
    ? table(doc, y, { head: [['SMDB', 'Site', 'Finding', 'Value']], body: report.powerQuality.map((p) => [p.board, p.site, p.issue, p.value]), columnStyles: { 3: right } })
    : paragraph(doc, y, 'All boards within their power-quality limits.')

  // ---------- 7. Alerts, assets, work orders ----------
  y = sectionTitle(doc, y + 2, next(), 'Alerts, asset health & work orders')
  y = kpiBoxes(doc, y, [
    { label: 'Alerts', value: String(report.alerts.total), sub: report.alerts.bySource.map((s) => `${s.count} ${s.label}`).join(' · ') || 'None' },
    { label: 'Acknowledged', value: report.alerts.acknowledgedPct === null ? '-' : `${report.alerts.acknowledgedPct}%` },
    { label: 'Monitored assets', value: String(report.assets.monitored), sub: `${report.assets.ok} OK · ${report.assets.watch} watch · ${report.assets.alert} alert` },
    { label: 'Work orders', value: String(report.workOrders.raised), sub: `${report.workOrders.closed} closed` },
  ])
  if (report.assets.issues.length) {
    y = table(doc, y, {
      head: [['Asset', 'Site', 'Health', 'Finding']],
      body: report.assets.issues.map((a) => [a.name, a.site, `${a.health}/100`, a.issue]),
      columnStyles: { 2: right },
    })
  }
  if (report.alerts.list.length) {
    y = table(doc, y, { head: [['Date', 'Alert', 'Where', 'Severity']], body: report.alerts.list.map((a) => [a.date, a.title, a.site, a.severity]) })
  }
  if (report.workOrders.list.length) {
    table(doc, y, { head: [['Work order', 'Title', 'Site', 'Status']], body: report.workOrders.list.map((w) => [w.id, w.title, w.site, w.status]) })
  }

  addHeadersAndFooters(doc, `Monthly Energy & SMDB Report - ${report.monthLabel}`)
  const fileName = reportFileName(report.month, scopeKey)
  doc.save(fileName)
  return fileName
}
