export type TranslationProviderId = 'mymemory' | 'remote' | 'mock';

export interface TranslationProviderInfo {
  label: string;
  /** Compact name shown in the translation panel. */
  shortLabel: string;
  /** One-line explanation shown in the settings popup. */
  description: string;
  /** Whether the provider accepts `source: 'auto'`. */
  supportsAutoDetect: boolean;
}

export const TRANSLATION_PROVIDERS: Record<TranslationProviderId, TranslationProviderInfo> = {
  mymemory: {
    label: 'MyMemory (Free)',
    shortLabel: 'MyMemory',
    description: 'Free, no account or server needed. Choose the language you write in; MyMemory cannot detect it.',
    supportsAutoDetect: false,
  },
  remote: {
    label: 'Google Cloud (your server)',
    shortLabel: 'Google Cloud',
    description: 'Google Cloud Translation through your own Browser Translator server. Detects the language automatically.',
    supportsAutoDetect: true,
  },
  mock: {
    label: 'Demo (offline, not real)',
    shortLabel: 'Demo',
    description: 'Offline placeholder output for trying the interface. Not a real translation.',
    supportsAutoDetect: true,
  },
};

export function isTranslationProviderId(value: unknown): value is TranslationProviderId {
  return typeof value === 'string' && Object.hasOwn(TRANSLATION_PROVIDERS, value);
}
