/**
 * Interview Enterprise Service (V4-INTV-01 through V4-INTV-07)
 *
 * V4-INTV-01: Extended question types (matrix, ranking, repeatable) + branching + quotas + segmentation
 * V4-INTV-02: Distribution engine (email/link channels, reminders, tracking, anonymity)
 * V4-INTV-03: Evidence storage governance (S3-ready, virus scan status, retention, access audit)
 * V4-INTV-04: Diagnostics (themes, sentiment, trends, segments, driver analysis)
 * V4-INTV-05: Pipeline findings → recommendations → initiatives with traceability
 * V4-INTV-06: Anonymity modes (min cohort, redaction, aggregation, export gating)
 * V4-INTV-07: Company context versioning, confidence scoring, source citations, reviewer sign-off
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// ============================================================
// Types
// ============================================================

export type ExtendedAnswerType =
  | 'open'
  | 'number'
  | 'select'
  | 'scale'
  | 'boolean'
  | 'matrix'
  | 'ranking'
  | 'multi_select'
  | 'date'
  | 'file_upload';

export interface BranchingRule {
  condition: {
    questionId: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: unknown;
  };
  action: 'show' | 'hide' | 'skip_to';
  targetQuestionId?: string;
}

export interface QuestionConfig {
  matrixRows?: string[];
  matrixColumns?: string[];
  rankingItems?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: Record<string, string>;
  maxSelections?: number;
  placeholder?: string;
}

export interface RespondentSegment {
  id: string;
  sessionId: string;
  segmentName: string;
  criteria: Record<string, unknown>;
  respondentCount: number;
}

export interface Distribution {
  id: string;
  sessionId: string;
  channel: 'email' | 'link' | 'webhook';
  recipientEmail: string | null;
  recipientName: string | null;
  publicToken: string;
  status: 'pending' | 'sent' | 'opened' | 'started' | 'completed' | 'expired' | 'revoked';
  anonymityMode: 'identified' | 'anonymous' | 'pseudonymous';
  sentAt: string | null;
  openedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  reminderCount: number;
  expiresAt: string;
  revokedAt: string | null;
}

export class InterviewDistributionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVITE_NOT_FOUND'
      | 'INVITE_EXPIRED'
      | 'INVITE_REVOKED'
      | 'INVALID_EXPIRY'
      | 'SESSION_NOT_FOUND'
      | 'INITIATIVE_NOT_FOUND',
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'InterviewDistributionError';
  }
}

export interface Finding {
  id: string;
  sessionId: string;
  insightId: string | null;
  findingType: 'gap' | 'strength' | 'risk' | 'opportunity';
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidenceRefs: string[];
  status: 'identified' | 'recommended' | 'initiative_created' | 'dismissed';
  recommendationId: string | null;
  initiativeId: string | null;
}

export interface ContextVersion {
  id: string;
  organizationId: string;
  version: number;
  contextData: Record<string, unknown>;
  confidenceScores: Record<string, number>;
  sourceCitations: Array<{ sessionId: string; questionId?: string; snippet: string }>;
  reviewerId: string | null;
  reviewerSignOffAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface DiagnosticsSnapshot {
  id: string;
  sessionId: string;
  snapshotType: 'themes' | 'sentiment' | 'trends' | 'segments' | 'drivers';
  data: Record<string, unknown>;
  generatedBy: string;
  createdAt: string;
}

// ============================================================
// Service
// ============================================================

class InterviewEnterpriseService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) this.db = await getDatabase();
    return this.db;
  }

  /**
   * SECURITY (cross-org tenant fix — M03 Interview V4): bind a caller-supplied
   * `sessionId` to the caller's org BEFORE writing anything that references it.
   *
   * The child-row INSERTs below all stamp the caller's own `organization_id`, so
   * they look tenant-safe at a glance — but `session_id` came straight off the
   * URL and was never checked. A caller could therefore graft segments, quotas,
   * reminder schedules, diagnostics snapshots and findings onto ANOTHER tenant's
   * interview session. The rows are then invisible to their real owner (every
   * read filters by organization_id) while still counting in that session's
   * quota/reminder machinery — silent cross-tenant corruption plus confirmation
   * that a probed session id exists.
   *
   * `createDistribution` already did this check inline; this is the same check,
   * named, so every session-scoped write shares it. 404 (not 403) on purpose:
   * "not found in your org" must be indistinguishable from "does not exist", or
   * the error code itself becomes the enumeration oracle.
   */
  private async assertSessionInOrg(orgId: string, sessionId: string): Promise<void> {
    const session = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM interview_sessions WHERE id = ? AND organization_id = ?`,
      [sessionId, orgId]
    );
    if (!session) {
      throw new InterviewDistributionError('Interview session not found', 'SESSION_NOT_FOUND', 404);
    }
  }

  // ──────────────────────────────────────────────
  // V4-INTV-01: Segments + Quotas
  // ──────────────────────────────────────────────

  async createSegment(
    orgId: string,
    sessionId: string,
    data: { segmentName: string; criteria: Record<string, unknown> }
  ): Promise<RespondentSegment> {
    await this.assertSessionInOrg(orgId, sessionId);
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO interview_respondent_segments (id, organization_id, session_id, segment_name, criteria)
       VALUES (?, ?, ?, ?, ?)`,
      [id, orgId, sessionId, data.segmentName, JSON.stringify(data.criteria)]
    );
    return {
      id,
      sessionId,
      segmentName: data.segmentName,
      criteria: data.criteria,
      respondentCount: 0,
    };
  }

  async getSegments(orgId: string, sessionId: string): Promise<RespondentSegment[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM interview_respondent_segments WHERE organization_id = ? AND session_id = ? ORDER BY created_at`,
        [orgId, sessionId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      segmentName: r.segment_name,
      criteria: safeJson(r.criteria),
      respondentCount: r.respondent_count || 0,
    }));
  }

  async createQuota(
    orgId: string,
    sessionId: string,
    data: { segmentId?: string; targetCount: number }
  ): Promise<{ id: string; targetCount: number; currentCount: number; status: string }> {
    await this.assertSessionInOrg(orgId, sessionId);
    if (data.segmentId) {
      // A quota may point at a segment; that segment must also be ours, else the
      // quota silently references another tenant's cohort.
      const segment = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM interview_respondent_segments WHERE id = ? AND organization_id = ? AND session_id = ?`,
        [data.segmentId, orgId, sessionId]
      );
      if (!segment) {
        throw new InterviewDistributionError(
          'Respondent segment not found',
          'SESSION_NOT_FOUND',
          404
        );
      }
    }
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO interview_quotas (id, organization_id, session_id, segment_id, target_count)
       VALUES (?, ?, ?, ?, ?)`,
      [id, orgId, sessionId, data.segmentId || null, data.targetCount]
    );
    return { id, targetCount: data.targetCount, currentCount: 0, status: 'open' };
  }

  async getQuotas(orgId: string, sessionId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM interview_quotas WHERE organization_id = ? AND session_id = ? ORDER BY created_at`,
        [orgId, sessionId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      segmentId: r.segment_id,
      targetCount: r.target_count,
      currentCount: r.current_count || 0,
      status: r.status,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-INTV-02: Distribution engine
  // ──────────────────────────────────────────────

  async createDistribution(
    orgId: string,
    sessionId: string,
    data: {
      channel: 'email' | 'link' | 'webhook';
      recipientEmail?: string;
      recipientName?: string;
      anonymityMode?: 'identified' | 'anonymous' | 'pseudonymous';
      expiresAt?: string;
    }
  ): Promise<Distribution> {
    const id = uuidv4();
    const publicToken = crypto.randomBytes(32).toString('hex');
    const session = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM interview_sessions WHERE id = ? AND organization_id = ?`,
      [sessionId, orgId]
    );
    if (!session) {
      throw new InterviewDistributionError('Interview session not found', 'INVITE_NOT_FOUND', 404);
    }
    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new InterviewDistributionError('Invite expiry must be in the future', 'INVALID_EXPIRY', 400);
    }

    await queryHelpers.queryRun(
      `INSERT INTO interview_distributions
       (id, organization_id, session_id, channel, recipient_email, recipient_name, public_token, anonymity_mode, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        orgId,
        sessionId,
        data.channel,
        data.recipientEmail || null,
        data.recipientName || null,
        publicToken,
        data.anonymityMode || 'identified',
        expiresAt.toISOString(),
      ]
    );

    return {
      id,
      sessionId,
      channel: data.channel,
      recipientEmail: data.recipientEmail || null,
      recipientName: data.recipientName || null,
      publicToken,
      status: 'pending',
      anonymityMode: data.anonymityMode || 'identified',
      sentAt: null,
      openedAt: null,
      startedAt: null,
      completedAt: null,
      reminderCount: 0,
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
    };
  }

  async getDistributions(orgId: string, sessionId: string): Promise<Distribution[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM interview_distributions WHERE organization_id = ? AND session_id = ? ORDER BY created_at DESC`,
        [orgId, sessionId]
      )) || [];
    return rows.map(mapDistributionRow);
  }

  async updateDistributionStatus(
    orgId: string,
    distributionId: string,
    status: string,
    timestampField?: string
  ): Promise<boolean> {
    const updates = [`status = ?`];
    const params: unknown[] = [status];
    if (timestampField) {
      updates.push(`${timestampField} = ?`);
      params.push(new Date().toISOString());
    }
    params.push(distributionId, orgId);
    const result = await queryHelpers.queryRun(
      `UPDATE interview_distributions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    return (result?.changes || 0) > 0;
  }

  async markDistributionSent(orgId: string, distributionId: string): Promise<boolean> {
    return this.updateDistributionStatus(orgId, distributionId, 'sent', 'sent_at');
  }

  async getDistributionByToken(publicToken: string): Promise<Distribution | null> {
    const row = await queryHelpers.queryOne<any>(
      `SELECT * FROM interview_distributions WHERE public_token = ?`,
      [publicToken]
    );
    return row ? mapDistributionRow(row) : null;
  }

  async resolveActiveDistributionByToken(publicToken: string): Promise<Distribution> {
    const token = String(publicToken || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new InterviewDistributionError('Invite not found', 'INVITE_NOT_FOUND', 404);
    }
    const active = await queryHelpers.queryOne<any>(
      `UPDATE interview_distributions
          SET status = CASE WHEN status IN ('pending','sent') THEN 'opened' ELSE status END,
              opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP)
        WHERE public_token = ?
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
          AND status NOT IN ('expired','revoked')
        RETURNING *`,
      [token]
    );
    if (active) return mapDistributionRow(active);

    const terminal = await queryHelpers.queryOne<any>(
      `SELECT revoked_at, expires_at FROM interview_distributions WHERE public_token = ?`,
      [token]
    );
    if (!terminal) {
      throw new InterviewDistributionError('Invite not found', 'INVITE_NOT_FOUND', 404);
    }
    if (terminal.revoked_at) {
      throw new InterviewDistributionError('Invite revoked', 'INVITE_REVOKED', 410);
    }
    await queryHelpers.queryRun(
      `UPDATE interview_distributions SET status='expired'
        WHERE public_token=? AND revoked_at IS NULL AND expires_at <= CURRENT_TIMESTAMP`,
      [token]
    );
    throw new InterviewDistributionError('Invite expired', 'INVITE_EXPIRED', 410);
  }

  async revokeDistribution(orgId: string, distributionId: string, actorId: string): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE interview_distributions
          SET revoked_at = CURRENT_TIMESTAMP, revoked_by = ?, status = 'revoked'
        WHERE id = ? AND organization_id = ? AND revoked_at IS NULL`,
      [actorId, distributionId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async createReminderSchedule(
    orgId: string,
    sessionId: string,
    data: { reminderType?: string; sendAfterHours?: number; maxReminders?: number }
  ): Promise<{ id: string }> {
    await this.assertSessionInOrg(orgId, sessionId);
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO interview_reminder_schedules (id, organization_id, session_id, reminder_type, send_after_hours, max_reminders)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        sessionId,
        data.reminderType || 'email',
        data.sendAfterHours || 48,
        data.maxReminders || 3,
      ]
    );
    return { id };
  }

  async getDistributionStats(orgId: string, sessionId: string) {
    const row = await queryHelpers.queryOne<any>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
         SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
         SUM(CASE WHEN status = 'started' THEN 1 ELSE 0 END) as started,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM interview_distributions
       WHERE organization_id = ? AND session_id = ?`,
      [orgId, sessionId]
    );
    return {
      total: row?.total || 0,
      sent: row?.sent || 0,
      opened: row?.opened || 0,
      started: row?.started || 0,
      completed: row?.completed || 0,
      completionRate: row?.total ? (((row?.completed || 0) / row.total) * 100).toFixed(1) : '0.0',
    };
  }

  // ──────────────────────────────────────────────
  // V4-INTV-03: Evidence access audit
  // ──────────────────────────────────────────────

  async logEvidenceAccess(
    orgId: string,
    evidenceId: string,
    actorId: string,
    action: string,
    ipAddress?: string
  ): Promise<void> {
    await queryHelpers.queryRun(
      `INSERT INTO interview_evidence_access_log (id, organization_id, evidence_id, actor_id, action, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), orgId, evidenceId, actorId, action, ipAddress || null]
    );
  }

  async getEvidenceAccessLog(orgId: string, evidenceId: string, limit: number = 50) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM interview_evidence_access_log
       WHERE organization_id = ? AND evidence_id = ?
       ORDER BY created_at DESC LIMIT ?`,
        [orgId, evidenceId, limit]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      actorId: r.actor_id,
      action: r.action,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-INTV-04: Diagnostics snapshots
  // ──────────────────────────────────────────────

  async createDiagnosticsSnapshot(
    orgId: string,
    sessionId: string,
    data: {
      snapshotType: DiagnosticsSnapshot['snapshotType'];
      data: Record<string, unknown>;
      generatedBy?: string;
    }
  ): Promise<DiagnosticsSnapshot> {
    await this.assertSessionInOrg(orgId, sessionId);
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO interview_diagnostics_snapshots (id, organization_id, session_id, snapshot_type, data, generated_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        sessionId,
        data.snapshotType,
        JSON.stringify(data.data),
        data.generatedBy || 'system',
        now,
      ]
    );
    return {
      id,
      sessionId,
      snapshotType: data.snapshotType,
      data: data.data,
      generatedBy: data.generatedBy || 'system',
      createdAt: now,
    };
  }

  async getDiagnosticsSnapshots(
    orgId: string,
    sessionId: string,
    snapshotType?: string
  ): Promise<DiagnosticsSnapshot[]> {
    const conditions = ['organization_id = ?', 'session_id = ?'];
    const params: unknown[] = [orgId, sessionId];
    if (snapshotType) {
      conditions.push('snapshot_type = ?');
      params.push(snapshotType);
    }
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM interview_diagnostics_snapshots WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
        params
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      snapshotType: r.snapshot_type,
      data: safeJson(r.data),
      generatedBy: r.generated_by,
      createdAt: r.created_at,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-INTV-05: Findings pipeline
  // ──────────────────────────────────────────────

  async createFinding(
    orgId: string,
    sessionId: string,
    data: {
      insightId?: string;
      findingType: Finding['findingType'];
      title: string;
      description?: string;
      severity?: Finding['severity'];
      evidenceRefs?: string[];
    }
  ): Promise<Finding> {
    await this.assertSessionInOrg(orgId, sessionId);
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO interview_findings
       (id, organization_id, session_id, insight_id, finding_type, title, description, severity, evidence_refs, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'identified', ?, ?)`,
      [
        id,
        orgId,
        sessionId,
        data.insightId || null,
        data.findingType,
        data.title,
        data.description || null,
        data.severity || 'medium',
        JSON.stringify(data.evidenceRefs || []),
        now,
        now,
      ]
    );
    return {
      id,
      sessionId,
      insightId: data.insightId || null,
      findingType: data.findingType,
      title: data.title,
      description: data.description || null,
      severity: data.severity || 'medium',
      evidenceRefs: data.evidenceRefs || [],
      status: 'identified',
      recommendationId: null,
      initiativeId: null,
    };
  }

  async getFindings(orgId: string, sessionId: string, status?: string): Promise<Finding[]> {
    const conditions = ['organization_id = ?', 'session_id = ?'];
    const params: unknown[] = [orgId, sessionId];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM interview_findings WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
        params
      )) || [];
    return rows.map(mapFindingRow);
  }

  async promoteFindingToInitiative(
    orgId: string,
    findingId: string,
    initiativeId: string
  ): Promise<boolean> {
    // SECURITY (cross-org tenant fix — M03 Interview V4): `initiativeId` arrives
    // from the request body and used to be written into `interview_findings`
    // unverified. The UPDATE itself is org-scoped, so no foreign ROW is written —
    // but the value stored is not. A caller could bind their own finding to a
    // FOREIGN org's initiative id, which (a) is a probe: 200 vs 404 tells them
    // whether that id exists, and (b) plants a cross-tenant pointer that every
    // downstream traceability read (finding → initiative) then follows out of
    // the tenant. Same doctrine as `interview-insights.routes.ts`, which already
    // pre-checks `target_initiative_id` against `initiatives.organization_id`.
    const initiative = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
    if (!initiative) {
      throw new InterviewDistributionError('Initiative not found', 'INITIATIVE_NOT_FOUND', 404);
    }
    const result = await queryHelpers.queryRun(
      `UPDATE interview_findings SET status = 'initiative_created', initiative_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [initiativeId, new Date().toISOString(), findingId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async updateFindingStatus(orgId: string, findingId: string, status: string): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE interview_findings SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [status, new Date().toISOString(), findingId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  // ──────────────────────────────────────────────
  // V4-INTV-06: Anonymity — aggregation check
  // ──────────────────────────────────────────────

  async checkCohortSize(
    orgId: string,
    sessionId: string,
    segmentId?: string
  ): Promise<{
    cohortSize: number;
    minRequired: number;
    suppressed: boolean;
  }> {
    const session = await queryHelpers.queryOne<any>(
      `SELECT min_cohort_size FROM interview_sessions WHERE id = ? AND organization_id = ?`,
      [sessionId, orgId]
    );
    const minRequired = session?.min_cohort_size || 5;

    let cohortSize: number;
    if (segmentId) {
      const seg = await queryHelpers.queryOne<any>(
        `SELECT respondent_count FROM interview_respondent_segments WHERE id = ? AND organization_id = ?`,
        [segmentId, orgId]
      );
      cohortSize = seg?.respondent_count || 0;
    } else {
      const dist = await queryHelpers.queryOne<any>(
        `SELECT COUNT(*) as cnt FROM interview_distributions WHERE session_id = ? AND organization_id = ? AND status = 'completed'`,
        [sessionId, orgId]
      );
      cohortSize = dist?.cnt || 0;
    }

    return { cohortSize, minRequired, suppressed: cohortSize < minRequired };
  }

  async checkExportGating(
    orgId: string,
    sessionId: string
  ): Promise<{
    canExport: boolean;
    reason: string | null;
  }> {
    const session = await queryHelpers.queryOne<any>(
      `SELECT export_gating, anonymity_mode, min_cohort_size FROM interview_sessions WHERE id = ? AND organization_id = ?`,
      [sessionId, orgId]
    );
    if (!session) return { canExport: false, reason: 'Session not found' };

    if (session.export_gating === 'blocked') {
      return { canExport: false, reason: 'Export is blocked by policy' };
    }

    if (session.anonymity_mode === 'anonymous') {
      const cohort = await this.checkCohortSize(orgId, sessionId);
      if (cohort.suppressed) {
        return {
          canExport: false,
          reason: `Cohort size (${cohort.cohortSize}) below minimum (${cohort.minRequired})`,
        };
      }
    }

    return { canExport: true, reason: null };
  }

  // ──────────────────────────────────────────────
  // V4-INTV-07: Company context versioning
  // ──────────────────────────────────────────────

  async createContextVersion(
    orgId: string,
    userId: string,
    data: {
      contextData: Record<string, unknown>;
      confidenceScores?: Record<string, number>;
      sourceCitations?: Array<{ sessionId: string; questionId?: string; snippet: string }>;
    }
  ): Promise<ContextVersion> {
    const db = await this.getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    const lastVersion = await queryHelpers.queryOne<any>(
      `SELECT MAX(version) as "maxV" FROM organization_context_versions WHERE organization_id = ?`,
      [orgId]
    );
    const version = (lastVersion?.maxV || 0) + 1;

    await queryHelpers.queryRun(
      `INSERT INTO organization_context_versions
       (id, organization_id, version, context_data, confidence_scores, source_citations, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        version,
        JSON.stringify(data.contextData),
        JSON.stringify(data.confidenceScores || {}),
        JSON.stringify(data.sourceCitations || []),
        userId,
        now,
      ]
    );

    return {
      id,
      organizationId: orgId,
      version,
      contextData: data.contextData,
      confidenceScores: data.confidenceScores || {},
      sourceCitations: data.sourceCitations || [],
      reviewerId: null,
      reviewerSignOffAt: null,
      createdBy: userId,
      createdAt: now,
    };
  }

  async getContextVersions(orgId: string, limit: number = 20): Promise<ContextVersion[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM organization_context_versions WHERE organization_id = ? ORDER BY version DESC LIMIT ?`,
        [orgId, limit]
      )) || [];
    return rows.map(mapContextVersionRow);
  }

  async getContextVersion(orgId: string, version: number): Promise<ContextVersion | null> {
    const row = await queryHelpers.queryOne<any>(
      `SELECT * FROM organization_context_versions WHERE organization_id = ? AND version = ?`,
      [orgId, version]
    );
    return row ? mapContextVersionRow(row) : null;
  }

  async signOffContextVersion(
    orgId: string,
    versionId: string,
    reviewerId: string
  ): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE organization_context_versions SET reviewer_id = ?, reviewer_sign_off_at = ? WHERE id = ? AND organization_id = ?`,
      [reviewerId, new Date().toISOString(), versionId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async diffContextVersions(
    orgId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{
    added: string[];
    removed: string[];
    changed: Array<{ key: string; from: unknown; to: unknown }>;
  }> {
    const from = await this.getContextVersion(orgId, fromVersion);
    const to = await this.getContextVersion(orgId, toVersion);
    if (!from || !to) return { added: [], removed: [], changed: [] };

    const fromKeys = new Set(Object.keys(from.contextData));
    const toKeys = new Set(Object.keys(to.contextData));

    const added = [...toKeys].filter((k) => !fromKeys.has(k));
    const removed = [...fromKeys].filter((k) => !toKeys.has(k));
    const changed: Array<{ key: string; from: unknown; to: unknown }> = [];

    for (const key of fromKeys) {
      if (
        toKeys.has(key) &&
        JSON.stringify(from.contextData[key]) !== JSON.stringify(to.contextData[key])
      ) {
        changed.push({ key, from: from.contextData[key], to: to.contextData[key] });
      }
    }

    return { added, removed, changed };
  }
}

// ============================================================
// Helpers
// ============================================================

function safeJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>);
  } catch {
    return {};
  }
}

function safeJsonArray(val: unknown): unknown[] {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as unknown[]);
  } catch {
    return [];
  }
}

function mapDistributionRow(r: any): Distribution {
  return {
    id: r.id,
    sessionId: r.session_id,
    channel: r.channel,
    recipientEmail: r.recipient_email,
    recipientName: r.recipient_name,
    publicToken: r.public_token,
    status: r.status,
    anonymityMode: r.anonymity_mode || 'identified',
    sentAt: r.sent_at,
    openedAt: r.opened_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    reminderCount: r.reminder_count || 0,
    expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : String(r.expires_at),
    revokedAt: r.revoked_at
      ? r.revoked_at instanceof Date
        ? r.revoked_at.toISOString()
        : String(r.revoked_at)
      : null,
  };
}

function mapFindingRow(r: any): Finding {
  return {
    id: r.id,
    sessionId: r.session_id,
    insightId: r.insight_id,
    findingType: r.finding_type,
    title: r.title,
    description: r.description,
    severity: r.severity || 'medium',
    evidenceRefs: safeJsonArray(r.evidence_refs) as string[],
    status: r.status,
    recommendationId: r.recommendation_id,
    initiativeId: r.initiative_id,
  };
}

function mapContextVersionRow(r: any): ContextVersion {
  return {
    id: r.id,
    organizationId: r.organization_id,
    version: r.version,
    contextData: safeJson(r.context_data),
    confidenceScores: safeJson(r.confidence_scores) as Record<string, number>,
    sourceCitations: safeJsonArray(r.source_citations) as ContextVersion['sourceCitations'],
    reviewerId: r.reviewer_id,
    reviewerSignOffAt: r.reviewer_sign_off_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

const interviewEnterpriseService = new InterviewEnterpriseService();
export default interviewEnterpriseService;
export { InterviewEnterpriseService, interviewEnterpriseService };
