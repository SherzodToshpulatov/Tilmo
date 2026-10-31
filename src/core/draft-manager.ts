import type { MessageEditorAdapter } from '../adapters/types';

export interface DraftSnapshot {
  editor: HTMLElement;
  text: string;
}

export class DraftManager {
  private undoSnapshot: DraftSnapshot | null = null;
  private replacedText: string | null = null;

  constructor(private readonly adapter: MessageEditorAdapter) {}

  capture(editor: HTMLElement): DraftSnapshot {
    return { editor, text: this.adapter.readDraft(editor) };
  }

  canReplace(snapshot: DraftSnapshot): boolean {
    return this.adapter.canReplaceDraft(snapshot.editor);
  }

  isUnchanged(snapshot: DraftSnapshot): boolean {
    return snapshot.editor.isConnected &&
      this.adapter.readDraft(snapshot.editor) === snapshot.text;
  }

  async replace(snapshot: DraftSnapshot, translatedText: string): Promise<boolean> {
    if (!this.isUnchanged(snapshot) || !this.canReplace(snapshot)) return false;
    const replaced = await this.adapter.replaceDraft(snapshot.editor, translatedText);
    if (!replaced) return false;

    this.undoSnapshot = snapshot;
    this.replacedText = translatedText;
    return true;
  }

  async undo(): Promise<boolean> {
    const snapshot = this.undoSnapshot;
    if (!snapshot || this.replacedText === null ||
      !snapshot.editor.isConnected ||
      this.adapter.readDraft(snapshot.editor) !== this.replacedText ||
      !this.adapter.canReplaceDraft(snapshot.editor)) {
      return false;
    }

    const restored = await this.adapter.replaceDraft(snapshot.editor, snapshot.text);
    if (restored) {
      this.undoSnapshot = null;
      this.replacedText = null;
    }
    return restored;
  }
}
