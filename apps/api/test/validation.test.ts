import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';
import { ApiError } from '../src/errors';
import { readJsonBody, validateTranslationRequest } from '../src/middleware/validation';

const config = readConfig({});

function expectApiError(run: () => unknown, code: string, status: number) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    expect((error as ApiError).status).toBe(status);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe('validateTranslationRequest', () => {
  it('accepts a valid request and defaults source to auto', () => {
    expect(validateTranslationRequest({ text: 'Salom, yaxshimisan?', target: 'en' }, config))
      .toEqual({ text: 'Salom, yaxshimisan?', source: 'auto', target: 'en' });
  });

  it.each(['uz', 'en', 'ru'])('accepts supported target %s', (target) => {
    const source = target === 'en' ? 'uz' : 'en';
    expect(validateTranslationRequest({ text: 'x', source, target }, config).target).toBe(target);
  });

  it('normalizes language code case', () => {
    expect(validateTranslationRequest({ text: 'x', source: 'AUTO', target: 'RU' }, config))
      .toMatchObject({ source: 'auto', target: 'ru' });
  });

  it.each([
    [{ text: 'x', target: 'fr' }],
    [{ text: 'x', source: 'xx', target: 'en' }],
    [{ text: 'x', target: 'auto' }],
  ])('rejects unsupported languages %j', (body) => {
    expectApiError(() => validateTranslationRequest(body, config), 'unsupported_language', 400);
  });

  it.each(['', '   ', '\n\t '])('rejects empty text %j', (text) => {
    expectApiError(() => validateTranslationRequest({ text, target: 'en' }, config), 'empty_text', 400);
  });

  it('rejects text over the configured limit', () => {
    const limited = readConfig({ MAX_TEXT_CHARS: '5' });
    expect(validateTranslationRequest({ text: '12345', target: 'en' }, limited).text).toBe('12345');
    expectApiError(() => validateTranslationRequest({ text: '123456', target: 'en' }, limited), 'text_too_long', 413);
  });

  it('preserves Unicode, Uzbek characters, emoji and newlines unchanged', () => {
    const text = 'Oʻzbekiston gʻalaba 👋🏽 😀\nПривет — “quotes” & <tags>';
    expect(validateTranslationRequest({ text, target: 'en' }, config).text).toBe(text);
  });

  it('rejects lone surrogates', () => {
    expectApiError(() => validateTranslationRequest({ text: 'bad \ud800', target: 'en' }, config), 'invalid_request', 400);
  });

  it.each([null, [], 'text', 42, { text: 5, target: 'en' }, { text: 'x', target: 5 }])('rejects malformed body %j', (body) => {
    expectApiError(() => validateTranslationRequest(body, config), 'invalid_request', 400);
  });

  it('rejects identical source and target', () => {
    expectApiError(() => validateTranslationRequest({ text: 'x', source: 'en', target: 'en' }, config), 'invalid_request', 400);
  });
});

describe('readJsonBody', () => {
  const post = (body: BodyInit, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
    new Request('https://api.example.test/v1/translate', { method: 'POST', headers, body });

  it('parses JSON', async () => {
    await expect(readJsonBody(post('{"text":"salom"}'), 100)).resolves.toEqual({ text: 'salom' });
  });

  it('rejects invalid JSON', async () => {
    await expect(readJsonBody(post('{"text":'), 100)).rejects.toMatchObject({ code: 'invalid_json', status: 400 });
  });

  it('rejects invalid UTF-8', async () => {
    await expect(readJsonBody(post(new Uint8Array([0x22, 0xff, 0x22])), 100)).rejects.toMatchObject({ code: 'invalid_json' });
  });

  it('rejects non-JSON content types', async () => {
    await expect(readJsonBody(post('{}', { 'content-type': 'text/plain' }), 100))
      .rejects.toMatchObject({ code: 'unsupported_media_type', status: 415 });
  });

  it('rejects a declared Content-Length over the limit', async () => {
    await expect(readJsonBody(post('{}', { 'content-type': 'application/json', 'content-length': '101' }), 100))
      .rejects.toMatchObject({ code: 'payload_too_large', status: 413 });
  });

  it('rejects a streamed body over the limit even without Content-Length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`{"text":"${'a'.repeat(80)}`));
        controller.enqueue(new TextEncoder().encode(`${'a'.repeat(80)}"}`));
        controller.close();
      },
    });
    const request = new Request('https://api.example.test/v1/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    await expect(readJsonBody(request, 100)).rejects.toMatchObject({ code: 'payload_too_large' });
  });
});

describe('readConfig', () => {
  it('fails closed on invalid limits', () => {
    expect(() => readConfig({ MONTHLY_CHARACTER_LIMIT: 'unlimited' })).toThrowError(ApiError);
    expect(() => readConfig({ MAX_TEXT_CHARS: '-1' })).toThrowError(ApiError);
    expect(() => readConfig({ SUPPORTED_LANGUAGES: 'uz,<script>' })).toThrowError(ApiError);
  });

  it('supports adding languages through configuration', () => {
    expect([...readConfig({ SUPPORTED_LANGUAGES: 'uz, en, ru, tr' }).supportedLanguages]).toEqual(['uz', 'en', 'ru', 'tr']);
  });
});
