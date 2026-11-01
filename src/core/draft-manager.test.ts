import { describe, expect, it } from 'vitest';
import type { MessageEditorAdapter } from '../adapters/types';
import { DraftManager } from './draft-manager';

// Editor stand-in: the draft lives in `drafts`, keyed by the element object.
function fakeEditor(initial: string) {
  const editor = { isConnected: true } as HTMLElement;
  const drafts = new Map<HTMLElement, string>([[editor, initial]]);
  const adapter: MessageEditorAdapter = {
    isComposer: (element): element is HTMLElement => element === editor,
    readDraft: (element) => drafts.get(element) ?? '',
    canReplaceDraft: (_element, text) => text === undefined || !text.includes('\n\n'),
    replaceDraft: async (element, text) => {
      drafts.set(element, text);
      return true;
    },
  };
  return { editor, adapter, setDraft: (text: string) => drafts.set(editor, text), draft: () => drafts.get(editor) };
}

describe('DraftManager', () => {
  it('replaces an unchanged draft and undoes it', async () => {
    const { editor, adapter, draft } = fakeEditor('Salom');
    const manager = new DraftManager(adapter);
    const snapshot = manager.capture(editor);

    expect(await manager.replace(snapshot, 'Hello')).toBe(true);
    expect(draft()).toBe('Hello');
    expect(await manager.undo()).toBe(true);
    expect(draft()).toBe('Salom');
  });

  it('refuses to replace a draft edited after the translation was requested', async () => {
    const { editor, adapter, setDraft, draft } = fakeEditor('Salom');
    const manager = new DraftManager(adapter);
    const snapshot = manager.capture(editor);

    setDraft('Salom, qalaysan?');
    expect(manager.isUnchanged(snapshot)).toBe(false);
    expect(await manager.replace(snapshot, 'Hello')).toBe(false);
    expect(draft()).toBe('Salom, qalaysan?');
  });

  it('refuses to undo after the user edits the replaced draft', async () => {
    const { editor, adapter, setDraft, draft } = fakeEditor('Salom');
    const manager = new DraftManager(adapter);
    await manager.replace(manager.capture(editor), 'Hello');

    setDraft('Hello there');
    expect(await manager.undo()).toBe(false);
    expect(draft()).toBe('Hello there');
  });

  it('refuses a replacement the editor cannot hold exactly, or whose undo it could not restore', async () => {
    const { editor, adapter, draft } = fakeEditor('a\n\nb');
    const manager = new DraftManager(adapter);
    const snapshot = manager.capture(editor);

    expect(manager.canReplace(snapshot, 'x')).toBe(false);
    expect(await manager.replace(snapshot, 'x')).toBe(false);
    expect(draft()).toBe('a\n\nb');
  });

  it('refuses a disconnected editor', async () => {
    const { editor, adapter } = fakeEditor('Salom');
    const manager = new DraftManager(adapter);
    const snapshot = manager.capture(editor);
    (editor as { isConnected: boolean }).isConnected = false;
    expect(await manager.replace(snapshot, 'Hello')).toBe(false);
  });
});
