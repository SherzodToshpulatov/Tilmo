import { describe, expect, it, vi } from 'vitest';
import { decodeHtmlEntities } from '../src/html-entities';
import { GOOGLE_TRANSLATE_ENDPOINT, GoogleCloudTranslationProvider } from '../src/providers/google';
import { ProviderError } from '../src/providers/types';

const API_KEY = 'test-google-key-not-real';

function googleResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function provider(fetchImpl: (input: string, init: RequestInit) => Promise<Response>, timeoutMs = 1000) {
  return new GoogleCloudTranslationProvider(API_KEY, timeoutMs, fetchImpl);
}

async function providerError(promise: Promise<unknown>): Promise<ProviderError> {
  const error = await promise.then(() => null, (reason: unknown) => reason);
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

describe('GoogleCloudTranslationProvider', () => {
  it('sends a v2 request with the key in a header and auto detection', async () => {
    const fetchImpl = vi.fn(async () => googleResponse({
      data: { translations: [{ translatedText: 'Hello, how are you?', detectedSourceLanguage: 'uz' }] },
    }));

    const result = await provider(fetchImpl).translate({ text: 'Salom, yaxshimisan?', source: 'auto', target: 'en' });

    expect(result).toEqual({ translatedText: 'Hello, how are you?', detectedSourceLanguage: 'uz', provider: 'google' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GOOGLE_TRANSLATE_ENDPOINT);
    expect(url).not.toContain(API_KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(API_KEY);
    expect(JSON.parse(init.body as string)).toEqual({ q: 'Salom, yaxshimisan?', target: 'en', format: 'text' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('passes an explicit source and reports it as the source language', async () => {
    const fetchImpl = vi.fn(async () => googleResponse({ data: { translations: [{ translatedText: 'Привет' }] } }));
    const result = await provider(fetchImpl).translate({ text: 'Hello', source: 'en', target: 'ru' });
    expect(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).source).toBe('en');
    expect(result.detectedSourceLanguage).toBe('en');
  });

  it('decodes HTML entities in the response as plain text and keeps emoji and newlines', async () => {
    const fetchImpl = async () => googleResponse({
      data: { translations: [{ translatedText: 'It&#39;s &quot;fine&quot; &amp; &lt;b&gt;ok&lt;/b&gt; 👋\nline two', detectedSourceLanguage: 'UZ' }] },
    });
    const result = await provider(fetchImpl).translate({ text: 'x', source: 'auto', target: 'en' });
    expect(result.translatedText).toBe('It\'s "fine" & <b>ok</b> 👋\nline two');
    expect(result.detectedSourceLanguage).toBe('uz');
  });

  it.each([
    [429, {}, 'rate_limited'],
    [403, { error: { errors: [{ reason: 'dailyLimitExceeded' }] } }, 'rate_limited'],
    [403, { error: { errors: [{ reason: 'forbidden' }] } }, 'rejected'],
    [400, { error: { message: 'API key not valid' } }, 'rejected'],
    [500, {}, 'unavailable'],
    [503, 'not json', 'unavailable'],
  ])('maps HTTP %i to %s', async (status, body, kind) => {
    const fetchImpl = async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    const error = await providerError(provider(fetchImpl).translate({ text: 'x', source: 'auto', target: 'en' }));
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain('API key not valid');
  });

  it('maps network failures to unavailable', async () => {
    const fetchImpl = async () => { throw new TypeError('fetch failed'); };
    expect((await providerError(provider(fetchImpl).translate({ text: 'x', source: 'auto', target: 'en' }))).kind).toBe('unavailable');
  });

  it('times out when Google does not answer', async () => {
    const fetchImpl = (_input: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
    const error = await providerError(provider(fetchImpl, 20).translate({ text: 'x', source: 'auto', target: 'en' }));
    expect(error.kind).toBe('timeout');
  });

  it.each([
    [{}],
    [{ data: { translations: [] } }],
    [{ data: { translations: [{ translatedText: 42 }] } }],
  ])('rejects malformed success responses %j', async (body) => {
    const error = await providerError(provider(async () => googleResponse(body)).translate({ text: 'x', source: 'auto', target: 'en' }));
    expect(error.kind).toBe('invalid_response');
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes in a single pass', () => {
    expect(decodeHtmlEntities('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;');
  });

  it('decodes numeric entities, including astral code points', () => {
    expect(decodeHtmlEntities('&#128075; &#x1F600; &#1179;')).toBe('👋 😀 қ');
  });

  it('leaves unknown, invalid and surrogate entities untouched', () => {
    expect(decodeHtmlEntities('&unknown; &#0; &#xD800; &#99999999; a & b')).toBe('&unknown; &#0; &#xD800; &#99999999; a & b');
  });
});
