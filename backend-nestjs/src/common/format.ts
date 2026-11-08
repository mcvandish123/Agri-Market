import type { ModelName } from '../supabase/database.types';

/** Round half away from zero to `digits` decimals (2 for PHP/kg, docs/api.md). */
export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return (
    (Math.sign(value) * Math.round(Math.abs(value) * f + Number.EPSILON)) / f
  );
}

/** Display order for models: the naive reference first, then the thesis order. */
export const MODEL_ORDER: readonly ModelName[] = [
  'naive',
  'sarimax',
  'xgboost_full',
  'xgboost_rfe',
  'ms_xgboost_rfe',
  'lstm',
];

export const byModelOrder = (a: ModelName, b: ModelName): number =>
  MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b);

/** snake_case keys -> camelCase keys (one level), for returning stored rows. */
export function camelizeKeys<T extends object>(
  row: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()),
      v as unknown,
    ]),
  );
}
