import { isInstagramDirectPath } from '../utils/sites';
import { dispatchPlainTextPaste, isTextArea, isVisible, normalizeText, waitForEditor } from './editor-utils';
import type { MessageEditorAdapter } from './types';

// Instagram's DOM uses generated class names that change often, so detection
// relies on roles, ARIA labels and the editor type instead of classes.
const EDITOR_CANDIDATE_SELECTOR = 'textarea, [contenteditable="true"], [contenteditable="plaintext-only"]';
const MESSAGE_LABEL = /\bmessages?\b|сообщени|xabar/i;
// Fields that can appear on Direct pages but are not the conversation composer.
const UNRELATED_LABEL = /\b(search|comment|caption|bio|note|notes|name|title|reply to story)\b|поиск|коммент|qidir|izoh/i;
const UNRELATED_CONTAINER = '[role="dialog"], [role="search"], form[role="search"], [aria-modal="true"]';
const COMPOSER_CONTROL = 'button, [role="button"]';
const MAX_ANCHOR_DEPTH = 6;

// Lexical renders plain text as <p><span data-lexical-text="true">…</span></p>.
// Any other attribute (mentions, styles, data markers) means rich content.
const PLAIN_TEXT_SPAN_ATTRIBUTES = new Set(['data-lexical-text', 'class', 'dir']);
const PLAIN_PARAGRAPH_ATTRIBUTES = new Set(['class', 'dir']);

function labelsOf(element: HTMLElement): string {
  return [
    element.getAttribute('aria-label'),
    element.getAttribute('aria-placeholder'),
    element.getAttribute('placeholder'),
    element.getAttribute('data-placeholder'),
  ].filter(Boolean).join(' ');
}

function hasOnlyAttributes(element: Element, allowed: ReadonlySet<string>): boolean {
  return element.getAttributeNames().every((name) => allowed.has(name));
}

function isPlainTextSpan(node: Node): node is HTMLSpanElement {
  return node instanceof HTMLSpanElement &&
    node.getAttribute('data-lexical-text') === 'true' &&
    hasOnlyAttributes(node, PLAIN_TEXT_SPAN_ATTRIBUTES) &&
    Array.from(node.childNodes).every((child) => child instanceof Text);
}

// Reads one paragraph. Returns null for anything that replacement would lose.
function readParagraph(block: HTMLElement): string | null {
  const nodes = Array.from(block.childNodes);
  // An empty Lexical paragraph is rendered as <p><br></p>.
  if (nodes.length === 1 && nodes[0] instanceof HTMLBRElement) return '';

  let text = '';
  for (const [index, node] of nodes.entries()) {
    if (node instanceof Text) {
      text += node.data;
    } else if (isPlainTextSpan(node)) {
      text += node.textContent ?? '';
    } else if (node instanceof HTMLBRElement) {
      // Lexical adds an extra caret <br> after a trailing line break.
      const isCaretBreak = index === nodes.length - 1 && nodes[index - 1] instanceof HTMLBRElement;
      if (!isCaretBreak) text += '\n';
    } else {
      return null;
    }
  }
  return text;
}

/** The draft as plain text, or null if it contains content Replace would destroy. */
function readPlainDraft(editor: HTMLElement): string | null {
  if (isTextArea(editor)) return normalizeText(editor.value);

  const blocks = Array.from(editor.childNodes);
  if (!blocks.some((node) => node instanceof HTMLElement && node.tagName === 'P')) {
    return blocks.length ? null : '';
  }

  const lines: string[] = [];
  for (const block of blocks) {
    if (!(block instanceof HTMLParagraphElement) || !hasOnlyAttributes(block, PLAIN_PARAGRAPH_ATTRIBUTES)) return null;
    const line = readParagraph(block);
    if (line === null) return null;
    lines.push(line);
  }
  return normalizeText(lines.join('\n'));
}

function readDraft(editor: HTMLElement): string {
  return readPlainDraft(editor) ?? normalizeText(isTextArea(editor) ? editor.value : editor.innerText);
}

function selectEditorContents(editor: HTMLElement): void {
  const selection = editor.ownerDocument.getSelection();
  if (!selection) return;
  const range = editor.ownerDocument.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
}

function execInsertText(editor: HTMLElement, text: string): void {
  const doc = editor.ownerDocument;
  if (typeof doc.execCommand === 'function') doc.execCommand('insertText', false, text);
}

function setTextAreaValue(editor: HTMLTextAreaElement, text: string): void {
  editor.focus();
  editor.select();
  // Native editing keeps the browser's undo stack and fires a real input event.
  execInsertText(editor, text);
  if (editor.value === text) return;

  // Fallback for React-controlled textareas: set through the native setter so
  // React's value tracker sees a change, then notify it with an input event.
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(editor, text);
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: text }));
  editor.setSelectionRange(text.length, text.length);
}

async function insertReplacement(editor: HTMLElement, text: string): Promise<void> {
  if (isTextArea(editor)) {
    setTextAreaValue(editor, text);
    return;
  }

  editor.focus();
  selectEditorContents(editor);
  // Let the editor (Lexical) pick up the new selection from selectionchange,
  // otherwise it may insert at its stale caret instead of replacing.
  await waitForEditor();
  if (text.includes('\n')) {
    // Instagram binds Enter to Send; a paste inserts line breaks without any
    // paragraph or Enter handling.
    dispatchPlainTextPaste(editor, text);
  } else {
    execInsertText(editor, text);
  }
}

async function replaceAndVerify(editor: HTMLElement, text: string): Promise<boolean> {
  const original = readPlainDraft(editor);
  const expected = normalizeText(text);
  if (!editor.isConnected || original === null) return false;

  await insertReplacement(editor, expected);
  // React and Lexical reconcile asynchronously; check what actually stuck.
  await waitForEditor();
  if (editor.isConnected && readPlainDraft(editor) === expected) return true;

  // The editor rejected or reshaped the text: put the original draft back.
  if (editor.isConnected && readPlainDraft(editor) !== original) {
    await insertReplacement(editor, original);
    await waitForEditor();
  }
  return false;
}

export const instagramEditorAdapter: MessageEditorAdapter = {
  isComposer(element): element is HTMLElement {
    if (!(element instanceof HTMLElement) || !isInstagramDirectPath(location.pathname)) return false;
    if (!element.matches(EDITOR_CANDIDATE_SELECTOR) || element.closest(UNRELATED_CONTAINER)) return false;

    const labels = labelsOf(element);
    if (UNRELATED_LABEL.test(labels)) return false;
    const isLexicalTextbox = element.getAttribute('data-lexical-editor') === 'true' &&
      element.getAttribute('role') === 'textbox';
    return (MESSAGE_LABEL.test(labels) || isLexicalTextbox) && isVisible(element);
  },

  readDraft,

  canReplaceDraft(editor): boolean {
    return editor.isConnected && readPlainDraft(editor) !== null;
  },

  replaceDraft: replaceAndVerify,
};

export function findInstagramComposer(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const candidate = target.closest(EDITOR_CANDIDATE_SELECTOR);
  return instagramEditorAdapter.isComposer(candidate) ? candidate : null;
}

export function findFocusedInstagramComposer(): HTMLElement | null {
  // Cheap route check first: this runs on every DOM mutation.
  if (!isInstagramDirectPath(location.pathname)) return null;
  return findInstagramComposer(document.activeElement);
}

/**
 * The composer bar: the nearest ancestor that also holds the emoji, attachment
 * or Send controls. The floating controls sit above it, so they never cover them.
 */
export function findInstagramComposerPositioningAnchor(editor: HTMLElement): HTMLElement {
  let candidate = editor.parentElement;
  for (let depth = 0; candidate && depth < MAX_ANCHOR_DEPTH; depth += 1) {
    if (candidate === document.body || candidate.closest(UNRELATED_CONTAINER)) break;
    const hasControls = Array.from(candidate.querySelectorAll(COMPOSER_CONTROL)).some((control) => !editor.contains(control));
    if (hasControls) return isVisible(candidate) ? candidate : editor;
    candidate = candidate.parentElement;
  }
  return editor;
}
