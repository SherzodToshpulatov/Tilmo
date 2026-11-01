import { describe, expect, it } from 'vitest';
import { isSameText } from './text';

describe('isSameText', () => {
  it.each([
    ['Telegram', 'Telegram'],
    ['  OK ', 'ok'],
    ['salom\nqalaysan', 'Salom qalaysan'],
    ['Oʻzbek 👋', 'oʻzbek 👋'],
    ['é', 'é'],
  ])('treats %j and %j as the same', (a, b) => {
    expect(isSameText(a, b)).toBe(true);
  });

  it.each([
    ['Salom', 'Hello'],
    ['Привет', 'Hi'],
    ['👋', '👍'],
  ])('treats %j and %j as different', (a, b) => {
    expect(isSameText(a, b)).toBe(false);
  });
});
