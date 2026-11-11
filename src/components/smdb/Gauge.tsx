interface Props {
  label: string
  value: number
  /** Text shown in the middle (defaults to the value). */
  display?: string
  unit?: string
  min: number
  max: number
  /** Value above which the arc turns amber / red. */
  warnAt?: number
  critAt?: number
  /** For voltage: values BELOW these are also bad. */
  lowWarnAt?: number
}

/** Semicircle gauge drawn in SVG. */
export function Gauge({ label, value, display, unit, min, max, warnAt, critAt, lowWarnAt }: Props) {
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)))
  const r = 52
  const cx = 64
  const cy = 64
  // Arc from 180° (left) to 0° (right).
  const point = (f: number) => {
    const angle = Math.PI * (1 - f)
    return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)] as const
  }
  const [ex, ey] = point(fraction)
  const bad = (critAt !== undefined && value > critAt) ? 'critical' : (warnAt !== undefined && value > warnAt) || (lowWarnAt !== undefined && value < lowWarnAt) ? 'warning' : 'ok'
  const color = bad === 'critical' ? '#dc2626' : bad === 'warning' ? '#d97706' : '#014cc3'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 128 76" className="w-full max-w-44" role="img" aria-label={`${label}: ${display ?? value} ${unit ?? ''}`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e3eaf8" strokeWidth="10" strokeLinecap="round" />
        {fraction > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            style={{ transition: 'all 0.7s ease' }}
          />
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-navy-900" style={{ fontSize: 18, fontWeight: 700 }}>
          {display ?? value}
        </text>
        {unit && (
          <text x={cx} y={cy + 8} textAnchor="middle" className="fill-navy-500" style={{ fontSize: 9 }}>
            {unit}
          </text>
        )}
      </svg>
      <p className="-mt-1 text-sm font-medium text-navy-600">{label}</p>
    </div>
  )
}
