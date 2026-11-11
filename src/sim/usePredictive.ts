import { useMemo } from 'react'
import { toISODate } from '../lib/dates'
import { ASSETS } from '../data/assets'
import { useAppState } from '../store/hooks'
import { assessAll, type Assessment } from './predictiveModel'

/**
 * Health assessments for all CT-monitored assets. Recalculated when an
 * asset is marked resolved, or the date changes.
 */
export function usePredictive(): Assessment[] {
  const { predictiveResets } = useAppState()
  const day = toISODate(new Date())
  return useMemo(() => assessAll(ASSETS, new Date(), predictiveResets), [predictiveResets, day])
}
