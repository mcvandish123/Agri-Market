import { validateEnv } from './env.validation';

const valid = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  ADMIN_API_KEY: 'admin-test',
  ML_API_KEY: 'ml-test',
  ML_SERVICE_URL: 'http://127.0.0.1:8000/',
};

describe('validateEnv', () => {
  it('accepts a complete environment and defaults PORT to 3000', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.ML_SERVICE_URL).toBe('http://127.0.0.1:8000');
  });

  it('names every missing key', () => {
    expect(() =>
      validateEnv({ ...valid, ADMIN_API_KEY: '', ML_API_KEY: ' ' }),
    ).toThrow(/ADMIN_API_KEY is missing; ML_API_KEY is missing/);
  });

  it('rejects an invalid URL and port', () => {
    expect(() =>
      validateEnv({ ...valid, SUPABASE_URL: 'not a url', PORT: '99999' }),
    ).toThrow(/SUPABASE_URL is not a valid URL; PORT must be/);
  });

  it('never includes secret values in the error', () => {
    try {
      validateEnv({ ...valid, SUPABASE_URL: '' });
      fail('expected an error');
    } catch (e) {
      expect((e as Error).message).not.toContain('service-role-test');
    }
  });
});
