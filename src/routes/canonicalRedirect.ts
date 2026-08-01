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

/** Preserve legacy state while enforcing the canonical tab for a retired route. */
export function buildCanonicalTabRedirectTarget(
  canonicalPath: string,
  location: RedirectLocationParts,
  tab: string
): string {
  const params = new URLSearchParams(location.search || '');
  params.set('tab', tab);
  const query = params.toString();
  return `${canonicalPath}${query ? `?${query}` : ''}${location.hash || ''}`;
}
