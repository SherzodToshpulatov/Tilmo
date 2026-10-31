import { createRoot, type Root } from 'react-dom/client';
import {
  telegramEditorAdapter,
  findFocusedTelegramComposer,
  findTelegramComposer,
  findTelegramComposerPositioningAnchor,
} from '../src/adapters/telegram';
import { DraftManager, type DraftSnapshot } from '../src/core/draft-manager';
import { mockTranslationService } from '../src/services/translation';
import { TelegramTranslatePanel, type PanelState } from '../src/components/TelegramTranslatePanel';
import { TRANSLATE_DRAFT_MESSAGE } from '../src/utils/messaging';

const INITIAL_PANEL_STATE: PanelState = {
  status: 'idle',
  translation: '',
  canReplace: false,
  error: '',
};

export default defineContentScript({
  matches: ['https://web.telegram.org/*'],
  main(ctx) {
    const draftManager = new DraftManager(telegramEditorAdapter);
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
        <TelegramTranslatePanel
          visible={activeEditor !== null}
          state={panelState}
          onTranslate={() => void translateDraft()}
          onReplace={() => void replaceDraft()}
          onUndo={() => void undoReplacement()}
          onCopy={copyTranslation}
          onCancel={cancelPreview}
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
      if (!activeEditor?.isConnected || !activePositioningAnchor?.isConnected) {
        shadowHost.style.setProperty('display', 'none', 'important');
        return;
      }

      shadowHost.style.setProperty('display', 'block', 'important');
      const currentPanel = uiContainer.querySelector<HTMLElement>('.telegram-translate-root');
      if (currentPanel !== panelElement) {
        if (panelElement) resizeObserver.unobserve(panelElement);
        panelElement = currentPanel;
        if (panelElement) resizeObserver.observe(panelElement);
      }

      const anchorRect = activePositioningAnchor.getBoundingClientRect();
      const panelRect = panelElement?.getBoundingClientRect();
      const width = panelRect?.width || 120;
      const height = panelRect?.height || 40;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const edgeGap = 8;
      const boundedWidth = Math.min(width, Math.max(0, viewportWidth - edgeGap * 2));
      const boundedHeight = Math.min(height, Math.max(0, viewportHeight - edgeGap * 2));
      const left = Math.max(edgeGap, Math.min(viewportWidth - boundedWidth - edgeGap, anchorRect.right - boundedWidth));
      const preferredTop = anchorRect.top - height - edgeGap;
      const top = preferredTop >= edgeGap
        ? preferredTop
        : anchorRect.bottom + edgeGap;
      const boundedTop = Math.max(edgeGap, Math.min(viewportHeight - boundedHeight - edgeGap, top));

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
      uiContainer.style.maxWidth = `calc(100vw - ${edgeGap * 2}px)`;
      uiContainer.style.height = 'auto';
      uiContainer.style.maxHeight = `calc(100vh - ${edgeGap * 2}px)`;
      uiContainer.style.overflowY = 'auto';
      uiContainer.style.margin = '0';
      uiContainer.style.padding = '0';
      uiContainer.style.pointerEvents = 'none';

      if (import.meta.env.DEV) {
        const diagnostics = {
          mode: import.meta.env.MODE,
          // More than one host means another copy of the extension is injecting.
          floatingHostCount: document.querySelectorAll('#browser-translator-floating-host').length,
          composer: getLayerGeometry(activeEditor),
          positioningAnchor: getLayerGeometry(activePositioningAnchor),
          documentRoot: getLayerGeometry(document.documentElement),
          shadowHost: getLayerGeometry(shadowHost),
          uiContainer: getLayerGeometry(uiContainer),
          reactPanel: getLayerGeometry(panelElement),
          translateButton: getLayerGeometry(panelElement?.querySelector<HTMLElement>('.translate') ?? null),
        };
        const diagnosticKey = JSON.stringify(diagnostics);
        if (diagnosticKey !== lastPositionDiagnostic) {
          console.debug('[Browser Translator] Telegram floating UI geometry', diagnostics);
          lastPositionDiagnostic = diagnosticKey;
        }
      }
    };

    const setActiveEditor = (editor: HTMLElement | null) => {
      if (editor === activeEditor) {
        const positioningAnchor = editor ? findTelegramComposerPositioningAnchor(editor) : null;
        if (positioningAnchor !== activePositioningAnchor) {
          activePositioningAnchor = positioningAnchor;
          observePositionTargets();
        }
        positionUi();
        return;
      }
      requestId += 1;
      activeEditor = editor;
      activePositioningAnchor = editor ? findTelegramComposerPositioningAnchor(editor) : null;
      pendingSnapshot = null;
      pendingLocation = null;
      panelState = INITIAL_PANEL_STATE;
      observePositionTargets();
      render();
      positionUi();
    };

    async function translateDraft() {
      const editor = activeEditor;
      if (!editor?.isConnected) return;

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
      panelState = { ...INITIAL_PANEL_STATE, status: 'loading' };
      render();

      try {
        const translation = await mockTranslationService.translate(snapshot.text);
        if (currentRequest !== requestId) return;
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

        panelState = {
          status: 'preview',
          translation,
          canReplace: draftManager.canReplace(snapshot, translation),
          error: '',
        };
        render();
      } catch {
        if (currentRequest !== requestId) return;
        pendingSnapshot = null;
        pendingLocation = null;
        panelState = { ...INITIAL_PANEL_STATE, status: 'error', error: 'The demo translation could not be completed.' };
        render();
      }
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
          error: 'Telegram did not accept the replacement. Check your draft; the preview is still available to copy.',
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

    const onFocusIn = (event: FocusEvent) => {
      const editor = findTelegramComposer(event.target);
      if (editor) {
        setActiveEditor(editor);
      } else if (!(event.target instanceof Node && shadowHost?.contains(event.target))) {
        setActiveEditor(null);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (findTelegramComposer(event.target)) return;
      if (event.target instanceof Node && shadowHost?.contains(event.target)) return;
      setActiveEditor(null);
    };

    const onScrollOrResize = () => positionUi();
    const onLocationChange = () => {
      pendingLocation = null;
      undoLocation = null;
      setActiveEditor(null);
      ctx.requestAnimationFrame(() => {
        const editor = findFocusedTelegramComposer();
        if (editor) setActiveEditor(editor);
      });
    };
    const onRuntimeMessage = (message: unknown) => {
      if (typeof message === 'object' && message !== null &&
        'type' in message && message.type === TRANSLATE_DRAFT_MESSAGE) {
        void translateDraft();
      }
    };

    const observer = new MutationObserver(() => {
      if (activeEditor && !activeEditor.isConnected) setActiveEditor(null);
      if (activeEditor) {
        setActiveEditor(activeEditor);
      } else {
        const focusedEditor = findFocusedTelegramComposer();
        if (focusedEditor) setActiveEditor(focusedEditor);
      }
    });

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.visualViewport?.addEventListener('scroll', onScrollOrResize);
    window.visualViewport?.addEventListener('resize', onScrollOrResize);
    ctx.addEventListener(window, 'wxt:locationchange', onLocationChange);
    browser.runtime.onMessage.addListener(onRuntimeMessage);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const initiallyFocusedEditor = findFocusedTelegramComposer();
    if (initiallyFocusedEditor) setActiveEditor(initiallyFocusedEditor);

    // Use one viewport-fixed positioning element rather than mixing WXT inline
    // layout and custom floating coordinates. Shadow DOM keeps styles isolated.
    shadowHost = document.createElement('div');
    shadowHost.id = 'browser-translator-floating-host';
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
      browser.runtime.onMessage.removeListener(onRuntimeMessage);
      observer.disconnect();
      resizeObserver.disconnect();
      root?.unmount();
      root = null;
      shadowHost?.remove();
      shadowHost = null;
      uiContainer = null;
    });
  },
});
