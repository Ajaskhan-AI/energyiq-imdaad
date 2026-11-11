import clsx from 'clsx'
import { format } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { HEALTH_TONE } from '../../lib/predictive'
import { HEALTH_LABELS, type DayPoint, type HealthStatus, type SpectrumBin } from '../../sim/predictiveModel'
import { Badge } from '../ui/Badge'

const AXIS = { fontSize: 12, fill: '#6a87c4' }

export function HealthBadge({ status }: { status: HealthStatus }) {
  return <Badge tone={HEALTH_TONE[status]}>{HEALTH_LABELS[status]}</Badge>
}

/** Score bar coloured by band (OK ≥ 80, Watch 60–79, Alert < 60). */
export function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full rounded-full bg-navy-50">
        <div className={clsx('h-2 rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-navy-900">{score}</span>
    </div>
  )
}

/** Tiny 60-day health line for list rows. */
export function HealthSparkline({ points, status }: { points: DayPoint[]; status: HealthStatus }) {
  const stroke = status === 'ok' ? '#16a34a' : status === 'watch' ? '#d97706' : '#dc2626'
  return (
    <div className="h-8 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <YAxis domain={[0, 100]} hide />
          <Line type="monotone" dataKey="health" stroke={stroke} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Health score over 60 days with the OK / Watch / Alert bands shaded. */
export function HealthTrendChart({ points, resetAt }: { points: DayPoint[]; resetAt?: string }) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <ReferenceArea y1={80} y2={100} fill="#16a34a" fillOpacity={0.07} />
          <ReferenceArea y1={60} y2={80} fill="#d97706" fillOpacity={0.08} />
          <ReferenceArea y1={0} y2={60} fill="#dc2626" fillOpacity={0.06} />
          <CartesianGrid stroke="#e3eaf8" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => format(t, 'd MMM')} tick={AXIS} />
          <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={AXIS} />
          <Tooltip labelFormatter={(t) => format(Number(t), 'd MMM yyyy')} formatter={(v) => [`${v} / 100`, 'Health']} />
          {resetAt && (
            <ReferenceLine x={new Date(resetAt).setHours(0, 0, 0, 0)} stroke="#014cc3" strokeDasharray="4 4" label={{ value: 'Resolved', fill: '#023fa3', fontSize: 11, position: 'insideTopLeft' }} />
          )}
          <Line type="monotone" dataKey="health" stroke="#0f224b" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Motor current per day against the asset's normal band. */
export function CurrentBandChart({ points, band }: { points: DayPoint[]; band: [number, number] }) {
  const values = points.map((p) => p.currentA)
  const min = Math.floor(Math.min(band[0], ...values) * 0.95)
  const max = Math.ceil(Math.max(band[1], ...values) * 1.05)
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
          <ReferenceArea y1={band[0]} y2={band[1]} fill="#014cc3" fillOpacity={0.12} label={{ value: 'Normal band', position: 'insideTopLeft', fill: '#023fa3', fontSize: 11 }} />
          <CartesianGrid stroke="#e3eaf8" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => format(t, 'd MMM')} tick={AXIS} />
          <YAxis domain={[min, max]} tickFormatter={(v: number) => `${v} A`} tick={AXIS} />
          <Tooltip labelFormatter={(t) => format(Number(t), 'd MMM yyyy')} formatter={(v) => [`${v} A`, 'Motor current']} />
          <Line type="monotone" dataKey="currentA" stroke="#2f4f92" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Current signature: side-bands and harmonics (% of the 50 Hz fundamental) vs normal. */
export function SpectrumChart({ bins }: { bins: SpectrumBin[] }) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 10, right: 12, bottom: 0, left: -18 }} barGap={2}>
          <CartesianGrid stroke="#e3eaf8" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} interval={0} />
          <YAxis tickFormatter={(v: number) => `${v}%`} tick={AXIS} />
          <Tooltip formatter={(v, name) => [`${v}% of fundamental`, name === 'normal' ? 'Normal' : 'Now']} />
          <Legend formatter={(v) => (v === 'normal' ? 'Normal' : 'Now')} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="normal" fill="#c5d3ee" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {bins.map((b) => (
              <Cell key={b.label} fill={b.fault ? '#dc2626' : '#2f4f92'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
