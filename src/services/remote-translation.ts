import {
  TranslationError,
  type TranslationErrorCode,
  type TranslationRequest,
  type TranslationResult,
  type TranslationService,
} from './translation';

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export interface RemoteTranslationOptions {
  baseUrl: string;
  accessToken: string;
  timeoutMs?: number;
  fetch?: Fetch;
}

const SERVER_ERROR_CODES: Partial<Record<string, TranslationErrorCode>> = {
  unauthorized: 'unauthorized',
  rate_limited: 'rate_limited',
  provider_rate_limited: 'rate_limited',
  quota_exceeded: 'quota_exceeded',
  provider_timeout: 'timeout',
  text_too_long: 'text_too_long',
  payload_too_large: 'text_too_long',
  empty_text: 'invalid_request',
  invalid_request: 'invalid_request',
  invalid_json: 'invalid_request',
  unsupported_language: 'invalid_request',
};

function codeForStatus(status: number): TranslationErrorCode {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status === 504) return 'timeout';
  if (status >= 400 && status < 500) return 'invalid_request';
  return 'server_error';
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function parseResult(body: unknown): TranslationResult {
  const { translatedText, detectedSourceLanguage, provider } = (body ?? {}) as Record<string, unknown>;
  if (typeof translatedText !== 'string' || typeof provider !== 'string' ||
    (detectedSourceLanguage !== undefined && typeof detectedSourceLanguage !== 'string')) {
    throw new TranslationError('invalid_response');
  }
  return { translatedText, detectedSourceLanguage, provider };
}

/** Calls the Browser Translator backend (`POST /v1/translate`). */
export class RemoteTranslationService implements TranslationService {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: Fetch;

  constructor(private readonly options: RemoteTranslationOptions) {
    this.endpoint = new URL('v1/translate', options.baseUrl.replace(/\/*$/, '/')).toString();
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.accessToken}`,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeoutMs),
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (error) {
      throw new TranslationError(isTimeout(error) ? 'timeout' : 'offline');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (isTimeout(error)) throw new TranslationError('timeout');
      throw new TranslationError(response.ok ? 'invalid_response' : codeForStatus(response.status));
    }

    if (!response.ok) {
      const serverCode = (body as { error?: { code?: unknown } } | null)?.error?.code;
      throw new TranslationError(
        (typeof serverCode === 'string' && SERVER_ERROR_CODES[serverCode]) || codeForStatus(response.status),
      );
    }
    return parseResult(body);
  }
}
