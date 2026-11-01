/** Instagram Direct inbox and conversation routes, e.g. `/direct/t/<id>/`. */
export function isInstagramDirectPath(pathname: string): boolean {
  return /^\/direct(\/|$)/.test(pathname);
}
