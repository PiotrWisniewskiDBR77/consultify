/**
 * briefEnrichment (W3.2 / F2.2 „Wejście 1: brief→retrieval z org") — wzbogaca
 * brief wiązki o KONTEKST ORGANIZACJI przed generacją.
 *
 * Komponuje DOJRZAŁE narzędzia retrieval Teresy (`searchInsights` + `searchOrgNotes`,
 * za flagą ENABLE_TERESA_RETRIEVAL) — te same, których używa docGenerationRuntime.
 * Trafienia stają się blokiem faktów dopisanym do briefu → generacja zakotwiczona
 * w realnych danych org (nie tylko w słowach użytkownika).
 *
 * Decyzja W0.1 = KOMPONUJ dojrzałe studia. Czyste, fail-soft (błąd/pusto →
 * brief bez zmian, used=false). DI na narzędzia → testowalne bez DB/flag.
 */
import logger from '../../utils/Logger.js';

const LOG = '[briefEnrichment]';

export interface BriefEnrichmentHit {
  type: 'insight' | 'note';
  title: string;
  snippet: string;
}

export interface BriefEnrichment {
  /** Brief + blok kontekstu org (lub oryginał gdy brak trafień). */
  enrichedBrief: string;
  /** Dopisany blok faktów (null gdy brak). */
  contextBlock: string | null;
  hits: BriefEnrichmentHit[];
  /** Czy realnie wzbogacono (≥1 trafienie). */
  used: boolean;
}

type RetrievalEnvelope<T> = { results: T[] };
export interface BriefEnrichmentDeps {
  searchInsights: (
    params: { query: string; limit: number },
    ctx: { organizationId: string }
  ) => Promise<RetrievalEnvelope<{ title?: string; snippet?: string }>>;
  searchOrgNotes: (
    params: { query: string; limit: number },
    ctx: { organizationId: string }
  ) => Promise<RetrievalEnvelope<{ title?: string; snippet?: string }>>;
}

export interface BriefEnrichmentOptions {
  language?: 'pl' | 'en';
  maxHits?: number;
  maxContextChars?: number;
}

/** Domyślne deps = dynamiczny import realnych narzędzi Teresy (jak docGenerationRuntime). */
async function defaultDeps(): Promise<BriefEnrichmentDeps> {
  const [{ searchInsights }, { searchOrgNotes }] = await Promise.all([
    import('../ai/tools/searchInsights.js'),
    import('../ai/tools/searchOrgNotes.js'),
  ]);
  return {
    searchInsights: searchInsights as never,
    searchOrgNotes: searchOrgNotes as never,
  };
}

/**
 * Wzbogać brief o kontekst organizacji. Fail-soft: brak orgId / pusto / błąd →
 * oryginalny brief, used=false. Nigdy nie rzuca.
 */
export async function enrichBriefWithOrgContext(
  brief: string,
  organizationId: string,
  deps?: BriefEnrichmentDeps,
  opts: BriefEnrichmentOptions = {}
): Promise<BriefEnrichment> {
  const noop: BriefEnrichment = { enrichedBrief: brief, contextBlock: null, hits: [], used: false };
  try {
    const orgId = String(organizationId || '').trim();
    const query = String(brief || '').trim();
    if (!orgId || query.length < 3) return noop;

    const d = deps ?? (await defaultDeps());
    const maxHits = Math.max(1, Math.min(opts.maxHits ?? 6, 12));
    const perTool = Math.max(1, Math.ceil(maxHits / 2));

    const [insights, notes] = await Promise.all([
      d
        .searchInsights({ query, limit: perTool }, { organizationId: orgId })
        .catch(() => ({ results: [] })),
      d
        .searchOrgNotes({ query, limit: perTool }, { organizationId: orgId })
        .catch(() => ({ results: [] })),
    ]);

    const hits: BriefEnrichmentHit[] = [
      ...(insights.results ?? []).map((h) => ({
        type: 'insight' as const,
        title: String(h.title ?? ''),
        snippet: String(h.snippet ?? ''),
      })),
      ...(notes.results ?? []).map((h) => ({
        type: 'note' as const,
        title: String(h.title ?? ''),
        snippet: String(h.snippet ?? ''),
      })),
    ]
      .filter((h) => h.title || h.snippet)
      .slice(0, maxHits);

    if (hits.length === 0) return noop;

    const isPl = (opts.language ?? 'pl') !== 'en';
    const header = isPl
      ? 'Kontekst organizacji (fakty ze źródeł — użyj jako podstawy, nie zmyślaj):'
      : 'Organization context (facts from sources — use as basis, do not fabricate):';
    const lines = hits
      .map((h) => `${h.title}${h.title && h.snippet ? ': ' : ''}${h.snippet}`.trim())
      .filter((l) => l.length > 4);
    const maxChars = Math.max(200, Math.min(opts.maxContextChars ?? 3500, 6000));
    const contextBlock = `${header}\n- ${lines.join('\n- ')}`.slice(0, maxChars);

    return {
      enrichedBrief: `${brief}\n\n${contextBlock}`,
      contextBlock,
      hits,
      used: true,
    };
  } catch (err) {
    logger.warn(
      `${LOG} enrich failed (fail-soft, using raw brief): ${err instanceof Error ? err.message : String(err)}`
    );
    return noop;
  }
}
