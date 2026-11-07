import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminKeyGuard } from './admin-key.guard';

const contextWith = (key?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name.toLowerCase() === 'x-admin-key' ? key : undefined,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('AdminKeyGuard', () => {
  const config = { get: () => 'correct-key' } as unknown as ConfigService;
  const guard = new AdminKeyGuard(config as never);

  it('allows the correct key', () => {
    expect(guard.canActivate(contextWith('correct-key'))).toBe(true);
  });

  it.each([undefined, '', 'wrong-key', 'correct-key-but-longer'])(
    'rejects %p with 401',
    (key) => {
      expect(() => guard.canActivate(contextWith(key))).toThrow(
        UnauthorizedException,
      );
    },
  );
});
