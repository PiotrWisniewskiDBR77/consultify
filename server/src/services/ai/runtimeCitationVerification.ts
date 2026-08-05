/**
 * Runtime Citation Verification — HP-15 (Harvey-Parity Blok D).
 *
 * SSOT: Harvard/wdrozenie-100/_PLAN_HARVEY_PARITY_2026-07-11.md §Blok D (HP-15):
 *   "Przenieść citationVerifier z evalHarness do runtime (wywoływany przy generacji, nie
 *    tylko offline). Widoczne w logach produkcyjnych, nie tylko w testach."
 *
 * DO 07-14 `citationVerifier` był wołany WYŁĄCZNIE w `evalHarnessService.ts` (offline eval).
 * Ten moduł jest cienkim ADAPTEREM runtime: bierze heterogeniczne cytowania SSE zebrane w
 * `ai.routes.ts` (`collectedCitations`), normalizuje do kształtu `Citation`, uruchamia
 * istniejący `citationVerifier.verify(...)` PRZY GENERACJI i loguje wynik (liczniki
 * zweryfikowanych/niezweryfikowanych). NIE blokuje generacji — tylko oznacza (fail-soft).
 *
 * Wynik zasila `confidence` w trust bundle DETERMINISTYCZNIE (zamiast dotychczasowego
 * zahardkodowanego 0.86/0.52 — patrz emitTrustBundle) oraz `EvidenceContract.confidence`
 * przez `deriveConfidence({ verifiedCitations, totalCitations, ... })`.
 */
import logger from '../../utils/Logger.js';
import type { EvidenceConfidence } from '../evidence/evidenceContract.js';
import type { Citation } from './citationExtractor.js';
import { citationVerifier, type VerificationReport } from './citationVerifier.js';

const LOG = '[RuntimeCitationVerify]';

function looksLikeUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/.+/i.test(value.trim());
}

/**
 * Normalizuje jedno surowe cytowanie SSE (governed/attachment/deep_research/…) do `Citation`.
 * Świadomie zachowawcza: jeśli cytowanie NIE ma rozwiązywalnego `sourceId` ani URL, weryfikator
 * oznaczy je jako 'unverified' — to POŻĄDANE zachowanie bramki dowodowej
 * ("Deklaracja—niepotwierdzone"), nie błąd.
 */
export function adaptRuntimeCitation(raw: unknown, index: number): Citation | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === 'string' && r.id.trim() ? r.id : `rt_citation_${index + 1}`;
  const rawType = typeof r.type === 'string' ? r.type : '';
  const url =
    (typeof r.sourceUrl === 'string' && r.sourceUrl) ||
    (typeof r.url === 'string' && r.url) ||
    (typeof r.link === 'string' && r.link) ||
    (looksLikeUrl(r.reference) ? (r.reference as string) : '') ||
    undefined;

  const isExternal = rawType === 'external' || Boolean(url);
  const explicitSourceType = typeof r.sourceType === 'string' ? r.sourceType : '';

  const sourceType = (explicitSourceType ||
    (isExternal ? 'external' : 'document')) as Citation['sourceType'];

  const sourceId =
    (typeof r.sourceId === 'string' && r.sourceId) ||
    (typeof r.docId === 'string' && r.docId) ||
    undefined;

  const text =
    (typeof r.text === 'string' && r.text) ||
    (typeof r.excerpt === 'string' && r.excerpt) ||
    (typeof r.title === 'string' && r.title) ||
    '';

  const confidence = typeof r.confidence === 'number' ? r.confidence : 0.5;

  const citation: Citation & { retrievedBySystem?: boolean } = {
    id,
    index,
    text,
    sourceType,
    sourceId,
    sourceTitle: typeof r.title === 'string' ? r.title : undefined,
    sourceUrl: url,
    confidence,
  };

  // Deep-research źródła były FAKTYCZNIE pobrane przez system → weryfikator może je uznać
  // ('verified' zamiast 'partial'). Sygnał realny (id nadany przez pipeline pobierania), nie zgadnięty.
  if (String(id).startsWith('deep_research') || r.retrievedBySystem === true) {
    citation.retrievedBySystem = true;
  }

  return citation;
}

export function adaptRuntimeCitations(rawCitations: unknown): Citation[] {
  if (!Array.isArray(rawCitations)) return [];
  const out: Citation[] = [];
  rawCitations.forEach((raw, i) => {
    const c = adaptRuntimeCitation(raw, i);
    if (c) out.push(c);
  });
  return out;
}

/**
 * Uruchamia weryfikator cytowań PRZY GENERACJI i loguje wynik. NIGDY nie rzuca — zwraca
 * `null`, gdy nie było czego weryfikować lub weryfikacja padła (fail-soft, nie blokuje odpowiedzi).
 */
export async function verifyRuntimeCitations(
  rawCitations: unknown,
  ctx: {
    conversationId?: string | null;
    messageId?: string | null;
    surface?: string;
    /**
     * M01-006 — the requesting caller's organization. Threaded through to
     * `citationVerifier.verify` so it can flag a citation whose sourceId
     * resolves to a document belonging to a DIFFERENT organization as
     * `'no_access'` instead of `'verified'`. Optional: every existing
     * caller that doesn't pass it keeps the prior existence-only behavior.
     */
    organizationId?: string | null;
  } = {}
): Promise<VerificationReport | null> {
  try {
    const citations = adaptRuntimeCitations(rawCitations);
    if (citations.length === 0) {
      logger.info(
        `${LOG} 0 citations to verify (surface=${ctx.surface || 'chat'}, conversation=${ctx.conversationId || 'n/a'})`
      );
      return null;
    }
    const report = await citationVerifier.verify(
      citations,
      ctx.conversationId || undefined,
      ctx.messageId || undefined,
      ctx.organizationId || undefined
    );
    // Widoczne w logach produkcyjnych — twardy wymóg HP-15.
    logger.info(
      `${LOG} runtime verification (surface=${ctx.surface || 'chat'}): ` +
        `${report.totalCitations} citations → ${report.verified} verified, ` +
        `${report.unverified} unverified, ${report.broken} broken, score=${report.overallScore}`
    );
    return report;
  } catch (err) {
    logger.warn(
      `${LOG} runtime verification failed (fail-soft, non-blocking): ` +
        `${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Mapuje raport weryfikacji na etykietę pewności trust-bundle — DETERMINISTYCZNIE z realnych
 * liczników (verified/total), NIE ze zgadywania. Używane do zastąpienia zahardkodowanego 0.86/0.52.
 */
export function confidenceFromVerification(
  report: VerificationReport | null,
  hasNonGeneralSources: boolean
): EvidenceConfidence {
  if (!report || report.totalCitations === 0) {
    // Brak zweryfikowanych cytowań: pewność 'low', chyba że są realne źródła nie-ogólne.
    return hasNonGeneralSources ? 'medium' : 'low';
  }
  const ratio = report.verified / report.totalCitations;
  if (ratio >= 0.8 && report.totalCitations >= 3) return 'high';
  if (ratio >= 0.5) return 'medium';
  return 'low';
}

/** Numeryczna pewność pod istniejące pole `bundle.confidence` (0..1). */
export function numericConfidenceFromVerification(
  report: VerificationReport | null,
  hasNonGeneralSources: boolean
): number {
  const label = confidenceFromVerification(report, hasNonGeneralSources);
  return label === 'high' ? 0.86 : label === 'medium' ? 0.68 : 0.52;
}
