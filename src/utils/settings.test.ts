import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { apiOriginPattern, isValidContactEmail, sourceLanguageSetting, targetLanguageSetting } from './settings';

describe('isValidContactEmail', () => {
  it.each(['me@example.com', 'first.last+tag@mail.co.uz'])('accepts %s', (email) => {
    expect(isValidContactEmail(email)).toBe(true);
  });

  it.each(['', 'me', 'me@', '@example.com', 'me@example', 'a b@example.com', `${'a'.repeat(250)}@example.com`])('rejects %j', (email) => {
    expect(isValidContactEmail(email)).toBe(false);
  });
});

describe('apiOriginPattern', () => {
  it.each([
    ['https://browser-translator-api.example.workers.dev', 'https://browser-translator-api.example.workers.dev/*'],
    ['https://api.example.com/base/', 'https://api.example.com/*'],
    ['http://localhost:8787', 'http://localhost/*'],
    ['http://127.0.0.1:8787/', 'http://127.0.0.1/*'],
  ])('allows %s', (url, pattern) => {
    expect(apiOriginPattern(url)).toBe(pattern);
  });

  it.each(['', 'not a url', 'http://api.example.com', 'ftp://example.com', 'https://user:pass@api.example.com', 'javascript:alert(1)'])(
    'rejects %j',
    (url) => {
      expect(apiOriginPattern(url)).toBeNull();
    },
  );
});

describe('targetLanguageSetting', () => {
  it('defaults to English and persists the choice in sync storage', async () => {
    fakeBrowser.reset();
    expect(await targetLanguageSetting.getValue()).toBe('en');
    await targetLanguageSetting.setValue('ru');
    expect(await fakeBrowser.storage.sync.get('targetLanguage')).toEqual({ targetLanguage: 'ru' });
  });

  it('defaults the source language to auto', async () => {
    fakeBrowser.reset();
    expect(await sourceLanguageSetting.getValue()).toBe('auto');
  });
});
