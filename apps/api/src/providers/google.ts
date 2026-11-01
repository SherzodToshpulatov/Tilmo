import { decodeHtmlEntities } from '../html-entities';
import type { TranslationRequest, TranslationResult } from '../types';
import { ProviderError, type ProviderErrorKind, type TranslationProvider } from './types';

/** Cloud Translation Basic (v2). */
export const GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

const QUOTA_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded']);

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isTimeout(error)) throw new ProviderError('timeout', response.status);
    return null;
  }
}

function errorReasons(body: unknown): string[] {
  const errors = (body as { error?: { errors?: unknown } } | null)?.error?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.map((entry) => (entry as { reason?: unknown })?.reason).filter((reason): reason is string => typeof reason === 'string');
}

function classifyFailure(status: number, body: unknown): ProviderErrorKind {
  if (status === 429) return 'rate_limited';
  if (status === 403 && errorReasons(body).some((reason) => QUOTA_REASONS.has(reason))) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  return 'rejected';
}

export class GoogleCloudTranslationProvider implements TranslationProvider {
  readonly name = 'google';

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    // Wrapped so `fetch` is never called with a foreign `this` in Workers.
    private readonly fetchImpl: Fetch = (input, init) => fetch(input, init),
  ) {}

  async translate({ text, source, target }: TranslationRequest): Promise<TranslationResult> {
    // format "text" keeps newlines and avoids HTML interpretation of the input.
    const body: Record<string, string> = { q: text, target, format: 'text' };
    if (source !== 'auto') body.source = source;

    let response: Response;
    try {
      response = await this.fetchImpl(GOOGLE_TRANSLATE_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          // Header instead of ?key= so the credential never appears in URLs or logs.
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new ProviderError(isTimeout(error) ? 'timeout' : 'unavailable');
    }

    const data = await readJson(response);
    if (!response.ok) throw new ProviderError(classifyFailure(response.status, data), response.status);

    const translation = (data as { data?: { translations?: unknown[] } } | null)?.data?.translations?.[0] as
      | { translatedText?: unknown; detectedSourceLanguage?: unknown }
      | undefined;
    if (typeof translation?.translatedText !== 'string') throw new ProviderError('invalid_response', response.status);

    const detected = typeof translation.detectedSourceLanguage === 'string'
      ? translation.detectedSourceLanguage.toLowerCase()
      : undefined;
    return {
      translatedText: decodeHtmlEntities(translation.translatedText),
      detectedSourceLanguage: source === 'auto' ? detected : source,
      provider: this.name,
    };
  }
}
