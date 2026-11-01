import { useState } from 'react';
import { LANGUAGES, languageLabel, type LanguageCode, type SourceLanguage } from '../core/languages';

export type PanelStatus = 'idle' | 'loading' | 'replacing' | 'preview' | 'replaced' | 'error';

export interface PanelState {
  status: PanelStatus;
  translation: string;
  canReplace: boolean;
  error: string;
  detectedSourceLanguage?: string;
  /** Target language of the shown translation. */
  translationTarget?: string;
  provider?: string;
}

interface TelegramTranslatePanelProps {
  visible: boolean;
  state: PanelState;
  sourceLanguage: SourceLanguage;
  /** Offer "Auto" only when the selected translator can detect languages. */
  supportsAutoDetect: boolean;
  targetLanguage: LanguageCode;
  onSourceLanguageChange: (language: SourceLanguage) => void;
  onTargetLanguageChange: (language: LanguageCode) => void;
  onTranslate: () => void;
  onReplace: () => void;
  onUndo: () => void;
  onCopy: () => Promise<boolean>;
  onCancel: () => void;
}

const styles = `
  :host { all: initial; color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  .telegram-translate-root { display: flex; flex-direction: column; align-items: flex-end; width: max-content; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow-y: auto; pointer-events: none; }
  .launcher { position: relative; display: flex; justify-content: flex-end; gap: 6px; pointer-events: none; }
  .target { height: 33px; padding: 0 8px; color: var(--tg-theme-text-color, #222); background: var(--tg-theme-bg-color, #fff); border: 1px solid #8886; border-radius: 9px; box-shadow: 0 2px 8px #0002; font: 600 12px/1.2 system-ui, sans-serif; cursor: pointer; pointer-events: auto; }
  .target:disabled { opacity: .65; cursor: wait; }
  .arrow { align-self: center; color: #8a8a8a; font: 600 12px/1 system-ui, sans-serif; text-shadow: 0 0 3px var(--tg-theme-bg-color, #fff); }
  .meta { margin: 0 0 6px; color: #8a8a8a; font: 600 11px/1.3 system-ui, sans-serif; letter-spacing: .02em; }
  button { border: 0; border-radius: 9px; font: 600 13px/1.2 system-ui, sans-serif; cursor: pointer; }
  .translate { display: inline-flex; align-items: center; gap: 7px; padding: 9px 12px; color: #fff; background: #3390ec; box-shadow: 0 2px 8px #0003; white-space: nowrap; pointer-events: auto; }
  .translate:hover { background: #267dce; }
  button:disabled { opacity: .65; cursor: wait; }
  .icon { width: 16px; height: 16px; display: inline-grid; place-items: center; font-size: 15px; }
  .panel { width: min(340px, calc(100vw - 24px)); margin-top: 8px; padding: 12px; color: var(--tg-theme-text-color, #222); background: var(--tg-theme-bg-color, #fff); border: 1px solid #8884; border-radius: 12px; box-shadow: 0 6px 24px #0003; pointer-events: auto; }
  .result { max-height: 150px; overflow: auto; margin: 0 0 10px; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.45 system-ui, sans-serif; }
  .hint { margin: 0 0 10px; color: #b45309; font: 12px/1.4 system-ui, sans-serif; }
  .error { margin: 0 0 10px; color: #c62828; font: 12px/1.4 system-ui, sans-serif; }
  .actions { display: flex; gap: 7px; }
  .actions button { padding: 7px 10px; color: var(--tg-theme-text-color, #222); background: #8882; }
  .actions .primary { color: #fff; background: #3390ec; }
`;

export function TelegramTranslatePanel({
  visible,
  state,
  sourceLanguage,
  supportsAutoDetect,
  targetLanguage,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onTranslate,
  onReplace,
  onUndo,
  onCopy,
  onCancel,
}: TelegramTranslatePanelProps) {
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const copy = async () => {
    if (await onCopy()) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <div className="telegram-translate-root">
      <style>{styles}</style>
      <div className="launcher">
        <select
          className="target"
          aria-label="Translate from"
          title="Translate from"
          value={sourceLanguage}
          disabled={state.status === 'replacing'}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => onSourceLanguageChange(event.target.value as SourceLanguage)}
        >
          {supportsAutoDetect && <option value="auto">Auto</option>}
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>{language.label}</option>
          ))}
        </select>
        <span className="arrow" aria-hidden="true">→</span>
        <select
          className="target"
          aria-label="Translate to"
          title="Translate to"
          value={targetLanguage}
          disabled={state.status === 'replacing'}
          // Keep Telegram's global shortcuts from reacting to keys in the menu.
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => onTargetLanguageChange(event.target.value as LanguageCode)}
        >
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>{language.label}</option>
          ))}
        </select>
        <button className="translate" type="button" disabled={state.status === 'loading' || state.status === 'replacing'} onMouseDown={(event) => event.preventDefault()} onClick={onTranslate}>
          <span className="icon" aria-hidden="true">文</span>
          {state.status === 'loading' ? 'Translating…' : state.status === 'replacing' ? 'Updating draft…' : 'Translate'}
        </button>
      </div>
      {(state.status === 'preview' || state.status === 'replacing' || state.status === 'replaced' || state.status === 'error') && (
        <section className="panel" aria-live="polite">
          {state.translation && state.translationTarget && (
            <p className="meta">
              {state.detectedSourceLanguage ? languageLabel(state.detectedSourceLanguage) : 'Auto-detected'}
              {' → '}{languageLabel(state.translationTarget)}
              {state.provider === 'mock' && ' · Demo translation'}
            </p>
          )}
          {state.translation && <p className="result">{state.translation}</p>}
          {state.status === 'preview' && !state.canReplace && (
            <p className="hint">Safe replacement is unavailable for this editor or rich-text draft. Copy the preview instead.</p>
          )}
          {state.error && <p className="error">{state.error}</p>}
          {state.status === 'replacing' && <p className="hint">Checking Telegram editor…</p>}
          {state.status !== 'replacing' && <div className="actions">
            {state.status === 'preview' && state.canReplace && (
              <button className="primary" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onReplace}>Replace</button>
            )}
            {state.status === 'replaced' && (
              <button className="primary" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onUndo}>Undo</button>
            )}
            {state.translation && (
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
            )}
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onCancel}>Cancel</button>
          </div>}
        </section>
      )}
    </div>
  );
}
