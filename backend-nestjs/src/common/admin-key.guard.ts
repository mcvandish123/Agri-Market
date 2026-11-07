import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Env } from '../config/env.validation';

const sha256 = (s: string): Buffer => createHash('sha256').update(s).digest();

/**
 * Protects admin routes (decision D7): the `x-admin-key` header must equal
 * ADMIN_API_KEY. Use with `@UseGuards(AdminKeyGuard)`.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.expected = sha256(config.get('ADMIN_API_KEY', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const header = context
      .switchToHttp()
      .getRequest<Request>()
      .header('x-admin-key');
    // Hash both sides so the comparison is constant-time and length-independent.
    if (!header || !timingSafeEqual(sha256(header), this.expected)) {
      throw new UnauthorizedException('Missing or invalid x-admin-key header');
    }
    return true;
  }
}
