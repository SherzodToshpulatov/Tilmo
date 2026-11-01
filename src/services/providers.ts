export type TranslationProviderId = 'mymemory' | 'remote' | 'mock';

export interface TranslationProviderInfo {
  label: string;
  /** Whether the provider accepts `source: 'auto'`. */
  supportsAutoDetect: boolean;
}

export const TRANSLATION_PROVIDERS: Record<TranslationProviderId, TranslationProviderInfo> = {
  mymemory: { label: 'MyMemory (Free)', supportsAutoDetect: false },
  remote: { label: 'Google Cloud (your server)', supportsAutoDetect: true },
  mock: { label: 'Demo (offline, not real)', supportsAutoDetect: true },
};

export function isTranslationProviderId(value: unknown): value is TranslationProviderId {
  return typeof value === 'string' && Object.hasOwn(TRANSLATION_PROVIDERS, value);
}
