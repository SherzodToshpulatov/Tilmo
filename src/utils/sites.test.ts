import { describe, expect, it } from 'vitest';
import { isInstagramDirectPath } from './sites';

describe('isInstagramDirectPath', () => {
  it.each(['/direct', '/direct/', '/direct/inbox/', '/direct/t/1234567890/'])('matches %s', (pathname) => {
    expect(isInstagramDirectPath(pathname)).toBe(true);
  });

  it.each(['/', '/directory', '/directory/', '/explore/', '/p/abc123/', '/someone/'])('ignores %s', (pathname) => {
    expect(isInstagramDirectPath(pathname)).toBe(false);
  });
});
