/**
 * initiativeCandidateService — F2 SKRZYNKA KANDYDATÓW (D5/D8).
 *
 * Wejście wrzeciona inicjatyw: AI proaktywnie sugeruje inicjatywy z rozpoznania.
 * Skanuje świeże artefakty rozpoznania (interview_insights / assessments / audits),
 * które NIE mają jeszcze przypisanej inicjatywy, i produkuje wiersze-kandydatów
 * {title, rationale, fitScore} do tabeli `initiative_candidates`.
 *
 * Granice tej warstwy:
 *   - scanForCandidates  → buduje kandydatów z rozpoznania i je utrwala (pending).
 *   - listCandidates     → lista (filtr po statusie).
 *   - acceptCandidate    → oznacza accepted i ZWRACA payload do uruchomienia
 *                          generatora F1 (NIE wywołuje generatora — to robi route/F1).
 *   - dismissCandidate   → oznacza dismissed.
 *
 * Wszystko org-scoped i FAIL-SOFT: schema drift / brak tabeli / błąd zapytania
 * degraduje do pustej listy / null zamiast wyjątku (wzór initiativeLineageService).
 *
 * `db` jest wstrzykiwalnym interfejsem zapytań (domyślnie globalne queryHelpers),
 * dzięki czemu logika jest testowalna z mock-DB bez realnej bazy.
 */

import type { QueryResultRow } from 'pg';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { createInitiative as funnelCreateInitiative } from './createInitiativeService.js';
import {
  defaultDeps as generatorDefaultDeps,
  generateFullInitiative,
} from './initiativeGeneratorBrain.js';
import { resolveProjectIdFromSource } from './sourceProjectResolver.js';

// ---------------------------------------------------------------------------
// Injectable DB interface
// ---------------------------------------------------------------------------

export interface CandidateDb {
  queryAll<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T | null>;
  queryRun(sql: string, params?: unknown[]): Promise<{ lastID?: number; changes: number }>;
}

/** Default DB = real query helpers. Tests pass a mock implementing CandidateDb. */
const defaultDb: CandidateDb = {
  queryAll: (sql, params = []) => queryHelpers.queryAll(sql, params),
  queryOne: (sql, params = []) => queryHelpers.queryOne(sql, params),
  queryRun: (sql, params = []) => queryHelpers.queryRun(sql, params),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CandidateStatus = 'pending' | 'accepted' | 'dismissed';

export type DiscoverySourceType =
  | 'interview_insight'
  | 'assessment'
  | 'audit'
  | 'finance_investment_case'
  | 'finance_statement_pack'
  | 'finance_valuation_recommendation';

export interface InitiativeCandidate {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  rationale: string;
  fitScore: number;
  status: CandidateStatus;
  createdAt?: string;
  createdBy?: string | null;
  /** Durable acceptance receipt. Prevents a retry from minting another DRAFT. */
  initiativeId?: string | null;
  duplicateOfInitiativeId?: string | null;
  acceptedAt?: string | null;
  /**
   * INI-BVP-001 — the DISJOINT claim column written by the event-sourced
   * runtime-v1 path (registerInitiative.ts via
   * postgresMaterialCommandUnitOfWork.markSourceProposalRegistered). Unlike
   * `initiativeId`, this points at an `ie_aggregate_state` row, never a real
   * `initiatives` table row. Read here so `acceptCandidate` can recognize a
   * candidate already claimed by that subsystem instead of minting a SECOND
   * materialization.
   */
  registeredInitiativeId?: string | null;
}

/** Raw discovery artifact pulled from a source table before scoring. */
export interface DiscoveryArtifact {
  sourceType: DiscoverySourceType;
  sourceId: string;
  title: string;
  summary?: string;
}

/** Payload returned by acceptCandidate — everything F1 needs to launch the generator. */
export interface AcceptCandidatePayload {
  candidateId: string;
  organizationId: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  rationale: string;
  brief: string;
  /**
   * F2→F1: id of the DRAFT initiative created from this candidate via the canonical
   * funnel. Null only when creation failed (accept still succeeds; recoverable).
   * The FE navigates to this id instead of creating the DRAFT itself.
   */
  initiativeId: string | null;
  /** True when generateFullInitiative ran and produced ≥1 filled card (fail-soft). */
  filled: boolean;
  /**
   * Zwornik cross-record de-dup: set when `initiativeId` points at a PRE-EXISTING
   * initiative (title-similarity match, §"Cross-record de-dup" above) rather than
   * a freshly-created DRAFT. The FE should navigate there and surface "this looks
   * like an existing initiative" instead of implying a new one was created.
   */
  duplicateOfInitiativeId?: string | null;
  /**
   * M05-FIX-01 — true when a durable candidate→initiative receipt exists after this
   * call (freshly claimed, adopted from a concurrent winner, or already present).
   *
   * False means the initiative was resolved but the receipt could NOT be persisted:
   * the accept is not yet idempotent, the candidate deliberately stays pending, and
   * a retry reconciles onto the same initiative through cross-record de-dup. Callers
   * must not present that as a completed handoff.
   */
  receiptPersisted: boolean;
  /**
   * INI-BVP-001 — set when this candidate's durable materialization lives in
   * the event-sourced runtime-v1 store (an `ie_aggregate_state` row claimed
   * via registerInitiative.ts) rather than the classic funnel's `initiatives`
   * table. When set, `initiativeId` is null on purpose: no relational DRAFT
   * was created (or ever should be) for this acceptance — the FE should treat
   * this candidate as accepted-elsewhere instead of expecting a DRAFT to
   * navigate to.
   */
  registeredInitiativeId?: string | null;
}

/**
 * Injectable funnel + generator deps for acceptCandidate. Real defaults wire the
 * canonical create funnel + the F1 generator brain; tests pass mocks so they never
 * touch an LLM / real DB. Kept here (not on the shared files) so this service owns
 * the F2→F1 wiring without editing the brain/funnel/generationService.
 */
export interface AcceptDeps {
  /** Canonical create funnel — persists a DRAFT initiative + stamps lineage. */
  createInitiative: typeof funnelCreateInitiative;
  /** F1 fast-track: brief → fully-filled initiative. */
  generateFull: typeof generateFullInitiative;
  /** Factory for the generator's production deps (injected so tests can stub). */
  generatorDeps: typeof generatorDefaultDeps;
}

/** Production wiring: canonical funnel + F1 brain. */
function defaultAcceptDeps(): AcceptDeps {
  return {
    createInitiative: funnelCreateInitiative,
    generateFull: generateFullInitiative,
    generatorDeps: generatorDefaultDeps,
  };
}

export interface AcceptCandidateOptions {
  /** Org scope (org-scoped lookup when provided). */
  orgId?: string;
  /** Creating user (forwarded to the funnel actor + created_by). */
  userId?: string;
  /**
   * Trigger F1 generateFullInitiative after creating the DRAFT (default true).
   * Fail-soft: when fill fails the accept + DRAFT still succeed (filled=false).
   */
  fill?: boolean;
  /** Language forwarded to the generator (default 'pl'). */
  language?: 'en' | 'pl';
  /** Injectable funnel + generator deps (tests pass mocks). */
  deps?: AcceptDeps;
}

// ---------------------------------------------------------------------------
// Heuristic candidate builder (deterministic stub — LLM seam marked)
// ---------------------------------------------------------------------------

/**
 * Builds a candidate {title, rationale, fitScore} from a single discovery artifact.
 *
 * Deterministic + testable on purpose. This is the seam where a real LLM call would
 * generate a sharper title/rationale and a portfolio-aware fit score:
 *
 *   // LLM-SEAM (F1/F4): replace heuristic below with
 *   //   await llm.proposeCandidate(artifact, portfolioSummary)
 *   // returning { title, rationale, fitScore } grounded in the artifact + portfolio.
 *
 * Until then we derive a stable proposal from the artifact text so the inbox is
 * populated and the accept→generator path is exercisable end-to-end.
 */
export function buildCandidateFromArtifact(artifact: DiscoveryArtifact): {
  title: string;
  rationale: string;
  fitScore: number;
} {
  const rawTitle = (artifact.title || '').trim();
  const baseTitle = rawTitle.length > 0 ? rawTitle : 'Inicjatywa z rozpoznania';
  // Tytuł kandydata = czytelny prefiks akcji + temat artefaktu (skrócony).
  const title = `Inicjatywa: ${baseTitle}`.slice(0, 200);

  const summary = (artifact.summary || '').trim();
  const sourceLabel =
    artifact.sourceType === 'interview_insight'
      ? 'insightu z wywiadu'
      : artifact.sourceType === 'assessment'
        ? 'wyniku assessmentu'
        : 'audytu';
  const rationale =
    summary.length > 0
      ? `AI sugeruje inicjatywę na podstawie ${sourceLabel}: ${summary}`.slice(0, 600)
      : `AI sugeruje inicjatywę na podstawie ${sourceLabel} „${baseTitle}".`;

  // Deterministyczny fit_score 0..1: dłuższy/bogatszy artefakt = wyższe dopasowanie.
  // (LLM-SEAM: docelowo similarity vs portfel + pokrycie luk MECE — F4.)
  const richness = Math.min(1, (baseTitle.length + summary.length) / 200);
  const fitScore = Math.round((0.4 + richness * 0.5) * 100) / 100; // 0.40..0.90

  return { title, rationale, fitScore };
}

// ---------------------------------------------------------------------------
// LLM-backed proposer (real F1/F4 seam) — fail-soft to the deterministic builder
// ---------------------------------------------------------------------------

/** Lazy LLM accessor (premium tier resolved inside llmService — no key here). */
async function getCandidateLlm(): Promise<{ call: (req: any) => Promise<any> } | null> {
  try {
    const mod: any = await import('../ai/llmService.js');
    return mod.llmService || mod.default || null;
  } catch {
    return null;
  }
}

function parseProposeJson(content: string): any | null {
  const text = String(content || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const s = candidate.indexOf('{');
    const e = candidate.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(candidate.slice(s, e + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function pickStr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

export interface ProposeCandidateOptions {
  language?: 'pl' | 'en';
  /** F0/F4 grounding: istniejące inicjatywy/portfel, by AI nie duplikował. */
  portfolioSummary?: string;
  /** Wstrzyknięty LLM dla testów; domyślnie leniwy `llmService`. */
  llm?: { call: (req: any) => Promise<any> } | null;
}

/**
 * Real LLM-backed candidate proposer (zastępuje deterministyczny stub w skanie).
 * Zwraca ostrzejszy {title, rationale, fitScore} ugruntowany w artefakcie (+portfel).
 * FAIL-SOFT na każdym kroku: brak LLM / błąd / niewalidny JSON → deterministyczny
 * `buildCandidateFromArtifact`. Pola brakujące/niepoprawne → fallback per-pole;
 * fitScore klamrowany do 0..1.
 */
export async function buildCandidateFromArtifactAI(
  artifact: DiscoveryArtifact,
  options: ProposeCandidateOptions = {}
): Promise<{ title: string; rationale: string; fitScore: number }> {
  const fallback = buildCandidateFromArtifact(artifact);
  try {
    const llm = options.llm !== undefined ? options.llm : await getCandidateLlm();
    if (!llm) return fallback;

    const isPolish = (options.language ?? 'pl') !== 'en';
    const sourceLabel =
      artifact.sourceType === 'interview_insight'
        ? isPolish
          ? 'insight z wywiadu'
          : 'interview insight'
        : artifact.sourceType === 'assessment'
          ? isPolish
            ? 'wynik assessmentu'
            : 'assessment result'
          : isPolish
            ? 'audyt'
            : 'audit';

    const systemPrompt = isPolish
      ? `Jesteś konsultantem PMO. Z pojedynczego artefaktu rozpoznania proponujesz JEDNĄ inicjatywę: ostry, akcyjny tytuł, zwięzłe uzasadnienie i fit_score 0..1 (jak bardzo warto ją podjąć w kontekście portfela). Nie wymyślaj faktów spoza artefaktu. Zwróć WYŁĄCZNIE JSON: {"title": string, "rationale": string, "fitScore": number}.`
      : `You are a PMO consultant. From a single discovery artifact, propose ONE initiative: a sharp action title, a concise rationale, and a fit_score 0..1 (how worth pursuing it is in portfolio context). Do not invent facts beyond the artifact. Return ONLY JSON: {"title": string, "rationale": string, "fitScore": number}.`;

    const lines = [
      `${isPolish ? 'Źródło' : 'Source'}: ${sourceLabel}`,
      `${isPolish ? 'Tytuł artefaktu' : 'Artifact title'}: ${artifact.title || ''}`,
      `${isPolish ? 'Treść' : 'Summary'}: ${(artifact.summary || '').slice(0, 1500)}`,
    ];
    if (options.portfolioSummary) {
      lines.push(
        '',
        isPolish
          ? `Istniejące inicjatywy (NIE duplikuj; celuj w luki): ${options.portfolioSummary.slice(0, 1000)}`
          : `Existing initiatives (do NOT duplicate; target gaps): ${options.portfolioSummary.slice(0, 1000)}`
      );
    }
    lines.push('', isPolish ? 'Zwróć WYŁĄCZNIE JSON.' : 'Return JSON ONLY.');

    const res = await llm.call({
      type: 'text',
      modelConfig: { id: 'premium' },
      systemPrompt,
      messages: [{ role: 'user', content: lines.join('\n') }],
      maxTokens: 512,
      temperature: 0.4,
      cache: false,
    });

    const parsed = parseProposeJson(String(res?.content || ''));
    const title = pickStr(parsed?.title, fallback.title).slice(0, 200);
    const rationale = pickStr(parsed?.rationale, fallback.rationale).slice(0, 600);
    let fit = Number(parsed?.fitScore);
    if (!Number.isFinite(fit)) fit = fallback.fitScore;
    fit = Math.max(0, Math.min(1, fit));
    return { title, rationale, fitScore: Math.round(fit * 100) / 100 };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cross-record de-dup (Zwornik anchoring, panel bloker #5)
// ---------------------------------------------------------------------------
//
// Two different discovery artifacts (e.g. an interview_insight AND an
// assessment) can describe the SAME underlying initiative topic. The existing
// scan-time dedup only keys on (source_type, source_id) — an exact-artifact
// re-scan guard — so it does NOT catch this cross-record case. This is the
// check that does: before minting a new DRAFT from an accepted candidate, we
// look for an ACTIVE initiative in the org whose title is a likely semantic
// duplicate and, if found, attach the candidate to it instead of creating a
// second DRAFT for the same initiative.

const TITLE_STOPWORDS = new Set([
  'inicjatywa',
  'initiative',
  'i',
  'w',
  'z',
  'na',
  'do',
  'dla',
  'oraz',
  'the',
  'a',
  'an',
  'of',
  'for',
  'to',
  'and',
  'or',
  'on',
  'with',
]);

/** Significant, normalized words of a title (builder prefix + stopwords stripped). */
export function normalizeInitiativeTitleWords(title: string): Set<string> {
  const stripped = String(title || '').replace(/^inicjatywa\s*:\s*/i, '');
  const words = stripped
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w));
  return new Set(words);
}

/** Jaccard similarity of two titles' significant-word sets (0..1). Pure, testable. */
export function titleSimilarity(a: string, b: string): number {
  const wa = normalizeInitiativeTitleWords(a);
  const wb = normalizeInitiativeTitleWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Jaccard threshold above which two titles are treated as the same initiative. */
export const DUPLICATE_TITLE_SIMILARITY_THRESHOLD = 0.6;

/**
 * Finds an existing, non-terminal-status initiative in the org whose title is
 * a likely duplicate of `title`. Fail-soft — a query error degrades to "no
 * duplicate found" (dedup is advisory, it must never block candidate accept).
 */
export async function findDuplicateInitiative(
  db: CandidateDb,
  orgId: string,
  title: string
): Promise<{ id: string; title: string } | null> {
  if (!orgId || !String(title || '').trim()) return null;
  try {
    const rows = await db.queryAll<Record<string, unknown>>(
      `SELECT id, COALESCE(title, name, '') AS title FROM initiatives
        WHERE organization_id = ?
          AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED', 'REJECTED', 'ARCHIVED')`,
      [orgId]
    );
    let best: { id: string; title: string; score: number } | null = null;
    for (const r of rows || []) {
      const rowTitle = String(r.title || '');
      if (!rowTitle.trim()) continue;
      const score = titleSimilarity(title, rowTitle);
      if (score >= DUPLICATE_TITLE_SIMILARITY_THRESHOLD && (!best || score > best.score)) {
        best = { id: String(r.id), title: rowTitle, score };
      }
    }
    return best ? { id: best.id, title: best.title } : null;
  } catch {
    return null;
  }
}

function mapRow(row: Record<string, unknown>): InitiativeCandidate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ''),
    sourceType: String(row.source_type ?? ''),
    sourceId: row.source_id != null ? String(row.source_id) : null,
    title: String(row.title ?? ''),
    rationale: String(row.rationale ?? ''),
    fitScore: row.fit_score != null ? Number(row.fit_score) : 0,
    status: String(row.status ?? 'pending') as CandidateStatus,
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    createdBy: row.created_by != null ? String(row.created_by) : null,
    initiativeId: row.initiative_id != null ? String(row.initiative_id) : null,
    duplicateOfInitiativeId:
      row.duplicate_of_initiative_id != null ? String(row.duplicate_of_initiative_id) : null,
    acceptedAt: row.accepted_at != null ? String(row.accepted_at) : null,
    registeredInitiativeId:
      row.registered_initiative_id != null ? String(row.registered_initiative_id) : null,
  };
}

/**
 * Pulls recent discovery artifacts (insights / assessments / audits) that have NO
 * initiative attached yet. Each source is independently fail-soft: a missing table or
 * a query error contributes [] instead of aborting the whole scan.
 */
async function loadDiscoveryArtifacts(
  db: CandidateDb,
  orgId: string
): Promise<DiscoveryArtifact[]> {
  const artifacts: DiscoveryArtifact[] = [];

  // interview_insights — bez przypisanej inicjatywy.
  try {
    const rows = await db.queryAll<Record<string, unknown>>(
      `SELECT i.id AS id,
              COALESCE(i.title, '') AS title,
              COALESCE(i.content, '') AS summary
         FROM interview_insights i
        WHERE i.organization_id = ?
          AND COALESCE(i.status, '') <> 'generating'
          AND NOT EXISTS (
                SELECT 1 FROM initiatives n
                 WHERE n.organization_id = i.organization_id
                   AND n.source_type = 'interview_insight'
                   AND n.source_id = i.id)
        ORDER BY i.created_at DESC
        LIMIT 50`,
      [orgId]
    );
    for (const r of rows || []) {
      artifacts.push({
        sourceType: 'interview_insight',
        sourceId: String(r.id),
        title: String(r.title || ''),
        summary: String(r.summary || ''),
      });
    }
  } catch {
    // degrade — insights source unavailable
  }

  // assessments — bez przypisanej inicjatywy.
  try {
    const rows = await db.queryAll<Record<string, unknown>>(
      `SELECT a.id AS id,
              COALESCE(a.title, a.name, '') AS title,
              COALESCE(a.description, a.summary, '') AS summary
         FROM assessments a
        WHERE a.organization_id = ?
          AND NOT EXISTS (
                SELECT 1 FROM initiatives n
                 WHERE n.organization_id = a.organization_id
                   AND n.source_type = 'assessment'
                   AND n.source_id = a.id)
        ORDER BY a.created_at DESC
        LIMIT 50`,
      [orgId]
    );
    for (const r of rows || []) {
      artifacts.push({
        sourceType: 'assessment',
        sourceId: String(r.id),
        title: String(r.title || ''),
        summary: String(r.summary || ''),
      });
    }
  } catch {
    // degrade — assessments source unavailable
  }

  // audits — bez przypisanej inicjatywy.
  try {
    const rows = await db.queryAll<Record<string, unknown>>(
      `SELECT a.id AS id,
              COALESCE(a.title, a.name, '') AS title,
              COALESCE(a.summary, a.description, '') AS summary
         FROM audits a
        WHERE a.organization_id = ?
          AND NOT EXISTS (
                SELECT 1 FROM initiatives n
                 WHERE n.organization_id = a.organization_id
                   AND n.source_type = 'audit'
                   AND n.source_id = a.id)
        ORDER BY a.created_at DESC
        LIMIT 50`,
      [orgId]
    );
    for (const r of rows || []) {
      artifacts.push({
        sourceType: 'audit',
        sourceId: String(r.id),
        title: String(r.title || ''),
        summary: String(r.summary || ''),
      });
    }
  } catch {
    // degrade — audits source unavailable
  }

  return artifacts;
}

// ---------------------------------------------------------------------------
// scanForCandidates
// ---------------------------------------------------------------------------

/**
 * Scans recent discovery artifacts without an initiative and produces candidate rows.
 * Idempotent per (org, source_type, source_id): an artifact that already has a
 * pending/accepted candidate is skipped (no duplicate inbox entries). Dismissed ones
 * are NOT re-proposed. Returns the candidates created in this run.
 *
 * Fail-soft: any failure returns whatever was created so far (never throws).
 */
export async function scanForCandidates(
  db: CandidateDb = defaultDb,
  orgId?: string,
  opts: {
    createdBy?: string;
    /**
     * Optional async proposer (R5 LLM seam). When provided, used per artifact to
     * build {title, rationale, fitScore}; a throw falls back to the deterministic
     * builder (fail-soft). Default (undefined) = deterministic builder.
     */
    propose?: (
      artifact: DiscoveryArtifact
    ) => Promise<{ title: string; rationale: string; fitScore: number }>;
  } = {}
): Promise<InitiativeCandidate[]> {
  if (!orgId) return [];

  try {
    const artifacts = await loadDiscoveryArtifacts(db, orgId);
    if (artifacts.length === 0) return [];

    // Już-istniejące kandydaci (dowolny status) → klucz dedup.
    const existingKeys = new Set<string>();
    try {
      const existing = await db.queryAll<Record<string, unknown>>(
        `SELECT source_type, source_id FROM initiative_candidates WHERE organization_id = ?`,
        [orgId]
      );
      for (const e of existing || []) {
        existingKeys.add(`${String(e.source_type)}::${String(e.source_id ?? '')}`);
      }
    } catch {
      // degrade — brak dedup, możliwy duplikat, ale skan nie pada
    }

    const created: InitiativeCandidate[] = [];
    for (const artifact of artifacts) {
      const key = `${artifact.sourceType}::${artifact.sourceId}`;
      if (existingKeys.has(key)) continue;

      let built;
      try {
        built = opts.propose ? await opts.propose(artifact) : buildCandidateFromArtifact(artifact);
      } catch {
        built = buildCandidateFromArtifact(artifact); // fail-soft → deterministic
      }
      try {
        const row = await db.queryOne<Record<string, unknown>>(
          `INSERT INTO initiative_candidates
             (organization_id, source_type, source_id, title, rationale, fit_score, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
           RETURNING *`,
          [
            orgId,
            artifact.sourceType,
            artifact.sourceId,
            built.title,
            built.rationale,
            built.fitScore,
            opts.createdBy ?? null,
          ]
        );
        if (row) {
          created.push(mapRow(row));
          existingKeys.add(key);
        }
      } catch {
        // degrade — pojedynczy insert padł, kontynuuj resztę
      }
    }
    return created;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// listCandidates
// ---------------------------------------------------------------------------

/**
 * Lists candidates for an org, optionally filtered by status. Newest first.
 * Fail-soft → [] on any error.
 */
export async function listCandidates(
  db: CandidateDb = defaultDb,
  orgId?: string,
  status?: CandidateStatus
): Promise<InitiativeCandidate[]> {
  if (!orgId) return [];
  try {
    const params: unknown[] = [orgId];
    let sql = `SELECT * FROM initiative_candidates WHERE organization_id = ?`;
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC, fit_score DESC`;
    const rows = await db.queryAll<Record<string, unknown>>(sql, params);
    return (rows || []).map(mapRow);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// acceptCandidate
// ---------------------------------------------------------------------------

/**
 * Accept a candidate → (a) resolve or CREATE a DRAFT initiative from it,
 * (b) persist a durable candidate→initiative receipt and mark it accepted,
 * through the canonical funnel (lineage source_type/source_id from the candidate),
 * and (c) OPTIONALLY trigger the F1 generator (generateFullInitiative) to fill the
 * DRAFT (default ON, fail-soft). Returns the launch payload PLUS the new
 * `initiativeId` so the FE navigates to it instead of creating the DRAFT itself.
 *
 * The 3rd argument is back-compatible: a bare string is treated as the legacy
 * `orgId`; an object unlocks userId / fill / language / injectable deps.
 *
 * Fail-soft posture (the accept itself never throws → null only when unresolvable):
 *   - receipt/status write failing → still return the resolved initiative (retry can recover).
 *   - DRAFT creation failing → payload returned with initiativeId=null, filled=false and
 *     the candidate remains pending so an operator can retry.
 *   - fill failing → DRAFT still created; filled=false.
 */
export async function acceptCandidate(
  db: CandidateDb = defaultDb,
  id?: string,
  optsOrOrgId?: string | AcceptCandidateOptions
): Promise<AcceptCandidatePayload | null> {
  if (!id) return null;

  const opts: AcceptCandidateOptions =
    typeof optsOrOrgId === 'string' ? { orgId: optsOrOrgId } : (optsOrOrgId ?? {});
  const { orgId, userId } = opts;
  const fill = opts.fill !== false; // default true
  const language: 'en' | 'pl' = opts.language === 'en' ? 'en' : 'pl';
  const deps = opts.deps ?? defaultAcceptDeps();

  try {
    const params: unknown[] = [id];
    let sql = `SELECT * FROM initiative_candidates WHERE id = ?`;
    if (orgId) {
      sql += ` AND organization_id = ?`;
      params.push(orgId);
    }
    sql += ` LIMIT 1`;
    const row = await db.queryOne<Record<string, unknown>>(sql, params);
    if (!row) return null;

    const candidate = mapRow(row);

    const brief = [candidate.title, candidate.rationale].filter(Boolean).join('\n\n');
    // Lineage source_type must be non-'manual' so the funnel enforces sourceId. A
    // candidate without a sourceId would trip the lineage guard → degrade source to
    // 'manual' in that edge case so the DRAFT still persists.
    const lineageSourceType =
      candidate.sourceType && candidate.sourceId ? candidate.sourceType : 'manual';
    const lineageSourceId = candidate.sourceType && candidate.sourceId ? candidate.sourceId : null;

    // INI-BVP-001 — the event-sourced runtime-v1 path (registerInitiative.ts via
    // postgresMaterialCommandUnitOfWork.markSourceProposalRegistered) can claim
    // this SAME candidate row through `registered_initiative_id`, a column this
    // funnel never wrote or checked. If that already happened, this candidate is
    // ALREADY materialized — in the aggregate store, not `initiatives` — so this
    // call must be a no-op read of that receipt, not a second DRAFT creation.
    // Mirrors the `reusedReceipt` early-return below for `initiativeId`.
    if (candidate.registeredInitiativeId && !candidate.initiativeId) {
      return {
        candidateId: candidate.id,
        organizationId: candidate.organizationId,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        title: candidate.title,
        rationale: candidate.rationale,
        brief,
        initiativeId: null,
        filled: false,
        duplicateOfInitiativeId: null,
        receiptPersisted: true,
        registeredInitiativeId: candidate.registeredInitiativeId,
      };
    }

    // (b0) Zwornik cross-record de-dup — BEFORE minting a new DRAFT, check
    // whether an ACTIVE initiative already covers this topic (a different
    // discovery artifact proposing the same underlying initiative). Advisory
    // + fail-soft: any failure here just falls through to normal creation.
    const orgForDedup = orgId || candidate.organizationId;
    // A prior successful accept is a durable receipt: return it without creating
    // or filling anything again. This is the normal retry/double-click path.
    let initiativeId: string | null = candidate.initiativeId ?? null;
    let duplicateOfInitiativeId: string | null = candidate.duplicateOfInitiativeId ?? null;
    const reusedReceipt = Boolean(initiativeId);
    if (!initiativeId && orgForDedup) {
      const dup = await findDuplicateInitiative(db, orgForDedup, candidate.title);
      if (dup) {
        initiativeId = dup.id;
        duplicateOfInitiativeId = dup.id;
        logger.info(
          `[initiativeCandidateService] candidate ${candidate.id} ("${candidate.title}") matched existing initiative ${dup.id} ("${dup.title}") — skipping DRAFT creation (cross-record de-dup)`
        );
      }
    }

    // (b) CREATE the DRAFT initiative through the canonical funnel — same
    // project-anchoring gate as the wizard (createInitiativeService.ts).
    // Skipped when (b0) found a duplicate.
    if (!initiativeId) {
      try {
        const orgForCreate = orgId || candidate.organizationId;
        // Zwornik project inheritance: assessment/audit sources carry a real
        // project_id (see sourceProjectResolver.ts) — inherit it so the DRAFT
        // lands in the SAME project as its source instead of always falling
        // to the generic system "Portfel" bucket. interview_insight (and any
        // other source without a project concept) resolves to null and the
        // funnel's own auto-anchor takes over — fail-soft either way.
        let inheritedProjectId: string | null = null;
        try {
          inheritedProjectId = await resolveProjectIdFromSource(
            orgForCreate,
            lineageSourceType,
            lineageSourceId,
            { queryOne: (sql, params) => db.queryOne(sql, params) }
          );
        } catch {
          inheritedProjectId = null;
        }
        const created = await deps.createInitiative(
          orgForCreate,
          {
            title: candidate.title,
            problemStatement: candidate.rationale || null,
            projectId: inheritedProjectId,
            sourceType: lineageSourceType,
            sourceId: lineageSourceId,
            // status DRAFT intentionally OMITTED — the funnel normalizes it.
          },
          { validate: false, actor: { id: userId ?? null } }
        );
        initiativeId = created?.id ?? null;
      } catch (createErr) {
        logger.warn(
          `[initiativeCandidateService] DRAFT creation failed for candidate ${candidate.id} (recoverable): ${
            (createErr as Error)?.message || createErr
          }`
        );
      }
    }

    // Persist the receipt only after an initiative was actually resolved. Keeping
    // failed creations pending makes recovery visible and one-click retryable.
    //
    // M05-FIX-01 — the receipt is the IDEMPOTENCY ANCHOR, so it is written as a
    // CONDITIONAL CLAIM (`AND initiative_id IS NULL`) and evaluated FAIL-CLOSED:
    //
    //   - exactly one writer can ever claim a candidate, so two concurrent accepts
    //     produce exactly one canonical receipt instead of the last writer silently
    //     overwriting the first;
    //   - when the claim is not ours we RE-READ and adopt whatever the durable row
    //     says. The database row is the arbiter — never our in-memory guess;
    //   - a failed write no longer masquerades as a clean success. It previously
    //     logged at warn() and returned as if accepted, which is how a demo database
    //     missing the receipt columns turned every retry into a fresh duplicate DRAFT
    //     while the API kept answering 200.
    let receiptPersisted = reusedReceipt;
    // INI-BVP-001 — surfaced to the caller only when a concurrent runtime-v1
    // registration wins the race below (adopted instead of our local DRAFT).
    let registeredInitiativeId: string | null = null;
    if (initiativeId && !reusedReceipt) {
      const receiptParams: unknown[] = [initiativeId, duplicateOfInitiativeId, candidate.id];
      let receiptSql = `UPDATE initiative_candidates
          SET status = 'accepted', initiative_id = ?, duplicate_of_initiative_id = ?, accepted_at = NOW()
          WHERE id = ? AND initiative_id IS NULL AND registered_initiative_id IS NULL`;
      if (orgId) {
        receiptSql += ` AND organization_id = ?`;
        receiptParams.push(orgId);
      }

      let claimed = 0;
      let receiptErr: unknown = null;
      try {
        const res = await db.queryRun(receiptSql, receiptParams);
        claimed = Number(res?.changes ?? 0);
      } catch (err) {
        receiptErr = err;
      }

      if (claimed >= 1) {
        receiptPersisted = true;
      } else {
        // Claim not ours: either a concurrent accept won it (this funnel OR the
        // runtime-v1 register path — INI-BVP-001), or the write failed. All
        // cases are settled by re-reading the durable row; the database row is
        // the arbiter, never our in-memory guess.
        const winnerParams: unknown[] = [candidate.id];
        let winnerSql = `SELECT initiative_id, duplicate_of_initiative_id, registered_initiative_id
          FROM initiative_candidates WHERE id = ?`;
        if (orgId) {
          winnerSql += ` AND organization_id = ?`;
          winnerParams.push(orgId);
        }
        const winner = await db
          .queryOne<Record<string, unknown>>(winnerSql, winnerParams)
          .catch(() => null);
        const winnerId = winner?.initiative_id != null ? String(winner.initiative_id) : null;
        const winnerRegisteredId =
          winner?.registered_initiative_id != null ? String(winner.registered_initiative_id) : null;

        if (winnerId) {
          if (winnerId !== initiativeId) {
            logger.info(
              `[initiativeCandidateService] candidate ${candidate.id}: concurrent accept already resolved to initiative ${winnerId} — adopting it and discarding local resolution ${initiativeId}`
            );
          }
          initiativeId = winnerId;
          duplicateOfInitiativeId =
            winner?.duplicate_of_initiative_id != null
              ? String(winner.duplicate_of_initiative_id)
              : duplicateOfInitiativeId;
          receiptPersisted = true;
        } else if (winnerRegisteredId) {
          // INI-BVP-001 — a concurrent runtime-v1 registration won the row in the
          // gap between our SELECT and this UPDATE. That subsystem's claim is
          // canonical. Discarding the in-memory `initiativeId` reference is NOT
          // enough by itself: if step (b) above minted a FRESH DRAFT for us in
          // THIS call (as opposed to (b0) matching a PRE-EXISTING initiative,
          // which always pairs with a non-null `duplicateOfInitiativeId`), that
          // row was really INSERTed into `initiatives` and would otherwise sit
          // there forever as an orphan no candidate ever points to. Delete it —
          // we know for certain we created it in this call and nothing else can
          // reference it yet (the (c) fill step below hasn't run).
          const weOwnAnOrphanDraft = Boolean(initiativeId) && !duplicateOfInitiativeId;
          if (weOwnAnOrphanDraft) {
            try {
              const orphanOrgId = orgId || candidate.organizationId;
              await db.queryRun(`DELETE FROM initiatives WHERE id = ? AND organization_id = ?`, [
                initiativeId,
                orphanOrgId,
              ]);
              logger.info(
                `[initiativeCandidateService] candidate ${candidate.id}: deleted orphan DRAFT ${initiativeId} after losing the claim race to runtime-v1 registration ${winnerRegisteredId}`
              );
            } catch (cleanupErr) {
              // Best-effort: log loudly rather than silently accepting an orphan.
              // The candidate row itself still converges to exactly one claim
              // column below — only the (rare) unlinked `initiatives` row would
              // remain if this delete itself fails.
              logger.error(
                `[initiativeCandidateService] candidate ${candidate.id}: FAILED to delete orphan DRAFT ${initiativeId} after losing the claim race to runtime-v1 registration ${winnerRegisteredId} — orphan row remains: ${
                  (cleanupErr as Error)?.message || cleanupErr
                }`
              );
            }
          } else {
            logger.info(
              `[initiativeCandidateService] candidate ${candidate.id}: concurrent runtime-v1 registration already resolved to initiative ${winnerRegisteredId} — adopting it (no local DRAFT had been created)`
            );
          }
          registeredInitiativeId = winnerRegisteredId;
          initiativeId = null;
          duplicateOfInitiativeId = null;
          receiptPersisted = true;
        } else {
          // FAIL-CLOSED. The initiative exists but is unlinked; the candidate stays
          // pending on purpose. The cross-record de-dup step (b0) reconciles the next
          // retry onto this same initiative, so recovery converges instead of forking.
          receiptPersisted = false;
          logger.error(
            `[initiativeCandidateService] acceptance receipt NOT persisted for candidate ${candidate.id} (initiative ${initiativeId} left unlinked; retry will reconcile via de-dup): ${
              receiptErr ? (receiptErr as Error)?.message || receiptErr : 'no row matched the claim'
            }`
          );
        }
      }
    }

    // (c) OPTIONALLY trigger F1 fill — fail-soft so accept still succeeds.
    // Never re-fill a pre-existing initiative matched by (b0): it may already
    // have real, human-reviewed content that the generator must not clobber.
    let filled = false;
    if (fill && initiativeId && !duplicateOfInitiativeId && !reusedReceipt) {
      try {
        const orgForFill = orgId || candidate.organizationId;
        const result = await deps.generateFull(deps.generatorDeps(), {
          initiativeId,
          brief,
          sourceType: lineageSourceType,
          organizationId: orgForFill,
          language,
        });
        filled = (result?.qualitySummary?.filled ?? 0) > 0;
        // PERSIST + HYDRATE onto authoritative typed columns (parity with the Teresa
        // tool + the /generate-full route): the brain returns cards only in-memory;
        // without this the assessment/audit → initiative path leaves the object as an
        // empty skeleton. Best-effort & fail-soft (never breaks accept).
        if (filled && orgForFill) {
          try {
            const { persistCards } = await import('../ai/tools/generateInitiative.js');
            await persistCards(initiativeId, orgForFill, result?.cards ?? {});
          } catch (persistErr) {
            logger.warn(
              `[initiativeCandidateService] persist/hydrate failed for ${initiativeId} (ignored): ${
                (persistErr as Error)?.message || persistErr
              }`
            );
          }
        }
      } catch (fillErr) {
        logger.warn(
          `[initiativeCandidateService] generateFullInitiative failed for initiative ${initiativeId} (fail-soft): ${
            (fillErr as Error)?.message || fillErr
          }`
        );
      }
    }

    return {
      candidateId: candidate.id,
      organizationId: candidate.organizationId,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      title: candidate.title,
      rationale: candidate.rationale,
      brief,
      initiativeId,
      filled,
      duplicateOfInitiativeId,
      receiptPersisted,
      registeredInitiativeId,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// dismissCandidate
// ---------------------------------------------------------------------------

/**
 * Marks a candidate dismissed. Returns true if a row was updated. Org-scoped when
 * orgId is provided. Fail-soft → false on error.
 */
export async function dismissCandidate(
  db: CandidateDb = defaultDb,
  id?: string,
  orgId?: string
): Promise<boolean> {
  if (!id) return false;
  try {
    const params: unknown[] = [id];
    let sql = `UPDATE initiative_candidates SET status = 'dismissed' WHERE id = ?`;
    if (orgId) {
      sql += ` AND organization_id = ?`;
      params.push(orgId);
    }
    const result = await db.queryRun(sql, params);
    return (result?.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// createCandidateFromSource (ASM-08)
// ---------------------------------------------------------------------------

/**
 * Single-row, fail-CLOSED candidate insert for a caller that already knows
 * exactly which (sourceType, sourceId) it wants and has already validated
 * everything that makes the write legitimate (e.g. ASM-08's "the source is
 * an accepted/current immutable Assessment Output" gate).
 *
 * Deliberately distinct from `scanForCandidates` (bulk, discovery-driven,
 * fail-soft, deterministic/AI-proposed title+rationale) — this is a direct,
 * single-record write for a caller supplying its own title/rationale, and it
 * THROWS on failure instead of degrading, because the caller (a handoff
 * receipt writer running inside its own transaction) needs to know the
 * write did not happen so it can roll back rather than persist a receipt
 * pointing at a candidate that was never created.
 *
 * Does not de-dup against `scanForCandidates`' own (org, source_type,
 * source_id) keys — callers using a source_type distinct from the F2
 * discovery values ('interview_insight' | 'assessment' | 'audit') never
 * collide with F2's dedup set, by construction.
 */
export async function createCandidateFromSource(
  db: CandidateDb,
  params: {
    organizationId: string;
    sourceType: string;
    sourceId: string;
    title: string;
    rationale: string;
    fitScore?: number;
    createdBy?: string | null;
  }
): Promise<InitiativeCandidate> {
  const { organizationId, sourceType, sourceId, title, rationale } = params;
  if (!organizationId) throw new Error('organizationId is required to create a candidate');
  if (!sourceType || !sourceId) {
    throw new Error('sourceType and sourceId are required to create a candidate');
  }
  if (!title || !String(title).trim()) {
    throw new Error('title is required to create a candidate');
  }

  const row = await db.queryOne<Record<string, unknown>>(
    `INSERT INTO initiative_candidates
       (organization_id, source_type, source_id, title, rationale, fit_score, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
     RETURNING *`,
    [
      organizationId,
      sourceType,
      sourceId,
      String(title).trim(),
      rationale ?? '',
      params.fitScore ?? 1,
      params.createdBy ?? null,
    ]
  );
  if (!row) {
    throw new Error('Candidate insert did not return a row');
  }
  return mapRow(row);
}
