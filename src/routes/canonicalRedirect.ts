export interface RedirectLocationParts {
  search?: string;
  hash?: string;
}

/** Preserve user-visible route state while retiring a legacy pathname. */
export function buildCanonicalRedirectTarget(
  canonicalPath: string,
  location: RedirectLocationParts
): string {
  return `${canonicalPath}${location.search || ''}${location.hash || ''}`;
}
