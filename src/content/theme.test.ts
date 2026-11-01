// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectColorScheme } from './theme';

afterEach(() => {
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
  vi.unstubAllGlobals();
});

function nested(outerStyle: string) {
  document.body.innerHTML = `<div style="${outerStyle}"><div><div class="composer"></div></div></div>`;
  return document.querySelector('.composer')!;
}

describe('detectColorScheme', () => {
  it.each([
    ['Telegram night background', 'background-color: rgb(33, 33, 33)', 'dark'],
    ['Instagram dark background', 'background-color: rgb(0, 0, 0)', 'dark'],
    ['Telegram light background', 'background-color: rgb(255, 255, 255)', 'light'],
    ['Instagram light grey', 'background-color: rgb(250, 250, 250)', 'light'],
    ['mid-dark slate', 'background-color: rgb(60, 64, 72)', 'dark'],
  ])('reads the first opaque background: %s', (_label, style, expected) => {
    expect(detectColorScheme(nested(style))).toBe(expected);
  });

  it('skips transparent and translucent layers', () => {
    document.body.innerHTML = `
      <div style="background-color: rgb(24, 25, 26)">
        <div style="background-color: rgba(255, 255, 255, 0.1)"><div style="background-color: transparent" class="composer"></div></div>
      </div>`;
    expect(detectColorScheme(document.querySelector('.composer'))).toBe('dark');
  });

  it('falls back to the system preference when no background is set', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('dark') }));
    expect(detectColorScheme(nested(''))).toBe('dark');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(detectColorScheme(nested(''))).toBe('light');
  });
});
