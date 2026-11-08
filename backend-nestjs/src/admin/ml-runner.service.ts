import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';

/** Job as returned by the ML runner (docs/api.md, "ML job runner contract"). */
export interface MlJob {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  dryRun: boolean;
  through: string | null;
  createdAt: string;
  finishedAt: string | null;
  modelRunId: string | null;
  error: string | null;
  result: unknown;
}

/**
 * Runner errors that are the caller's problem; passed through with the
 * runner's message, in the NestJS error shape.
 */
const PASS_THROUGH: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
};

const TIMEOUT_MS = 10_000;

/**
 * Client for the FastAPI job runner (decision D9). Only starts and reads jobs;
 * forecasts themselves are always read from Supabase.
 */
@Injectable()
export class MlRunnerService {
  private readonly logger = new Logger(MlRunnerService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('ML_SERVICE_URL', { infer: true });
    this.apiKey = config.get('ML_API_KEY', { infer: true });
  }

  startRun(body: { dryRun: boolean; through: string | null }): Promise<MlJob> {
    return this.request('POST', '/runs', body);
  }

  getRun(jobId: string): Promise<MlJob> {
    return this.request('GET', `/runs/${encodeURIComponent(jobId)}`);
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<MlJob> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'x-ml-key': this.apiKey,
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const reason = e instanceof Error ? e.name : 'unknown';
      this.logger.error(`${method} ${path}: runner unreachable (${reason})`);
      throw new ServiceUnavailableException('ML runner is unreachable');
    }

    const payload: unknown = await res.json().catch(() => null);
    if (res.ok) return payload as MlJob;

    const error = PASS_THROUGH[res.status];
    if (error) {
      throw new HttpException(
        { statusCode: res.status, message: runnerMessage(payload), error },
        res.status,
      );
    }
    // 401/503 mean ML_API_KEY is wrong or missing on one side: a server
    // configuration problem, not something the admin client can fix.
    this.logger.error(`${method} ${path}: runner returned ${res.status}`);
    throw new BadGatewayException('ML runner request failed');
  }
}

/** FastAPI errors are `{ detail: string }` or, for 422, `{ detail: [{ msg }] }`. */
function runnerMessage(payload: unknown): string | string[] {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const msg = (d as { msg?: unknown } | null)?.msg;
      // Pydantic prefixes validator messages with "Value error, "
      return typeof msg === 'string'
        ? msg.replace(/^Value error, /, '')
        : 'Invalid request';
    });
  }
  return 'ML runner rejected the request';
}
