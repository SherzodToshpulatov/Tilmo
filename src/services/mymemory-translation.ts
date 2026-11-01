import { decodeHtmlEntities } from '../utils/html-entities';
import {
  TranslationError,
  type TranslationRequest,
  type TranslationResult,
  type TranslationService,
} from './translation';

export const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
export const MYMEMORY_MAX_QUERY_BYTES = 500;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export interface MyMemoryOptions {
  /** Optional contact email (`de`), which raises MyMemory's daily allowance. */
  email?: string;
  timeoutMs?: number;
  fetch?: Fetch;
}

const QUOTA_MESSAGE = 'MyMemory’s free daily limit is used up. Add a contact email in the extension settings for a higher limit, or try again later.';
// Translation-memory matches can carry XLIFF inline placeholders, e.g. <x id="1"/>.
const PLACEHOLDER_TAG = /<\/?(?:x|g|bx|ex|ph|bpt|ept|it)\b[^<>]*>/gi;

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function comparable(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function cleanTranslation(translated: string, sourceText: string): string {
  // Only strip tags MyMemory added, never markup the user typed.
  const withoutPlaceholders = sourceText.includes('<') ? translated : translated.replace(PLACEHOLDER_TAG, '');
  return decodeHtmlEntities(withoutPlaceholders).trim();
}

/**
 * Validates a MyMemory `/get` response. MyMemory reports errors with HTTP 200
 * and a non-200 `responseStatus`, and copies the error into `translatedText`,
 * so the status must be checked before the text is trusted.
 */
export function parseMyMemoryResponse(body: unknown, request: TranslationRequest): TranslationResult {
  if (typeof body !== 'object' || body === null) throw new TranslationError('invalid_response');
  const { responseStatus, responseDetails, responseData, quotaFinished } = body as Record<string, unknown>;
  const status = Number(responseStatus);
  const details = typeof responseDetails === 'string' ? responseDetails : '';
  const translated = (responseData as { translatedText?: unknown } | null | undefined)?.translatedText;

  if (quotaFinished === true || status === 429 ||
    /MYMEMORY WARNING/i.test(details) || (typeof translated === 'string' && /^MYMEMORY WARNING/i.test(translated))) {
    throw new TranslationError('quota_exceeded', QUOTA_MESSAGE);
  }

  if (Number.isNaN(status)) throw new TranslationError('invalid_response');
  if (status !== 200) {
    // Error details end with an example URL containing "LANGPAIR=", so match
    // the specific failure first rather than the word LANGPAIR.
    if (/QUERY LENGTH LIMIT/i.test(details)) {
      throw new TranslationError('text_too_long', `MyMemory accepts at most ${MYMEMORY_MAX_QUERY_BYTES} bytes per translation.`);
    }
    if (/NO QUERY/i.test(details)) throw new TranslationError('invalid_request');
    if (/INVALID (SOURCE|TARGET) LANGUAGE|DISTINCT LANGUAGES/i.test(details)) {
      throw new TranslationError('language_pair_unavailable');
    }
    throw new TranslationError('server_error', 'MyMemory could not translate this text. Try again later.');
  }

  if (typeof translated !== 'string') throw new TranslationError('invalid_response');
  const translatedText = cleanTranslation(translated, request.text);
  if (!translatedText) throw new TranslationError('empty_translation');
  // An unchanged echo means MyMemory had nothing for this pair; do not present it as a translation.
  if (/\p{L}/u.test(request.text) && comparable(translatedText) === comparable(request.text)) {
    throw new TranslationError('no_translation');
  }

  return { translatedText, detectedSourceLanguage: request.source, provider: 'mymemory' };
}

/** Calls MyMemory directly; it needs no key and allows any origin (CORS `*`). */
export class MyMemoryTranslationService implements TranslationService {
  private readonly timeoutMs: number;
  private readonly fetchImpl: Fetch;

  constructor(private readonly options: MyMemoryOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { text, source, target } = request;
    // MyMemory rejects `auto`; the caller must pick the source language.
    if (source === 'auto') throw new TranslationError('source_language_required');
    if (source === target) throw new TranslationError('invalid_request', 'Choose two different languages.');

    const bytes = utf8ByteLength(text);
    if (bytes > MYMEMORY_MAX_QUERY_BYTES) {
      throw new TranslationError(
        'text_too_long',
        `MyMemory accepts at most ${MYMEMORY_MAX_QUERY_BYTES} bytes per translation; this draft is ${bytes} bytes. Shorten it or use another translator.`,
      );
    }

    const url = new URL(MYMEMORY_ENDPOINT);
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${source}|${target}`);
    const email = this.options.email?.trim();
    if (email) url.searchParams.set('de', email);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch (error) {
      throw new TranslationError(isTimeout(error) ? 'timeout' : 'offline');
    }

    if (response.status === 429) throw new TranslationError('quota_exceeded', QUOTA_MESSAGE);
    if (!response.ok) throw new TranslationError('server_error', 'MyMemory is unavailable right now. Try again later.');

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new TranslationError(isTimeout(error) ? 'timeout' : 'invalid_response');
    }
    return parseMyMemoryResponse(body, request);
  }
}
