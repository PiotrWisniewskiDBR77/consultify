/**
 * Portfolio Health analysis (Kręgosłup inicjatyw · F4 · D9).
 *
 * "Zdrowie portfela" — read-only, deterministic analytics over the org's
 * initiative portfolio. Two responsibilities:
 *
 *   1. {@link findDuplicates} — given a candidate title and the existing
 *      initiatives, surface likely duplicates with a 0..1 similarity score.
 *      Deterministic lexical overlap (Jaccard over normalized tokens) — NO
 *      embeddings, NO LLM, NO DB. Plugs into the generator (F1) and the
 *      candidate inbox (F2) so the same notion of "duplicate" is used everywhere.
 *
 *   2. {@link analyzePortfolioHealth} — given the whole portfolio, compute a
 *      health object: distribution by status, MECE coverage over a FIXED area
 *      taxonomy (so "gaps" are stable across orgs), effort×impact balance, and
 *      clusters of mutually-similar initiatives (duplicate detection at portfolio
 *      scale). Pure: array in → object out, unit-testable without a DB.
 *
 * The thin {@link getPortfolioHealth} adapter is the only DB-touching function:
 * it loads the org's initiatives (fail-safe against schema drift) and delegates
 * everything to the pure functions above. The route layer wires this to
 * `GET /api/initiatives/portfolio-health`.
 *
 * Lexical similarity reuses the shared {@link jaccardSimilarity} primitive — the
 * same engine as C1 dedup (initiativeSimilarityService) and the MECE check
 * (portfolioMeceService) — so "similar" means the same thing module-wide.
 *
 * @module services/initiative/portfolioAnalysisService
 */
import { jaccardSimilarity } from './similarityPrimitives.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape the analysis needs from an initiative row. */
export interface PortfolioInitiative {
  id: string;
  title?: string;
  /** Long-form body, used to strengthen lexical similarity. */
  summary?: string;
  status?: string | null;
  /** Free-text or taxonomy area/category — mapped onto the fixed taxonomy. */
  area?: string | null;
  category?: string | null;
  /** "high" | "medium" | "low" | number-ish — coerced to a 0..1 weight. */
  effort?: string | number | null;
  impact?: string | number | null;
  /** Charter completeness signals (Z94 §5.4 "ready to launch"). */
  ownerId?: string | null;
  budget?: number | null;
  plannedEndDate?: string | null;
}

export interface DuplicateMatch {
  id: string;
  title: string;
  /** 0..1 lexical similarity against the candidate. */
  score: number;
}

export interface DuplicateCluster {
  /** Member initiative ids that are mutually similar (size ≥ 2). */
  ids: string[];
  titles: string[];
  /** Highest pairwise score inside the cluster (0..1). */
  peakScore: number;
}

export interface AreaCoverage {
  /** Fixed-taxonomy area key. */
  area: string;
  count: number;
  /** Share of the portfolio in this area, 0..100. */
  sharePct: number;
}

export interface BalanceCell {
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  count: number;
}

export interface PortfolioHealth {
  total: number;
  byStatus: Record<string, number>;
  /** MECE coverage over the fixed area taxonomy (every taxonomy area present). */
  coverage: AreaCoverage[];
  /** Taxonomy areas with zero / below-threshold coverage. */
  gaps: string[];
  /** effort × impact 3×3 distribution + headline buckets. */
  balance: {
    grid: BalanceCell[];
    /** High-impact + low-effort ("quick wins"). */
    quickWins: number;
    /** High-impact + high-effort ("big bets"). */
    bigBets: number;
    /** Low-impact + high-effort ("money pits"). */
    moneyPits: number;
    /** Low-impact + low-effort ("fill-ins"). */
    fillIns: number;
  };
  duplicateClusters: DuplicateCluster[];
  /**
   * "Ready to launch" (Z94 §5.4 werdykt zakładki): pre-execution initiatives
   * (DRAFT/VALIDATED) whose charter is complete (owner + sizing + timeline
   * assigned) AND that are NOT part of any duplicate cluster. This is a
   * charter-COMPLETENESS signal, not a full feasibility simulation (that lives
   * client-side in Analysis › Feasibility) — deliberately conservative so it
   * never overclaims "ready" for a thin charter.
   */
  readyToLaunch: ReadyToLaunchItem[];
}

export interface ReadyToLaunchItem {
  id: string;
  title: string;
  status: string;
}

/** Statuses considered "pre-launch" (before execution has started). */
const PRE_LAUNCH_STATUSES = new Set(['DRAFT', 'VALIDATED']);

// ---------------------------------------------------------------------------
// Fixed area taxonomy (MECE) — deterministic gap detection
// ---------------------------------------------------------------------------

/**
 * Fixed taxonomy of strategic areas a healthy AI-transformation portfolio should
 * cover. Free-text `area`/`category` values are mapped onto these via keyword
 * synonyms; anything unmatched falls into `other` (never a gap by itself).
 */
export const PORTFOLIO_AREA_TAXONOMY = [
  'data',
  'process',
  'product',
  'people',
  'governance',
  'technology',
  'customer',
  'finance',
] as const;

export type PortfolioArea = (typeof PORTFOLIO_AREA_TAXONOMY)[number] | 'other';

/** Keyword → taxonomy-area synonyms (PL + EN), checked as substrings. */
const AREA_SYNONYMS: Record<(typeof PORTFOLIO_AREA_TAXONOMY)[number], string[]> = {
  data: ['data', 'dane', 'analityk', 'analytics', 'bi', 'raport', 'report', 'insight'],
  process: ['process', 'proces', 'operation', 'operacyj', 'workflow', 'automat', 'efficiency', 'lean'],
  product: ['product', 'produkt', 'feature', 'offering', 'oferta', 'r&d', 'innow'],
  people: ['people', 'ludzi', 'hr', 'talent', 'skill', 'kompeten', 'szkolen', 'training', 'culture', 'kultur', 'team', 'zespol'],
  governance: ['govern', 'ład', 'lad', 'compliance', 'zgodno', 'risk', 'ryzyk', 'security', 'bezpieczen', 'regulat', 'audit', 'audyt', 'policy', 'polit:'],
  technology: ['tech', 'technolog', 'infra', 'platform', 'system', 'it', 'cloud', 'chmur', 'integrac', 'integration', 'architekt'],
  customer: ['customer', 'klient', 'sales', 'sprzeda', 'marketing', 'cx', 'experience', 'doswiadczen', 'service', 'obslug'],
  finance: ['finance', 'finans', 'cost', 'koszt', 'revenue', 'przychod', 'budget', 'budzet', 'roi', 'profit', 'marza', 'margin'],
};

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'by',
  'i', 'oraz', 'dla', 'do', 'na', 'w', 'z', 'ze', 'o', 'jest', 'inicjatywa',
  'initiative', 'projekt', 'project', 'wdrozenie', 'wdrozenia', 'system',
]);

/** Lowercase → token set, strip diacritics, drop stopwords + short tokens. */
function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

/** Map a free-text area/category onto the fixed taxonomy (or 'other'). */
export function classifyArea(area?: string | null, category?: string | null): PortfolioArea {
  const hay = `${String(area || '')} ${String(category || '')}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  if (!hay.trim()) return 'other';
  for (const taxArea of PORTFOLIO_AREA_TAXONOMY) {
    for (const kw of AREA_SYNONYMS[taxArea]) {
      if (hay.includes(kw)) return taxArea;
    }
  }
  return 'other';
}

/** Coerce an effort/impact value (string label or number) to low|medium|high. */
export function coerceLevel(v?: string | number | null): 'low' | 'medium' | 'high' {
  if (v == null) return 'medium';
  if (typeof v === 'number') {
    if (v <= 0) return 'medium';
    if (v <= 3.5) return 'low';
    if (v <= 6.5) return 'medium';
    return 'high';
  }
  const s = String(v).trim().toLowerCase();
  if (!s) return 'medium';
  if (/^\d+(\.\d+)?$/.test(s)) return coerceLevel(Number(s));
  if (/(very[_\s-]?high|highest|krytycz|critical|wysok|high|duz)/.test(s)) return 'high';
  if (/(very[_\s-]?low|lowest|nisk|low|mal|smal)/.test(s)) return 'low';
  return 'medium';
}

// ---------------------------------------------------------------------------
// 1) Duplicate detection (pure)
// ---------------------------------------------------------------------------

/**
 * Find existing initiatives that look like duplicates of a candidate title.
 *
 * Deterministic Jaccard over normalized tokens of {title (+summary)}. Returns
 * matches with score ≥ threshold, sorted by score desc, capped at `limit`.
 *
 * @param candidateTitle   the proposed initiative title (optionally include body
 *                         by passing `opts.candidateSummary`).
 * @param existing         the org's existing initiatives.
 */
export function findDuplicates(
  candidateTitle: string,
  existing: PortfolioInitiative[],
  opts?: { threshold?: number; limit?: number; candidateSummary?: string; excludeId?: string }
): DuplicateMatch[] {
  const threshold = opts?.threshold ?? 0.3;
  const limit = opts?.limit ?? 5;
  const list = Array.isArray(existing) ? existing : [];

  const candTokens = new Set<string>([
    ...tokenize(candidateTitle || ''),
    ...tokenize(opts?.candidateSummary || ''),
  ]);
  if (candTokens.size === 0) return [];

  const matches: DuplicateMatch[] = [];
  for (const e of list) {
    if (!e || !e.id) continue;
    if (opts?.excludeId && String(e.id) === String(opts.excludeId)) continue;
    const tokens = new Set<string>([...tokenize(e.title || ''), ...tokenize(e.summary || '')]);
    const score = jaccardSimilarity(candTokens, tokens);
    if (score >= threshold) {
      matches.push({ id: String(e.id), title: String(e.title || ''), score });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Cluster the portfolio into groups of mutually-similar initiatives (≥ threshold).
 * Single-link clustering over the similarity graph — every pair above threshold
 * connects two members; connected components of size ≥ 2 are returned.
 */
function buildDuplicateClusters(
  initiatives: PortfolioInitiative[],
  threshold: number
): DuplicateCluster[] {
  const n = initiatives.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const tokenSets = initiatives.map(
    (e) => new Set<string>([...tokenize(e.title || ''), ...tokenize(e.summary || '')])
  );
  // peak score per (resolved-root) edge collected after union.
  const pairScores: Array<{ i: number; j: number; score: number }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const score = jaccardSimilarity(tokenSets[i], tokenSets[j]);
      if (score >= threshold) {
        union(i, j);
        pairScores.push({ i, j, score });
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const clusters: DuplicateCluster[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const memberSet = new Set(members);
    let peak = 0;
    for (const p of pairScores) {
      if (memberSet.has(p.i) && memberSet.has(p.j)) peak = Math.max(peak, p.score);
    }
    clusters.push({
      ids: members.map((m) => String(initiatives[m].id)),
      titles: members.map((m) => String(initiatives[m].title || '')),
      peakScore: peak,
    });
  }
  // Strongest clusters first.
  return clusters.sort((a, b) => b.peakScore - a.peakScore);
}

// ---------------------------------------------------------------------------
// 2) Portfolio health (pure)
// ---------------------------------------------------------------------------

/**
 * Analyze the whole portfolio for health.
 *
 * @param initiatives   the org's initiatives.
 * @param opts.dupThreshold  similarity threshold for duplicate clustering (default 0.45).
 * @param opts.gapThreshold  min share (0..1) below which a taxonomy area counts as a gap (default 0 — only truly-empty areas are gaps).
 */
export function analyzePortfolioHealth(
  initiatives: PortfolioInitiative[],
  opts?: { dupThreshold?: number; gapThreshold?: number }
): PortfolioHealth {
  const list = (Array.isArray(initiatives) ? initiatives : []).filter((e) => e && e.id != null);
  const total = list.length;
  const dupThreshold = opts?.dupThreshold ?? 0.45;
  const gapThreshold = opts?.gapThreshold ?? 0;

  // --- byStatus -----------------------------------------------------------
  const byStatus: Record<string, number> = {};
  for (const e of list) {
    const status = String(e.status || 'DRAFT').toUpperCase();
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  // --- MECE coverage over fixed taxonomy ----------------------------------
  const areaCounts: Record<string, number> = {};
  for (const taxArea of PORTFOLIO_AREA_TAXONOMY) areaCounts[taxArea] = 0;
  areaCounts.other = 0;
  for (const e of list) {
    const a = classifyArea(e.area, e.category);
    areaCounts[a] = (areaCounts[a] || 0) + 1;
  }

  const coverage: AreaCoverage[] = PORTFOLIO_AREA_TAXONOMY.map((taxArea) => ({
    area: taxArea,
    count: areaCounts[taxArea] || 0,
    sharePct: total === 0 ? 0 : Math.round(((areaCounts[taxArea] || 0) / total) * 100),
  }));

  // Gaps = taxonomy areas at or below the gap threshold (share). With the
  // default (0), a gap is a truly-empty area.
  const gaps: string[] = [];
  for (const taxArea of PORTFOLIO_AREA_TAXONOMY) {
    const share = total === 0 ? 0 : (areaCounts[taxArea] || 0) / total;
    if (share <= gapThreshold) gaps.push(taxArea);
  }

  // --- effort × impact balance (3×3) --------------------------------------
  const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
  const cellCounts: Record<string, number> = {};
  for (const e of list) {
    const effort = coerceLevel(e.effort);
    const impact = coerceLevel(e.impact);
    cellCounts[`${effort}:${impact}`] = (cellCounts[`${effort}:${impact}`] || 0) + 1;
  }
  const grid: BalanceCell[] = [];
  for (const effort of levels) {
    for (const impact of levels) {
      grid.push({ effort, impact, count: cellCounts[`${effort}:${impact}`] || 0 });
    }
  }
  const quickWins = cellCounts['low:high'] || 0;
  const bigBets = cellCounts['high:high'] || 0;
  const moneyPits = cellCounts['high:low'] || 0;
  const fillIns = cellCounts['low:low'] || 0;

  // --- duplicate clusters -------------------------------------------------
  const duplicateClusters = buildDuplicateClusters(list, dupThreshold);

  // --- ready to launch (charter completeness, pre-launch only) -----------
  const duplicateIds = new Set<string>();
  for (const cl of duplicateClusters) for (const id of cl.ids) duplicateIds.add(id);

  const readyToLaunch: ReadyToLaunchItem[] = list
    .filter((e) => {
      const status = String(e.status || 'DRAFT').toUpperCase();
      if (!PRE_LAUNCH_STATUSES.has(status)) return false;
      if (duplicateIds.has(String(e.id))) return false;
      const hasOwner = Boolean(e.ownerId && String(e.ownerId).trim());
      const hasSizing = Boolean(e.effort != null && e.impact != null) || Boolean(e.budget && e.budget > 0);
      const hasTimeline = Boolean(e.plannedEndDate && String(e.plannedEndDate).trim());
      return hasOwner && hasSizing && hasTimeline;
    })
    .map((e) => ({
      id: String(e.id),
      title: String(e.title || ''),
      status: String(e.status || 'DRAFT').toUpperCase(),
    }));

  return {
    total,
    byStatus,
    coverage,
    gaps,
    balance: { grid, quickWins, bigBets, moneyPits, fillIns },
    duplicateClusters,
    readyToLaunch,
  };
}

// ---------------------------------------------------------------------------
// 3) Thin DB adapter (only DB-touching function) — wired by the route layer
// ---------------------------------------------------------------------------

/**
 * Load an org's initiatives and run {@link analyzePortfolioHealth}.
 *
 * Fail-safe against schema drift: a query error degrades to an empty-portfolio
 * health object rather than throwing (the view is advisory, never blocking).
 *
 * `db` is the queryHelpers-shaped module (`{ queryAll }`) so callers can pass the
 * real helpers or a mock in tests. Terminal rows (CANCELLED/ARCHIVED) are excluded.
 */
export async function getPortfolioHealth(
  db: { queryAll: <T = any>(sql: string, params?: unknown[]) => Promise<T[]> },
  organizationId: string,
  opts?: { dupThreshold?: number; gapThreshold?: number; includeTerminal?: boolean }
): Promise<PortfolioHealth> {
  const orgId = String(organizationId || '').trim();
  if (!orgId) return analyzePortfolioHealth([], opts);

  const terminalFilter = opts?.includeTerminal
    ? ''
    : `AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED', 'ARCHIVED')`;

  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = await db.queryAll<Record<string, unknown>>(
      `SELECT id,
              COALESCE(title, name, '') AS title,
              COALESCE(summary, '')     AS summary,
              status,
              area,
              category,
              effort,
              impact,
              COALESCE(owner_business_id, owner_execution_id) AS owner_id,
              estimated_budget,
              planned_end_date
         FROM initiatives
        WHERE organization_id = ?
          ${terminalFilter}
        LIMIT 1000`,
      [orgId]
    );
  } catch {
    // Advisory analytics — never throw on schema drift / missing optional column.
    return analyzePortfolioHealth([], opts);
  }

  const mapped: PortfolioInitiative[] = rows.map((r) => ({
    id: String(r.id),
    title: r.title == null ? '' : String(r.title),
    summary: r.summary == null ? '' : String(r.summary),
    status: r.status == null ? null : String(r.status),
    area: r.area == null ? null : String(r.area),
    category: r.category == null ? null : String(r.category),
    effort: (r.effort as string | number | null) ?? null,
    impact: (r.impact as string | number | null) ?? null,
    ownerId: r.owner_id == null ? null : String(r.owner_id),
    budget: r.estimated_budget == null ? null : Number(r.estimated_budget),
    plannedEndDate: r.planned_end_date == null ? null : String(r.planned_end_date),
  }));

  return analyzePortfolioHealth(mapped, opts);
}
