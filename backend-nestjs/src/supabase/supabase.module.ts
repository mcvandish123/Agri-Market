import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../config/env.validation';
import { Database } from './database.types';

/** Injection token for the server-side Supabase client (service-role key). */
export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

/** The typed Supabase client. Inject with `@Inject(SUPABASE_CLIENT)`. */
export type Db = SupabaseClient<Database>;

/**
 * One Supabase client for the whole API. It uses the service-role key, which
 * bypasses RLS (decision D7), so it must only ever run server-side.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Db =>
        createClient<Database>(
          config.get('SUPABASE_URL', { infer: true }),
          config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
          { auth: { persistSession: false, autoRefreshToken: false } },
        ),
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
