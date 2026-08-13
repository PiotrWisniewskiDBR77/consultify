/**
 * MethodInitiativeDraftService — persists local Initiative Proposal Drafts.
 *
 * ★ THIS CLASS HAS NO `register`/`registerInitiative` METHOD AND
 * `method_initiative_drafts` HAS NO `initiative_id` COLUMN (see the
 * migration's comment). "Teresa może grupować, deduplikować i proponować —
 * ale NIE tworzy Registered Initiative. `Register as Initiative` to decyzja
 * człowieka" (ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §5). Turning a
 * draft into a Registered Initiative is a write into the Initiatives
 * module's own tables, triggered by a human action there — out of this
 * service's reach by construction, not by convention.
 *
 * ★ NOT ONE-DRAFT-PER-FINDING: `create()` requires >= 1 `findingIds`, and
 * callers are expected to have grouped findings upstream (mirrors
 * src/method-core/outputs/initiativeDraft.ts's `groupFindingsForInitiativeDrafts`)
 * — this service does not itself enforce grouping (it is a persistence
 * layer), but it does refuse an empty findingIds array, which is the one
 * invariant a bad caller could otherwise violate silently.
 *
 * ★ SUPERSESSION, NOT REWRITE — same discipline as
 * MethodReportSnapshotService: `supersedeCurrentForSession` only ever
 * touches `status`, `superseded_by_output_id`, `superseded_at`.
 */

import * as DbPromise from '../../utils/DbPromise.js';
import { genId, nowIso, parseJson, runOrThrow } from '../db.js';

export type DraftSupersedenceStatus = 'current' | 'superseded' | 'source_updated';

export interface CreateInitiativeDraftInput {
  readonly organizationId: string;
  readonly outputId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly summary?: string | null;
  /** REQUIRED, non-empty. A draft grouping zero findings is not a draft. */
  readonly findingIds: readonly string[];
  readonly rationale: string;
  readonly expectedOutcome: string;
  readonly kpiProposal?: unknown;
  readonly dependencies?: readonly unknown[];
  readonly risks?: readonly unknown[];
  readonly evidenceLinks?: readonly string[];
  readonly confidence: 'low' | 'medium' | 'high';
}

export interface MethodInitiativeDraftRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly outputId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly findingIds: readonly string[];
  readonly rationale: string;
  readonly expectedOutcome: string;
  readonly kpiProposal: unknown;
  readonly dependencies: readonly unknown[];
  readonly risks: readonly unknown[];
  readonly evidenceLinks: readonly string[];
  readonly confidence: 'low' | 'medium' | 'high';
  readonly status: DraftSupersedenceStatus;
  readonly supersededByOutputId: string | null;
  readonly supersededAt: string | null;
  readonly createdAt: string;
}

export class InitiativeDraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitiativeDraftValidationError';
  }
}

interface MethodInitiativeDraftRow {
  id: string;
  organization_id: string;
  output_id: string;
  session_id: string;
  title: string;
  summary: string | null;
  finding_ids_json: unknown;
  rationale: string;
  expected_outcome: string;
  kpi_proposal_json: unknown;
  dependencies_json: unknown;
  risks_json: unknown;
  evidence_links_json: unknown;
  confidence: string;
  status: string;
  superseded_by_output_id: string | null;
  superseded_at: string | null;
  created_at: string;
}

function toRecord(row: MethodInitiativeDraftRow): MethodInitiativeDraftRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    outputId: row.output_id,
    sessionId: row.session_id,
    title: row.title,
    summary: row.summary,
    findingIds: parseJson(row.finding_ids_json, []),
    rationale: row.rationale,
    expectedOutcome: row.expected_outcome,
    kpiProposal: parseJson(row.kpi_proposal_json, null),
    dependencies: parseJson(row.dependencies_json, []),
    risks: parseJson(row.risks_json, []),
    evidenceLinks: parseJson(row.evidence_links_json, []),
    confidence: row.confidence as MethodInitiativeDraftRecord['confidence'],
    status: row.status as DraftSupersedenceStatus,
    supersededByOutputId: row.superseded_by_output_id,
    supersededAt: row.superseded_at,
    createdAt: row.created_at,
  };
}

export class MethodInitiativeDraftService {
  async create(input: CreateInitiativeDraftInput): Promise<MethodInitiativeDraftRecord> {
    if (!input.findingIds || input.findingIds.length === 0) {
      throw new InitiativeDraftValidationError(
        'InitiativeProposalDraft rejected: a draft must link at least one finding'
      );
    }
    if (!input.title || input.title.trim() === '') {
      throw new InitiativeDraftValidationError('InitiativeProposalDraft rejected: title is required');
    }

    const id = genId();
    const now = nowIso();
    const findingIdsSorted = [...input.findingIds].sort((a, b) => a.localeCompare(b));

    await runOrThrow(
      `INSERT INTO method_initiative_drafts
         (id, organization_id, output_id, session_id, title, summary, finding_ids_json,
          rationale, expected_outcome, kpi_proposal_json, dependencies_json, risks_json,
          evidence_links_json, confidence, status, superseded_by_output_id, superseded_at,
          created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.outputId,
        input.sessionId,
        input.title,
        input.summary ?? null,
        JSON.stringify(findingIdsSorted),
        input.rationale,
        input.expectedOutcome,
        input.kpiProposal == null ? null : JSON.stringify(input.kpiProposal),
        JSON.stringify(input.dependencies ?? []),
        JSON.stringify(input.risks ?? []),
        JSON.stringify(input.evidenceLinks ?? []),
        input.confidence,
        'current',
        null,
        null,
        now,
      ]
    );

    return {
      id,
      organizationId: input.organizationId,
      outputId: input.outputId,
      sessionId: input.sessionId,
      title: input.title,
      summary: input.summary ?? null,
      findingIds: findingIdsSorted,
      rationale: input.rationale,
      expectedOutcome: input.expectedOutcome,
      kpiProposal: input.kpiProposal ?? null,
      dependencies: input.dependencies ?? [],
      risks: input.risks ?? [],
      evidenceLinks: input.evidenceLinks ?? [],
      confidence: input.confidence,
      status: 'current',
      supersededByOutputId: null,
      supersededAt: null,
      createdAt: now,
    };
  }

  /**
   * Single draft by id, tenant-checked — same "missing and cross-org both
   * read as null" discipline as MethodReportSnapshotService.getById.
   */
  async getById(organizationId: string, id: string): Promise<MethodInitiativeDraftRecord | null> {
    const row = await DbPromise.get<MethodInitiativeDraftRow>(
      `SELECT * FROM method_initiative_drafts WHERE id = ?`,
      [id]
    );
    if (!row || row.organization_id !== organizationId) return null;
    return toRecord(row);
  }

  async listBySession(
    organizationId: string,
    sessionId: string
  ): Promise<MethodInitiativeDraftRecord[]> {
    const rows = await DbPromise.all<MethodInitiativeDraftRow>(
      `SELECT * FROM method_initiative_drafts WHERE organization_id = ?`,
      [organizationId]
    );
    return rows
      .filter((r) => r.session_id === sessionId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toRecord);
  }

  /**
   * Marks every `current` draft for `sessionId` as superseded by
   * `newOutputId`. Column-scoped UPDATE only (status/superseded_by_output_id/
   * superseded_at) — content columns are never part of this statement.
   */
  async supersedeCurrentForSession(
    organizationId: string,
    sessionId: string,
    newOutputId: string,
    reason: Extract<DraftSupersedenceStatus, 'superseded' | 'source_updated'> = 'superseded'
  ): Promise<number> {
    const current = await this.listBySession(organizationId, sessionId);
    const toSupersede = current.filter((r) => r.status === 'current' && r.outputId !== newOutputId);
    const now = nowIso();
    let touched = 0;
    for (const record of toSupersede) {
      const result = await DbPromise.run(
        `UPDATE method_initiative_drafts SET status = ?, superseded_by_output_id = ?, superseded_at = ?
          WHERE id = ?`,
        [reason, newOutputId, now, record.id],
        { fallback: false }
      );
      if (!result.success) {
        throw new Error(
          `method-core: initiative draft supersede UPDATE failed for ${record.id}: ${result.error ?? 'unknown error'}`
        );
      }
      touched += result.changes ?? 0;
    }
    return touched;
  }
}

export const methodInitiativeDraftService = new MethodInitiativeDraftService();
