import type { Tone } from '../components/ui/Badge'
import type { HealthStatus } from '../sim/predictiveModel'

export const HEALTH_TONE: Record<HealthStatus, Tone> = { ok: 'ok', watch: 'warn', alert: 'alert' }
