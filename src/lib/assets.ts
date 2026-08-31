// the site deploys under a base path, so a bare /audio or /art href would resolve
// against the domain root and 404. everything shipped from public/ goes through here
export function resolveAssetPath(path: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    (typeof document === 'undefined' ? 'http://localhost/' : document.baseURI);
  return new URL(path.replace(/^\/+/, ''), base).toString();
}
