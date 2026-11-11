import { getClient } from '../data/sites'
import { getSmdb } from '../data/smdbs'
import type { MonthlyBilling, SiteBill } from '../lib/billing'
import { formatNumber } from '../lib/format'
import { TARIFF_NOTE } from '../lib/tariff'
import { COLORS, addHeadersAndFooters, barChart, createDoc, drawCover, generatedLine, kpiBoxes, paragraph, sectionTitle, table } from './pdfBase'

/** One site's monthly recharge statement: estimated bill and split per cost centre. */
export function downloadRechargePdf(billing: MonthlyBilling, bill: SiteBill): string {
  const doc = createDoc()
  let y = drawCover(doc, `Electricity recharge statement — ${billing.label}`, [
    `${bill.site.name}  ·  ${getClient(bill.site.clientId)?.name ?? ''}  ·  DEWA account ${bill.site.dewaAccount}`,
    `${billing.partial ? 'Month to date' : 'Full month'} · ${bill.days} days of metered data · ${generatedLine()}`,
  ])

  y = kpiBoxes(doc, y, [
    { label: 'Metered energy', value: `${formatNumber(bill.kWh)} kWh`, color: COLORS.navyLight },
    { label: 'Estimated charges', value: `AED ${formatNumber(bill.totalAed)}`, sub: 'Incl. fuel surcharge' },
    { label: 'Average rate', value: `${bill.avgFilsPerKwh.toFixed(1)} fils`, sub: 'per kWh' },
    { label: 'Cost centres', value: String(bill.costCentres.length), color: COLORS.amber },
  ])

  y = sectionTitle(doc, y, '1', 'Recharge by cost centre')
  y = table(doc, y, {
    head: [['Cost centre', 'Meters', 'kWh', 'Share', 'Recharge (AED)']],
    body: [
      ...bill.costCentres.map((c) => [
        c.name,
        c.smdbIds.map((id) => getSmdb(id)?.meterId ?? id).join(', '),
        formatNumber(c.kWh),
        `${c.sharePct.toFixed(1)}%`,
        formatNumber(c.aed),
      ]),
      [{ content: 'Site total', styles: { fontStyle: 'bold' } }, '', formatNumber(bill.kWh), '100%', { content: formatNumber(bill.totalAed), styles: { fontStyle: 'bold' } }],
    ],
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })
  y = barChart(
    doc,
    y,
    bill.costCentres.map((c) => ({ label: c.name, value: c.kWh, display: `${formatNumber(c.kWh)} kWh` })),
  )

  y = sectionTitle(doc, y, '2', 'How the charge is estimated')
  y = table(doc, y, {
    head: [['Component', 'AED']],
    body: [
      ['Energy charge (DEWA commercial slabs)', formatNumber(bill.energyAed)],
      ['Fuel surcharge', formatNumber(bill.fuelAed)],
      ['Total', formatNumber(bill.totalAed)],
    ],
    columnStyles: { 1: { halign: 'right' } },
  })
  paragraph(doc, y, `${TARIFF_NOTE} Each cost centre is charged its metered kWh at the site's average rate. Meter readings come from Selec energy meters on each SMDB, read by Kuroshio IoT nodes.`, {
    italic: true,
    size: 8.5,
  })

  addHeadersAndFooters(doc, `${bill.site.shortName} recharge · ${billing.label}`)
  const fileName = `EnergyIQ-Recharge-${bill.site.id}-${billing.month}.pdf`
  doc.save(fileName)
  return fileName
}
