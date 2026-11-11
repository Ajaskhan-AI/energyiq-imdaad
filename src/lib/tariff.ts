/**
 * INDICATIVE DEWA commercial electricity tariff, used for cost estimates in the
 * demo only. Confirm against the current DEWA tariff and each account's bill
 * during the pilot.
 *
 * Slab rates apply to each premises' monthly consumption, plus a fuel surcharge
 * on every kWh. Large buildings sit in the top slab for almost all their use.
 */
export const DEWA_SLABS: Array<{ upToKwh: number; filsPerKwh: number }> = [
  { upToKwh: 2000, filsPerKwh: 23 },
  { upToKwh: 4000, filsPerKwh: 28 },
  { upToKwh: 6000, filsPerKwh: 32 },
  { upToKwh: Infinity, filsPerKwh: 38 },
]
export const FUEL_SURCHARGE_FILS = 6.5

/** Marginal cost of one more (or one less) kWh for a large site: top slab + fuel surcharge. */
export const MARGINAL_AED_PER_KWH = (38 + FUEL_SURCHARGE_FILS) / 100

export const TARIFF_NOTE =
  'Indicative DEWA commercial slab tariff (23 / 28 / 32 / 38 fils per kWh) plus 6.5 fils/kWh fuel surcharge. ' +
  'Savings use the marginal rate of 0.445 AED/kWh. To be confirmed against actual DEWA bills during the pilot.'

/** Electricity charge (AED) for one premises' monthly kWh, slab by slab, incl. fuel surcharge. */
export function monthlyBillAed(kwh: number): { energyAed: number; fuelAed: number; totalAed: number } {
  let remaining = kwh
  let previous = 0
  let fils = 0
  for (const slab of DEWA_SLABS) {
    const inSlab = Math.max(0, Math.min(remaining, slab.upToKwh - previous))
    fils += inSlab * slab.filsPerKwh
    remaining -= inSlab
    previous = slab.upToKwh
    if (remaining <= 0) break
  }
  const energyAed = fils / 100
  const fuelAed = (kwh * FUEL_SURCHARGE_FILS) / 100
  return { energyAed, fuelAed, totalAed: energyAed + fuelAed }
}
