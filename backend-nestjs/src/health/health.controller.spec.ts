import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';
import { HealthController } from './health.controller';

const fakeSupabase = (error: unknown) => ({
  from: () => ({
    select: () => ({ limit: () => Promise.resolve({ data: [], error }) }),
  }),
});

async function controllerWith(error: unknown): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: SUPABASE_CLIENT, useValue: fakeSupabase(error) }],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reports ok when Supabase answers', async () => {
    const controller = await controllerWith(null);
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('returns 503 when Supabase fails', async () => {
    const controller = await controllerWith({ message: 'boom' });
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
