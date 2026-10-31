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
const PROSEMIRROR_TRAILING_BREAK_CLASS = 'ProseMirror-trailingBreak';
const PROSEMIRROR_SEPARATOR_CLASS = 'ProseMirror-separator';
// Telegram Web renders paragraphs as <div data-chat-input-paragraph>. Only the
// classes and attributes observed on plain paragraphs are accepted, so quote,
// code or other block types keep Replace disabled.
const TELEGRAM_PARAGRAPH_ATTRIBUTE = 'data-chat-input-paragraph';
const TELEGRAM_PARAGRAPH_ATTRIBUTES = new Set(['class', 'dir', 'data-placeholder', TELEGRAM_PARAGRAPH_ATTRIBUTE]);
const TELEGRAM_PARAGRAPH_CLASS = /^(_(Padding|Paragraph)_[\w-]+|chat-input-[\w-]*placeholder[\w-]*)$/;
const TELEGRAM_TRAILING_PLACEHOLDER_CLASS = 'chat-input-trailing-placeholder';

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

function isProseMirror(editor: HTMLElement): boolean {
  return editor.classList.contains('ProseMirror');
}

function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
}

function isEmojiImage(node: Node): node is HTMLImageElement {
  return node instanceof HTMLImageElement &&
    node.classList.length === 1 && node.classList.contains('emoji') &&
    node.alt !== '' && !Object.keys(node.dataset).length;
}

// Reads text, line breaks and plain emoji images. Returns null for any other
// node (links, mentions, formatting, custom emoji, media) so callers can treat
// the draft as rich text that must not be overwritten.
function readInlineText(container: HTMLElement, skipPlaceholderBreak: boolean): string | null {
  const nodes = Array.from(container.childNodes);
  let text = '';
  for (const [index, node] of nodes.entries()) {
    if (node instanceof Text) {
      text += node.data;
    } else if (node instanceof HTMLBRElement) {
      if (node.classList.contains(PROSEMIRROR_TRAILING_BREAK_CLASS)) continue;
      // A trailing <br> in a plain contenteditable is the caret placeholder.
      if (skipPlaceholderBreak && index === nodes.length - 1) continue;
      text += '\n';
    } else if (node instanceof HTMLImageElement && node.classList.contains(PROSEMIRROR_SEPARATOR_CLASS)) {
      continue;
    } else if (isEmojiImage(node)) {
      text += node.alt;
    } else {
      return null;
    }
  }
  return text;
}

// Returns the draft text when it is plain enough to replace and restore
// exactly, or null when it contains structure that replacement would lose.
function isPlainParagraph(node: Node): node is HTMLElement {
  if (node instanceof HTMLParagraphElement) return true;
  return node instanceof HTMLDivElement &&
    node.hasAttribute(TELEGRAM_PARAGRAPH_ATTRIBUTE) &&
    node.getAttributeNames().every((name) => TELEGRAM_PARAGRAPH_ATTRIBUTES.has(name)) &&
    Array.from(node.classList).every((name) => TELEGRAM_PARAGRAPH_CLASS.test(name));
}

// Telegram keeps an empty paragraph after the draft; it is not part of the text.
function findTrailingPlaceholder(editor: HTMLElement): HTMLElement | null {
  const last = editor.lastElementChild;
  return last instanceof HTMLElement && editor.childElementCount > 1 &&
    last.classList.contains(TELEGRAM_TRAILING_PLACEHOLDER_CLASS) &&
    isPlainParagraph(last) && readInlineText(last, false) === ''
    ? last
    : null;
}

function readPlainDraft(editor: HTMLElement): string | null {
  if (isTextArea(editor)) return normalizeText(editor.value);

  if (isProseMirror(editor)) {
    const trailingPlaceholder = findTrailingPlaceholder(editor);
    const lines: string[] = [];
    for (const block of Array.from(editor.childNodes)) {
      if (block === trailingPlaceholder) continue;
      if (!isPlainParagraph(block)) return null;
      const line = readInlineText(block, false);
      if (line === null) return null;
      lines.push(line);
    }
    return normalizeText(lines.join('\n'));
  }

  const text = readInlineText(editor, true);
  return text === null ? null : normalizeText(text);
}

function readDraft(editor: HTMLElement): string {
  return readPlainDraft(editor) ?? normalizeText(isTextArea(editor) ? editor.value : editor.innerText);
}

function canInsertText(editor: HTMLElement, text: string): boolean {
  // ProseMirror's plain-text paste collapses consecutive newlines, so blank
  // lines cannot be reproduced exactly (and Undo could not restore them).
  return !(isProseMirror(editor) && normalizeText(text).includes('\n\n'));
}

function waitForEditor(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function selectEditorContents(editor: HTMLElement): void {
  const selection = editor.ownerDocument.getSelection();
  if (!selection) return;

  const range = editor.ownerDocument.createRange();
  range.selectNodeContents(editor);
  // Leave Telegram's trailing placeholder paragraph out of the replacement.
  const lastContentBlock = findTrailingPlaceholder(editor)?.previousElementSibling;
  if (lastContentBlock) range.setEnd(lastContentBlock, lastContentBlock.childNodes.length);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Uses native editing commands so the editor observes the change the same
// way it observes typing; the caret ends up after the inserted text.
async function insertReplacement(editor: HTMLElement, text: string): Promise<void> {
  const doc = editor.ownerDocument;
  editor.focus();

  if (isTextArea(editor)) {
    editor.select();
    doc.execCommand('insertText', false, text);
    return;
  }

  selectEditorContents(editor);
  const lines = text.split('\n');
  if (lines.length === 1) {
    doc.execCommand('insertText', false, text);
    return;
  }

  if (isProseMirror(editor)) {
    // Multi-line native input can look like an Enter press to ProseMirror's
    // DOM-change detection, and Telegram binds Enter to Send. A plain-text
    // paste goes through ProseMirror's transaction path instead. Wait first so
    // ProseMirror picks up the new selection from selectionchange.
    await waitForEditor();
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    editor.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData,
      bubbles: true,
      cancelable: true,
      composed: true,
    }));
    return;
  }

  lines.forEach((line, index) => {
    if (index > 0) doc.execCommand('insertLineBreak');
    if (line) doc.execCommand('insertText', false, line);
  });
}

async function replaceAndVerify(editor: HTMLElement, text: string): Promise<boolean> {
  const original = readPlainDraft(editor);
  const expected = normalizeText(text);
  if (!editor.isConnected || original === null ||
    !canInsertText(editor, expected) || !canInsertText(editor, original)) {
    return false;
  }

  await insertReplacement(editor, expected);
  // Telegram may reconcile editor content after the input.
  await waitForEditor();
  if (editor.isConnected && readPlainDraft(editor) === expected) return true;

  // The editor rejected or reshaped the text: put the original draft back.
  if (editor.isConnected && readPlainDraft(editor) !== original) {
    await insertReplacement(editor, original);
    await waitForEditor();
  }
  return false;
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

  canReplaceDraft(editor, text): boolean {
    return editor.isConnected && readPlainDraft(editor) !== null &&
      (text === undefined || canInsertText(editor, text));
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
