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
