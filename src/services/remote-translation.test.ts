import { describe, expect, it, vi } from 'vitest';
import { RemoteTranslationService } from './remote-translation';
import { TranslationError, type TranslationErrorCode } from './translation';

const REQUEST = { text: 'Salom, yaxshimisan? 👋', source: 'auto', target: 'en' } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function service(fetchImpl: (input: string, init: RequestInit) => Promise<Response>, timeoutMs?: number) {
  return new RemoteTranslationService({ baseUrl: 'https://api.example.test/', accessToken: 'btk_token', fetch: fetchImpl, timeoutMs });
}

async function errorCode(promise: Promise<unknown>): Promise<TranslationErrorCode> {
  const error = await promise.then(() => null, (reason: unknown) => reason);
  expect(error).toBeInstanceOf(TranslationError);
  return (error as TranslationError).code;
}

describe('RemoteTranslationService', () => {
  it('posts the request with the bearer token and returns the result', async () => {
    const fetchImpl = vi.fn(async () => json({ translatedText: 'Hello, how are you? 👋', detectedSourceLanguage: 'uz', provider: 'google' }));
    const result = await service(fetchImpl).translate(REQUEST);

    expect(result).toEqual({ translatedText: 'Hello, how are you? 👋', detectedSourceLanguage: 'uz', provider: 'google' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/v1/translate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer btk_token');
    expect(JSON.parse(init.body as string)).toEqual(REQUEST);
    expect(init.credentials).toBe('omit');
  });

  it.each(['https://api.example.test', 'https://api.example.test/', 'https://api.example.test//'])('normalizes base URL %s', async (baseUrl) => {
    const fetchImpl = vi.fn(async () => json({ translatedText: 'x', provider: 'google' }));
    await new RemoteTranslationService({ baseUrl, accessToken: 't', fetch: fetchImpl }).translate(REQUEST);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.example.test/v1/translate');
  });

  it.each([
    [401, 'unauthorized', 'unauthorized'],
    [429, 'rate_limited', 'rate_limited'],
    [429, 'quota_exceeded', 'quota_exceeded'],
    [503, 'provider_rate_limited', 'rate_limited'],
    [504, 'provider_timeout', 'timeout'],
    [413, 'text_too_long', 'text_too_long'],
    [400, 'unsupported_language', 'invalid_request'],
    [502, 'provider_error', 'server_error'],
    [500, 'server_misconfigured', 'server_error'],
  ])('maps HTTP %i %s to %s', async (status, code, expected) => {
    const fetchImpl = async () => json({ error: { code, message: 'x' } }, status);
    expect(await errorCode(service(fetchImpl).translate(REQUEST))).toBe(expected);
  });

  it.each([
    [401, 'unauthorized'],
    [429, 'rate_limited'],
    [502, 'server_error'],
  ])('falls back to the HTTP status %i when the body is not JSON', async (status, expected) => {
    const fetchImpl = async () => new Response('<html>Bad gateway</html>', { status });
    expect(await errorCode(service(fetchImpl).translate(REQUEST))).toBe(expected);
  });

  it('reports network failures as offline', async () => {
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
    expect(await errorCode(service(fetchImpl).translate(REQUEST))).toBe('offline');
  });

  it('times out a request that never answers', async () => {
    const fetchImpl = (_input: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
    expect(await errorCode(service(fetchImpl, 20).translate(REQUEST))).toBe('timeout');
  });

  it.each([
    ['not JSON', new Response('ok', { status: 200 })],
    ['missing text', json({ provider: 'google' })],
    ['wrong types', json({ translatedText: 1, provider: 'google' })],
    ['bad detected language', json({ translatedText: 'x', provider: 'google', detectedSourceLanguage: 3 })],
  ])('rejects an invalid success response (%s)', async (_label, response) => {
    expect(await errorCode(service(async () => response).translate(REQUEST))).toBe('invalid_response');
  });
});
