import { describe, expect, it } from 'vitest';
import { EDGE_GAP, MIN_PANEL_HEIGHT, computeFloatingLayout } from './layout';

// Telegram's composer as measured in a 1400×1000 window (see the Phase 1 report).
const telegramComposer = { top: 899, right: 1011, bottom: 939, left: 455 };
const viewport = { viewportWidth: 1400, viewportHeight: 1000 };

describe('computeFloatingLayout', () => {
  it('places the compact button above the composer, right-aligned', () => {
    expect(computeFloatingLayout({ anchor: telegramComposer, contentWidth: 36, contentHeight: 36, ...viewport }))
      .toEqual({ left: 1011 - 36, top: 899 - 36 - EDGE_GAP, maxHeight: 899 - EDGE_GAP * 2 });
  });

  it('keeps an open panel above the composer and inside the viewport', () => {
    const layout = computeFloatingLayout({ anchor: telegramComposer, contentWidth: 340, contentHeight: 320, ...viewport });
    expect(layout.top + 320).toBeLessThanOrEqual(telegramComposer.top - EDGE_GAP);
    expect(layout.left).toBe(1011 - 340);
  });

  it('caps a tall panel to the room above the composer instead of covering it', () => {
    // High zoom: the composer sits 300px from the top and the panel wants 600px.
    const anchor = { top: 300, right: 700, bottom: 340, left: 100 };
    const layout = computeFloatingLayout({ anchor, contentWidth: 340, contentHeight: 600, viewportWidth: 800, viewportHeight: 400 });
    expect(layout.maxHeight).toBe(300 - EDGE_GAP * 2);
    expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(anchor.top - EDGE_GAP);
  });

  it('allows overlap only when there is almost no room above the composer', () => {
    const anchor = { top: 60, right: 700, bottom: 100, left: 100 };
    const layout = computeFloatingLayout({ anchor, contentWidth: 340, contentHeight: 600, viewportWidth: 800, viewportHeight: 700 });
    expect(layout.maxHeight).toBe(MIN_PANEL_HEIGHT);
    expect(layout.top).toBeGreaterThanOrEqual(EDGE_GAP);
    expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(700 - EDGE_GAP);
  });

  it.each([
    ['narrow window', { anchor: { top: 500, right: 300, bottom: 540, left: 10 }, contentWidth: 340, contentHeight: 300, viewportWidth: 320, viewportHeight: 600 }],
    ['composer near the left edge', { anchor: { top: 500, right: 40, bottom: 540, left: 0 }, contentWidth: 340, contentHeight: 300, viewportWidth: 1200, viewportHeight: 800 }],
    ['tiny viewport (150% zoom)', { anchor: { top: 380, right: 600, bottom: 420, left: 0 }, contentWidth: 340, contentHeight: 500, viewportWidth: 640, viewportHeight: 427 }],
    ['composer scrolled off the bottom', { anchor: { top: 1200, right: 900, bottom: 1240, left: 100 }, contentWidth: 340, contentHeight: 300, viewportWidth: 1000, viewportHeight: 800 }],
  ])('never leaves the viewport: %s', (_label, input) => {
    const layout = computeFloatingLayout(input);
    const width = Math.min(input.contentWidth, input.viewportWidth - EDGE_GAP * 2);
    expect(layout.left).toBeGreaterThanOrEqual(EDGE_GAP);
    expect(layout.left + width).toBeLessThanOrEqual(input.viewportWidth - EDGE_GAP);
    expect(layout.top).toBeGreaterThanOrEqual(EDGE_GAP);
    expect(layout.top + Math.min(input.contentHeight, layout.maxHeight)).toBeLessThanOrEqual(input.viewportHeight - EDGE_GAP);
    expect(layout.maxHeight).toBeLessThanOrEqual(input.viewportHeight - EDGE_GAP * 2);
  });
});
