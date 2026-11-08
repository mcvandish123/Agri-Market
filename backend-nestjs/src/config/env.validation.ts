/**
 * Environment variables the API needs (see docs/architecture.md,
 * "Environments and secrets"). Validated once at startup so a missing key
 * fails fast with its name only; values are never logged.
 */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ADMIN_API_KEY: string;
  ML_API_KEY: string;
  ML_SERVICE_URL: string;
  PORT: number;
}

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_API_KEY',
  'ML_API_KEY',
  'ML_SERVICE_URL',
] as const;

const URL_KEYS = ['SUPABASE_URL', 'ML_SERVICE_URL'] as const;

export function validateEnv(raw: Record<string, unknown>): Env {
  const problems: string[] = [];
  const value = (key: string): string => {
    const v = raw[key];
    return typeof v === 'string' ? v.trim() : '';
  };

  for (const key of REQUIRED) {
    if (!value(key)) problems.push(`${key} is missing`);
  }
  for (const key of URL_KEYS) {
    const v = value(key);
    if (v && !URL.canParse(v)) problems.push(`${key} is not a valid URL`);
  }

  const portRaw = value('PORT');
  const port = portRaw ? Number(portRaw) : 3000;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    problems.push('PORT must be an integer between 1 and 65535');
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment (check backend-nestjs/.env against .env.example): ${problems.join('; ')}`,
    );
  }

  return {
    SUPABASE_URL: value('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: value('SUPABASE_SERVICE_ROLE_KEY'),
    ADMIN_API_KEY: value('ADMIN_API_KEY'),
    ML_API_KEY: value('ML_API_KEY'),
    ML_SERVICE_URL: value('ML_SERVICE_URL').replace(/\/+$/, ''),
    PORT: port,
  };
}
