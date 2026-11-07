import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

export interface HealthResponse {
  status: 'ok';
  database: 'ok';
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** GET /api/v1/health: confirms the API can read Supabase (docs/api.md). */
  @Get()
  async check(): Promise<HealthResponse> {
    const { error } = await this.supabase
      .from('monthly_data')
      .select('month')
      .limit(1);
    if (error) {
      // Server log only; the client gets the generic 503 body below.
      this.logger.error(`health check: ${error.code} ${error.message}`);
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'error',
      });
    }
    return { status: 'ok', database: 'ok' };
  }
}
