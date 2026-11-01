const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const ENTITY = /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+);/gi;

/**
 * Decodes the HTML entities Google Translate v2 can return (for example
 * `&#39;`) into plain text. Single pass, so `&amp;lt;` becomes `&lt;`, not `<`.
 * The result is text and must only ever be rendered as text.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(ENTITY, (entity, body: string) => {
    if (body[0] === '#') {
      const codePoint = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      const isValid = codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff);
      return isValid ? String.fromCodePoint(codePoint) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}
