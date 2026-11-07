/**
 * Vapor pressure deficit (kPa), Tetens equation. Must stay identical to
 * `vpd_kpa()` in ml-service-fastapi/features.py and docs/data-dictionary.md:
 *   VPD = 0.61078 * exp(17.27 * T / (T + 237.3)) * (1 - RH / 100)
 * Rounded to 6 decimals, the precision of monthly_data.vpd_kpa (numeric(8,6)).
 */
export function vpdKpa(tempC: number, rhPct: number): number {
  const vpd =
    0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3)) * (1 - rhPct / 100);
  return Math.round(vpd * 1e6) / 1e6;
}
