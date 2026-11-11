import { format } from 'date-fns'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HistoryPoint } from '../../sim/smdbModel'

interface Props {
  points: HistoryPoint[]
  warnPct: number
  critPct: number
}

/** Last 24 h of board load (% of breaker rating) with the warning / critical lines. */
export function LoadTrendChart({ points, warnPct, critPct }: Props) {
  const maxY = Math.max(110, Math.ceil(Math.max(...points.map((p) => p.loadPct)) / 10) * 10 + 10)
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#014cc3" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#014cc3" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e3eaf8" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => format(t, 'HH:mm')}
            tick={{ fontSize: 12, fill: '#6a87c4' }}
            tickCount={7}
          />
          <YAxis domain={[0, maxY]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 12, fill: '#6a87c4' }} />
          <Tooltip
            labelFormatter={(t) => format(Number(t), 'EEE HH:mm')}
            formatter={(value, _name, item) => [`${Number(value).toFixed(1)}%  (${(item.payload as HistoryPoint).kW} kW)`, 'Load']}
          />
          <ReferenceLine y={warnPct} stroke="#d97706" strokeDasharray="4 4" label={{ value: `Warning ${warnPct}%`, position: 'insideTopRight', fill: '#b45309', fontSize: 11 }} />
          <ReferenceLine y={critPct} stroke="#dc2626" strokeDasharray="4 4" label={{ value: `Critical ${critPct}%`, position: 'insideTopRight', fill: '#b91c1c', fontSize: 11 }} />
          <Area type="monotone" dataKey="loadPct" stroke="#014cc3" strokeWidth={2} fill="url(#loadFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
