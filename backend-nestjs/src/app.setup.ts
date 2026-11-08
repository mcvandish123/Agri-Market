import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * App-wide request lifecycle settings. Called by main.ts and by the e2e
 * tests, so tests run the same pipeline as the real server.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1');

  // Validate and convert query params and bodies with class-validator DTOs.
  // Unknown fields are rejected (400) instead of silently passed through.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Close cleanly (finish in-flight requests) when the host sends SIGTERM.
  app.enableShutdownHooks();

  return app;
}
