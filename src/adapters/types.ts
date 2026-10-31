export interface MessageEditorAdapter {
  isComposer(element: Element | null): element is HTMLElement;
  readDraft(editor: HTMLElement): string;
  /** When `text` is given, also checks that the editor can hold it exactly. */
  canReplaceDraft(editor: HTMLElement, text?: string): boolean;
  replaceDraft(editor: HTMLElement, text: string): Promise<boolean>;
}
