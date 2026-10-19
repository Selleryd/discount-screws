/** Root of the public GitHub Pages project. */
export const SITE_BASE = "/discount-screws/";

/** Prefix local absolute paths; keep remote, blob, data and anchor URLs intact. */
export function sitePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const base = SITE_BASE.slice(0, -1);
  if (path === base || path.startsWith(SITE_BASE) || path.startsWith(base + "?") || path.startsWith(base + "#")) return path;
  return base + path;
}

/** Remove the deployment prefix before interpreting a storefront route. */
export function appPath(pathname: string): string {
  const base = SITE_BASE.slice(0, -1);
  if (pathname === base || pathname === SITE_BASE) return "/";
  return pathname.startsWith(SITE_BASE) ? pathname.slice(base.length) : pathname;
}
