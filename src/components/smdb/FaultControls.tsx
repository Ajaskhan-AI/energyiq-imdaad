import { FlaskConical, PowerOff, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { BUILDINGS } from '../../data/sites'
import { SMDBS, getSmdb } from '../../data/smdbs'
import { useSimulator } from '../../sim/simulatorContext'
import { Button } from '../ui/Button'
import { inputClass } from '../ui/styles'
import { useToast } from '../ui/toastContext'

/**
 * Demo helper (Admin only): force a trip or overload on a board so the
 * live alert flow can be shown in the meeting. Pass smdbId to fix the board.
 */
export function FaultControls({ smdbId }: { smdbId?: string }) {
  const { faults, injectFault, clearFault } = useSimulator()
  const toast = useToast()
  const [selected, setSelected] = useState(smdbId ?? 'SMDB-HBT-B1-04')
  const target = smdbId ?? selected
  const active = faults[target]
  const name = getSmdb(target)?.name ?? target

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-navy-600">
        <FlaskConical className="size-4 text-amber-600" aria-hidden />
        Demo helper — simulates a fault so the live alert can be shown. Real meters are not affected.
      </p>
      {!smdbId && (
        <select aria-label="Board" value={selected} onChange={(e) => setSelected(e.target.value)} className={inputClass}>
          {BUILDINGS.map((b) => (
            <optgroup key={b.id} label={b.name}>
              {SMDBS.filter((s) => s.buildingId === b.id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id}){faults[s.id] ? ` — ${faults[s.id]} active` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          onClick={() => {
            injectFault(target, 'trip')
            toast.show(`Simulating a trip on ${name}`, 'info')
          }}
          disabled={active === 'trip'}
        >
          <PowerOff className="size-4" aria-hidden />
          Simulate trip
        </Button>
        <Button
          variant="secondary"
          className="border-amber-300 text-amber-800 hover:bg-amber-50"
          onClick={() => {
            injectFault(target, 'overload')
            toast.show(`Simulating an overload on ${name}`, 'info')
          }}
          disabled={active === 'overload'}
        >
          <TrendingUp className="size-4" aria-hidden />
          Simulate overload
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            injectFault(target, 'low_pf')
            toast.show(`Simulating a low power factor on ${name}`, 'info')
          }}
          disabled={active === 'low_pf'}
        >
          <TrendingDown className="size-4" aria-hidden />
          Simulate low PF
        </Button>
        {active && (
          <Button
            variant="secondary"
            onClick={() => {
              clearFault(target)
              toast.show(`${name} back to normal — the alert clears after a few updates`, 'info')
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            Clear fault
          </Button>
        )}
      </div>
      {Object.keys(faults).length > 0 && (
        <p className="text-xs text-navy-500">
          Active demo faults: {Object.entries(faults).map(([id, type]) => `${getSmdb(id)?.name ?? id} (${type})`).join(', ')}
        </p>
      )}
    </div>
  )
}
