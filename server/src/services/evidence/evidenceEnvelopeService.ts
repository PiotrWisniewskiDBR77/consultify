/**
 * Evidence Envelope Service — fundament Warstwy Dowodowej (H1 Harvey-gap).
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md §3 (kontrakt nr 1).
 * Persystencja: JEDNA polimorficzna tabela `artifact_evidence`
 * (server/migrations/904_artifact_evidence.sql) — adnotacja węzła łańcucha
 * dowodowego. Krawędzie źródeł (kto→skąd) żyją w istniejącej `link_graph_edges`
 * (20260303_link_graph_v3.sql, relation='evidence_source') — ta usługa NIE
 * buduje drugiego grafu, tylko best-effort dopisuje do niego przy attachSource.
 *
 * Kontrakt egzekwowania (§3.2 rdzenia) — 4 punkty, docelowo wołające ten
 * serwis: materializacja Insight (F14 cardContentFormulaValidator), snapshot
 * F5 (createSnapshot), compute Finance/EVM/ROI (shared/assumptions), propozycje
 * Teresy (claimCitationValidator). Ten commit dostarcza SERWIS+API+FE render
 * dla Insight jako pierwszego artefaktu (patrz TODO na końcu pliku).
 */
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import {
  getCurrentPgTransactionClient,
  queryAll,
  queryRun,
} from '../../utils/queryHelpers.js';

// ==========================================
// TYPES — EvidenceEnvelope (kontrakt §3.1)
// ==========================================

export type EvidenceArtifactType =
  | 'insight'
  | 'initiative'
  | 'task'
  | 'decision'
  | 'report'
  | 'deck'
  | 'document'
  | 'kpi'
  | 'finance_number'
  | 'benefit'
  | 'canvas'
  | 'project'
  | 'source'
  | 'assessment'
  // HP-16 domknięcie (note) — patrz migracja 931_artifact_evidence_note_type.sql,
  // która rozszerza CHECK artifact_evidence.artifact_type o tę samą wartość.
  | 'note'
  // HP-16 domknięcie (sheet/arkusz) — patrz migracja
  // 20260719_artifact_evidence_sheet_type.sql (rozszerza CHECK o 'sheet').
  | 'sheet'
  | 'other';

export type EvidenceSourceType =
  | 'interview'
  | 'document'
  | 'kb'
  | 'statement_pack'
  | 'kpi_series'
  | 'insight'
  | 'tool_session'
  | 'snapshot'
  | 'benchmark';

export interface EvidenceSource {
  type: EvidenceSourceType;
  /** Id ref do rekordu źródła (np. interview_insight_id, document_id). */
  ref: string;
  /** Krótki cytat/wycinek (opcjonalny — nie każde źródło ma cytowalny fragment). */
  snippet?: string;
  /** Link kliknięty przez usera (Vault/interview/URL zewnętrzny). */
  url?: string;
}

export type EvidenceAssumptionSourceType =
  | 'imported'
  | 'user'
  | 'teresa'
  | 'ai_assumed'
  | 'benchmark';

export interface EvidenceAssumption {
  key: string;
  value: unknown;
  source_type: EvidenceAssumptionSourceType;
  rationale?: string;
  confidence?: number;
}

export interface EvidenceToVerify {
  claim: string;
  why: string;
  suggested_check?: string;
}

export interface EvidenceComputedBy {
  service: string;
  version?: string;
  at: string;
}

/** Etykieta pochodna z `confidence` numerycznego (kontrakt §3.1: 'high'|'medium'|'low'). */
export type EvidenceConfidenceLabel = 'high' | 'medium' | 'low' | 'unknown';

export interface EvidenceEnvelope {
  id: string;
  organizationId: string;
  artifactType: EvidenceArtifactType;
  artifactId: string;
  sources: EvidenceSource[];
  assumptions: EvidenceAssumption[];
  /** 0..1 — surowa wartość liczbowa w DB (kolumna `confidence numeric`). */
  confidence: number | null;
  /** Derived: high (>=0.75) / medium (>=0.4) / low (<0.4) / unknown (null). */
  confidenceLabel: EvidenceConfidenceLabel;
  toVerify: EvidenceToVerify[];
  computedBy: EvidenceComputedBy | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEnvelopeInput {
  organizationId: string;
  artifactType: EvidenceArtifactType;
  artifactId: string;
  sources?: EvidenceSource[];
  assumptions?: EvidenceAssumption[];
  confidence?: number | null;
  toVerify?: EvidenceToVerify[];
  computedBy?: EvidenceComputedBy | null;
  createdBy?: string | null;
}

export interface AttachSourceInput {
  organizationId: string;
  artifactType: EvidenceArtifactType;
  artifactId: string;
  source: EvidenceSource;
  createdBy?: string | null;
}

/**
 * RES-011: thrown by upsertEnvelope/attachSource when an envelope already
 * exists for this (artifactType, artifactId) under a DIFFERENT organization.
 * `artifact_evidence`'s only uniqueness constraint is on
 * (artifact_type, artifact_id) — organization is not part of the key — so a
 * caller in org B upserting against org A's artifactId cannot simply "create
 * its own row"; without this check it would silently take the UPDATE branch
 * against org A's row instead (the cross-tenant write/poisoning bug this
 * error exists to close). Routes should map this to 404, matching this
 * codebase's existing convention for cross-tenant artifact access (never
 * confirm to the caller that the artifact exists under another org).
 */
export class EvidenceEnvelopeForeignOrgError extends Error {
  constructor(artifactType: EvidenceArtifactType, artifactId: string) {
    super(
      `Evidence envelope for ${artifactType}/${artifactId} belongs to a different organization`
    );
    this.name = 'EvidenceEnvelopeForeignOrgError';
  }
}

// ==========================================
// HELPERS
// ==========================================

function deriveConfidenceLabel(confidence: number | null | undefined): EvidenceConfidenceLabel {
  if (confidence === null || confidence === undefined || Number.isNaN(confidence)) return 'unknown';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T; // pg driver already parses jsonb
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function rowToEnvelope(row: any): EvidenceEnvelope {
  const confidence =
    row.confidence === null || row.confidence === undefined ? null : Number(row.confidence);
  let computedBy: EvidenceComputedBy | null = null;
  if (row.computed_by) {
    try {
      computedBy =
        typeof row.computed_by === 'string' ? JSON.parse(row.computed_by) : row.computed_by;
    } catch {
      computedBy = null;
    }
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    artifactType: row.artifact_type,
    artifactId: row.artifact_id,
    sources: parseJsonColumn<EvidenceSource[]>(row.sources, []),
    assumptions: parseJsonColumn<EvidenceAssumption[]>(row.assumptions, []),
    confidence,
    confidenceLabel: deriveConfidenceLabel(confidence),
    toVerify: parseJsonColumn<EvidenceToVerify[]>(row.to_verify, []),
    computedBy,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// SERVICE
// ==========================================

async function envelopeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (getCurrentPgTransactionClient()) return queryAll<T>(sql, params);
  const db = await getDatabase();
  const result = await db.query<T>(sql, params);
  return result.rows ?? [];
}

async function envelopeRun(sql: string, params: unknown[] = []): Promise<void> {
  if (getCurrentPgTransactionClient()) {
    await queryRun(sql, params);
    return;
  }
  const db = await getDatabase();
  await db.run(sql, params);
}

/**
 * Pobiera envelope dla artefaktu, org-scoped. Zwraca `null` gdy brak (BRAK
 * envelope ≠ błąd — artefakt może jeszcze nie przejść przez bramę
 * F14/computed_by) — ale też `null` gdy envelope istnieje pod INNĄ
 * organizacją (RES-011: to była realna cross-tenant luka odczytu/zapisu —
 * ta funkcja jest jedynym miejscem czytającym `artifact_evidence`, więc
 * dodanie filtra tutaj zamyka ją dla wszystkich callerów naraz).
 */
export async function getEnvelope(
  artifactType: EvidenceArtifactType,
  artifactId: string,
  organizationId: string
): Promise<EvidenceEnvelope | null> {
  const rows = await envelopeQuery<any>(
    `SELECT * FROM artifact_evidence WHERE artifact_type = ? AND artifact_id = ? AND organization_id = ? LIMIT 1`,
    [artifactType, artifactId, organizationId]
  );
  const row = rows[0];
  return row ? rowToEnvelope(row) : null;
}

/**
 * True when a row exists for this (artifactType, artifactId) under ANY
 * organization — used only to distinguish "genuinely new artifact, safe to
 * INSERT" from "exists, but owned by a different org" before upsertEnvelope
 * decides which branch to take. `artifact_evidence`'s only uniqueness
 * constraint is (artifact_type, artifact_id) with no organization_id in the
 * key, so blindly INSERTing in the latter case would hit a raw 23505
 * constraint violation instead of a clean, typed rejection.
 */
async function envelopeExistsForAnyOrg(
  artifactType: EvidenceArtifactType,
  artifactId: string
): Promise<boolean> {
  const rows = await envelopeQuery<{ id: string }>(
    `SELECT id FROM artifact_evidence WHERE artifact_type = ? AND artifact_id = ? LIMIT 1`,
    [artifactType, artifactId]
  );
  return Boolean(rows[0]);
}

/**
 * Upsert pełnego envelope (jeden per artifact_type+artifact_id — kontrakt
 * §3.1 "jeden obiekt lineage"). Pola nie podane w `input` NIE są nadpisywane
 * pustymi wartościami przy update — merge na poziomie wołającego (serwis
 * bierze to, co dostał; caller odpowiada za pełny stan, jak przy PUT).
 *
 * @throws EvidenceEnvelopeForeignOrgError gdy envelope dla tego artefaktu
 *   już istnieje, ale pod inną organizacją (RES-011 fail-closed guard).
 */
export async function upsertEnvelope(input: UpsertEnvelopeInput): Promise<EvidenceEnvelope> {
  const existing = await getEnvelope(input.artifactType, input.artifactId, input.organizationId);
  const now = new Date().toISOString();

  const sources = input.sources ?? existing?.sources ?? [];
  const assumptions = input.assumptions ?? existing?.assumptions ?? [];
  const toVerify = input.toVerify ?? existing?.toVerify ?? [];
  const confidence =
    input.confidence !== undefined ? input.confidence : (existing?.confidence ?? null);
  const computedBy =
    input.computedBy !== undefined ? input.computedBy : (existing?.computedBy ?? null);

  if (existing) {
    await envelopeRun(
      `UPDATE artifact_evidence
       SET sources = ?, assumptions = ?, confidence = ?, to_verify = ?, computed_by = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify(sources),
        JSON.stringify(assumptions),
        confidence,
        JSON.stringify(toVerify),
        computedBy ? JSON.stringify(computedBy) : null,
        now,
        existing.id,
        input.organizationId,
      ]
    );
    logger.info(
      `[EvidenceEnvelope] Updated envelope ${existing.id} (${input.artifactType}/${input.artifactId})`
    );
    const updated = await getEnvelope(input.artifactType, input.artifactId, input.organizationId);
    return updated as EvidenceEnvelope;
  }

  if (await envelopeExistsForAnyOrg(input.artifactType, input.artifactId)) {
    throw new EvidenceEnvelopeForeignOrgError(input.artifactType, input.artifactId);
  }

  const id = uuidv4();
  await envelopeRun(
    `INSERT INTO artifact_evidence (
      id, organization_id, artifact_type, artifact_id, sources, assumptions,
      confidence, to_verify, computed_by, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.artifactType,
      input.artifactId,
      JSON.stringify(sources),
      JSON.stringify(assumptions),
      confidence,
      JSON.stringify(toVerify),
      computedBy ? JSON.stringify(computedBy) : null,
      input.createdBy ?? null,
      now,
      now,
    ]
  );
  logger.info(
    `[EvidenceEnvelope] Created envelope ${id} (${input.artifactType}/${input.artifactId})`
  );
  const created = await getEnvelope(input.artifactType, input.artifactId, input.organizationId);
  return created as EvidenceEnvelope;
}

/**
 * Dopisuje JEDNO źródło do envelope (tworzy envelope, jeśli nie istnieje).
 * Best-effort dopisuje też krawędź do `link_graph_edges` (relation=
 * 'evidence_source') tak, żeby istniejący graf backlinków ("Used in") widział
 * tę relację — kontrakt rdzenia §2.1 "nie budować drugiego grafu". Awaria
 * zapisu krawędzi NIE blokuje zapisu envelope (envelope.sources = źródło
 * prawdy; graf to wtórny indeks nawigacyjny).
 */
export async function attachSource(input: AttachSourceInput): Promise<EvidenceEnvelope> {
  const existing = await getEnvelope(input.artifactType, input.artifactId, input.organizationId);
  const nextSources = [...(existing?.sources ?? []), input.source];

  // upsertEnvelope re-derives `existing` itself (org-scoped) and throws
  // EvidenceEnvelopeForeignOrgError if a foreign-org envelope already
  // exists for this artifact — attachSource does not need its own check,
  // it inherits the guard.
  const envelope = await upsertEnvelope({
    organizationId: input.organizationId,
    artifactType: input.artifactType,
    artifactId: input.artifactId,
    sources: nextSources,
    createdBy: input.createdBy ?? existing?.createdBy ?? null,
  });

  await tryLinkGraphEdge(input);

  return envelope;
}

async function tryLinkGraphEdge(input: AttachSourceInput): Promise<void> {
  try {
    const cols = await envelopeQuery<any>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'link_graph_edges'`
    );
    if (cols.length === 0) return; // table not present (fresh/sqlite dev) — skip silently
    const id = uuidv4();
    await envelopeRun(
      `INSERT INTO link_graph_edges (
        id, organization_id, created_by, source_type, source_id, target_type, target_id, relation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
      [
        id,
        input.organizationId,
        input.createdBy ?? 'system',
        input.source.type,
        input.source.ref,
        input.artifactType,
        input.artifactId,
        'evidence_source',
        new Date().toISOString(),
      ]
    );
  } catch (e) {
    logger.warn('[EvidenceEnvelope] link_graph_edges best-effort write failed (non-fatal):', e);
  }
}

/**
 * Listuje envelope'y z niepustym `to_verify` dla organizacji (opcjonalnie
 * zawężone do artifact_type) — punkt wejścia pod przyszły inbox "do
 * weryfikacji" (TODO poniżej — brak dziś ekranu, tylko zapytanie).
 */
export async function listToVerify(
  organizationId: string,
  artifactType?: EvidenceArtifactType
): Promise<EvidenceEnvelope[]> {
  const params: unknown[] = [organizationId];
  let sql = `SELECT * FROM artifact_evidence WHERE organization_id = ? AND jsonb_array_length(to_verify) > 0`;
  if (artifactType) {
    sql += ` AND artifact_type = ?`;
    params.push(artifactType);
  }
  sql += ` ORDER BY updated_at DESC`;
  const rows = await envelopeQuery<any>(sql, params);
  return rows.map(rowToEnvelope);
}

export default {
  getEnvelope,
  upsertEnvelope,
  attachSource,
  listToVerify,
};

// ==========================================
// TODO (patrz raport handoffu do nadzorcy)
// ==========================================
// 1. Egzekwowanie w 4 punktach kontraktu §3.2 (dziś: serwis istnieje, NIE jest
//    jeszcze wołany z żadnego z nich):
//    - F14 cardContentFormulaValidator → upsertEnvelope przy materializacji Insight
//    - reportBuilderService.createSnapshot → envelope w JSON snapshotu
//    - Finance/EVM/ROI compute → computed_by + assumptions z shared/assumptions
//    - claimCitationValidator (czat Teresy) → attachSource per tool-call
// 2. Pozostałe artifact_type (initiative/report/deck/kpi/finance_number/...)
//    nie mają jeszcze wołającego — tylko Insight (ten commit).
