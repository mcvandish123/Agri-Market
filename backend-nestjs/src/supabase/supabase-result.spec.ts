import { InternalServerErrorException, Logger } from '@nestjs/common';
import { unwrap } from './supabase-result';

describe('unwrap', () => {
  const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  afterEach(() => jest.clearAllMocks());
  afterAll(() => jest.restoreAllMocks());

  it('returns the data', () => {
    expect(unwrap({ data: [1, 2], error: null }, 'test')).toEqual([1, 2]);
  });

  it('throws a generic 500 and logs the real error on the server', () => {
    const result = {
      data: null,
      error: {
        code: '42703',
        message: 'column latest_forecasts.model does not exist',
      },
    };
    let thrown: unknown;
    try {
      unwrap(result, 'latest forecasts');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(InternalServerErrorException);
    const body = (thrown as InternalServerErrorException).getResponse();
    expect(JSON.stringify(body)).not.toContain('latest_forecasts');
    expect(logError).toHaveBeenCalledWith(
      'latest forecasts: 42703 column latest_forecasts.model does not exist',
    );
  });

  it('treats missing data as an error', () => {
    expect(() => unwrap({ data: null, error: null }, 'test')).toThrow(
      InternalServerErrorException,
    );
  });
});
