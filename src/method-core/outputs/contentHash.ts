/**
 * Deterministic content hashing for Assessment Outputs.
 *
 * Portable (no `node:crypto`) on purpose: `src/method-core/outputs` is
 * imported from the browser bundle (Workspace/Output UI) as well as from the
 * server runtime, and Web Crypto's `subtle.digest` is async — forcing every
 * construction path in this module to become async would buy nothing here
 * (this hash is for content-addressing/equality checks, not security).
 *
 * REGRESSION GUARD — this is the exact defect the canon calls out:
 * "UPDATE bez ORDER BY + float niełączne → 6-7 różnych hashy z 10 przebiegów"
 * (see MEMORY finance-v3-hash-niedeterministyczny-2026-08-11.md). Two
 * defensive rules follow from that incident and are enforced here, not left
 * to callers:
 *
 *  1. Never trust array order. Any array of identifiable records (findings,
 *     evidence refs, limitations) must be sorted BY A STABLE KEY before it
 *     enters the hashed representation — never by whatever order a SQL
 *     SELECT (no ORDER BY) or an unordered JS Set/Map happened to produce.
 *  2. Never fold a raw float into the hashed string. Aggregated scores are
 *     rounded to a fixed precision first, so float noise from different
 *     summation orders upstream (e.g. `0.1 + 0.2` computed two different
 *     ways) can't produce two different hashes for the same logical value.
 *
 * `server/src/method-core/db.ts` has a sibling `computeContentHash` (sha256,
 * same in-memory-sort discipline) for the session/event-log snapshot payload
 * — that is a different payload (raw event log) hashed for a different
 * purpose (freeze snapshot integrity). This module hashes the OUTPUT content
 * (methodology + scope + findings + aggregation) and is deliberately
 * independent so neither side needs to import across the server/browser
 * boundary.
 */

const HASH_DECIMAL_PRECISION = 4;

/** Round a score-like number to a fixed precision before hashing/comparing. */
export function roundForHash(value: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** HASH_DECIMAL_PRECISION;
  return Math.round(value * factor) / factor;
}

/** Sort an array of records by a stable string-coercible key. Never mutates. */
export function sortByStableKey<T, K extends keyof T>(items: readonly T[], key: K): T[] {
  return [...items].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

/** Sort an array of strings alphabetically. Never mutates. */
export function sortStrings(items: readonly string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b));
}

function normalizeForHash(value: unknown): unknown {
  if (typeof value === 'number') return roundForHash(value);
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = normalizeForHash(obj[k]);
    return out;
  }
  return value;
}

/**
 * Deterministic JSON serialization: object keys sorted, numbers rounded.
 * Does NOT sort arrays — callers must pre-sort any array whose element
 * order is not already semantically fixed (see `sortByStableKey`).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForHash(value));
}

/**
 * cyrb53 — small, fast, deterministic non-cryptographic string hash.
 * Public-domain implementation (bryc,
 * https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js).
 * 53-bit output encoded as a fixed-width hex string.
 */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Deterministic content hash of an already-normalized (sorted) payload. */
export function computePortableContentHash(payload: unknown): string {
  const str = stableStringify(payload);
  return cyrb53(str).toString(16).padStart(14, '0');
}
