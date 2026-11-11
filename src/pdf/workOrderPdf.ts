import { format } from 'date-fns'
import { ROLE_LABELS } from '../auth/roles'
import { getAsset } from '../data/assets'
import { getBuilding, getClient, getSite } from '../data/sites'
import { getSmdb } from '../data/smdbs'
import { formatDuration } from '../lib/format'
import { WO_PRIORITY_LABELS, WO_SOURCE_LABELS, WO_STATUS_LABELS, workOrderAgeHours } from '../lib/workOrders'
import type { Actor, WorkOrder } from '../types'
import { COLORS, addHeadersAndFooters, createDoc, drawCover, generatedLine, kpiBoxes, sectionTitle, table } from './pdfBase'

const when = (iso?: string) => (iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : '-')
const role = (actor: Actor) => (actor.role === 'system' ? 'System' : ROLE_LABELS[actor.role])

/** Single work-order PDF (e.g. to attach in Imdaad's CAFM system): details and history. */
export function downloadWorkOrderPdf(wo: WorkOrder): string {
  const doc = createDoc()
  const site = getSite(wo.siteId)
  let y = drawCover(doc, `Work order ${wo.id}`, [`${site?.name ?? wo.siteId}  ·  ${getClient(site?.clientId ?? '')?.name ?? ''}`, generatedLine()])

  y = kpiBoxes(doc, y, [
    { label: 'Status', value: WO_STATUS_LABELS[wo.status], color: wo.status === 'closed' ? COLORS.green : COLORS.amber },
    { label: 'Priority', value: WO_PRIORITY_LABELS[wo.priority], color: wo.priority === 'high' ? COLORS.red : COLORS.amber },
    { label: 'Raised from', value: WO_SOURCE_LABELS[wo.source], color: COLORS.navyLight },
    { label: wo.closedAt ? 'Time to close' : 'Open for', value: formatDuration(workOrderAgeHours(wo) * 3_600_000) },
  ])

  y = sectionTitle(doc, y, '', 'Details')
  y = table(doc, y, {
    head: [['Field', 'Value']],
    body: [
      ['Title', wo.title],
      ['Description', wo.description],
      ['Site', site?.name ?? wo.siteId],
      ['Building', getBuilding(wo.buildingId)?.name ?? wo.buildingId],
      ['SMDB / meter', wo.smdbId ? `${getSmdb(wo.smdbId)?.name ?? wo.smdbId} (${getSmdb(wo.smdbId)?.meterId ?? ''})` : '-'],
      ['Asset', wo.assetId ? `${getAsset(wo.assetId)?.name ?? ''} (${wo.assetId})` : '-'],
      ['Alert', wo.alertId ?? '-'],
      ['CAFM reference', wo.cafmRef ?? 'Not sent yet'],
      ['Created', `${when(wo.createdAt)} by ${wo.createdBy.name}`],
      ['Closed', when(wo.closedAt)],
      ['Closing remark', wo.closeRemark ?? '-'],
    ],
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } },
  })

  y = sectionTitle(doc, y, '', 'History')
  table(doc, y, {
    head: [['Date / time', 'By', 'Role', 'Event']],
    body: wo.history.map((e) => [when(e.at), e.by.name, role(e.by), e.text]),
  })

  addHeadersAndFooters(doc, `Work order ${wo.id}`)
  const fileName = `EnergyIQ-WorkOrder-${wo.id}.pdf`
  doc.save(fileName)
  return fileName
}
