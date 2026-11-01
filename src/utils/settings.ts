import { storage } from 'wxt/utils/storage';
import { DEFAULT_TARGET_LANGUAGE, type LanguageCode, type SourceLanguage } from '../core/languages';
import type { TranslationProviderId } from '../services/providers';

export type TranslationProviderSetting = TranslationProviderId;

/** Synced across the user's browsers; not sensitive. */
export const targetLanguageSetting = storage.defineItem<LanguageCode>('sync:targetLanguage', {
  fallback: DEFAULT_TARGET_LANGUAGE,
});

export const sourceLanguageSetting = storage.defineItem<SourceLanguage>('sync:sourceLanguage', {
  fallback: 'auto',
});

// Connection settings stay in local storage so the access token is not synced.
export const translationProviderSetting = storage.defineItem<TranslationProviderSetting>('local:translationProvider', {
  fallback: 'remote',
});

export const apiBaseUrlSetting = storage.defineItem<string>('local:apiBaseUrl', {
  fallback: import.meta.env.DEV ? 'http://localhost:8787' : '',
});

export const apiAccessTokenSetting = storage.defineItem<string>('local:apiAccessToken', {
  fallback: '',
});

/** Optional contact email sent to MyMemory as `de` for a higher daily limit. */
export const myMemoryEmailSetting = storage.defineItem<string>('local:myMemoryEmail', {
  fallback: '',
});

export function isValidContactEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates a backend URL and returns the host permission pattern it needs.
 * Plain HTTP is only allowed for local development servers.
 */
export function apiOriginPattern(baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return null;
  if (url.username || url.password) return null;
  // Chrome match patterns ignore ports, so this also covers e.g. localhost:8787.
  return `${url.protocol}//${url.hostname}/*`;
}
