import { describe, expect, it } from 'vitest';
import { isInstagramDirectPath, isTranslatableTabUrl } from './sites';

describe('isTranslatableTabUrl (Ctrl+Shift+Y routing)', () => {
  it.each([
    'https://web.telegram.org/k/#@durov',
    'https://web.telegram.org/a/',
    'https://www.instagram.com/direct/inbox/',
    'https://www.instagram.com/direct/t/1234567890/',
    'https://www.instagram.com/direct',
  ])('routes %s', (url) => {
    expect(isTranslatableTabUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'not a url',
    'https://www.instagram.com/',
    'https://www.instagram.com/p/abc123/',
    'https://www.instagram.com/someone/',
    'https://www.instagram.com/directory/',
    'https://instagram.com/direct/inbox/',
    'http://www.instagram.com/direct/inbox/',
    'https://evil.example/direct/inbox/',
    'https://web.telegram.org.evil.example/k/',
    'chrome://extensions/',
  ])('ignores %s', (url) => {
    expect(isTranslatableTabUrl(url)).toBe(false);
  });
});

describe('isInstagramDirectPath', () => {
  it('matches only Direct routes', () => {
    expect(isInstagramDirectPath('/direct/t/1/')).toBe(true);
    expect(isInstagramDirectPath('/directory')).toBe(false);
    expect(isInstagramDirectPath('/explore/')).toBe(false);
  });
});
