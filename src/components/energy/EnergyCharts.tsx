import clsx from 'clsx'
import { addDays, format } from 'date-fns'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DAY_TYPE_COLORS, DAY_TYPE_LABELS } from '../../lib/calendar'
import { fromISODate } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import type { CalendarPeriod, DayType } from '../../types'

const AXIS = { fontSize: 12, fill: '#6a87c4' }
const PERIOD_DAY_TYPE: Record<CalendarPeriod['type'], DayType> = { holiday: 'holiday', ramadan: 'ramadan', shutdown: 'shutdown', event: 'event' }

export interface DailyPoint {
  t: number
  date: string
  kWh: number
  expected: number
  flagged: boolean
}

/** Legend chips for the calendar colours. */
export function PeriodLegend() {
  const types: DayType[] = ['holiday', 'ramadan', 'shutdown', 'event']
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-600">
      {types.map((t) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: DAY_TYPE_COLORS[t] }} />
          {DAY_TYPE_LABELS[t]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-600" />
        Expected
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-red-600" />
        Closed day with flagged waste
      </span>
    </div>
  )
}

/** Daily kWh with calendar periods as coloured background bands. */
export function DailyEnergyChart({ points, periods }: { points: DailyPoint[]; periods: CalendarPeriod[] }) {
  if (!points.length) return null
  const min = points[0].t
  const max = points[points.length - 1].t
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
          {periods.map((p) => {
            const x1 = Math.max(min, fromISODate(p.start).getTime())
            const x2 = Math.min(max, addDays(fromISODate(p.end), 1).getTime())
            return x2 > x1 ? <ReferenceArea key={p.id} x1={x1} x2={x2} fill={DAY_TYPE_COLORS[PERIOD_DAY_TYPE[p.type]]} fillOpacity={0.55} ifOverflow="hidden" /> : null
          })}
          <CartesianGrid stroke="#e3eaf8" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={[min, max]} tickFormatter={(t: number) => format(t, 'd MMM')} tick={AXIS} />
          <YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} tick={AXIS} width={44} />
          <Tooltip
            labelFormatter={(t) => format(Number(t), 'EEE d MMM yyyy')}
            formatter={(v, name) => [`${formatNumber(Number(v))} kWh`, name === 'expected' ? 'Expected' : 'Actual']}
          />
          <Area
            type="monotone"
            dataKey="kWh"
            stroke="#0f224b"
            fill="#0f224b"
            fillOpacity={0.08}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: DailyPoint; index?: number }) =>
              props.payload?.flagged ? (
                <circle key={props.index} cx={props.cx} cy={props.cy} r={3.5} fill="#dc2626" stroke="#fff" strokeWidth={1} />
              ) : (
                <g key={props.index} />
              )
            }
          />
          <Line type="monotone" dataKey="expected" stroke="#d97706" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 24 hourly bars for one day with the expected profile; after-hours bars in amber. */
export function HourlyChart({ hours, expected, afterHours }: { hours: number[]; expected?: number[]; afterHours: boolean[] }) {
  const data = hours.map((kWh, hour) => ({ hour: String(hour).padStart(2, '0'), kWh: Math.round(kWh), expected: expected ? Math.round(expected[hour]) : undefined, after: afterHours[hour] }))
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e3eaf8" vertical={false} />
          <XAxis dataKey="hour" tick={{ ...AXIS, fontSize: 10 }} interval={1} />
          <YAxis tick={{ ...AXIS, fontSize: 10 }} width={40} />
          <Tooltip formatter={(v, name) => [`${formatNumber(Number(v))} kWh`, name === 'expected' ? 'Expected' : 'Actual']} labelFormatter={(h) => `${h}:00`} />
          <Bar dataKey="kWh" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.hour} fill={d.after ? '#f59e0b' : '#2f4f92'} />
            ))}
          </Bar>
          {expected && <Line type="stepAfter" dataKey="expected" stroke="#023fa3" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Horizontal bars for a "share by category" breakdown. */
export function BreakdownBars({ rows }: { rows: Array<{ label: string; value: number; sub?: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,11rem)_1fr_7rem] items-center gap-3 text-sm">
          <span className="truncate text-navy-800">{r.label}</span>
          <span className="h-2.5 rounded-full bg-navy-50">
            <span className="block h-2.5 rounded-full bg-navy-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">
            {formatNumber(r.value / 1000, 1)} MWh
            {r.sub && <span className="block text-xs text-navy-500">{r.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Simple bar chart: one value per item. */
export function SimpleBarChart({ data, unit, color = '#2f4f92' }: { data: Array<{ label: string; value: number }>; unit: string; color?: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="#e3eaf8" vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 11 }} interval={0} />
          <YAxis tick={AXIS} width={44} />
          <Tooltip formatter={(v) => [`${formatNumber(Number(v))} ${unit}`, '']} />
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface HeatmapRow {
  date: string
  dayType: DayType
  hours: number[]
  flagged: boolean
}

/** Hour × day heatmap (one row per day). Darker = more energy. */
export function Heatmap({ rows, openHours }: { rows: HeatmapRow[]; openHours: [number, number] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.hours))
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[11rem_repeat(24,minmax(0,1fr))] gap-px text-[10px] text-navy-500">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className={clsx('text-center', (h < openHours[0] || h >= openHours[1]) && 'text-amber-700')}>
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </span>
          ))}
          {rows.map((row) => (
            <div key={row.date} className="contents">
              <span className={clsx('flex items-center gap-1.5 pr-2 text-xs', row.flagged ? 'font-semibold text-red-700' : 'text-navy-700')}>
                {format(fromISODate(row.date), 'EEE d MMM')}
                {row.dayType !== 'workday' && (
                  <span className="rounded px-1 text-[10px]" style={{ background: DAY_TYPE_COLORS[row.dayType] }}>
                    {DAY_TYPE_LABELS[row.dayType].split(' ')[0]}
                  </span>
                )}
              </span>
              {row.hours.map((kWh, h) => {
                const level = kWh / max
                return (
                  <span
                    key={h}
                    title={`${format(fromISODate(row.date), 'EEE d MMM')} ${String(h).padStart(2, '0')}:00 — ${formatNumber(kWh)} kWh`}
                    className="h-7 rounded-[3px]"
                    style={{ background: `rgba(15, 34, 75, ${0.06 + level * 0.9})` }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-navy-500">
          Low
          <span className="h-2 w-32 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(15,34,75,0.06), rgba(15,34,75,0.96))' }} />
          High · <span className="text-amber-700">amber hours</span> = outside opening hours · <span className="font-semibold text-red-700">red date</span> = flagged waste
        </div>
      </div>
    </div>
  )
}
