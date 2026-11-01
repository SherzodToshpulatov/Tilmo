export interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FloatingLayoutInput {
  anchor: Rect;
  /** Natural size of the floating controls' content. */
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface FloatingLayout {
  left: number;
  top: number;
  /** Height the controls may use before scrolling internally. */
  maxHeight: number;
}

export const EDGE_GAP = 8;
/** Below this much room above the composer, the controls may overlap it. */
export const MIN_PANEL_HEIGHT = 200;

/**
 * Viewport coordinates for the floating controls: right-aligned with the
 * composer and above it, kept inside the viewport. The height is capped to the
 * room above the composer so a tall panel scrolls instead of covering the
 * composer and its Send button, unless there is almost no room (high zoom).
 */
export function computeFloatingLayout({
  anchor,
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
}: FloatingLayoutInput): FloatingLayout {
  const viewportRoom = Math.max(0, viewportHeight - EDGE_GAP * 2);
  const roomAbove = anchor.top - EDGE_GAP * 2;
  const maxHeight = Math.min(viewportRoom, Math.max(MIN_PANEL_HEIGHT, roomAbove));
  const width = Math.min(contentWidth, Math.max(0, viewportWidth - EDGE_GAP * 2));
  const height = Math.min(contentHeight, maxHeight);

  const left = Math.max(EDGE_GAP, Math.min(viewportWidth - width - EDGE_GAP, anchor.right - width));
  const preferredTop = anchor.top - height - EDGE_GAP;
  const top = preferredTop >= EDGE_GAP ? preferredTop : anchor.bottom + EDGE_GAP;
  return {
    left,
    top: Math.max(EDGE_GAP, Math.min(viewportHeight - height - EDGE_GAP, top)),
    maxHeight,
  };
}
