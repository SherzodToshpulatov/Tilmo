function comparable(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

/** Whether two texts differ only in case, whitespace or Unicode normalization. */
export function isSameText(a: string, b: string): boolean {
  return comparable(a) === comparable(b);
}
