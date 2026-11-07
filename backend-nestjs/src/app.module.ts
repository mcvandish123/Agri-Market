import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { validateEnv } from './config/env.validation';
import { ForecastsModule } from './forecasts/forecasts.module';
import { HealthController } from './health/health.controller';
import { PricesModule } from './prices/prices.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    SupabaseModule,
    PricesModule,
    ForecastsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
