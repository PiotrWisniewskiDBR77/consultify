/**
 * Shared lexical-similarity primitives for initiative duplicate detection.
 *
 * Extracted to de-duplicate the (previously copy-pasted) Jaccard implementation
 * that lived in BOTH initiative similarity services:
 *   - server/src/services/initiativeSimilarityService.ts        (AI-wizard candidate flow)
 *   - server/src/services/initiative/initiativeSimilarityService.ts (C1 portfolio dedup)
 *
 * Only the genuinely-identical primitive (Jaccard over token sets) is shared.
 * The two services intentionally keep their OWN tokenizers — they differ in
 * stopword lists and minimum-token-length, and changing either would alter the
 * observable behavior of its endpoint. Do NOT merge the tokenizers here.
 *
 * @module services/initiative/similarityPrimitives
 */

/**
 * Jaccard similarity between two token sets: |A∩B| / |A∪B|, in [0,1].
 * Returns 0 when either set is empty (no meaningful overlap to measure).
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const tok of a) {
    if (b.has(tok)) intersection++;
  }
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}
