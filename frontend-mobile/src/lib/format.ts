import type { ModelName } from '@/api/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const parts = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return { year: y, index: m - 1 };
};

/** '2025-12-01' -> 'December 2025' */
export const monthLong = (month: string) => {
  const { year, index } = parts(month);
  return `${MONTHS[index]} ${year}`;
};

/** '2025-12-01' -> 'Dec 2025' */
export const monthShort = (month: string) => {
  const { year, index } = parts(month);
  return `${MONTHS[index].slice(0, 3)} ${year}`;
};

/** '2025-12-01' -> "Dec '25" (chart axes) */
export const monthTick = (month: string) => {
  const { year, index } = parts(month);
  return `${MONTHS[index].slice(0, 3)} '${String(year).slice(2)}`;
};

/** '2025-12-01' -> 'December' */
export const monthName = (month: string) => MONTHS[parts(month).index];

/** 60.28 -> '₱60.28' */
export const peso = (value: number) =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** -4.37 -> '−4.37%', 2.1 -> '+2.10%' */
export const signedPct = (value: number, digits = 2) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}%`;

/** -0.75 -> '−₱0.75' */
export const signedPeso = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${peso(Math.abs(value))}`;

/** 'YYYY-MM-01' for `months` before `month` (both first-of-month). */
export const monthsBefore = (month: string, months: number) => {
  const { year, index } = parts(month);
  const total = year * 12 + index - months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}-01`;
};

export const MODEL_LABELS: Record<ModelName, string> = {
  naive: 'Naive',
  sarimax: 'SARIMAX',
  xgboost_full: 'XGBoost (all features)',
  xgboost_rfe: 'XGBoost-RFE',
  ms_xgboost_rfe: 'MS-XGBoost-RFE',
  lstm: 'LSTM',
};
