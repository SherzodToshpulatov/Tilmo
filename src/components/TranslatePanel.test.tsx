// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslatePanel, type PanelState, type TranslatePanelProps } from './TranslatePanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const PREVIEW: PanelState = {
  status: 'preview',
  translation: 'Hello, how are you? 👋',
  canReplace: true,
  error: '',
  unchanged: false,
  detectedSourceLanguage: 'uz',
  translationSource: 'auto',
  translationTarget: 'en',
  provider: 'google',
};

function props(overrides: Partial<TranslatePanelProps> = {}): TranslatePanelProps {
  return {
    visible: true,
    open: true,
    state: PREVIEW,
    colorScheme: 'light',
    accentColor: '#3390ec',
    providerLabel: 'Google Cloud',
    sourceLanguage: 'auto',
    supportsAutoDetect: true,
    targetLanguage: 'en',
    canSwapLanguages: true,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onSourceLanguageChange: vi.fn(),
    onTargetLanguageChange: vi.fn(),
    onSwapLanguages: vi.fn(),
    onTranslate: vi.fn(),
    onReplace: vi.fn(),
    onUndo: vi.fn(),
    onCopy: vi.fn(async () => true),
    ...overrides,
  };
}

function show(overrides: Partial<TranslatePanelProps> = {}) {
  const all = props(overrides);
  act(() => root.render(<TranslatePanel {...all} />));
  return all;
}

const buttons = () => Array.from(container.querySelectorAll('button')).map((button) => button.textContent || button.getAttribute('aria-label'));
const byLabel = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`);

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('compact launcher', () => {
  it('is an accessible icon button, not text or emoji', () => {
    const all = show({ open: false });
    const launcher = byLabel('Translate message')!;
    expect(launcher.tagName).toBe('BUTTON');
    expect(launcher.getAttribute('title')).toBe('Translate message');
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(launcher.getAttribute('aria-haspopup')).toBe('dialog');
    expect(launcher.textContent).toBe('');
    expect(launcher.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    act(() => launcher.click());
    expect(all.onOpen).toHaveBeenCalledOnce();
  });

  it('renders nothing when no composer is active', () => {
    show({ visible: false });
    expect(container.innerHTML).toBe('');
  });
});

describe('translation panel', () => {
  it('is a labelled dialog showing provider, languages, detected language and the preview', () => {
    show();
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Translate message');
    expect(container.querySelector('.provider')!.textContent).toBe('Google Cloud');
    expect(container.querySelector('.meta')!.textContent).toBe('Detected Oʻzbekcha');
    expect(container.querySelector('.result')!.textContent).toBe('Hello, how are you? 👋');
    expect(buttons()).toEqual(['Close', 'Swap languages', 'Replace', 'Copy', 'Cancel']);
  });

  it('renders translations as text, never as HTML', () => {
    show({ state: { ...PREVIEW, translation: '<img src=x onerror="alert(1)"><b>bold</b>' } });
    expect(container.querySelector('.result')!.textContent).toBe('<img src=x onerror="alert(1)"><b>bold</b>');
    expect(container.querySelector('.result img, .result b')).toBeNull();
  });

  it('shows a loading indicator and only Cancel while translating', () => {
    show({ state: { ...PREVIEW, status: 'loading', translation: '' } });
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Translating…');
    expect(buttons()).toEqual(['Close', 'Swap languages', 'Cancel']);
  });

  it('flags an unchanged translation without offering Replace', () => {
    show({ state: { ...PREVIEW, translation: 'Telegram', unchanged: true, canReplace: false } });
    expect(container.querySelector('.notice')!.textContent).toMatch(/same as your text/);
    expect(buttons()).toEqual(['Close', 'Swap languages', 'Copy', 'Cancel']);
  });

  it('explains when a rich draft cannot be replaced', () => {
    show({ state: { ...PREVIEW, canReplace: false } });
    expect(container.querySelector('.notice')!.textContent).toMatch(/Copy the translation instead/);
    expect(buttons()).not.toContain('Replace');
  });

  it('announces errors and offers Try again', () => {
    const all = show({ state: { ...PREVIEW, status: 'error', translation: '', error: 'Could not reach the translation server.' } });
    expect(container.querySelector('[role="alert"]')!.textContent).toBe('Could not reach the translation server.');
    const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Try again')!;
    act(() => retry.click());
    expect(all.onTranslate).toHaveBeenCalledOnce();
  });

  it('offers Undo after replacing and says nothing was sent', () => {
    show({ state: { ...PREVIEW, status: 'replaced' } });
    expect(buttons()).toEqual(['Close', 'Swap languages', 'Undo', 'Copy', 'Done']);
    expect(container.textContent).toMatch(/has not been sent/);
  });

  it('hides "Detect language" for providers that cannot detect, and explains why', () => {
    show({ supportsAutoDetect: false, sourceLanguage: 'uz', providerLabel: 'MyMemory' });
    const source = byLabel('Translate from') as HTMLSelectElement;
    expect(Array.from(source.options).map((option) => option.value)).toEqual(['en', 'uz', 'ru']);
    expect(source.title).toMatch(/MyMemory cannot detect languages/);
  });

  it('reports language changes and swaps', () => {
    const all = show();
    act(() => {
      const target = byLabel('Translate to') as HTMLSelectElement;
      target.value = 'ru';
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(all.onTargetLanguageChange).toHaveBeenCalledWith('ru');
    act(() => byLabel('Swap languages')!.click());
    expect(all.onSwapLanguages).toHaveBeenCalledOnce();
  });

  it('disables swapping when there is no known source language', () => {
    show({ canSwapLanguages: false });
    expect((byLabel('Swap languages') as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies the theme and the site accent through extension-owned tokens', () => {
    show({ colorScheme: 'dark', accentColor: '#0095f6' });
    const rootElement = container.querySelector<HTMLElement>('.translate-root')!;
    expect(rootElement.dataset.theme).toBe('dark');
    expect(rootElement.style.getPropertyValue('--bt-accent')).toBe('#0095f6');
    expect(container.querySelector('style')!.textContent).not.toMatch(/--tg-theme/);
  });

  it('closes on Escape and keeps keys from reaching the host site', () => {
    const siteShortcut = vi.fn();
    document.addEventListener('keydown', siteShortcut);
    const all = show();
    act(() => {
      byLabel('Translate to')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      container.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    document.removeEventListener('keydown', siteShortcut);
    expect(all.onClose).toHaveBeenCalledOnce();
    expect(siteShortcut).not.toHaveBeenCalled();
  });
});
