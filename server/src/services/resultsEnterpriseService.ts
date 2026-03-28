/**
 * Results Enterprise Service (V4-RSLT-02, 04, 05, 06)
 *
 * V4-RSLT-02: KPI connectors (ingestion pipeline, scheduled refresh, provenance)
 * V4-RSLT-04: ROI evidence (realized values, provenance assumptions, finance linkage)
 * V4-RSLT-05: Scheduled KPI reporting (templates, approval gates, distribution)
 * V4-RSLT-06: Wallboard mode (real-time refresh, alert banners, auto-rotation)
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

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
    await queryHelpers.queryRun(
      `INSERT INTO kpi_connectors (id, organization_id, connector_name, connector_type, config, target_kpi_ids, schedule_cron, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.connectorName,
        data.connectorType || 'api',
        JSON.stringify(data.config),
        JSON.stringify(data.targetKpiIds || []),
        data.scheduleCron || null,
        userId,
      ]
    );
    return { id, connectorName: data.connectorName, status: 'never' };
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
      config: safeJson(r.config),
      targetKpiIds: safeJsonArray(r.target_kpi_ids),
      scheduleCron: r.schedule_cron,
      lastRunAt: r.last_run_at,
      lastRunStatus: r.last_run_status,
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
    const id = uuidv4();
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
    await queryHelpers.queryRun(
      `UPDATE kpi_connectors SET last_run_at = ?, last_run_status = 'success' WHERE id = ? AND organization_id = ?`,
      [new Date().toISOString(), data.connectorId, orgId]
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
    await queryHelpers.queryRun(
      `INSERT INTO kpi_report_schedules (id, organization_id, report_name, template_config, kpi_ids, schedule_cron, send_at, recipient_policy, approval_required, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        userId,
      ]
    );
    return { id, status: 'active' };
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
}

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

const resultsEnterpriseService = new ResultsEnterpriseService();
export default resultsEnterpriseService;
export { ResultsEnterpriseService, resultsEnterpriseService };
