import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { RequestLoggerMiddleware } from './request-logger.middleware';

function run(statusCode: number) {
  const req = {
    method: 'POST',
    originalUrl: '/api/v1/admin/monthly-data?debug=1',
    headers: { 'x-admin-key': 'super-secret-admin-key' },
    body: { sourceNote: 'secret body' },
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), { statusCode });
  const next = jest.fn();

  new RequestLoggerMiddleware().use(req, res as unknown as Response, next);
  res.emit('finish');
  return next;
}

describe('RequestLoggerMiddleware', () => {
  const spies = {
    log: jest.spyOn(Logger.prototype, 'log').mockImplementation(),
    warn: jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
    error: jest.spyOn(Logger.prototype, 'error').mockImplementation(),
  };

  afterEach(() => jest.clearAllMocks());
  afterAll(() => jest.restoreAllMocks());

  it('logs method, path, status and duration, and calls next', () => {
    const next = run(201);
    expect(next).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith(
      expect.stringMatching(/^POST \/api\/v1\/admin\/monthly-data 201 \d+ms$/),
    );
  });

  it('never logs headers, bodies or the query string', () => {
    run(200);
    const line = String(spies.log.mock.calls[0][0]);
    expect(line).not.toContain('super-secret-admin-key');
    expect(line).not.toContain('secret body');
    expect(line).not.toContain('debug=1');
  });

  it('uses warn for 4xx and error for 5xx', () => {
    run(401);
    run(500);
    expect(spies.warn).toHaveBeenCalledTimes(1);
    expect(spies.error).toHaveBeenCalledTimes(1);
  });
});
