import Constants from 'expo-constants';
import type {
  AreaPrices,
  Health,
  LatestForecast,
  LatestPrice,
  MetricRow,
  PricePoint,
} from './types';

/**
 * Base URL of the NestJS API. The app talks only to this API, never to
 * Supabase (CLAUDE.md rule 4).
 *
 * Order: EXPO_PUBLIC_API_URL if set; otherwise, in development, the computer
 * running the Expo dev server on port 3000 (so a real phone on the same Wi-Fi
 * reaches your laptop's API); otherwise localhost.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3000/api/v1`;
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 15_000;

async function get<T>(path: string): Promise<T> {
  // AbortSignal.timeout is not available on every React Native runtime
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Check your internet connection and try again.',
      null,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `Request failed (${res.status})`);
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

/** Every call the app makes. All are public read endpoints. */
export const api = {
  health: () => get<Health>('/health'),
  latestPrice: () => get<LatestPrice>('/prices/latest'),
  priceHistory: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return get<PricePoint[]>(`/prices/history${qs ? `?${qs}` : ''}`);
  },
  areaPrices: () => get<AreaPrices>('/prices/areas'),
  latestForecast: () => get<LatestForecast>('/forecast/latest'),
  metrics: () => get<MetricRow[]>('/metrics'),
};
