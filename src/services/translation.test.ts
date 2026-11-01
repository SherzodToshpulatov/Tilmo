import { describe, expect, it } from 'vitest';
import { DEFAULT_TARGET_LANGUAGE, isSupportedLanguage, languageLabel, resolveSourceLanguage } from '../core/languages';
import { TRANSLATION_PROVIDERS, isTranslationProviderId } from './providers';
import { TRANSLATION_ERROR_MESSAGES, TranslationError, mockTranslationService } from './translation';

describe('mockTranslationService', () => {
  it.each([
    ['Salom, yaxshimisan?', 'Hello, how are you?'],
    ['  SALOM ', 'Hello'],
    ['rahmat', 'Thank you'],
  ])('keeps the demo phrase %j → %j', async (text, translatedText) => {
    expect(await mockTranslationService.translate({ text, source: 'auto', target: 'en' }))
      .toEqual({ translatedText, detectedSourceLanguage: 'uz', provider: 'mock' });
  });

  it('labels anything else as a demo translation and keeps the text intact', async () => {
    const text = 'nima gap 👋\nikkinchi qator';
    expect(await mockTranslationService.translate({ text, source: 'auto', target: 'ru' })).toEqual({
      translatedText: `[Demo translation — not a real translation] ${text}`,
      provider: 'mock',
    });
  });
});

describe('providers', () => {
  it('offers MyMemory without auto-detection next to Google Cloud and the demo', () => {
    expect(TRANSLATION_PROVIDERS.mymemory).toMatchObject({ label: 'MyMemory (Free)', shortLabel: 'MyMemory', supportsAutoDetect: false });
    expect(TRANSLATION_PROVIDERS.remote.supportsAutoDetect).toBe(true);
    expect(isTranslationProviderId('mymemory')).toBe(true);
    expect(isTranslationProviderId('toString')).toBe(false);
  });
});

describe('TranslationError', () => {
  it('uses the user-facing message for its code', () => {
    const error = new TranslationError('quota_exceeded');
    expect(error.message).toBe(TRANSLATION_ERROR_MESSAGES.quota_exceeded);
    expect(error.code).toBe('quota_exceeded');
  });
});

describe('languages', () => {
  it('supports Uzbek, English and Russian with English as the default target', () => {
    expect(['uz', 'en', 'ru'].every(isSupportedLanguage)).toBe(true);
    expect(isSupportedLanguage('fr')).toBe(false);
    expect(DEFAULT_TARGET_LANGUAGE).toBe('en');
  });

  it.each([
    ['auto', 'en', true, 'auto'],
    ['auto', 'en', false, 'uz'],
    ['auto', 'uz', false, 'en'],
    ['ru', 'en', false, 'ru'],
    ['en', 'en', false, 'uz'],
    ['uz', 'uz', true, 'en'],
  ] as const)('resolves stored source %s with target %s (auto-detect: %s) to %s', (stored, target, autoDetect, expected) => {
    expect(resolveSourceLanguage(stored, target, autoDetect)).toBe(expected);
  });

  it('labels detected languages outside the list by code', () => {
    expect(languageLabel('uz')).toBe('Oʻzbekcha');
    expect(languageLabel('tr')).toBe('TR');
  });
});
