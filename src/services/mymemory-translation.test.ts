import { describe, expect, it, vi } from 'vitest';
import { MYMEMORY_ENDPOINT, MyMemoryTranslationService, utf8ByteLength } from './mymemory-translation';
import { TranslationError, type TranslationErrorCode, type TranslationRequest } from './translation';

const UZ_EN: TranslationRequest = { text: 'Salom, yaxshimisan?', source: 'uz', target: 'en' };

// Shapes below are copied from real MyMemory responses (2026-11-01).
function ok(translatedText: string, extra: Record<string, unknown> = {}) {
  return { responseData: { translatedText, match: 0.85 }, quotaFinished: false, responseDetails: '', responseStatus: 200, ...extra };
}

function failure(details: string, status: string | number = '403') {
  return { responseData: { translatedText: details, match: null }, quotaFinished: null, responseDetails: details, responseStatus: status };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function service(body: unknown, options: { status?: number; email?: string } = {}) {
  const fetchImpl = vi.fn(async (_input: string, _init: RequestInit) => json(body, options.status));
  return { fetchImpl, translator: new MyMemoryTranslationService({ fetch: fetchImpl, email: options.email }) };
}

async function failureOf(promise: Promise<unknown>): Promise<TranslationError> {
  const error = await promise.then(() => null, (reason: unknown) => reason);
  expect(error).toBeInstanceOf(TranslationError);
  return error as TranslationError;
}

async function codeOf(promise: Promise<unknown>): Promise<TranslationErrorCode> {
  return (await failureOf(promise)).code;
}

describe('MyMemoryTranslationService', () => {
  it('sends a GET with q and langpair and returns the translation', async () => {
    const { fetchImpl, translator } = service(ok('Hello how are you doing?'));
    expect(await translator.translate(UZ_EN)).toEqual({
      translatedText: 'Hello how are you doing?',
      detectedSourceLanguage: 'uz',
      provider: 'mymemory',
    });

    const [input, init] = fetchImpl.mock.calls[0]!;
    const url = new URL(input);
    expect(`${url.origin}${url.pathname}`).toBe(MYMEMORY_ENDPOINT);
    expect(url.searchParams.get('q')).toBe('Salom, yaxshimisan?');
    expect(url.searchParams.get('langpair')).toBe('uz|en');
    expect(url.searchParams.has('de')).toBe(false);
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('omit');
  });

  it('adds the optional contact email as `de`', async () => {
    const { fetchImpl, translator } = service(ok('Hi, how are you?'), { email: ' me@example.com ' });
    await translator.translate({ text: 'Привет, как дела?', source: 'ru', target: 'en' });
    expect(new URL(fetchImpl.mock.calls[0]![0]).searchParams.get('de')).toBe('me@example.com');
  });

  it('never sends `auto`, which MyMemory rejects', async () => {
    const { fetchImpl, translator } = service(ok('x'));
    expect(await codeOf(translator.translate({ ...UZ_EN, source: 'auto' }))).toBe('source_language_required');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects identical languages before sending', async () => {
    const { fetchImpl, translator } = service(ok('x'));
    expect(await codeOf(translator.translate({ text: 'Hello', source: 'en', target: 'en' }))).toBe('invalid_request');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  describe('500-byte limit', () => {
    it('counts UTF-8 bytes, not characters', () => {
      expect(utf8ByteLength('a')).toBe(1);
      expect(utf8ByteLength('ў')).toBe(2);
      expect(utf8ByteLength('👋')).toBe(4);
    });

    it.each([
      ['500 ASCII bytes', 'a'.repeat(500), true],
      ['501 ASCII bytes', 'a'.repeat(501), false],
      ['250 Cyrillic letters (500 bytes)', 'п'.repeat(250), true],
      ['251 Cyrillic letters (502 bytes)', 'п'.repeat(251), false],
      ['125 emoji (500 bytes)', '👋'.repeat(125), true],
      ['126 emoji (504 bytes)', '👋'.repeat(126), false],
    ])('%s → allowed: %s', async (_label, text, allowed) => {
      const { fetchImpl, translator } = service(ok('translated text'));
      const request = { text, source: 'ru', target: 'en' };
      if (allowed) {
        await translator.translate(request);
        expect(fetchImpl).toHaveBeenCalledOnce();
      } else {
        const error = await failureOf(translator.translate(request));
        expect(error.code).toBe('text_too_long');
        expect(error.message).toMatch(/500 bytes/);
        expect(fetchImpl).not.toHaveBeenCalled();
      }
    });
  });

  it.each([
    ['invalid source', "'AUTO' IS AN INVALID SOURCE LANGUAGE . EXAMPLE: LANGPAIR=EN|IT USING 2 LETTER ISO OR RFC3066 LIKE ZH-CN.", 'language_pair_unavailable'],
    ['invalid target', "'XX' IS AN INVALID TARGET LANGUAGE . EXAMPLE: LANGPAIR=EN|IT USING 2 LETTER ISO OR RFC3066 LIKE ZH-CN.", 'language_pair_unavailable'],
    ['same languages', 'PLEASE SELECT TWO DISTINCT LANGUAGES', 'language_pair_unavailable'],
    ['query too long', 'QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS', 'text_too_long'],
    ['no query', 'NO QUERY SPECIFIED. EXAMPLE REQUEST: GET?Q=HELLO&LANGPAIR=EN|IT', 'invalid_request'],
    ['unknown error', 'SOMETHING ELSE WENT WRONG', 'server_error'],
  ])('treats HTTP 200 with responseStatus 403 (%s) as an error, not a translation', async (_label, details, code) => {
    const { translator } = service(failure(details));
    const error = await failureOf(translator.translate(UZ_EN));
    expect(error.code).toBe(code);
    // The API's error text (copied into translatedText) is never shown as a translation or message.
    expect(error.message).not.toContain(details);
  });

  it.each([
    ['quotaFinished flag', ok('anything', { quotaFinished: true })],
    ['responseStatus 429', failure('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.', 429)],
    ['warning in translatedText', ok('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 10 HOURS')],
  ])('reports quota exhaustion (%s)', async (_label, body) => {
    const error = await failureOf(service(body).translator.translate(UZ_EN));
    expect(error.code).toBe('quota_exceeded');
    expect(error.message).toMatch(/email/i);
  });

  it('reports HTTP 429 as quota exhaustion', async () => {
    expect(await codeOf(service({}, { status: 429 }).translator.translate(UZ_EN))).toBe('quota_exceeded');
  });

  it('reports HTTP 5xx as a server error', async () => {
    expect(await codeOf(service({}, { status: 503 }).translator.translate(UZ_EN))).toBe('server_error');
  });

  it.each([['   '], ['<x id="1"/><x id="2"/>']])('reports an empty translation %j', async (translatedText) => {
    expect(await codeOf(service(ok(translatedText)).translator.translate(UZ_EN))).toBe('empty_translation');
  });

  it('reports an unchanged echo as no translation instead of showing it', async () => {
    const { translator } = service(ok(' salom, YAXSHIMISAN? '));
    expect(await codeOf(translator.translate(UZ_EN))).toBe('no_translation');
  });

  it.each([
    [{}],
    [{ responseStatus: 200, responseData: {} }],
    [{ responseStatus: 200, responseData: { translatedText: 42 } }],
    [{ responseStatus: 200, responseData: null }],
    [null],
  ])('rejects a malformed response %j', async (body) => {
    expect(await codeOf(service(body).translator.translate(UZ_EN))).toBe('invalid_response');
  });

  it('rejects a non-JSON body', async () => {
    const translator = new MyMemoryTranslationService({ fetch: async () => new Response('<html>', { status: 200 }) });
    expect(await codeOf(translator.translate(UZ_EN))).toBe('invalid_response');
  });

  it('strips translation-memory placeholders and decodes entities as text', async () => {
    const { translator } = service(ok('<x id="1"/>Katta rahmat.<x id="2"/> It&#39;s &quot;ok&quot; &amp; &lt;b&gt;'));
    const result = await translator.translate({ text: 'Thank you very much', source: 'en', target: 'uz' });
    expect(result.translatedText).toBe('Katta rahmat. It\'s "ok" & <b>');
  });

  it('keeps tags when the user typed markup themselves', async () => {
    const { translator } = service(ok('Используйте <x id="1"/> тег'));
    const result = await translator.translate({ text: 'Use the <x id="1"/> tag', source: 'en', target: 'ru' });
    expect(result.translatedText).toBe('Используйте <x id="1"/> тег');
  });

  it('preserves emoji and newlines', async () => {
    const { translator } = service(ok('Здравствуйте, друг 👋\nДо завтра'));
    const result = await translator.translate({ text: 'Hello friend 👋\nSee you tomorrow', source: 'en', target: 'ru' });
    expect(result.translatedText).toBe('Здравствуйте, друг 👋\nДо завтра');
  });

  it('reports network failures and timeouts', async () => {
    const offline = new MyMemoryTranslationService({ fetch: async () => { throw new TypeError('Failed to fetch'); } });
    expect(await codeOf(offline.translate(UZ_EN))).toBe('offline');

    const hanging = new MyMemoryTranslationService({
      timeoutMs: 20,
      fetch: (_input, init) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
    });
    expect(await codeOf(hanging.translate(UZ_EN))).toBe('timeout');
  });
});
