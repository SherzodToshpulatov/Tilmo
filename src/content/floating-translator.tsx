import { createRoot, type Root } from 'react-dom/client';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { MessageEditorAdapter } from '../adapters/types';
import { DraftManager, type DraftSnapshot } from '../core/draft-manager';
import {
  DEFAULT_TARGET_LANGUAGE,
  isSourceLanguage,
  isSupportedLanguage,
  resolveSourceLanguage,
  type LanguageCode,
  type SourceLanguage,
} from '../core/languages';
import { isSameText } from '../core/text';
import { TRANSLATION_PROVIDERS, isTranslationProviderId } from '../services/providers';
import { TranslationError, TRANSLATION_ERROR_MESSAGES, type TranslationResult } from '../services/translation';
import { TranslatePanel, type PanelState } from '../components/TranslatePanel';
import { EDGE_GAP, computeFloatingLayout } from './layout';
import { detectColorScheme, type ColorScheme } from './theme';
import { requestTranslation } from '../utils/messaging';
import {
  sourceLanguageSetting,
  targetLanguageSetting,
  translationProviderSetting,
  type TranslationProviderSetting,
} from '../utils/settings';

export const FLOATING_HOST_ID = 'browser-translator-floating-host';

const INITIAL_PANEL_STATE: PanelState = {
  status: 'idle',
  translation: '',
  canReplace: false,
  error: '',
};

export interface FloatingTranslatorSite {
  /** Site name used in user-facing messages, e.g. "Telegram". */
  name: string;
  adapter: MessageEditorAdapter;
  /** Returns the message composer for an event target, or null if it is not one. */
  findComposer(target: EventTarget | null): HTMLElement | null;
  findFocusedComposer(): HTMLElement | null;
  /** Element the floating controls are aligned to (the composer's container). */
  findPositioningAnchor(editor: HTMLElement): HTMLElement;
  /** The site's own accent colour, used for the primary controls. */
  accentColor: string;
}

/**
 * Shows the floating Translate controls next to the site's active message
 * composer. Site-specific behaviour lives in `site`; everything else (Shadow
 * DOM host, positioning, translation, Replace/Undo safety) is shared.
 */
export function startFloatingTranslator(ctx: ContentScriptContext, site: FloatingTranslatorSite): void {
  const draftManager = new DraftManager(site.adapter);
  let activeEditor: HTMLElement | null = null;
  let activePositioningAnchor: HTMLElement | null = null;
  let panelState = INITIAL_PANEL_STATE;
  let root: Root | null = null;
  let shadowHost: HTMLElement | null = null;
  let uiContainer: HTMLElement | null = null;
  let panelElement: HTMLElement | null = null;
  let requestId = 0;
  let pendingSnapshot: DraftSnapshot | null = null;
  let pendingLocation: string | null = null;
  let undoLocation: string | null = null;
  let targetLanguage: LanguageCode = DEFAULT_TARGET_LANGUAGE;
  let storedSourceLanguage: SourceLanguage = 'auto';
  let provider: TranslationProviderSetting = translationProviderSetting.fallback;
  // In-memory only, so re-translating an unchanged draft costs no request.
  let lastTranslation: { key: string; result: TranslationResult } | null = null;
  const sourceLanguage = () =>
    resolveSourceLanguage(storedSourceLanguage, targetLanguage, TRANSLATION_PROVIDERS[provider].supportsAutoDetect);
  let panelOpen = false;
  let colorScheme: ColorScheme = 'light';
  let syncScheduled = false;
  let lastPositionDiagnostic = '';
  const resizeObserver = new ResizeObserver(() => positionUi());

  const getLayerGeometry = (element: HTMLElement | null) => {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      position: style.position,
      top: style.top,
      left: style.left,
      transform: style.transform,
      parentTransform: element.parentElement ? getComputedStyle(element.parentElement).transform : null,
    };
  };

  const render = () => {
    root?.render(
      <TranslatePanel
        visible={activeEditor !== null}
        open={panelOpen}
        state={panelState}
        colorScheme={colorScheme}
        accentColor={site.accentColor}
        providerLabel={TRANSLATION_PROVIDERS[provider].shortLabel}
        sourceLanguage={sourceLanguage()}
        supportsAutoDetect={TRANSLATION_PROVIDERS[provider].supportsAutoDetect}
        targetLanguage={targetLanguage}
        canSwapLanguages={swapSource() !== null}
        onOpen={openPanel}
        onClose={closePanel}
        onSourceLanguageChange={changeSourceLanguage}
        onTargetLanguageChange={changeTargetLanguage}
        onSwapLanguages={swapLanguages}
        onTranslate={() => void translateDraft()}
        onReplace={() => void replaceDraft()}
        onUndo={() => void undoReplacement()}
        onCopy={copyTranslation}
      />,
    );
  };

  const observePositionTargets = () => {
    resizeObserver.disconnect();
    const anchorParent = activePositioningAnchor?.parentElement ?? null;
    const targets = new Set([
      activeEditor,
      activePositioningAnchor,
      anchorParent,
      anchorParent?.parentElement ?? null,
      uiContainer,
      panelElement,
    ]);
    for (const target of targets) {
      if (target) resizeObserver.observe(target);
    }
  };

  const positionUi = () => {
    if (!shadowHost || !uiContainer) return;
    // A connected but unrendered anchor (e.g. a minimized chat panel) has no
    // boxes; hide instead of clamping the controls into a viewport corner.
    if (!activeEditor?.isConnected || !activePositioningAnchor?.isConnected ||
      activePositioningAnchor.getClientRects().length === 0) {
      shadowHost.style.setProperty('display', 'none', 'important');
      return;
    }

    shadowHost.style.setProperty('display', 'block', 'important');
    const currentPanel = uiContainer.querySelector<HTMLElement>('.translate-root');
    if (currentPanel !== panelElement) {
      if (panelElement) resizeObserver.unobserve(panelElement);
      panelElement = currentPanel;
      if (panelElement) resizeObserver.observe(panelElement);
    }

    const panelRect = panelElement?.getBoundingClientRect();
    const { left, top: boundedTop, maxHeight } = computeFloatingLayout({
      anchor: activePositioningAnchor.getBoundingClientRect(),
      contentWidth: panelRect?.width || 36,
      contentHeight: panelRect?.height || 36,
      viewportWidth: document.documentElement.clientWidth || window.innerWidth,
      viewportHeight: document.documentElement.clientHeight || window.innerHeight,
    });

    // Inline WXT positioning leaves the host/container alone; the host is the
    // only positioned layer, so these viewport coordinates map directly to it.
    shadowHost.style.setProperty('position', 'fixed', 'important');
    shadowHost.style.setProperty('left', `${left}px`, 'important');
    shadowHost.style.setProperty('top', `${boundedTop}px`, 'important');
    shadowHost.style.setProperty('z-index', '2147483647', 'important');
    shadowHost.style.setProperty('display', 'block', 'important');
    shadowHost.style.setProperty('width', 'max-content', 'important');
    shadowHost.style.setProperty('height', 'auto', 'important');
    shadowHost.style.setProperty('margin', '0', 'important');
    shadowHost.style.setProperty('padding', '0', 'important');
    shadowHost.style.setProperty('pointer-events', 'none', 'important');
    uiContainer.style.position = 'static';
    uiContainer.style.inset = 'auto';
    uiContainer.style.width = 'max-content';
    uiContainer.style.maxWidth = `calc(100vw - ${EDGE_GAP * 2}px)`;
    uiContainer.style.height = 'auto';
    uiContainer.style.maxHeight = `${maxHeight}px`;
    uiContainer.style.overflowY = 'auto';
    uiContainer.style.margin = '0';
    uiContainer.style.padding = '0';
    uiContainer.style.pointerEvents = 'none';

    if (import.meta.env.DEV) {
      const diagnostics = {
        mode: import.meta.env.MODE,
        // More than one host means another copy of the extension is injecting.
        floatingHostCount: document.querySelectorAll(`#${FLOATING_HOST_ID}`).length,
        composer: getLayerGeometry(activeEditor),
        positioningAnchor: getLayerGeometry(activePositioningAnchor),
        documentRoot: getLayerGeometry(document.documentElement),
        shadowHost: getLayerGeometry(shadowHost),
        uiContainer: getLayerGeometry(uiContainer),
        reactPanel: getLayerGeometry(panelElement),
        translateButton: getLayerGeometry(panelElement?.querySelector<HTMLElement>('.launcher') ?? null),
      };
      const diagnosticKey = JSON.stringify(diagnostics);
      if (diagnosticKey !== lastPositionDiagnostic) {
        console.debug(`[Tilmo] ${site.name} floating UI geometry`, diagnostics);
        lastPositionDiagnostic = diagnosticKey;
      }
    }
  };

  /**
   * Re-checks the active composer and position at most once per frame. DOM
   * mutations and scroll events can fire hundreds of times per frame on busy
   * pages (feeds, Reels); each check measures layout, so they are coalesced.
   */
  const scheduleSync = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    ctx.requestAnimationFrame(() => {
      syncScheduled = false;
      if (activeEditor && !activeEditor.isConnected) setActiveEditor(null);
      if (activeEditor) {
        setActiveEditor(activeEditor);
      } else {
        const focusedEditor = site.findFocusedComposer();
        if (focusedEditor) setActiveEditor(focusedEditor);
      }
    });
  };

  const setActiveEditor = (editor: HTMLElement | null) => {
    if (editor === activeEditor) {
      const positioningAnchor = editor ? site.findPositioningAnchor(editor) : null;
      if (positioningAnchor !== activePositioningAnchor) {
        activePositioningAnchor = positioningAnchor;
        observePositionTargets();
      }
      positionUi();
      return;
    }
    requestId += 1;
    activeEditor = editor;
    activePositioningAnchor = editor ? site.findPositioningAnchor(editor) : null;
    pendingSnapshot = null;
    pendingLocation = null;
    panelState = INITIAL_PANEL_STATE;
    panelOpen = false;
    // Measured once per composer, not per frame: themes rarely change mid-chat.
    if (activePositioningAnchor) colorScheme = detectColorScheme(activePositioningAnchor);
    observePositionTargets();
    render();
    positionUi();
  };

  async function translateDraft() {
    const editor = activeEditor;
    if (!editor?.isConnected) return;
    // Ignore repeated clicks while a request is in flight.
    if (panelState.status === 'loading' || panelState.status === 'replacing') return;

    const snapshot: DraftSnapshot = draftManager.capture(editor);
    if (!snapshot.text.trim()) {
      pendingSnapshot = null;
      pendingLocation = null;
      panelState = { ...INITIAL_PANEL_STATE, status: 'error', error: 'Type a draft before translating.' };
      render();
      return;
    }

    pendingSnapshot = snapshot;
    pendingLocation = location.href;
    const requestLocation = pendingLocation;
    const currentRequest = ++requestId;
    const target = targetLanguage;
    const source = sourceLanguage();
    const cacheKey = JSON.stringify([provider, source, target, snapshot.text]);
    panelState = { ...INITIAL_PANEL_STATE, status: 'loading' };
    render();

    try {
      const result = lastTranslation?.key === cacheKey
        ? lastTranslation.result
        : await requestTranslation({ text: snapshot.text, source, target });
      if (currentRequest !== requestId) return;
      lastTranslation = { key: cacheKey, result };
      const translation = result.translatedText;
      if (activeEditor !== editor || location.href !== requestLocation || !draftManager.isUnchanged(snapshot)) {
        pendingSnapshot = null;
        pendingLocation = null;
        panelState = {
          ...INITIAL_PANEL_STATE,
          status: 'error',
          error: 'The draft changed while translation was pending. Translate the updated draft again.',
        };
        render();
        return;
      }

      // Unchanged text is shown with a notice, not as an error: names, links
      // and short words legitimately stay the same.
      const unchanged = isSameText(translation, snapshot.text);
      panelState = {
        status: 'preview',
        translation,
        canReplace: !unchanged && draftManager.canReplace(snapshot, translation),
        error: '',
        unchanged,
        detectedSourceLanguage: result.detectedSourceLanguage,
        translationSource: source,
        translationTarget: target,
        provider: result.provider,
      };
      render();
    } catch (error) {
      if (currentRequest !== requestId) return;
      pendingSnapshot = null;
      pendingLocation = null;
      // The draft is untouched on failure; only the panel shows the error.
      const message = error instanceof TranslationError ? error.message : TRANSLATION_ERROR_MESSAGES.server_error;
      panelState = { ...INITIAL_PANEL_STATE, status: 'error', error: message };
      render();
    }
  }

  function onLanguagesChanged() {
    // A preview or pending request for the old languages no longer applies.
    // Keep a completed replacement so Undo stays available.
    if (panelState.status === 'loading' || panelState.status === 'preview' || panelState.status === 'error') {
      cancelPreview();
      // The user changed languages in the open panel: translate again with them.
      if (panelOpen) void translateDraft();
    } else {
      render();
    }
  }

  /** The language swapping would make the new target, or null if it cannot swap. */
  function swapSource(): LanguageCode | null {
    const source = sourceLanguage();
    if (source !== 'auto') return source;
    const detected = panelState.detectedSourceLanguage;
    return isSupportedLanguage(detected) && detected !== targetLanguage ? detected : null;
  }

  function swapLanguages() {
    const newTarget = swapSource();
    if (!newTarget) return;
    storedSourceLanguage = targetLanguage;
    targetLanguage = newTarget;
    void sourceLanguageSetting.setValue(storedSourceLanguage);
    void targetLanguageSetting.setValue(targetLanguage);
    onLanguagesChanged();
  }

  function openPanel() {
    if (!activeEditor) return;
    panelOpen = true;
    if (activePositioningAnchor) colorScheme = detectColorScheme(activePositioningAnchor);
    render();
    void translateDraft();
  }

  function closePanel() {
    panelOpen = false;
    cancelPreview();
  }

  function changeTargetLanguage(language: LanguageCode) {
    if (!isSupportedLanguage(language) || language === targetLanguage) return;
    // Picking the current source as the target swaps the pair.
    if (language === sourceLanguage()) {
      storedSourceLanguage = targetLanguage;
      void sourceLanguageSetting.setValue(storedSourceLanguage);
    }
    targetLanguage = language;
    void targetLanguageSetting.setValue(language);
    onLanguagesChanged();
  }

  function changeSourceLanguage(language: SourceLanguage) {
    if (!isSourceLanguage(language) || language === sourceLanguage()) return;
    if (language === targetLanguage) {
      const previous = sourceLanguage();
      targetLanguage = previous !== 'auto' ? previous : language === 'en' ? 'uz' : 'en';
      void targetLanguageSetting.setValue(targetLanguage);
    }
    storedSourceLanguage = language;
    void sourceLanguageSetting.setValue(language);
    onLanguagesChanged();
  }

  async function replaceDraft() {
    if (panelState.status !== 'preview') return;

    const snapshot = pendingSnapshot;
    if (!panelState.canReplace || !activeEditor ||
      !snapshot || snapshot.editor !== activeEditor || pendingLocation !== location.href ||
      !draftManager.isUnchanged(snapshot)) {
      pendingSnapshot = null;
      pendingLocation = null;
      panelState = {
        ...panelState,
        canReplace: false,
        error: 'The draft changed after preview. Translate the updated draft before replacing it.',
      };
      render();
      return;
    }

    const translated = panelState.translation;
    panelState = { ...panelState, status: 'replacing', error: '' };
    render();
    const replaced = await draftManager.replace(snapshot, translated);
    if (!replaced) {
      panelState = {
        ...panelState,
        status: 'preview',
        error: `${site.name} did not accept the replacement. Check your draft; the preview is still available to copy.`,
      };
    } else {
      pendingSnapshot = null;
      pendingLocation = null;
      undoLocation = location.href;
      panelState = { ...panelState, status: 'replaced', error: '' };
    }
    render();
    positionUi();
  }

  async function undoReplacement() {
    if (undoLocation !== location.href) {
      panelState = { ...panelState, error: 'Undo is unavailable after navigating to another chat.' };
      render();
      return;
    }

    const restored = await draftManager.undo();
    panelState = restored
      ? INITIAL_PANEL_STATE
      : { ...panelState, error: 'Undo was not applied because the draft changed or the editor rejected it.' };
    if (restored) undoLocation = null;
    render();
    positionUi();
  }

  async function copyTranslation(): Promise<boolean> {
    if (!panelState.translation) return false;
    try {
      await navigator.clipboard.writeText(panelState.translation);
      return true;
    } catch {
      panelState = { ...panelState, error: 'Clipboard access was unavailable. Select and copy the preview manually.' };
      render();
      return false;
    }
  }

  function cancelPreview() {
    requestId += 1;
    pendingSnapshot = null;
    pendingLocation = null;
    panelState = INITIAL_PANEL_STATE;
    render();
  }

  // composedPath crosses the shadow boundary, so focus and clicks inside the
  // panel count as ours even where the event target is not retargeted.
  const isInsideControls = (event: Event) => shadowHost !== null && event.composedPath().includes(shadowHost);

  const onFocusIn = (event: FocusEvent) => {
    const editor = site.findComposer(event.target);
    if (editor) {
      setActiveEditor(editor);
    } else if (!isInsideControls(event)) {
      setActiveEditor(null);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (site.findComposer(event.target)) return;
    if (isInsideControls(event)) return;
    setActiveEditor(null);
  };

  const onScrollOrResize = () => scheduleSync();
  const onLocationChange = () => {
    pendingLocation = null;
    undoLocation = null;
    lastTranslation = null;
    setActiveEditor(null);
    ctx.requestAnimationFrame(() => {
      const editor = site.findFocusedComposer();
      if (editor) setActiveEditor(editor);
    });
  };

  const observer = new MutationObserver(scheduleSync);

  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
  window.visualViewport?.addEventListener('scroll', onScrollOrResize);
  window.visualViewport?.addEventListener('resize', onScrollOrResize);
  ctx.addEventListener(window, 'wxt:locationchange', onLocationChange);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const applyStoredTargetLanguage = (language: LanguageCode | null) => {
    const next = isSupportedLanguage(language) ? language : DEFAULT_TARGET_LANGUAGE;
    if (next === targetLanguage) return;
    targetLanguage = next;
    render();
  };
  const applyStoredSourceLanguage = (language: SourceLanguage | null) => {
    const next = isSourceLanguage(language) ? language : 'auto';
    if (next === storedSourceLanguage) return;
    storedSourceLanguage = next;
    render();
  };
  const applyStoredProvider = (value: TranslationProviderSetting | null) => {
    const next = isTranslationProviderId(value) ? value : translationProviderSetting.fallback;
    if (next === provider) return;
    provider = next;
    onLanguagesChanged();
  };
  void targetLanguageSetting.getValue().then(applyStoredTargetLanguage, () => {});
  void sourceLanguageSetting.getValue().then(applyStoredSourceLanguage, () => {});
  void translationProviderSetting.getValue().then(applyStoredProvider, () => {});
  const unwatchSettings = [
    targetLanguageSetting.watch(applyStoredTargetLanguage),
    sourceLanguageSetting.watch(applyStoredSourceLanguage),
    translationProviderSetting.watch(applyStoredProvider),
  ];
  const initiallyFocusedEditor = site.findFocusedComposer();
  if (initiallyFocusedEditor) setActiveEditor(initiallyFocusedEditor);

  // A content script orphaned by an extension reload (or a second installed
  // copy) can leave its host behind; keep exactly one set of controls.
  document.querySelectorAll(`#${FLOATING_HOST_ID}`).forEach((host) => host.remove());

  // Use one viewport-fixed positioning element rather than mixing WXT inline
  // layout and custom floating coordinates. Shadow DOM keeps styles isolated.
  shadowHost = document.createElement('div');
  shadowHost.id = FLOATING_HOST_ID;
  shadowHost.style.cssText = [
    'all: initial !important',
    'position: fixed !important',
    'top: 0px !important',
    'left: 0px !important',
    'display: none !important',
    'z-index: 2147483647 !important',
    'width: max-content !important',
    'height: auto !important',
    'pointer-events: none !important',
  ].join(';');
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  uiContainer = document.createElement('div');
  shadowRoot.append(uiContainer);
  document.documentElement.append(shadowHost);
  root = createRoot(uiContainer);
  observePositionTargets();
  render();
  ctx.requestAnimationFrame(positionUi);

  ctx.onInvalidated(() => {
    requestId += 1;
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    window.visualViewport?.removeEventListener('scroll', onScrollOrResize);
    window.visualViewport?.removeEventListener('resize', onScrollOrResize);
    unwatchSettings.forEach((unwatch) => unwatch());
    lastTranslation = null;
    observer.disconnect();
    resizeObserver.disconnect();
    root?.unmount();
    root = null;
    shadowHost?.remove();
    shadowHost = null;
    uiContainer = null;
  });
}
