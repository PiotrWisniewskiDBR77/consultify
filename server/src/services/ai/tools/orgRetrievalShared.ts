/**
 * Shared helpers for Teresa org-content retrieval tools
 * (search_org_notes / search_insights / get_initiative).
 *
 * All three tools return the same compact, model-readable envelope:
 *   { results: [...], truncated: boolean }
 * capped to ~4KB of serialized JSON per call so tool output can be injected
 * into the chat system instruction without blowing up the prompt budget.
 */

/**
 * Feature flag ff_teresaRetrieval — same env-var mechanism as the other
 * ENABLE_* flags (cf. ENABLE_DELIVERABLES_LIGHT in config/FeatureFlags.ts).
 * Read per-call so tests/env changes apply without re-importing modules.
 * Default off.
 */
export function isTeresaRetrievalEnabled(): boolean {
  return process.env.ENABLE_TERESA_RETRIEVAL === 'true';
}

/**
 * Krok C (rozdział flagi-długu ENABLE_TERESA_MINDMAP — patrz
 * `server/src/config/FeatureFlags.ts` komentarz przy tej fladze): jedna nazwa
 * ENV historycznie gasiła DWIE niepowiązane funkcje —
 *   Funkcja A (deliverable bridge): generate_deliverable(type:'mindmap') +
 *     front (IdeaMapWorkspace/useOpenChatWithContext) — zostaje na
 *     `ENABLE_TERESA_MINDMAP`, default ON, NIE dotyczy tego helpera.
 *   Funkcja B (retrieval, TEN plik): tool `search_org_mindmaps` — dostaje
 *     WŁASNĄ flagę `ENABLE_TERESA_MINDMAP_SEARCH`, default OFF.
 *
 * Kompatybilność wsteczna: każde środowisko, które dotąd włączało retrieval
 * WYŁĄCZNIE starą flagą (`ENABLE_TERESA_MINDMAP=true`), ma działać tak samo —
 * stąd OR obu flag, nie zamiana jednej na drugą. Jedyny sposób na wyłączenie
 * retrievalu tam, gdzie stara flaga zostaje ON dla Funkcji A, to NOWA,
 * niezależna kontrola (`ENABLE_TERESA_MINDMAP_SEARCH`), którą to zastępuje.
 *
 * Read per-call (nie przez cache'owany `featureFlags` singleton) so env
 * changes in tests apply without re-importing. Co-gated z
 * `isTeresaRetrievalEnabled()` (oba muszą być prawdziwe) — patrz
 * `searchOrgMindmaps.ts`.
 */
export function isTeresaMindmapSearchEnabled(): boolean {
  return (
    process.env.ENABLE_TERESA_MINDMAP_SEARCH === 'true' ||
    process.env.ENABLE_TERESA_MINDMAP === 'true'
  );
}

/** Max serialized size (chars ≈ bytes for ASCII-heavy JSON) per tool result. */
export const ORG_RETRIEVAL_MAX_PAYLOAD_CHARS = 4000;

/** Max hits a single search tool call may return. */
export const ORG_RETRIEVAL_MAX_LIMIT = 10;

/** Default number of hits when the caller does not specify a limit. */
export const ORG_RETRIEVAL_DEFAULT_LIMIT = 5;

export interface OrgRetrievalEnvelope<T> {
  results: T[];
  truncated: boolean;
}

/** Clamp a requested limit into [1, ORG_RETRIEVAL_MAX_LIMIT]. */
export function clampLimit(limit?: number): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return ORG_RETRIEVAL_DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(n)), ORG_RETRIEVAL_MAX_LIMIT);
}

/** Trim a snippet to ~300 chars without leaving a dangling half-word. */
export function toSnippet(text: unknown, maxChars = 300): string {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : maxChars)}…`;
}

/**
 * Build the { results, truncated } envelope while enforcing the ~4KB cap.
 * Items are added in order until the serialized payload would exceed the cap.
 */
export function capResultPayload<T>(
  results: T[],
  maxChars = ORG_RETRIEVAL_MAX_PAYLOAD_CHARS
): OrgRetrievalEnvelope<T> {
  const out: T[] = [];
  let size = 32; // envelope overhead
  let truncated = false;
  for (const item of results) {
    const itemSize = JSON.stringify(item).length + 1;
    if (size + itemSize > maxChars) {
      truncated = true;
      break;
    }
    out.push(item);
    size += itemSize;
  }
  return { results: out, truncated: truncated || out.length < results.length };
}

export default {
  isTeresaRetrievalEnabled,
  isTeresaMindmapSearchEnabled,
  clampLimit,
  toSnippet,
  capResultPayload,
};
