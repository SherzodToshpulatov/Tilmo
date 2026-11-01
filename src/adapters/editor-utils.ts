// Helpers shared by the site-specific editor adapters.

export function isVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

export function isTextArea(element: HTMLElement): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
}

/** Gives the page's editor two frames to observe and reconcile a change. */
export function waitForEditor(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Dispatches a plain-text paste, which rich-text editors handle through their
 * own transaction path instead of interpreting DOM mutations.
 */
export function dispatchPlainTextPaste(editor: HTMLElement, text: string): void {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  editor.dispatchEvent(new ClipboardEvent('paste', {
    clipboardData,
    bubbles: true,
    cancelable: true,
    composed: true,
  }));
}
