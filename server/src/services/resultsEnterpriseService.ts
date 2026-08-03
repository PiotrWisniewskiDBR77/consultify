/**
 * Results Enterprise Service (V4-RSLT-02, 04, 05, 06)
 *
 * V4-RSLT-02: KPI connectors (ingestion pipeline, scheduled refresh, provenance)
 * V4-RSLT-04: ROI evidence (realized values, provenance assumptions, finance linkage)
 * V4-RSLT-05: Scheduled KPI reporting (templates, approval gates, distribution)
 * V4-RSLT-06: Wallboard mode (real-time refresh, alert banners, auto-rotation)
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import * as ReportBuilderService from './reportBuilderService.js';
import { recordKpiMeasurement } from './results/kpiMeasurementWriterService.js';
import { createKpiReportSnapshot } from './results/kpiReportSnapshotService.js';

type MetricAuditEntry = {
  id: string;
  section: string;
  eventType: string;
  source: string;
  actorUserId?: string | null;
  summary?: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
};

const LOG_PREFIX = '[ResultsEnterprise]';

class ResultsEnterpriseService {
  // ── V4-RSLT-02: KPI connectors ──

  async createConnector(
    orgId: string,
    userId: string,
    data: {
      connectorName: string;
      connectorType?: string;
      config: Record<string, unknown>;
      targetKpiIds?: string[];
      scheduleCron?: string;
    }
  ) {
    const id = uuidv4();
    const nextRunAt = resolveNextRunAt({ scheduleCron: data.scheduleCron || null });
    await queryHelpers.queryRun(
      `INSERT INTO kpi_connectors (id, organization_id, connector_name, connector_type, config, target_kpi_ids, schedule_cron, next_run_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.connectorName,
        data.connectorType || 'api',
        JSON.stringify(data.config),
        JSON.stringify(data.targetKpiIds || []),
        data.scheduleCron || null,
        nextRunAt,
        userId,
      ]
    );
    return {
      id,
      connectorName: data.connectorName,
      status: 'never',
      nextRunAt,
    };
  }

  async getConnectors(orgId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_connectors WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      connectorName: r.connector_name,
      connectorType: r.connector_type,
      // SEC (response-leak): the connector `config` blob (z.record(z.unknown())) is
      // where api/database/webhook connectors store credentials — api keys, tokens,
      // passwords, connection strings, auth headers. Returning it verbatim on GET
      // discloses those secrets to any authed org member over the wire. Mirror the
      // mcp.routes redactProviderConfig pattern (utils — SECRET_CONFIG_KEYS deny-list)
      // and replace secret-bearing values with a "__set__" placeholder so the UI can
      // show "configured" without ever receiving the raw credential.
      config: redactConnectorConfig(r.config),
      targetKpiIds: safeJsonArray(r.target_kpi_ids),
      scheduleCron: r.schedule_cron,
      lastRunAt: r.last_run_at,
      lastRunStatus: r.last_run_status,
      lastRunMessage: r.last_run_message,
      nextRunAt: r.next_run_at,
      isActive: !!r.is_active,
    }));
  }

  async ingestKPIValue(
    orgId: string,
    data: {
      connectorId: string;
      kpiId: string;
      value: number;
      period: string;
      provenance?: Record<string, unknown>;
      qualityScore?: number;
    }
  ) {
    return this.recordConnectorMeasurement(orgId, {
      connectorId: data.connectorId,
      kpiId: data.kpiId,
      value: data.value,
      period: data.period,
      provenance: data.provenance,
      qualityScore: data.qualityScore,
      actorUserId: null,
      runSource: 'manual_ingest',
    });
  }

  private async recordConnectorMeasurement(
    orgId: string,
    data: {
      connectorId: string;
      kpiId: string;
      value: number;
      period: string;
      provenance?: Record<string, unknown>;
      qualityScore?: number;
      actorUserId?: string | null;
      runSource: string;
    }
  ) {
    const id = uuidv4();
    const periodStart = String(data.period || '').slice(0, 10);
    const sourceLabel = `connector:${data.connectorId}`;
    // SEC-3 (L-04): verify the connector belongs to the caller's org before ingesting.
    // Without this, a foreign-org connectorId would still drive a kpi_time_series write
    // and (below) a cross-org current_value overwrite. The route maps 'not found' → 404.
    const ownedConnector = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM kpi_connectors WHERE id = ? AND organization_id = ?`,
      [data.connectorId, orgId]
    );
    if (!ownedConnector?.id) {
      throw new Error('Connector not found');
    }
    await queryHelpers.queryRun(
      `INSERT INTO kpi_ingestion_log (id, organization_id, connector_id, kpi_id, ingested_value, period, provenance, quality_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.connectorId,
        data.kpiId,
        data.value,
        data.period,
        JSON.stringify(data.provenance || {}),
        data.qualityScore || 1.0,
      ]
    );
    // RES-003: route through the canonical measurement writer. This also
    // closes a real gap this function previously had — only the connector
    // was org-verified (above); `data.kpiId` itself was never checked, so a
    // connector could be configured (accidentally or not) to ingest against
    // a foreign-org kpiId and still get a kpi_time_series row written under
    // the caller's org (the current_value UPDATE below was org-scoped and
    // would silently no-op, but the measurement row itself was not guarded).
    // recordKpiMeasurement's ownership precheck now rejects that case before
    // any write. It also upserts on (kpiId, periodStart, source) instead of
    // the previous bare INSERT, resolves the RES-02 definition_version_id
    // pin itself, and writes kpi_metric_audit_log itself.
    await recordKpiMeasurement({
      organizationId: orgId,
      kpiId: data.kpiId,
      value: data.value,
      periodStart,
      source: sourceLabel,
      notes: stringifyCompact({
        connectorId: data.connectorId,
        ingestionLogId: id,
        provenance: data.provenance || {},
        qualityScore: data.qualityScore ?? 1.0,
        runSource: data.runSource,
      }),
      actorUserId: data.actorUserId || null,
      auditEventType: 'connector_ingest',
      auditSourceLabel: sourceLabel,
      auditSummary: `Connector ingested ${Number(data.value)} for ${periodStart}`,
      auditAfterExtra: {
        period: periodStart,
        provenance: data.provenance || {},
        qualityScore: data.qualityScore ?? 1.0,
      },
    });
    await queryHelpers.queryRun(
      `UPDATE kpi_connectors
       SET last_run_at = ?, last_run_status = 'success', last_run_message = ?, next_run_at = COALESCE(next_run_at, ?)
       WHERE id = ? AND organization_id = ?`,
      [
        new Date().toISOString(),
        `Accepted ${Number(data.value)} for ${data.kpiId}`,
        resolveNextRunAt({ scheduleCron: null }),
        data.connectorId,
        orgId,
      ]
    );
    return { id };
  }

  async getIngestionLog(orgId: string, connectorId: string, limit: number = 50) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_ingestion_log WHERE organization_id = ? AND connector_id = ? ORDER BY created_at DESC LIMIT ?`,
        [orgId, connectorId, limit]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      kpiId: r.kpi_id,
      ingestedValue: r.ingested_value,
      period: r.period,
      provenance: safeJson(r.provenance),
      qualityScore: r.quality_score,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  // ── V4-RSLT-04: ROI evidence ──

  async createROIEvidence(
    orgId: string,
    userId: string,
    data: {
      initiativeId?: string;
      benefitId?: string;
      evidenceType?: string;
      value: number;
      currency?: string;
      period: string;
      sourceDescription?: string;
      provenanceAssumptions?: unknown[];
      financeModelId?: string;
    }
  ) {
    // SEC-3: each referenced parent (initiative, benefit, finance model) must belong to the
    // caller's org. Without this, a request could pin ROI evidence to a foreign-org id and
    // pollute that org's evidence joins / portfolio rollups. The route maps 'not found' → 404.
    await this.assertParentOwned(orgId, 'initiatives', data.initiativeId);
    await this.assertParentOwned(orgId, 'benefits', data.benefitId);
    await this.assertParentOwned(orgId, 'financial_models', data.financeModelId);
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO roi_evidence (id, organization_id, initiative_id, benefit_id, evidence_type, value, currency, period, source_description, provenance_assumptions, finance_model_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.initiativeId || null,
        data.benefitId || null,
        data.evidenceType || 'measurement',
        data.value,
        data.currency || 'PLN',
        data.period,
        data.sourceDescription || null,
        JSON.stringify(data.provenanceAssumptions || []),
        data.financeModelId || null,
        userId,
      ]
    );
    return { id, verificationStatus: 'unverified' };
  }

  async getROIEvidence(orgId: string, filters?: { initiativeId?: string; benefitId?: string }) {
    const conditions = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    if (filters?.initiativeId) {
      conditions.push('initiative_id = ?');
      params.push(filters.initiativeId);
    }
    if (filters?.benefitId) {
      conditions.push('benefit_id = ?');
      params.push(filters.benefitId);
    }
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM roi_evidence WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
        params
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      initiativeId: r.initiative_id,
      benefitId: r.benefit_id,
      evidenceType: r.evidence_type,
      value: r.value,
      currency: r.currency,
      period: r.period,
      sourceDescription: r.source_description,
      provenanceAssumptions: safeJsonArray(r.provenance_assumptions),
      financeModelId: r.finance_model_id,
      verificationStatus: r.verification_status,
      verifiedBy: r.verified_by,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  }

  async verifyROIEvidence(orgId: string, evidenceId: string, userId: string) {
    const result = await queryHelpers.queryRun(
      `UPDATE roi_evidence SET verification_status = 'verified', verified_by = ?, verified_at = ? WHERE id = ? AND organization_id = ?`,
      [userId, new Date().toISOString(), evidenceId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  // ── V4-RSLT-05: Scheduled KPI reporting ──

  async createReportSchedule(
    orgId: string,
    userId: string,
    data: {
      reportName: string;
      templateConfig?: Record<string, unknown>;
      kpiIds: string[];
      scheduleCron?: string;
      sendAt?: string;
      recipientPolicy: Record<string, unknown>;
      approvalRequired?: boolean;
    }
  ) {
    const id = uuidv4();
    const nextRunAt = resolveNextRunAt({
      scheduleCron: data.scheduleCron || null,
      sendAt: data.sendAt || null,
    });
    await queryHelpers.queryRun(
      `INSERT INTO kpi_report_schedules (id, organization_id, report_name, template_config, kpi_ids, schedule_cron, send_at, recipient_policy, approval_required, next_run_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.reportName,
        JSON.stringify(data.templateConfig || {}),
        JSON.stringify(data.kpiIds),
        data.scheduleCron || null,
        data.sendAt || null,
        JSON.stringify(data.recipientPolicy),
        data.approvalRequired ? 1 : 0,
        nextRunAt,
        userId,
      ]
    );
    return { id, status: 'active', nextRunAt };
  }

  async getReportSchedules(orgId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_report_schedules WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      reportName: r.report_name,
      templateConfig: safeJson(r.template_config),
      kpiIds: safeJsonArray(r.kpi_ids),
      scheduleCron: r.schedule_cron,
      sendAt: r.send_at,
      recipientPolicy: safeJson(r.recipient_policy),
      approvalRequired: !!r.approval_required,
      approvalStatus: r.approval_status,
      lastSentAt: r.last_sent_at,
      lastRunStatus: r.last_run_status || 'never',
      nextRunAt: r.next_run_at,
      status: r.status,
    }));
  }

  async approveReportSchedule(orgId: string, scheduleId: string, userId: string) {
    const result = await queryHelpers.queryRun(
      `UPDATE kpi_report_schedules SET approval_status = 'approved', approved_by = ?, approved_at = ? WHERE id = ? AND organization_id = ?`,
      [userId, new Date().toISOString(), scheduleId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async getScheduleDeliveryLog(orgId: string, scheduleId: string, limit: number = 50) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_report_delivery_log
         WHERE organization_id = ? AND schedule_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [orgId, scheduleId, Math.max(1, Math.min(limit, 200))]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      recipientEmail: r.recipient_email,
      channel: r.channel,
      status: r.status,
      deliveredAt: r.delivered_at,
      openedAt: r.opened_at,
      createdAt: r.created_at,
    }));
  }

  async runReportScheduleNow(orgId: string, scheduleId: string, userId?: string | null) {
    const schedule = await this.getRawSchedule(orgId, scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }
    return this.executeReportSchedule(
      orgId,
      schedule,
      userId || schedule.created_by || 'system',
      'manual_run'
    );
  }

  async runConnectorNow(orgId: string, connectorId: string, userId?: string | null) {
    const connector = await this.getRawConnector(orgId, connectorId);
    if (!connector) {
      throw new Error('Connector not found');
    }
    return this.executeConnector(
      orgId,
      connector,
      userId || connector.created_by || 'system',
      'manual_run'
    );
  }

  async runDueWork(orgId?: string) {
    const connectorRuns = await this.runDueConnectors(orgId);
    const scheduleRuns = await this.runDueSchedules(orgId);
    if (connectorRuns.length || scheduleRuns.length) {
      logger.info(`${LOG_PREFIX} executed due enterprise work`, {
        orgId: orgId || 'all',
        connectors: connectorRuns.length,
        schedules: scheduleRuns.length,
      });
    }
    return {
      connectors: connectorRuns,
      schedules: scheduleRuns,
    };
  }

  async createMetricAuditEntry(
    orgId: string,
    data: {
      kpiId: string;
      section: string;
      eventType: string;
      source?: string;
      actorUserId?: string | null;
      summary?: string | null;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO kpi_metric_audit_log
       (id, organization_id, kpi_id, section, event_type, source, actor_user_id, summary, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.kpiId,
        data.section,
        data.eventType,
        data.source || 'results_runtime',
        data.actorUserId || null,
        data.summary || null,
        JSON.stringify(data.before || {}),
        JSON.stringify(data.after || {}),
      ]
    );
    return { id };
  }

  async getMetricAuditLog(
    orgId: string,
    kpiId: string,
    limit: number = 50
  ): Promise<MetricAuditEntry[]> {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_metric_audit_log
         WHERE organization_id = ? AND kpi_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [orgId, kpiId, Math.max(1, Math.min(limit, 200))]
      )) || [];
    return rows.map((row: any) => ({
      id: row.id,
      section: row.section,
      eventType: row.event_type,
      source: row.source || 'results_runtime',
      actorUserId: row.actor_user_id || null,
      summary: row.summary || null,
      before: safeJson(row.before_json),
      after: safeJson(row.after_json),
      createdAt: row.created_at,
    }));
  }

  // ── V4-RSLT-06: Wallboard mode ──

  async createWallboard(
    orgId: string,
    userId: string,
    data: {
      name: string;
      layoutConfig?: Record<string, unknown>;
      kpiIds: string[];
      refreshIntervalSeconds?: number;
      autoRotationSeconds?: number;
      alertThresholds?: Record<string, unknown>;
    }
  ) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO kpi_wallboards (id, organization_id, name, layout_config, kpi_ids, refresh_interval_seconds, auto_rotation_seconds, alert_thresholds, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.name,
        JSON.stringify(data.layoutConfig || {}),
        JSON.stringify(data.kpiIds),
        data.refreshIntervalSeconds || 60,
        data.autoRotationSeconds || 30,
        JSON.stringify(data.alertThresholds || {}),
        userId,
        now,
        now,
      ]
    );
    return { id, name: data.name };
  }

  async getWallboards(orgId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_wallboards WHERE organization_id = ? AND is_active = 1 ORDER BY created_at DESC`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      layoutConfig: safeJson(r.layout_config),
      kpiIds: safeJsonArray(r.kpi_ids),
      refreshIntervalSeconds: r.refresh_interval_seconds,
      autoRotationSeconds: r.auto_rotation_seconds,
      alertThresholds: safeJson(r.alert_thresholds),
      isActive: !!r.is_active,
    }));
  }

  async getWallboard(orgId: string, wallboardId: string) {
    const r = await queryHelpers.queryOne<any>(
      `SELECT * FROM kpi_wallboards WHERE id = ? AND organization_id = ?`,
      [wallboardId, orgId]
    );
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      layoutConfig: safeJson(r.layout_config),
      kpiIds: safeJsonArray(r.kpi_ids),
      refreshIntervalSeconds: r.refresh_interval_seconds,
      autoRotationSeconds: r.auto_rotation_seconds,
      alertThresholds: safeJson(r.alert_thresholds),
    };
  }

  async createWallboardAlert(
    orgId: string,
    data: {
      wallboardId: string;
      kpiId: string;
      alertType?: string;
      thresholdValue: number;
      currentValue: number;
      severity?: string;
    }
  ) {
    // SEC-3: the wallboard must belong to the caller's org before an alert is pinned to it.
    // Otherwise a foreign-org wallboardId from the path would attach an alert that surfaces
    // in that org's wallboard feed. The route maps 'not found' → 404.
    const ownedWallboard = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM kpi_wallboards WHERE id = ? AND organization_id = ?`,
      [data.wallboardId, orgId]
    );
    if (!ownedWallboard?.id) {
      throw new Error('Wallboard not found');
    }
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO kpi_wallboard_alerts (id, organization_id, wallboard_id, kpi_id, alert_type, threshold_value, current_value, severity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.wallboardId,
        data.kpiId,
        data.alertType || 'threshold',
        data.thresholdValue,
        data.currentValue,
        data.severity || 'warning',
      ]
    );
    return { id };
  }

  async getWallboardAlerts(orgId: string, wallboardId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_wallboard_alerts WHERE organization_id = ? AND wallboard_id = ? ORDER BY created_at DESC`,
        [orgId, wallboardId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      kpiId: r.kpi_id,
      alertType: r.alert_type,
      thresholdValue: r.threshold_value,
      currentValue: r.current_value,
      severity: r.severity,
      acknowledgedBy: r.acknowledged_by,
      acknowledgedAt: r.acknowledged_at,
    }));
  }

  // SEC-3: org-scope an optional parent reference. A null/undefined id is a no-op (the
  // column is nullable); a non-null id that does not resolve under the caller's org throws
  // 'not found', which the route maps → 404. Mirrors assertModelOwned in financeEnterpriseService.
  private async assertParentOwned(
    orgId: string,
    table: 'initiatives' | 'benefits' | 'financial_models',
    id?: string | null
  ) {
    if (!id) return;
    const owned = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM ${table} WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!owned?.id) {
      throw new Error('Parent not found');
    }
  }

  private async getRawConnector(orgId: string, connectorId: string) {
    return queryHelpers.queryOne<any>(
      `SELECT * FROM kpi_connectors WHERE id = ? AND organization_id = ?`,
      [connectorId, orgId]
    );
  }

  private async getRawSchedule(orgId: string, scheduleId: string) {
    return queryHelpers.queryOne<any>(
      `SELECT * FROM kpi_report_schedules WHERE id = ? AND organization_id = ?`,
      [scheduleId, orgId]
    );
  }

  private async runDueConnectors(orgId?: string) {
    const params: unknown[] = [];
    const where = ['is_active = 1'];
    if (orgId) {
      where.push('organization_id = ?');
      params.push(orgId);
    }
    const connectors =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_connectors WHERE ${where.join(' AND ')} ORDER BY created_at ASC`,
        params
      )) || [];
    const now = new Date();
    const runs = [];
    for (const connector of connectors) {
      const nextRunAt = connector.next_run_at ? new Date(connector.next_run_at) : null;
      if (!connector.schedule_cron) continue;
      if (!nextRunAt) {
        await queryHelpers
          .queryRun(`UPDATE kpi_connectors SET next_run_at = ? WHERE id = ?`, [
            resolveNextRunAt({ scheduleCron: connector.schedule_cron }),
            connector.id,
          ])
          .catch(() => null);
        continue;
      }
      if (Number.isNaN(nextRunAt.getTime()) || nextRunAt > now) continue;
      runs.push(
        await this.executeConnector(
          connector.organization_id,
          connector,
          connector.created_by,
          'scheduled'
        )
      );
    }
    return runs;
  }

  private async runDueSchedules(orgId?: string) {
    const params: unknown[] = [];
    const where = [`status = 'active'`];
    if (orgId) {
      where.push('organization_id = ?');
      params.push(orgId);
    }
    const schedules =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM kpi_report_schedules WHERE ${where.join(' AND ')} ORDER BY created_at ASC`,
        params
      )) || [];
    const now = new Date();
    const runs = [];
    for (const schedule of schedules) {
      const nextRunAt = schedule.next_run_at ? new Date(schedule.next_run_at) : null;
      if (!schedule.schedule_cron && !schedule.send_at) continue;
      if (!nextRunAt) {
        await queryHelpers
          .queryRun(`UPDATE kpi_report_schedules SET next_run_at = ? WHERE id = ?`, [
            resolveNextRunAt({
              scheduleCron: schedule.schedule_cron,
              sendAt: schedule.send_at,
            }),
            schedule.id,
          ])
          .catch(() => null);
        continue;
      }
      if (Number.isNaN(nextRunAt.getTime()) || nextRunAt > now) continue;
      runs.push(
        await this.executeReportSchedule(
          schedule.organization_id,
          schedule,
          schedule.created_by || 'system',
          'scheduled'
        )
      );
    }
    return runs;
  }

  private async executeConnector(
    orgId: string,
    connector: any,
    actorUserId: string,
    trigger: 'scheduled' | 'manual_run'
  ) {
    const config = safeJson(connector.config);
    const defaultPeriod = new Date().toISOString().slice(0, 10);
    const payloads = normalizeConnectorPayloads(
      config,
      safeJsonArray(connector.target_kpi_ids).map((entry) => String(entry))
    );

    if (payloads.length === 0) {
      const nextRunAt = resolveNextRunAt({ scheduleCron: connector.schedule_cron || null });
      await queryHelpers.queryRun(
        `UPDATE kpi_connectors
         SET last_run_at = ?, last_run_status = ?, last_run_message = ?, next_run_at = ?
         WHERE id = ? AND organization_id = ?`,
        [
          new Date().toISOString(),
          'skipped',
          'No executable payload configured',
          nextRunAt,
          connector.id,
          orgId,
        ]
      );
      return { connectorId: connector.id, status: 'skipped', processed: 0 };
    }

    let processed = 0;
    for (const payload of payloads) {
      await this.recordConnectorMeasurement(orgId, {
        connectorId: connector.id,
        kpiId: payload.kpiId,
        value: payload.value,
        period: payload.period || defaultPeriod,
        provenance: {
          ...(payload.provenance || {}),
          trigger,
          connectorType: connector.connector_type,
        },
        qualityScore: payload.qualityScore,
        actorUserId,
        runSource: trigger,
      });
      processed += 1;
    }

    await queryHelpers.queryRun(
      `UPDATE kpi_connectors
       SET next_run_at = ?, last_run_at = ?, last_run_status = 'success', last_run_message = ?
       WHERE id = ? AND organization_id = ?`,
      [
        resolveNextRunAt({ scheduleCron: connector.schedule_cron || null }),
        new Date().toISOString(),
        `Processed ${processed} KPI payload${processed === 1 ? '' : 's'}`,
        connector.id,
        orgId,
      ]
    );
    return { connectorId: connector.id, status: 'success', processed };
  }

  private async executeReportSchedule(
    orgId: string,
    schedule: any,
    actorUserId: string,
    trigger: 'scheduled' | 'manual_run'
  ) {
    if (schedule.approval_required && schedule.approval_status !== 'approved') {
      await queryHelpers.queryRun(
        `UPDATE kpi_report_schedules
         SET last_run_status = ?, next_run_at = ?
         WHERE id = ? AND organization_id = ?`,
        [
          'awaiting_approval',
          resolveNextRunAt({ scheduleCron: schedule.schedule_cron, sendAt: schedule.send_at }),
          schedule.id,
          orgId,
        ]
      );
      return { scheduleId: schedule.id, status: 'awaiting_approval', deliveries: 0 };
    }

    const templateConfig = safeJson(schedule.template_config);
    const kpiIds = safeJsonArray(schedule.kpi_ids)
      .map((entry) => String(entry))
      .filter(Boolean);
    const periodEnd = new Date().toISOString().slice(0, 10);
    const lookbackDays = deriveLookbackDays(schedule.schedule_cron || null, templateConfig);
    const periodStart = addDays(periodEnd, -lookbackDays + 1);
    const title = `${schedule.report_name} — ${periodStart} → ${periodEnd}`;

    const created = await createKpiReportSnapshot({
      organizationId: orgId,
      periodStart,
      periodEnd,
      title,
      createdBy: actorUserId,
      filters:
        templateConfig.filters && typeof templateConfig.filters === 'object'
          ? (templateConfig.filters as Record<string, unknown>)
          : null,
      kpiIds: kpiIds.length ? kpiIds : null,
    });

    const report = await ReportBuilderService.createReport({
      organizationId: orgId,
      sourceType: 'RESULTS_KPI_REPORT',
      sourceId: created.snapshotId,
      sourceName: created.snapshot.title,
      title: created.snapshot.title,
      description: `KPI review for ${created.snapshot.periodStart}${created.snapshot.periodEnd ? ` → ${created.snapshot.periodEnd}` : ''}`,
      createdBy: actorUserId,
    });
    await Promise.all([
      ReportBuilderService.updateSectionContent(
        report.report.id,
        'executive_summary',
        created.markdown.executive_summary,
        actorUserId
      ),
      ReportBuilderService.updateSectionContent(
        report.report.id,
        'kpi_overview',
        created.markdown.kpi_overview,
        actorUserId
      ),
      ReportBuilderService.updateSectionContent(
        report.report.id,
        'deviation_cases',
        created.markdown.deviation_cases,
        actorUserId
      ),
      ReportBuilderService.updateSectionContent(
        report.report.id,
        'action_plan',
        created.markdown.action_plan,
        actorUserId
      ),
      ReportBuilderService.updateSectionContent(
        report.report.id,
        'appendix',
        created.markdown.appendix,
        actorUserId
      ),
      ReportBuilderService.updateReportStatus(report.report.id, 'GENERATED', actorUserId),
    ]);

    const recipientPolicy = safeJson(schedule.recipient_policy);
    const deliveries = normalizeRecipients(recipientPolicy).length
      ? normalizeRecipients(recipientPolicy)
      : [{ email: null, channel: String(recipientPolicy.channel || 'email') }];

    for (const delivery of deliveries) {
      await queryHelpers.queryRun(
        `INSERT INTO kpi_report_delivery_log
         (id, organization_id, schedule_id, recipient_email, channel, status, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          orgId,
          schedule.id,
          delivery.email,
          delivery.channel,
          'sent',
          new Date().toISOString(),
        ]
      );
    }

    const hasRecurringCron = !!String(schedule.schedule_cron || '').trim();
    await queryHelpers.queryRun(
      `UPDATE kpi_report_schedules
       SET last_sent_at = ?, last_run_status = ?, next_run_at = ?, status = ?
       WHERE id = ? AND organization_id = ?`,
      [
        new Date().toISOString(),
        'sent',
        hasRecurringCron
          ? resolveNextRunAt({ scheduleCron: schedule.schedule_cron, sendAt: schedule.send_at })
          : null,
        hasRecurringCron ? 'active' : 'completed',
        schedule.id,
        orgId,
      ]
    );

    return {
      scheduleId: schedule.id,
      status: 'sent',
      deliveries: deliveries.length,
      snapshotId: created.snapshotId,
      reportId: report.report.id,
      trigger,
    };
  }
}

function safeJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>);
  } catch {
    return {};
  }
}

/**
 * Secret-bearing keys inside a connector `config` blob. Mirrors SECRET_CONFIG_KEYS
 * in routes/mcp.routes.ts — these hold credentials that must never be returned to
 * the client over the wire (even to admins).
 */
const SECRET_CONNECTOR_CONFIG_KEYS = new Set([
  'mes_api_token',
  'marketplace_token',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'clientSecret',
  'client_secret',
  'password',
  'passphrase',
  'privateKey',
  'private_key',
  'connectionString',
  'connection_string',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
]);

const REDACTED_PLACEHOLDER = '__set__';

/**
 * Redact secret-bearing keys (and all auth-header values) within a connector config
 * for client-facing responses. Mirrors redactProviderConfig in routes/mcp.routes.ts:
 * a non-empty secret becomes the "__set__" placeholder so the UI can show
 * "configured" without exposing the value; non-secret config (baseUrl, staticPayloads,
 * defaultValue, …) passes through untouched.
 */
function redactConnectorConfig(val: unknown): Record<string, unknown> {
  const obj = safeJson(val);
  for (const key of Object.keys(obj)) {
    if (SECRET_CONNECTOR_CONFIG_KEYS.has(key) && obj[key]) {
      obj[key] = REDACTED_PLACEHOLDER;
    }
  }
  // Auth headers (e.g. Authorization: Bearer …) are secrets too.
  const headers = obj.headers;
  if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
    const h = headers as Record<string, unknown>;
    for (const hk of Object.keys(h)) {
      if (typeof h[hk] === 'string' && h[hk]) h[hk] = REDACTED_PLACEHOLDER;
    }
  }
  return obj;
}
function safeJsonArray(val: unknown): unknown[] {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as unknown[]);
  } catch {
    return [];
  }
}

function stringifyCompact(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

function addDays(dateIso: string, deltaDays: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function deriveLookbackDays(
  scheduleCron: string | null | undefined,
  templateConfig: Record<string, unknown>
): number {
  const explicit = Number(templateConfig.lookbackDays);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const cron = String(scheduleCron || '').trim();
  if (!cron) return 30;
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return 30;
  const [minute, hour, dom, mon] = parts;
  if (minute.startsWith('*/') || hour === '*') return 1;
  if (dom === '*' && mon === '*') return 7;
  if (dom !== '*' && mon === '*') return 30;
  return 90;
}

function resolveNextRunAt(input: {
  scheduleCron?: string | null;
  sendAt?: string | null;
}): string | null {
  const now = new Date();
  if (input.scheduleCron) {
    return calculateNextRunFromCron(input.scheduleCron, now)?.toISOString() || null;
  }
  if (input.sendAt) {
    return calculateNextRunFromSendAt(input.sendAt, now)?.toISOString() || null;
  }
  return null;
}

function calculateNextRunFromSendAt(sendAt: string, now: Date): Date | null {
  const raw = String(sendAt || '').trim();
  if (!raw) return null;
  const [hours, minutes] = raw.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function calculateNextRunFromCron(cron: string, now: Date): Date | null {
  const parts = String(cron || '')
    .trim()
    .split(/\s+/);
  if (parts.length !== 5) return null;
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);
  for (let i = 0; i < 525_600; i += 1) {
    if (
      matchesCronField(parts[0], candidate.getMinutes()) &&
      matchesCronField(parts[1], candidate.getHours()) &&
      matchesCronField(parts[2], candidate.getDate()) &&
      matchesCronField(parts[3], candidate.getMonth() + 1) &&
      matchesCronField(parts[4], candidate.getDay())
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null;
}

function matchesCronField(expr: string, value: number): boolean {
  if (expr === '*') return true;
  if (expr.startsWith('*/')) {
    const step = Number(expr.slice(2));
    return Number.isFinite(step) && step > 0 ? value % step === 0 : false;
  }
  if (expr.includes(',')) {
    return expr.split(',').some((part) => matchesCronField(part, value));
  }
  if (expr.includes('-')) {
    const [start, end] = expr.split('-').map(Number);
    return Number.isFinite(start) && Number.isFinite(end) && value >= start && value <= end;
  }
  return Number(expr) === value;
}

function normalizeConnectorPayloads(
  config: Record<string, unknown>,
  targetKpiIds: string[]
): Array<{
  kpiId: string;
  value: number;
  period?: string;
  provenance?: Record<string, unknown>;
  qualityScore?: number;
}> {
  const staticPayloads = Array.isArray(config.staticPayloads) ? config.staticPayloads : [];
  const normalizedStatic = staticPayloads
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as Record<string, unknown>;
      const kpiId = String(raw.kpiId || '').trim();
      const value = Number(raw.value);
      if (!kpiId || !Number.isFinite(value)) return null;
      return {
        kpiId,
        value,
        period: raw.period ? String(raw.period) : undefined,
        provenance:
          typeof raw.provenance === 'object'
            ? (raw.provenance as Record<string, unknown>)
            : undefined,
        qualityScore: raw.qualityScore != null ? Number(raw.qualityScore) : undefined,
      };
    })
    .filter(Boolean) as Array<{
    kpiId: string;
    value: number;
    period?: string;
    provenance?: Record<string, unknown>;
    qualityScore?: number;
  }>;
  if (normalizedStatic.length > 0) return normalizedStatic;

  const kpiValues =
    config.kpiValues && typeof config.kpiValues === 'object'
      ? (config.kpiValues as Record<string, unknown>)
      : null;
  if (kpiValues) {
    return Object.entries(kpiValues)
      .map(([kpiId, raw]) => {
        if (typeof raw === 'number') {
          return { kpiId, value: raw };
        }
        if (!raw || typeof raw !== 'object') return null;
        const entry = raw as Record<string, unknown>;
        const value = Number(entry.value);
        if (!Number.isFinite(value)) return null;
        return {
          kpiId,
          value,
          period: entry.period ? String(entry.period) : undefined,
          provenance:
            typeof entry.provenance === 'object'
              ? (entry.provenance as Record<string, unknown>)
              : undefined,
          qualityScore: entry.qualityScore != null ? Number(entry.qualityScore) : undefined,
        };
      })
      .filter(Boolean) as Array<{
      kpiId: string;
      value: number;
      period?: string;
      provenance?: Record<string, unknown>;
      qualityScore?: number;
    }>;
  }

  const defaultValue = Number(config.defaultValue);
  if (Number.isFinite(defaultValue) && targetKpiIds.length > 0) {
    return targetKpiIds.map((kpiId) => ({ kpiId, value: defaultValue }));
  }
  return [];
}

function normalizeRecipients(
  recipientPolicy: Record<string, unknown>
): Array<{ email: string | null; channel: string }> {
  const channel = String(recipientPolicy.channel || 'email');
  const rawRecipients = Array.isArray(recipientPolicy.recipients)
    ? recipientPolicy.recipients
    : Array.isArray(recipientPolicy.emails)
      ? recipientPolicy.emails
      : [];
  return rawRecipients
    .map((entry) => {
      if (typeof entry === 'string') return { email: entry, channel };
      if (entry && typeof entry === 'object') {
        const raw = entry as Record<string, unknown>;
        return {
          email: raw.email ? String(raw.email) : null,
          channel: raw.channel ? String(raw.channel) : channel,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ email: string | null; channel: string }>;
}

const resultsEnterpriseService = new ResultsEnterpriseService();
export default resultsEnterpriseService;
export { ResultsEnterpriseService, resultsEnterpriseService };
