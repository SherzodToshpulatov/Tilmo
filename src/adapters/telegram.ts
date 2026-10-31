import type { MessageEditorAdapter } from './types';

const KNOWN_COMPOSER_SELECTOR = [
  '.input-message-input',
  '#editable-message-text',
  '.composer_rich_textarea',
  '[data-placeholder*="message" i]',
].join(',');

const EDITOR_CANDIDATE_SELECTOR =
  'textarea, [contenteditable="true"], [contenteditable="plaintext-only"]';

const COMPOSER_CONTAINER_SELECTOR = [
  '.input-message-container',
  '.composer_rich_textarea-container',
  '.composer_rich_textarea_container',
  '.message-input-container',
  '.input-message-wrapper',
].join(',');

const SEARCH_TERMS = /\b(search|find|filter)\b/i;
const MESSAGE_TERMS = /\b(message|reply|broadcast|write a message)\b/i;
const SAFE_CONTENT_TAGS = new Set(['BR']);

function isVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function hasSearchSemantics(element: HTMLElement): boolean {
  const labels = [
    element.getAttribute('aria-label'),
    element.getAttribute('placeholder'),
    element.getAttribute('data-placeholder'),
    element.getAttribute('role'),
  ].filter(Boolean).join(' ');

  return SEARCH_TERMS.test(labels) ||
    element.closest('[role="search"], form[role="search"], .input-search') !== null;
}

function hasComposerSemantics(element: HTMLElement): boolean {
  if (element.matches(KNOWN_COMPOSER_SELECTOR)) return true;

  const labels = [
    element.getAttribute('aria-label'),
    element.getAttribute('placeholder'),
    element.getAttribute('data-placeholder'),
  ].filter(Boolean).join(' ');

  return MESSAGE_TERMS.test(labels) &&
    !element.closest('[role="search"], form[role="search"]');
}

function isTextArea(element: HTMLElement): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

function hasOnlyPlainTextNodes(editor: HTMLElement): boolean {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (!(node instanceof HTMLElement) || !SAFE_CONTENT_TAGS.has(node.tagName)) return false;
    node = walker.nextNode();
  }
  return true;
}

function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
}

function readDraft(editor: HTMLElement): string {
  return normalizeText(isTextArea(editor) ? editor.value : editor.innerText);
}

function placeCaretAtEnd(editor: HTMLElement): void {
  const selection = editor.ownerDocument.getSelection();
  if (!selection) return;

  const range = editor.ownerDocument.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setPlainContent(editor: HTMLElement, text: string): void {
  if (isTextArea(editor)) {
    editor.value = text;
    editor.setSelectionRange(text.length, text.length);
    return;
  }

  const fragment = editor.ownerDocument.createDocumentFragment();
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) fragment.append(editor.ownerDocument.createElement('br'));
    if (line) fragment.append(editor.ownerDocument.createTextNode(line));
  });

  editor.replaceChildren(fragment);
  placeCaretAtEnd(editor);
}

async function replaceAndVerify(editor: HTMLElement, text: string): Promise<boolean> {
  if (!editor.isConnected || !hasOnlyPlainTextNodes(editor)) return false;

  editor.focus();
  setPlainContent(editor, text);
  editor.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    composed: true,
    inputType: 'insertReplacementText',
    data: text,
  }));

  // Telegram may reconcile controlled editor content after the input event.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  return editor.isConnected && readDraft(editor) === normalizeText(text);
}

export const telegramEditorAdapter: MessageEditorAdapter = {
  isComposer(element): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false;
    if (!element.matches(EDITOR_CANDIDATE_SELECTOR) || hasSearchSemantics(element)) return false;

    if (isTextArea(element)) {
      return hasComposerSemantics(element) && isVisible(element);
    }

    const editable = element.getAttribute('contenteditable');
    return (editable === 'true' || editable === 'plaintext-only') &&
      hasComposerSemantics(element) &&
      isVisible(element);
  },

  readDraft,

  canReplaceDraft(editor): boolean {
    return editor.isConnected && (isTextArea(editor) || hasOnlyPlainTextNodes(editor));
  },

  replaceDraft: replaceAndVerify,
};

export function findTelegramComposer(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;

  const candidate = target.closest(EDITOR_CANDIDATE_SELECTOR);
  return telegramEditorAdapter.isComposer(candidate) ? candidate : null;
}

export function findFocusedTelegramComposer(): HTMLElement | null {
  const activeElement = document.activeElement;
  return findTelegramComposer(activeElement);
}

export function findTelegramComposerPositioningAnchor(editor: HTMLElement): HTMLElement {
  const container = editor.closest(COMPOSER_CONTAINER_SELECTOR);
  return container instanceof HTMLElement && isVisible(container) ? container : editor;
}
