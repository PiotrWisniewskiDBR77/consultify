// components/Megatrend/megatrendIndustry.ts
//
// F3b (pomiar DEC-463, 2026-09-10): MegatrendsWorkspace used to hardcode
// `useState('automotive')` regardless of which organization was looking at
// the panel — every org saw the automotive baseline. The exact-match-else-
// 'general' fallback itself lives server-side (server/src/models/megatrend.ts
// getBaselineTrends), because that is the only place that actually knows
// which industries have curated rows. This helper only does the trivial,
// purely-client part: read the organization's own `industry` string and fall
// back to 'general' (never 'automotive') when it is missing/blank, so the
// FIRST request the panel makes is always a real, honest guess instead of a
// silently wrong default.
export const DEFAULT_MEGATREND_INDUSTRY = 'general';

/**
 * Trim `orgIndustry` and use it as the default Megatrend industry, or fall
 * back to `DEFAULT_MEGATREND_INDUSTRY` when it is missing/blank. Does NOT try
 * to guess whether the value has curated megatrend rows — an org industry
 * with no rows yet (e.g. 'financial') is a legitimate value to send; the
 * server degrades to 'general' and tells the client it did (see
 * useMegatrendStore.fetchMegatrends / MegatrendFallbackNotice).
 */
export function resolveDefaultMegatrendIndustry(orgIndustry: string | null | undefined): string {
  const trimmed = (orgIndustry ?? '').trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_MEGATREND_INDUSTRY;
}
