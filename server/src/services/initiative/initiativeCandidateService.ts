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

import * as queryHelpers from '../../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Injectable DB interface
// ---------------------------------------------------------------------------

export interface CandidateDb {
  queryAll<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: unknown[]): Promise<T | null>;
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

export type DiscoverySourceType = 'interview_insight' | 'assessment' | 'audit';

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
export function buildCandidateFromArtifact(
  artifact: DiscoveryArtifact
): { title: string; rationale: string; fitScore: number } {
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
  const rationale = summary.length > 0
    ? `AI sugeruje inicjatywę na podstawie ${sourceLabel}: ${summary}`.slice(0, 600)
    : `AI sugeruje inicjatywę na podstawie ${sourceLabel} „${baseTitle}".`;

  // Deterministyczny fit_score 0..1: dłuższy/bogatszy artefakt = wyższe dopasowanie.
  // (LLM-SEAM: docelowo similarity vs portfel + pokrycie luk MECE — F4.)
  const richness = Math.min(1, (baseTitle.length + summary.length) / 200);
  const fitScore = Math.round((0.4 + richness * 0.5) * 100) / 100; // 0.40..0.90

  return { title, rationale, fitScore };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): InitiativeCandidate {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ''),
    sourceType: String(row.source_type ?? ''),
    sourceId: row.source_id != null ? String(row.source_id) : null,
    title: String(row.title ?? ''),
    rationale: String(row.rationale ?? ''),
    fitScore: row.fit_score != null ? Number(row.fit_score) : 0,
    status: (String(row.status ?? 'pending') as CandidateStatus),
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    createdBy: row.created_by != null ? String(row.created_by) : null,
  };
}

/**
 * Pulls recent discovery artifacts (insights / assessments / audits) that have NO
 * initiative attached yet. Each source is independently fail-soft: a missing table or
 * a query error contributes [] instead of aborting the whole scan.
 */
async function loadDiscoveryArtifacts(db: CandidateDb, orgId: string): Promise<DiscoveryArtifact[]> {
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
  opts: { createdBy?: string } = {}
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

      const built = buildCandidateFromArtifact(artifact);
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
    let sql =
      `SELECT * FROM initiative_candidates WHERE organization_id = ?`;
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
 * Marks a candidate accepted and returns the payload F1 needs to launch the
 * generator. Does NOT call the generator (the route / F1 owns that). Returns null
 * if the candidate does not resolve (org-scoped when orgId is provided).
 *
 * Fail-soft → null on error.
 */
export async function acceptCandidate(
  db: CandidateDb = defaultDb,
  id?: string,
  orgId?: string
): Promise<AcceptCandidatePayload | null> {
  if (!id) return null;
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

    // Mark accepted (idempotent — accepting an accepted candidate is a no-op-ish).
    try {
      await db.queryRun(
        `UPDATE initiative_candidates SET status = 'accepted' WHERE id = ?`,
        [candidate.id]
      );
    } catch {
      // degrade — even if the status write fails we still return the launch payload,
      // so the generator can proceed; a stale 'pending' is recoverable.
    }

    const brief = [candidate.title, candidate.rationale].filter(Boolean).join('\n\n');

    return {
      candidateId: candidate.id,
      organizationId: candidate.organizationId,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      title: candidate.title,
      rationale: candidate.rationale,
      brief,
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
