// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DraftManager } from '../core/draft-manager';
import {
  findFocusedInstagramComposer,
  findInstagramComposer,
  findInstagramComposerPositioningAnchor,
  instagramEditorAdapter as adapter,
} from './instagram';

const paragraph = (inner: string) => `<p class="xat24cr xdj266r" dir="auto">${inner}</p>`;
const text = (value: string) => `<span data-lexical-text="true">${value}</span>`;

/** Instagram-like Direct composer bar: emoji button, Lexical editor, Send. */
function mountComposer(editorHtml = paragraph(text('nima gap')), editorAttributes = 'aria-label="Message"') {
  document.body.innerHTML = `
    <div role="main">
      <section class="thread">
        <div class="composer-bar">
          <div role="button" aria-label="Choose an emoji">🙂</div>
          <div class="field">
            <div ${editorAttributes} contenteditable="true" role="textbox" data-lexical-editor="true" spellcheck="true">${editorHtml}</div>
          </div>
          <div role="button" tabindex="0">Send</div>
        </div>
      </section>
    </div>`;
  return document.querySelector<HTMLElement>('[data-lexical-editor]')!;
}

function mountTextArea(value = 'Salom, yaxshimisan?') {
  document.body.innerHTML = `
    <div class="composer-bar">
      <textarea placeholder="Message..."></textarea>
      <button type="button">Send</button>
    </div>`;
  const textarea = document.querySelector('textarea')!;
  textarea.value = value;
  return textarea;
}

beforeEach(() => history.pushState({}, '', '/direct/t/1234567890/'));
afterEach(() => {
  document.body.innerHTML = '';
  history.pushState({}, '', '/');
});

describe('Instagram composer detection', () => {
  it('detects the Direct message composer, also from a nested text node target', () => {
    const editor = mountComposer();
    expect(adapter.isComposer(editor)).toBe(true);
    expect(findInstagramComposer(editor.querySelector('span'))).toBe(editor);
  });

  it('detects a Lexical textbox without an English label', () => {
    expect(adapter.isComposer(mountComposer(undefined, 'aria-label="Xabar yozing..."'))).toBe(true);
    expect(adapter.isComposer(mountComposer(undefined, 'aria-describedby="placeholder-1"'))).toBe(true);
  });

  it('detects a textarea composer', () => {
    expect(adapter.isComposer(mountTextArea())).toBe(true);
  });

  it('finds the focused composer only on Direct routes', () => {
    const editor = mountComposer();
    editor.focus();
    expect(findFocusedInstagramComposer()).toBe(editor);

    history.pushState({}, '', '/p/abc123/');
    expect(findFocusedInstagramComposer()).toBeNull();
    expect(adapter.isComposer(editor)).toBe(false);
  });

  it.each([
    ['search box', '<div contenteditable="true" role="textbox" aria-label="Search"></div>'],
    ['comment field', '<textarea aria-label="Add a comment…" placeholder="Add a comment…"></textarea>'],
    ['caption field', '<div contenteditable="true" role="textbox" aria-label="Write a caption..."></div>'],
    ['note composer', '<textarea placeholder="Share a note..."></textarea>'],
    ['group name', '<textarea aria-label="Group name"></textarea>'],
    ['unlabelled plain textarea', '<textarea></textarea>'],
    ['text input', '<input type="text" aria-label="Message">'],
    ['password input', '<input type="password" aria-label="Message">'],
    ['non-editable message-like div', '<div role="textbox" aria-label="Message"></div>'],
    ['hidden composer', '<div contenteditable="true" role="textbox" aria-label="Message" style="display:none"></div>'],
    ['composer inside a dialog (forward/share)', '<div role="dialog"><textarea placeholder="Write a message..."></textarea></div>'],
  ])('rejects the %s', (_label, html) => {
    document.body.innerHTML = html;
    const field = document.body.querySelector<HTMLElement>('textarea, input, [role="textbox"]')!;
    expect(adapter.isComposer(field)).toBe(false);
    expect(findInstagramComposer(field)).toBeNull();
  });

  it('anchors the floating controls to the composer bar, not the editor', () => {
    const editor = mountComposer();
    expect(findInstagramComposerPositioningAnchor(editor).className).toBe('composer-bar');
  });

  it('falls back to the editor when no composer bar is found', () => {
    document.body.innerHTML = '<div><div><div aria-label="Message" contenteditable="true" role="textbox"></div></div></div>';
    const editor = document.querySelector<HTMLElement>('[role="textbox"]')!;
    expect(findInstagramComposerPositioningAnchor(editor)).toBe(editor);
  });
});

describe('Instagram draft extraction', () => {
  it.each([
    ['plain text', paragraph(text('nima gap')), 'nima gap'],
    ['Uzbek and Cyrillic', paragraph(text('Oʻzbekiston, gʻalaba!')) + paragraph(text('Привет, как дела?')), 'Oʻzbekiston, gʻalaba!\nПривет, как дела?'],
    ['emoji', paragraph(text('salom 👋😀')), 'salom 👋😀'],
    ['several text spans', paragraph(text('bir ') + text('ikki')), 'bir ikki'],
    ['line breaks', paragraph(`${text('bir')}<br>${text('ikki')}`), 'bir\nikki'],
    ['trailing line break with caret <br>', paragraph(`${text('bir')}<br><br>`), 'bir\n'],
    ['blank line', paragraph(text('a')) + paragraph('<br>') + paragraph(text('b')), 'a\n\nb'],
    ['empty composer', paragraph('<br>'), ''],
  ])('reads %s', (_label, html, expected) => {
    const editor = mountComposer(html);
    expect(adapter.readDraft(editor)).toBe(expected);
    expect(adapter.canReplaceDraft(editor)).toBe(true);
  });

  it('reads a textarea draft', () => {
    expect(adapter.readDraft(mountTextArea('Salom\nqalaysan'))).toBe('Salom\nqalaysan');
  });

  it.each([
    ['link', paragraph(`${text('qara ')}<a href="https://example.com">bu</a>`)],
    ['mention marker', paragraph(`${text('salom ')}<span data-lexical-text="true" data-lexical-mention="true">@ali</span>`)],
    ['styled text', paragraph('<span data-lexical-text="true" style="font-weight: bold">muhim</span>')],
    ['bold element', paragraph('<strong data-lexical-text="true">muhim</strong>')],
    ['image emoji or sticker', paragraph(`${text('salom ')}<img alt="😀" src="data:,">`)],
    ['decorator node', paragraph(`${text('a')}<span contenteditable="false">chip</span>`)],
    ['unknown block', '<div>block</div>'],
    ['paragraph with data attribute', '<p data-custom="1"><span data-lexical-text="true">x</span></p>'],
  ])('keeps Replace disabled for a draft with a %s (Copy only)', (_label, html) => {
    const editor = mountComposer(html);
    expect(adapter.canReplaceDraft(editor)).toBe(false);
    expect(adapter.readDraft(editor).length).toBeGreaterThan(0);
  });
});

describe('Instagram draft replacement', () => {
  it('replaces a React-controlled textarea and notifies React with an input event', async () => {
    const textarea = mountTextArea();
    const inputs: InputEvent[] = [];
    textarea.addEventListener('input', (event) => inputs.push(event as InputEvent));

    expect(await adapter.replaceDraft(textarea, 'Hello, how are you?')).toBe(true);
    expect(textarea.value).toBe('Hello, how are you?');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.bubbles).toBe(true);
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe('Hello, how are you?'.length);
  });

  it('restores the original when a controlled textarea rejects the change', async () => {
    const textarea = mountTextArea('nima gap');
    let controlledValue = 'nima gap';
    // A controlled input that ignores the first change, as a stale React state would.
    let rejectNext = true;
    textarea.addEventListener('input', () => {
      if (rejectNext) {
        rejectNext = false;
        requestAnimationFrame(() => { textarea.value = controlledValue; });
      } else {
        controlledValue = textarea.value;
      }
    });

    expect(await adapter.replaceDraft(textarea, "What's up")).toBe(false);
    expect(textarea.value).toBe('nima gap');
  });

  it('reports failure and leaves a contenteditable draft untouched when the editor does not accept input', async () => {
    // happy-dom has no execCommand, standing in for an editor that ignores the change.
    const editor = mountComposer();
    const before = editor.innerHTML;
    expect(await adapter.replaceDraft(editor, 'Hello')).toBe(false);
    expect(editor.innerHTML).toBe(before);
  });

  it('refuses to replace a rich draft', async () => {
    const editor = mountComposer(paragraph(`${text('qara ')}<a href="https://example.com">bu</a>`));
    const before = editor.innerHTML;
    expect(await adapter.replaceDraft(editor, 'look')).toBe(false);
    expect(editor.innerHTML).toBe(before);
  });

  it('undoes a replacement through the shared DraftManager', async () => {
    const textarea = mountTextArea('Salom, yaxshimisan?');
    const manager = new DraftManager(adapter);
    const snapshot = manager.capture(textarea);

    expect(await manager.replace(snapshot, 'Hello, how are you?')).toBe(true);
    expect(await manager.undo()).toBe(true);
    expect(textarea.value).toBe('Salom, yaxshimisan?');
  });

  it('refuses Replace when the draft changed during translation, and Undo after a later edit', async () => {
    const textarea = mountTextArea('Salom');
    const manager = new DraftManager(adapter);
    const snapshot = manager.capture(textarea);

    textarea.value = 'Salom, qalaysan?';
    expect(await manager.replace(snapshot, 'Hello')).toBe(false);
    expect(textarea.value).toBe('Salom, qalaysan?');

    const fresh = manager.capture(textarea);
    expect(await manager.replace(fresh, 'Hello, how are you?')).toBe(true);
    textarea.value = 'Hello, how are you? 👋';
    expect(await manager.undo()).toBe(false);
    expect(textarea.value).toBe('Hello, how are you? 👋');
  });
});

/** A floating DM panel over another page: dialog or fixed overlay, thread, composer bar. */
function mountFloatingPanel({
  id = 'a',
  container = 'dialog',
  thread = '<div role="grid" aria-label="Messages in conversation"><div role="row"></div></div>',
  picker = '',
  editor = `<div aria-label="Message" contenteditable="true" role="textbox" data-lexical-editor="true">${paragraph(text('Salom'))}</div>`,
}: { id?: string; container?: 'dialog' | 'fixed'; thread?: string; picker?: string; editor?: string } = {}) {
  const panel = document.createElement('div');
  panel.dataset.panel = id;
  if (container === 'dialog') panel.setAttribute('role', 'dialog');
  else panel.style.position = 'fixed';
  panel.innerHTML = `
    <header><div role="button" aria-label="Minimize"></div><div role="button" aria-label="Close"></div></header>
    ${picker}${thread}
    <div class="composer-bar">
      <div role="button" aria-label="Emoji"></div>
      <div class="field">${editor}</div>
      <div role="button" aria-label="Voice clip"></div>
    </div>`;
  document.body.append(panel);
  return { panel, editor: panel.querySelector<HTMLElement>('.composer-bar .field > *')! };
}

describe('Instagram floating DM panels', () => {
  beforeEach(() => { document.body.innerHTML = '<main role="main"></main>'; });

  it.each(['/reels/C1a2b3c4d5/', '/someone/', '/p/C1a2b3c4d5/', '/', '/explore/'])('detects the composer of a dialog panel over %s', (path) => {
    history.pushState({}, '', path);
    const { editor } = mountFloatingPanel();
    expect(adapter.isComposer(editor)).toBe(true);
    expect(findInstagramComposer(editor.querySelector('span'))).toBe(editor);
  });

  it('detects a fixed-position panel that is not marked as a dialog', () => {
    history.pushState({}, '', '/reels/C1a2b3c4d5/');
    const { editor } = mountFloatingPanel({ container: 'fixed', thread: '<div role="log"></div>' });
    expect(adapter.isComposer(editor)).toBe(true);
  });

  it('detects a panel identified only by its conversation label', () => {
    history.pushState({}, '', '/someone/');
    const { panel, editor } = mountFloatingPanel({ thread: '' });
    panel.setAttribute('aria-label', 'Chat');
    expect(adapter.isComposer(editor)).toBe(true);
  });

  it('detects a textarea composer in a panel', () => {
    history.pushState({}, '', '/someone/');
    const { editor } = mountFloatingPanel({ editor: '<textarea placeholder="Message..."></textarea>' });
    expect(adapter.isComposer(editor)).toBe(true);
  });

  it('anchors the controls to the panel composer bar, not the panel or the editor', () => {
    history.pushState({}, '', '/reels/C1a2b3c4d5/');
    const { editor } = mountFloatingPanel();
    expect(findInstagramComposerPositioningAnchor(editor).className).toBe('composer-bar');
  });

  it('handles two panels at once, each with its own composer and anchor', () => {
    history.pushState({}, '', '/someone/');
    const first = mountFloatingPanel({ id: 'a' });
    const second = mountFloatingPanel({ id: 'b' });
    expect(adapter.isComposer(first.editor)).toBe(true);
    expect(adapter.isComposer(second.editor)).toBe(true);
    expect(findInstagramComposerPositioningAnchor(second.editor).closest('[data-panel]')).toBe(second.panel);

    second.editor.focus();
    expect(findFocusedInstagramComposer()).toBe(second.editor);
  });

  it.each([
    ['a share dialog with recipient checkboxes', { picker: '<input type="checkbox" aria-label="Select">', thread: '', editor: '<textarea placeholder="Write a message..."></textarea>' }],
    ['a share dialog even when it lists rows', { picker: '<input aria-label="Search" placeholder="Search...">', editor: '<textarea placeholder="Write a message..."></textarea>' }],
    ['a new-message dialog with a search box', { picker: '<div role="searchbox" contenteditable="true"></div>' }],
    ['an overlay without a message thread', { thread: '<div class="content"></div>' }],
    ['a fixed overlay without a message thread', { container: 'fixed' as const, thread: '' }],
    ['a comment drawer', { container: 'fixed' as const, editor: '<textarea aria-label="Add a comment…" placeholder="Add a comment…"></textarea>' }],
    ['a search field in a fixed bar', { container: 'fixed' as const, editor: '<div contenteditable="true" role="textbox" aria-label="Search"></div>' }],
    ['a caption box in a dialog', { editor: '<div contenteditable="true" role="textbox" aria-label="Write a caption..."></div>' }],
  ])('rejects %s', (_label, options) => {
    history.pushState({}, '', '/reels/C1a2b3c4d5/');
    const { editor } = mountFloatingPanel(options);
    expect(adapter.isComposer(editor)).toBe(false);
  });

  it('rejects a message-labelled field outside any panel on non-Direct pages', () => {
    history.pushState({}, '', '/someone/');
    document.body.innerHTML = '<main><div class="bar"><div role="button"></div><textarea placeholder="Message..."></textarea></div></main>';
    expect(adapter.isComposer(document.querySelector('textarea'))).toBe(false);
  });

  it('reads and safely refuses rich drafts in a panel like the main page', () => {
    history.pushState({}, '', '/someone/');
    const plain = mountFloatingPanel({ id: 'plain' }).editor;
    expect(adapter.readDraft(plain)).toBe('Salom');
    expect(adapter.canReplaceDraft(plain)).toBe(true);

    const rich = mountFloatingPanel({
      id: 'rich',
      editor: `<div aria-label="Message" contenteditable="true" role="textbox" data-lexical-editor="true">${paragraph(`${text('qara ')}<a href="https://example.com">bu</a>`)}</div>`,
    }).editor;
    expect(adapter.canReplaceDraft(rich)).toBe(false);
  });
});
