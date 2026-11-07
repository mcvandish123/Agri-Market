import {
  BadGatewayException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MlRunnerService } from './ml-runner.service';

const config = {
  get: (key: string) =>
    ({ ML_SERVICE_URL: 'http://runner:8000', ML_API_KEY: 'ml-secret' })[key],
} as unknown as ConfigService;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('MlRunnerService', () => {
  const runner = new MlRunnerService(config as never);
  const fetchMock = jest.spyOn(global, 'fetch');
  const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

  afterEach(() => jest.clearAllMocks());
  afterAll(() => jest.restoreAllMocks());

  it('starts a run with the x-ml-key header and returns the job', async () => {
    const job = { jobId: 'abc', status: 'queued' };
    fetchMock.mockResolvedValue(jsonResponse(202, job));

    await expect(
      runner.startRun({ dryRun: true, through: '2023-12-01' }),
    ).resolves.toEqual(job);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://runner:8000/runs');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'x-ml-key': 'ml-secret' });
    expect(init?.body).toBe('{"dryRun":true,"through":"2023-12-01"}');
  });

  it('passes 409 through with the runner message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { detail: 'A forecast job is already running' }),
    );
    const err = await runner.getRun('x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(409);
    expect((err as HttpException).getResponse()).toEqual({
      statusCode: 409,
      message: 'A forecast job is already running',
      error: 'Conflict',
    });
  });

  it('passes 422 validation messages through without the pydantic prefix', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        detail: [
          { msg: 'Value error, through is only allowed with dryRun = true' },
        ],
      }),
    );
    const err = (await runner
      .startRun({ dryRun: false, through: '2023-12-01' })
      .catch((e: unknown) => e)) as HttpException;
    expect(err.getResponse()).toEqual({
      statusCode: 422,
      message: ['through is only allowed with dryRun = true'],
      error: 'Unprocessable Entity',
    });
  });

  it('turns a runner auth/config error into 502 and logs it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Invalid key' }));
    await expect(runner.getRun('x')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('401'));
    expect(String(logError.mock.calls[0][0])).not.toContain('ml-secret');
  });

  it('returns 503 when the runner is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(runner.getRun('x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('encodes the job id in the path', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await runner.getRun('a/b');
    expect(fetchMock.mock.calls[0][0]).toBe('http://runner:8000/runs/a%2Fb');
  });
});
