export type ColorScheme = 'light' | 'dark';

const MAX_DEPTH = 25;

function parseRgb(color: string): { r: number; g: number; b: number; a: number } | null {
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(color.trim());
  if (!match) return null;
  const alphaText = match[4];
  const alpha = alphaText === undefined ? 1 : alphaText.endsWith('%') ? Number.parseFloat(alphaText) / 100 : Number(alphaText);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
}

/** WCAG relative luminance of an sRGB colour, 0 (black) to 1 (white). */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * The colour scheme the page actually shows behind `element`: the first opaque
 * background found walking up the tree decides. Host-page CSS variables are not
 * relied on, so it works the same on Telegram and Instagram in either theme.
 */
export function detectColorScheme(element: Element | null): ColorScheme {
  let node: Element | null = element;
  for (let depth = 0; node && depth < MAX_DEPTH; depth += 1) {
    const background = parseRgb(getComputedStyle(node).backgroundColor);
    if (background && background.a >= 0.5) return luminance(background) < 0.4 ? 'dark' : 'light';
    node = node.parentElement;
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
