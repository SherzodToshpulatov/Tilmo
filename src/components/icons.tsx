// Inline SVG icons shared by the floating panel and the popup.

export function TranslateIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 5h9" />
      <path d="M7.5 3v2" />
      <path d="M10.5 5c-.6 3.6-2.9 6.6-6.5 8.5" />
      <path d="M5.5 8.5c1 1.9 2.6 3.4 4.6 4.3" />
      <path d="M12.5 21l4-9 4 9" />
      <path d="M14 17.8h5" />
    </svg>
  );
}

export function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h14" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H7" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** The Tilmo app mark on its navy tile (same geometry as assets/brand/tilmo-icon-dark.svg). */
export function TilmoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="120" height="120" rx="28" fill="#0F172A" />
      <rect x="56" y="38" width="16" height="60" rx="8" fill="#F8FAFC" />
      <rect x="60" y="38" width="44" height="16" rx="8" fill="#F8FAFC" />
      <rect x="24" y="30" width="48" height="16" rx="8" fill="#22D3EE" />
    </svg>
  );
}
