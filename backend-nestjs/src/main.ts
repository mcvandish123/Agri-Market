import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env } from './config/env.validation';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // Off unless CORS_ORIGINS is set. The phone app does not need CORS; only a
  // browser (Expo web preview) does. Never use '*': admin routes live here too.
  const origins = config.get('CORS_ORIGINS', { infer: true });
  if (origins.length > 0) app.enableCors({ origin: origins });
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
