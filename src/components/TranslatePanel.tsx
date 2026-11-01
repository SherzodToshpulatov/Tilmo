import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { LANGUAGES, languageLabel, type LanguageCode, type SourceLanguage } from '../core/languages';
import type { ColorScheme } from '../content/theme';
import { CloseIcon, SwapIcon, TranslateIcon } from './icons';

export type PanelStatus = 'idle' | 'loading' | 'replacing' | 'preview' | 'replaced' | 'error';

export interface PanelState {
  status: PanelStatus;
  translation: string;
  canReplace: boolean;
  error: string;
  /** The translation equals the draft (names, links, or no translation found). */
  unchanged?: boolean;
  detectedSourceLanguage?: string;
  /** Source language that was requested for the shown translation. */
  translationSource?: SourceLanguage;
  /** Target language of the shown translation. */
  translationTarget?: string;
  provider?: string;
}

export interface TranslatePanelProps {
  /** A supported composer is active. */
  visible: boolean;
  /** The panel is expanded; otherwise only the compact button shows. */
  open: boolean;
  state: PanelState;
  colorScheme: ColorScheme;
  accentColor: string;
  providerLabel: string;
  sourceLanguage: SourceLanguage;
  /** Offer "Auto" only when the selected translator can detect languages. */
  supportsAutoDetect: boolean;
  targetLanguage: LanguageCode;
  canSwapLanguages: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSourceLanguageChange: (language: SourceLanguage) => void;
  onTargetLanguageChange: (language: LanguageCode) => void;
  onSwapLanguages: () => void;
  onTranslate: () => void;
  onReplace: () => void;
  onUndo: () => void;
  onCopy: () => Promise<boolean>;
}

// Extension-owned tokens: host-page CSS variables are not relied on.
const styles = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .translate-root {
    --bt-surface: #ffffff; --bt-surface-2: #f0f2f5; --bt-text: #1c1e21; --bt-muted: #65676b;
    --bt-border: rgba(0, 0, 0, .12); --bt-shadow: 0 8px 28px rgba(0, 0, 0, .18), 0 1px 3px rgba(0, 0, 0, .1);
    --bt-error: #b3261e; --bt-error-bg: #fdecea; --bt-notice: #7a4b00; --bt-notice-bg: #fff4e0;
    --bt-on-accent: #ffffff;
    color-scheme: light;
    display: flex; flex-direction: column; align-items: flex-end;
    font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--bt-text); pointer-events: none;
  }
  .translate-root[data-theme="dark"] {
    --bt-surface: #242526; --bt-surface-2: #3a3b3c; --bt-text: #e4e6eb; --bt-muted: #b0b3b8;
    --bt-border: rgba(255, 255, 255, .14); --bt-shadow: 0 8px 28px rgba(0, 0, 0, .55), 0 1px 3px rgba(0, 0, 0, .4);
    --bt-error: #ffb4ab; --bt-error-bg: #3b1d1b; --bt-notice: #ffcc80; --bt-notice-bg: #3a2c12;
    color-scheme: dark;
  }
  button, select { font: inherit; color: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: default; opacity: .55; }
  :focus-visible { outline: 2px solid var(--bt-accent); outline-offset: 2px; }
  svg { display: block; flex: none; }

  .launcher {
    display: grid; place-items: center; width: 34px; height: 34px; padding: 0;
    color: var(--bt-accent); background: var(--bt-surface); border: 1px solid var(--bt-border); border-radius: 50%;
    box-shadow: var(--bt-shadow); pointer-events: auto;
  }
  .launcher:hover { background: var(--bt-surface-2); }

  .panel {
    display: flex; flex-direction: column; gap: 10px; width: min(340px, calc(100vw - 16px)); padding: 12px;
    background: var(--bt-surface); border: 1px solid var(--bt-border); border-radius: 14px;
    box-shadow: var(--bt-shadow); pointer-events: auto;
  }
  .panel:focus { outline: none; }
  .header { display: flex; align-items: center; gap: 8px; }
  .title { display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; font-size: 13px; }
  .title svg { color: var(--bt-accent); }
  .provider { padding: 1px 7px; color: var(--bt-muted); background: var(--bt-surface-2); border-radius: 999px; font-size: 11px; font-weight: 600; }
  .icon-button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; background: transparent; border: 0; border-radius: 50%; color: var(--bt-muted); }
  .icon-button:hover:not(:disabled) { background: var(--bt-surface-2); color: var(--bt-text); }
  .close { margin-left: auto; }

  .languages { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 4px; }
  .languages select {
    width: 100%; min-width: 0; height: 32px; padding: 0 8px; background: var(--bt-surface-2);
    border: 1px solid transparent; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer;
  }
  .languages select:hover:not(:disabled) { border-color: var(--bt-border); }

  .body { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .meta { margin: 0; color: var(--bt-muted); font-size: 11px; font-weight: 600; letter-spacing: .02em; }
  .result {
    max-height: 168px; overflow: auto; margin: 0; padding: 8px 10px; background: var(--bt-surface-2); border-radius: 8px;
    white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.45;
  }
  .loading { display: flex; align-items: center; gap: 8px; margin: 0; padding: 8px 0; color: var(--bt-muted); }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--bt-border); border-top-color: var(--bt-accent); border-radius: 50%; animation: bt-spin .8s linear infinite; }
  @keyframes bt-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; border-top-color: var(--bt-border); background: var(--bt-accent); transform: scale(.5); } }
  .notice, .error { margin: 0; padding: 7px 10px; border-radius: 8px; font-size: 12px; line-height: 1.4; }
  .notice { color: var(--bt-notice); background: var(--bt-notice-bg); }
  .error { color: var(--bt-error); background: var(--bt-error-bg); }

  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  .actions button { height: 30px; padding: 0 12px; background: var(--bt-surface-2); border: 0; border-radius: 8px; font-weight: 600; font-size: 12px; }
  .actions button:hover:not(:disabled) { filter: brightness(.96); }
  .actions .primary { color: var(--bt-on-accent); background: var(--bt-accent); }
`;

// Buttons keep focus in the message box when clicked with a mouse.
const keepEditorFocus = (event: MouseEvent) => event.preventDefault();

export function TranslatePanel({
  visible,
  open,
  state,
  colorScheme,
  accentColor,
  providerLabel,
  sourceLanguage,
  supportsAutoDetect,
  targetLanguage,
  canSwapLanguages,
  onOpen,
  onClose,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onSwapLanguages,
  onTranslate,
  onReplace,
  onUndo,
  onCopy,
}: TranslatePanelProps) {
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const openedWithKeyboard = useRef(false);

  useEffect(() => {
    // Keyboard users land in the panel; mouse users keep typing in the composer.
    if (open && openedWithKeyboard.current) panelRef.current?.focus();
    if (!open) openedWithKeyboard.current = false;
  }, [open]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!visible) return null;

  const busy = state.status === 'loading' || state.status === 'replacing';
  const rootStyle = { '--bt-accent': accentColor } as CSSProperties;
  const copy = async () => {
    if (await onCopy()) setCopied(true);
  };
  // Keep the host site's own keyboard shortcuts from reacting inside the panel.
  const isolateKeys = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') onClose();
  };

  if (!open) {
    return (
      <div className="translate-root" data-theme={colorScheme} style={rootStyle}>
        <style>{styles}</style>
        <button
          className="launcher translate"
          type="button"
          aria-label="Translate message"
          title="Translate message"
          aria-haspopup="dialog"
          aria-expanded="false"
          onMouseDown={keepEditorFocus}
          onClick={(event) => {
            openedWithKeyboard.current = event.detail === 0;
            onOpen();
          }}
        >
          <TranslateIcon />
        </button>
      </div>
    );
  }

  const detected = state.translationSource === 'auto' && state.detectedSourceLanguage
    ? `Detected ${languageLabel(state.detectedSourceLanguage)}`
    : null;

  return (
    <div className="translate-root" data-theme={colorScheme} style={rootStyle}>
      <style>{styles}</style>
      <section
        ref={panelRef}
        className="panel"
        role="dialog"
        aria-label="Translate message"
        tabIndex={-1}
        onKeyDown={isolateKeys}
      >
        <div className="header">
          <p className="title"><TranslateIcon size={16} />Translate</p>
          <span className="provider" title="Translation provider">{providerLabel}</span>
          <button className="icon-button close" type="button" aria-label="Close" title="Close" onMouseDown={keepEditorFocus} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="languages">
          <select
            aria-label="Translate from"
            title={supportsAutoDetect ? 'Language of your message' : `${providerLabel} cannot detect languages: choose the language you wrote in`}
            value={sourceLanguage}
            disabled={state.status === 'replacing'}
            onChange={(event) => onSourceLanguageChange(event.target.value as SourceLanguage)}
          >
            {supportsAutoDetect && <option value="auto">Detect language</option>}
            {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
          <button
            className="icon-button"
            type="button"
            aria-label="Swap languages"
            title="Swap languages"
            disabled={!canSwapLanguages || state.status === 'replacing'}
            onMouseDown={keepEditorFocus}
            onClick={onSwapLanguages}
          >
            <SwapIcon />
          </button>
          <select
            aria-label="Translate to"
            title="Language to translate into"
            value={targetLanguage}
            disabled={state.status === 'replacing'}
            onChange={(event) => onTargetLanguageChange(event.target.value as LanguageCode)}
          >
            {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
        </div>

        <div className="body" aria-live="polite">
          {state.status === 'loading' && (
            <p className="loading" role="status"><span className="spinner" aria-hidden="true" />Translating…</p>
          )}
          {state.translation && (state.status === 'preview' || state.status === 'replacing' || state.status === 'replaced') && (
            <>
              {(detected || state.provider === 'mock') && (
                <p className="meta">{[detected, state.provider === 'mock' ? 'Demo output, not a real translation' : null].filter(Boolean).join(' · ')}</p>
              )}
              <p className="result">{state.translation}</p>
            </>
          )}
          {state.status === 'preview' && state.unchanged && (
            <p className="notice">The translation is the same as your text. Names and links often stay the same; otherwise check the source language.</p>
          )}
          {state.status === 'preview' && !state.unchanged && !state.canReplace && (
            <p className="notice">This message box can’t be replaced safely (for example, it contains a mention or link). Copy the translation instead.</p>
          )}
          {state.status === 'replacing' && <p className="loading" role="status"><span className="spinner" aria-hidden="true" />Updating your message…</p>}
          {state.status === 'replaced' && !state.error && <p className="meta">Your message was replaced. It has not been sent.</p>}
          {state.error && <p className="error" role="alert">{state.error}</p>}
        </div>

        {state.status !== 'replacing' && (
          <div className="actions">
            {state.status === 'error' && (
              <button className="primary" type="button" onMouseDown={keepEditorFocus} onClick={onTranslate}>Try again</button>
            )}
            {state.status === 'preview' && state.canReplace && (
              <button className="primary" type="button" onMouseDown={keepEditorFocus} onClick={onReplace}>Replace</button>
            )}
            {state.status === 'replaced' && (
              <button className="primary" type="button" onMouseDown={keepEditorFocus} onClick={onUndo}>Undo</button>
            )}
            {state.translation && state.status !== 'loading' && (
              <button type="button" onMouseDown={keepEditorFocus} onClick={() => void copy()} disabled={busy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            <button type="button" onMouseDown={keepEditorFocus} onClick={onClose}>
              {state.status === 'replaced' ? 'Done' : 'Cancel'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
