import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/app';
import { createDependencies } from '../src/dependencies';
import { sha256Hex } from '../src/middleware/security';
import { ProviderError, type TranslationProvider } from '../src/providers/types';
import { billingPeriod } from '../src/usage/usage-ledger';
import { TEST_TOKEN, memoryUsage, testDependencies, translateRequest } from './helpers';

const PRIVATE_TEXT = 'Maxfiy xabar: salom, yaxshimisan?';

function failingProvider(error: ProviderError): TranslationProvider {
  return { name: 'test', translate: async () => { throw error; } };
}

afterEach(() => vi.restoreAllMocks());

describe('POST /v1/translate', () => {
  it('translates an authenticated request', async () => {
    const deps = await testDependencies();
    const response = await handleRequest(translateRequest({ text: 'Salom, yaxshimisan?', source: 'auto', target: 'en' }), () => deps);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ translatedText: '[en] Salom, yaxshimisan?', detectedSourceLanguage: 'uz', provider: 'test' });
  });

  it.each([
    ['missing', null],
    ['wrong', 'btk_wrong-token'],
    ['empty', ''],
    ['oversized', `btk_${'a'.repeat(300)}`],
  ])('rejects a %s token with 401 before touching the provider', async (_label, token) => {
    const translate = vi.fn();
    const deps = await testDependencies({ provider: { name: 'test', translate } });
    const response = await handleRequest(translateRequest({ text: 'x', target: 'en' }, { token }), () => deps);

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(await response.json()).toMatchObject({ error: { code: 'unauthorized' } });
    expect(translate).not.toHaveBeenCalled();
  });

  it('accepts any of several configured tokens', async () => {
    const deps = await testDependencies({ tokenHashes: [await sha256Hex('btk_other-tester'), await sha256Hex(TEST_TOKEN)] });
    expect((await handleRequest(translateRequest({ text: 'x', target: 'en' }), () => deps)).status).toBe(200);
  });

  it('rate limits per client with 429 and Retry-After', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const deps = await testDependencies({ rateLimiter: { limit } });
    const response = await handleRequest(translateRequest({ text: 'x', target: 'en' }), () => deps);

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toMatchObject({ error: { code: 'rate_limited' } });
    const [{ key }] = limit.mock.calls[0] as unknown as [{ key: string }];
    expect(key).toBe((await sha256Hex(TEST_TOKEN)).slice(0, 16));
    expect(key).not.toContain(TEST_TOKEN);
  });

  it('enforces the monthly character budget', async () => {
    const usage = memoryUsage();
    const deps = await testDependencies({ usage, config: { ...(await testDependencies()).config, monthlyCharacterLimit: 10 } });

    expect((await handleRequest(translateRequest({ text: '123456', target: 'en' }), () => deps)).status).toBe(200);
    const blocked = await handleRequest(translateRequest({ text: '12345', target: 'en' }), () => deps);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: { code: 'quota_exceeded' } });
    expect(usage.storage.values.get(`characters:${billingPeriod(new Date())}`)).toBe(6);
  });

  it('returns characters to the budget when the provider rejects the request', async () => {
    const usage = memoryUsage();
    const deps = await testDependencies({ usage, provider: failingProvider(new ProviderError('unavailable', 500)) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await handleRequest(translateRequest({ text: 'salom', target: 'en' }), () => deps);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: 'provider_error' } });
    expect(usage.storage.values.get(`characters:${billingPeriod(new Date())}`)).toBe(0);
  });

  it('keeps timed-out requests counted and returns 504', async () => {
    const usage = memoryUsage();
    const deps = await testDependencies({ usage, provider: failingProvider(new ProviderError('timeout')) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await handleRequest(translateRequest({ text: 'salom', target: 'en' }), () => deps);
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: 'provider_timeout' } });
    expect(usage.storage.values.get(`characters:${billingPeriod(new Date())}`)).toBe(5);
  });

  it('maps provider throttling to 503', async () => {
    const deps = await testDependencies({ provider: failingProvider(new ProviderError('rate_limited', 429)) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await handleRequest(translateRequest({ text: 'salom', target: 'en' }), () => deps);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'provider_rate_limited' } });
  });

  it.each([
    ['invalid JSON', '{"text":', 400, 'invalid_json'],
    ['empty text', { text: '  ', target: 'en' }, 400, 'empty_text'],
    ['unsupported language', { text: 'x', target: 'fr' }, 400, 'unsupported_language'],
  ])('returns a structured error for %s', async (_label, body, status, code) => {
    const deps = await testDependencies();
    const response = await handleRequest(translateRequest(body), () => deps);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code, message: expect.any(String) } });
  });

  it('never logs request text or echoes it in errors', async () => {
    const logs: unknown[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args) => { logs.push(...args); });
    }
    const deps = await testDependencies({ provider: failingProvider(new ProviderError('rejected', 400)) });
    const response = await handleRequest(translateRequest({ text: PRIVATE_TEXT, target: 'en' }), () => deps);

    expect(await response.text()).not.toContain(PRIVATE_TEXT);
    expect(JSON.stringify(logs)).not.toContain(PRIVATE_TEXT);
  });
});

describe('routing and configuration', () => {
  it('serves an unauthenticated health check', async () => {
    const response = await handleRequest(new Request('https://api.example.test/v1/health'), () => { throw new Error('unused'); });
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('returns 405 and 404 as structured errors', async () => {
    const deps = await testDependencies();
    const get = await handleRequest(new Request('https://api.example.test/v1/translate'), () => deps);
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    const missing = await handleRequest(new Request('https://api.example.test/nope'), () => deps);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it.each([
    ['no Google key', { GOOGLE_TRANSLATE_API_KEY: '' }],
    ['no token hashes', { API_ACCESS_TOKEN_HASHES: '' }],
    ['a malformed token hash', { API_ACCESS_TOKEN_HASHES: 'not-a-hash' }],
  ])('fails closed with 500 when there is %s', async (_label, overrides) => {
    const env = {
      GOOGLE_TRANSLATE_API_KEY: 'secret-google-key',
      API_ACCESS_TOKEN_HASHES: await sha256Hex(TEST_TOKEN),
      ...overrides,
    } as unknown as Env;
    const response = await handleRequest(translateRequest({ text: 'x', target: 'en' }), () => createDependencies(env));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(body)).toMatchObject({ error: { code: 'server_misconfigured' } });
    expect(body).not.toContain('secret-google-key');
  });

  it('hides unexpected errors behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = await testDependencies({ provider: { name: 'test', translate: async () => { throw new Error('secret detail'); } } });
    const response = await handleRequest(translateRequest({ text: 'x', target: 'en' }), () => deps);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret detail');
  });
});
