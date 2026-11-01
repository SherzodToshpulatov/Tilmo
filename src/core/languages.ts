// Add a language here and to the backend's SUPPORTED_LANGUAGES to support it.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uz', label: 'Oʻzbekcha' },
  { code: 'ru', label: 'Русский' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** `auto` means "let the provider detect it", where the provider supports that. */
export type SourceLanguage = 'auto' | LanguageCode;

export const DEFAULT_TARGET_LANGUAGE: LanguageCode = 'en';

export function isSupportedLanguage(code: unknown): code is LanguageCode {
  return LANGUAGES.some((language) => language.code === code);
}

export function isSourceLanguage(code: unknown): code is SourceLanguage {
  return code === 'auto' || isSupportedLanguage(code);
}

/**
 * The source language to use with the current provider. Providers without
 * detection get a concrete language that differs from the target.
 */
export function resolveSourceLanguage(
  stored: SourceLanguage,
  target: LanguageCode,
  supportsAutoDetect: boolean,
): SourceLanguage {
  if (stored === 'auto' ? supportsAutoDetect : stored !== target) return stored;
  return target === 'uz' ? 'en' : 'uz';
}

/** Label for any language code, including detected ones outside the list. */
export function languageLabel(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.label ?? code.toUpperCase();
}
