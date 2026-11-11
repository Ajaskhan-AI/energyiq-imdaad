/**
 * Scope 2 (purchased electricity) CO2 estimate, location-based method:
 * tonnes CO2e = kWh × grid emission factor ÷ 1000.
 *
 * The factor below is an INDICATIVE value for the Dubai grid, used for the
 * demo only. In a pilot it is replaced with the latest factor published by
 * DEWA, or the one each client uses for its own ESG reporting.
 */
export const GRID_FACTOR_KG_PER_KWH = 0.4

export const EMISSION_FACTOR_NOTE =
  'Indicative Dubai grid emission factor of 0.40 kg CO2e/kWh (location-based Scope 2). ' +
  'To be replaced with the latest DEWA-published factor during the pilot.'

export function kwhToTonnesCo2(kwh: number): number {
  return (kwh * GRID_FACTOR_KG_PER_KWH) / 1000
}
