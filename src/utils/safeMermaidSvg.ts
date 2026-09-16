import DOMPurify from 'dompurify';

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const LOCAL_MARKER_REFERENCE = /^url\(#[A-Za-z0-9_.:-]+\)$/;
const MARKER_ATTRIBUTES = new Set(['marker-start', 'marker-mid', 'marker-end']);

function isAllowedSvgLink(rawValue: string): boolean {
  const value = rawValue.trim();
  if (!value) return false;
  if (value.startsWith('#')) return true;

  try {
    const url = new URL(value, 'https://consultify.invalid');
    return ALLOWED_LINK_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Final-context sanitization for Mermaid output before it reaches innerHTML.
 * Mermaid remains responsible for layout; this boundary removes active SVG
 * content and rejects executable/data URL schemes even if a future Mermaid
 * parser regression emits them.
 */
export function sanitizeMermaidSvg(renderedSvg: string): string {
  const sanitized = DOMPurify.sanitize(renderedSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Mermaid uses local marker references for arrow heads. These remain
    // internal `url(#id)` references and are not navigable links.
    ADD_ATTR: ['target', 'marker-start', 'marker-mid', 'marker-end'],
    ADD_URI_SAFE_ATTR: ['marker-start', 'marker-mid', 'marker-end'],
    FORBID_TAGS: ['script', 'foreignObject'],
  });

  const documentNode = new DOMParser().parseFromString(sanitized, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return '';

  for (const element of Array.from(documentNode.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.localName === 'href' && !isAllowedSvgLink(attribute.value)) {
        element.removeAttributeNode(attribute);
      } else if (
        MARKER_ATTRIBUTES.has(attribute.localName) &&
        !LOCAL_MARKER_REFERENCE.test(attribute.value)
      ) {
        element.removeAttributeNode(attribute);
      }
    }
  }

  return new XMLSerializer().serializeToString(documentNode.documentElement);
}
