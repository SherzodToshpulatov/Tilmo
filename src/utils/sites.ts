export const TELEGRAM_ORIGIN = 'https://web.telegram.org';
export const INSTAGRAM_ORIGIN = 'https://www.instagram.com';

/** Instagram Direct inbox and conversation routes, e.g. `/direct/t/<id>/`. */
export function isInstagramDirectPath(pathname: string): boolean {
  return /^\/direct(\/|$)/.test(pathname);
}

/** Whether a tab can receive the Translate shortcut. */
export function isTranslatableTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.origin === TELEGRAM_ORIGIN) return true;
  return parsed.origin === INSTAGRAM_ORIGIN && isInstagramDirectPath(parsed.pathname);
}
