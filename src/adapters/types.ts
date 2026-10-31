export interface MessageEditorAdapter {
  isComposer(element: Element | null): element is HTMLElement;
  readDraft(editor: HTMLElement): string;
  canReplaceDraft(editor: HTMLElement): boolean;
  replaceDraft(editor: HTMLElement, text: string): Promise<boolean>;
}
