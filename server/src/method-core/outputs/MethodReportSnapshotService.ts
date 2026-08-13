/**
 * MethodReportSnapshotService — persists report snapshots rendered from one
 * `method_outputs` row (10_ASSESSMENT_REVIEW.md §15).
 *
 * ★ SUPERSESSION, NOT REWRITE (ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md
 * §6): `supersedeCurrentForSession` issues an UPDATE that touches ONLY
 * `status`, `superseded_by_output_id` and `superseded_at`. It never appears
 * in the same statement as `content_json`/`content_hash` — the report body a
 * user already read/shared stays byte-for-byte what it was.
 *
 * ★ SCREENSHOT BAN: `content_json` is a structured, semantic snapshot
 * (produced by src/method-core/outputs/reportSnapshot.ts on the caller's
 * side, or an equivalent structured builder) — this service never accepts
 * or stores an image.
 */

import * as DbPromise from '../../utils/DbPromise.js';
import { genId, nowIso, parseJson, runOrThrow } from '../db.js';

export type ReportSupersedenceStatus = 'current' | 'superseded' | 'source_updated';

export interface CreateReportSnapshotInput {
  readonly organizationId: string;
  readonly outputId: string;
  readonly sessionId: string;
  readonly title: string;
  /** Structured content — see class doc comment on the screenshot ban. */
  readonly content: unknown;
  readonly contentHash: string;
}

export interface MethodReportSnapshotRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly outputId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly content: unknown;
  readonly contentHash: string;
  readonly status: ReportSupersedenceStatus;
  readonly supersededByOutputId: string | null;
  readonly supersededAt: string | null;
  readonly createdAt: string;
}

interface MethodReportSnapshotRow {
  id: string;
  organization_id: string;
  output_id: string;
  session_id: string;
  title: string;
  content_json: unknown;
  content_hash: string;
  status: string;
  superseded_by_output_id: string | null;
  superseded_at: string | null;
  created_at: string;
}

function toRecord(row: MethodReportSnapshotRow): MethodReportSnapshotRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    outputId: row.output_id,
    sessionId: row.session_id,
    title: row.title,
    content: parseJson(row.content_json, {}),
    contentHash: row.content_hash,
    status: row.status as ReportSupersedenceStatus,
    supersededByOutputId: row.superseded_by_output_id,
    supersededAt: row.superseded_at,
    createdAt: row.created_at,
  };
}

export class MethodReportSnapshotService {
  async create(input: CreateReportSnapshotInput): Promise<MethodReportSnapshotRecord> {
    const id = genId();
    const now = nowIso();
    await runOrThrow(
      `INSERT INTO method_report_snapshots
         (id, organization_id, output_id, session_id, title, content_json, content_hash,
          status, superseded_by_output_id, superseded_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.outputId,
        input.sessionId,
        input.title,
        JSON.stringify(input.content),
        input.contentHash,
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
      content: input.content,
      contentHash: input.contentHash,
      status: 'current',
      supersededByOutputId: null,
      supersededAt: null,
      createdAt: now,
    };
  }

  async listBySession(
    organizationId: string,
    sessionId: string
  ): Promise<MethodReportSnapshotRecord[]> {
    const rows = await DbPromise.all<MethodReportSnapshotRow>(
      `SELECT * FROM method_report_snapshots WHERE organization_id = ?`,
      [organizationId]
    );
    return rows
      .filter((r) => r.session_id === sessionId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toRecord);
  }

  /**
   * Marks every `current` report snapshot for `sessionId` as superseded by
   * `newOutputId`. Column-scoped UPDATE only — see class-level doc comment.
   * Returns the number of rows touched.
   */
  async supersedeCurrentForSession(
    organizationId: string,
    sessionId: string,
    newOutputId: string,
    reason: Extract<ReportSupersedenceStatus, 'superseded' | 'source_updated'> = 'superseded'
  ): Promise<number> {
    const current = await this.listBySession(organizationId, sessionId);
    const toSupersede = current.filter((r) => r.status === 'current' && r.outputId !== newOutputId);
    const now = nowIso();
    let touched = 0;
    for (const record of toSupersede) {
      const result = await DbPromise.run(
        `UPDATE method_report_snapshots SET status = ?, superseded_by_output_id = ?, superseded_at = ?
          WHERE id = ?`,
        [reason, newOutputId, now, record.id],
        { fallback: false }
      );
      if (!result.success) {
        throw new Error(
          `method-core: report snapshot supersede UPDATE failed for ${record.id}: ${result.error ?? 'unknown error'}`
        );
      }
      touched += result.changes ?? 0;
    }
    return touched;
  }
}

export const methodReportSnapshotService = new MethodReportSnapshotService();
