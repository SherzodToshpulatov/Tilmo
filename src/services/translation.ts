export interface TranslationRequest {
  text: string;
  /** `auto` asks the provider to detect the source language. */
  source: 'auto' | string;
  target: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  provider: string;
}

export interface TranslationService {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export type TranslationErrorCode =
  | 'not_configured'
  | 'permission_missing'
  | 'offline'
  | 'timeout'
  | 'unauthorized'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'text_too_long'
  | 'invalid_request'
  | 'server_error'
  | 'invalid_response'
  | 'source_language_required'
  | 'language_pair_unavailable'
  | 'empty_translation'
  | 'extension_unavailable';

export const TRANSLATION_ERROR_MESSAGES: Record<TranslationErrorCode, string> = {
  not_configured: 'Translation is not set up. Open the extension popup to add the server URL and access token.',
  permission_missing: 'The extension needs permission to reach the translation server. Save the settings in the popup again.',
  offline: 'Could not reach the translation server. Check your connection and try again.',
  timeout: 'The translation took too long. Try again.',
  unauthorized: 'The translation server rejected the access token. Check it in the extension popup.',
  rate_limited: 'Too many translations right now. Wait a moment and try again.',
  quota_exceeded: 'The monthly translation limit has been reached.',
  text_too_long: 'This draft is too long to translate at once.',
  invalid_request: 'The translation server could not accept this draft.',
  server_error: 'The translation server had a problem. Try again later.',
  invalid_response: 'The translation server returned an unexpected response.',
  source_language_required: 'This translator cannot detect languages. Choose the language your draft is written in.',
  language_pair_unavailable: 'This translator does not support this language pair.',
  empty_translation: 'The translator returned an empty translation.',
  extension_unavailable: 'The extension was updated. Reload this tab to keep translating.',
};

export class TranslationError extends Error {
  constructor(readonly code: TranslationErrorCode, message = TRANSLATION_ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'TranslationError';
  }
}

const DEMO_TRANSLATIONS = new Map<string, string>([
  ['salom, yaxshimisan?', 'Hello, how are you?'],
  ['salom', 'Hello'],
  ['rahmat', 'Thank you'],
]);

/** Offline demo translator for development and testing. Never used as a fallback. */
export const mockTranslationService: TranslationService = {
  async translate({ text }) {
    const normalized = text.trim().toLocaleLowerCase();
    const knownTranslation = DEMO_TRANSLATIONS.get(normalized);
    if (knownTranslation) return { translatedText: knownTranslation, detectedSourceLanguage: 'uz', provider: 'mock' };

    await Promise.resolve();
    return { translatedText: `[Demo translation — not a real translation] ${text}`, provider: 'mock' };
  },
};
