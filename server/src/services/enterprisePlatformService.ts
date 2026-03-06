/**
 * Enterprise Platform Service
 *
 * V4-ENT-05: Integration hub (connector registry, queue/retry, secrets vaulting, allowlists)
 * V4-ENT-08: Observability (metrics, traces, SLOs, DR drills, security hardening)
 */

import { v4 as uuidv4 } from 'uuid';
import * as queryHelpers from '../utils/queryHelpers.js';

class EnterprisePlatformService {

  // ── V4-ENT-05: Integration Hub ──

  async createConnector(orgId: string, data: {
    connectorType: string; connectorName: string; configJson?: object;
    secretsRef?: string; allowlistDomains?: string[]; createdBy: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO integration_connectors (id, organization_id, connector_type, connector_name, config_json, secrets_ref, allowlist_domains, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, orgId, data.connectorType, data.connectorName,
       JSON.stringify(data.configJson ?? {}), data.secretsRef ?? null,
       JSON.stringify(data.allowlistDomains ?? []), data.createdBy],
    );
    return { id };
  }

  async getConnectors(orgId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM integration_connectors WHERE organization_id=$1 ORDER BY connector_name`,
      [orgId],
    );
  }

  async getConnector(orgId: string, connectorId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM integration_connectors WHERE id=$1 AND organization_id=$2`,
      [connectorId, orgId],
    );
  }

  async updateConnector(orgId: string, connectorId: string, data: Partial<{
    connectorName: string; configJson: object; status: string;
    allowlistDomains: string[];
  }>) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.connectorName !== undefined) { sets.push(`connector_name=$${idx++}`); params.push(data.connectorName); }
    if (data.configJson !== undefined) { sets.push(`config_json=$${idx++}`); params.push(JSON.stringify(data.configJson)); }
    if (data.status !== undefined) { sets.push(`status=$${idx++}`); params.push(data.status); }
    if (data.allowlistDomains !== undefined) { sets.push(`allowlist_domains=$${idx++}`); params.push(JSON.stringify(data.allowlistDomains)); }

    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(connectorId, orgId);
    await queryHelpers.queryRun(
      `UPDATE integration_connectors SET ${sets.join(', ')} WHERE id=$${idx++} AND organization_id=$${idx}`,
      params,
    );
    return { ok: true };
  }

  async deleteConnector(orgId: string, connectorId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM integration_connectors WHERE id=$1 AND organization_id=$2`,
      [connectorId, orgId],
    );
    return { deleted: true };
  }

  async healthCheckConnector(connectorId: string, healthStatus: string) {
    await queryHelpers.queryRun(
      `UPDATE integration_connectors SET health_status=$1, last_health_check_at=CURRENT_TIMESTAMP WHERE id=$2`,
      [healthStatus, connectorId],
    );
    return { ok: true };
  }

  async enqueueMessage(orgId: string, data: {
    connectorId: string; direction?: string; payloadJson: object;
    maxRetries?: number;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO integration_queue (id, connector_id, organization_id, direction, payload_json, max_retries)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, data.connectorId, orgId, data.direction ?? 'outbound',
       JSON.stringify(data.payloadJson), data.maxRetries ?? 3],
    );
    return { id };
  }

  async getQueueItems(orgId: string, status?: string) {
    const sql = status
      ? `SELECT * FROM integration_queue WHERE organization_id=$1 AND status=$2 ORDER BY created_at`
      : `SELECT * FROM integration_queue WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`;
    return queryHelpers.queryAll(sql, status ? [orgId, status] : [orgId]);
  }

  async processQueueItem(itemId: string, success: boolean, errorMessage?: string) {
    if (success) {
      await queryHelpers.queryRun(
        `UPDATE integration_queue SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [itemId],
      );
    } else {
      const item = await queryHelpers.queryFirst<{ retry_count: number; max_retries: number }>(
        `SELECT retry_count, max_retries FROM integration_queue WHERE id=$1`, [itemId],
      );
      if (item && item.retry_count < item.max_retries) {
        await queryHelpers.queryRun(
          `UPDATE integration_queue SET status='retry', retry_count=retry_count+1, error_message=$1,
           next_retry_at=datetime('now', '+' || (retry_count+1)*5 || ' minutes') WHERE id=$2`,
          [errorMessage ?? null, itemId],
        );
      } else {
        await queryHelpers.queryRun(
          `UPDATE integration_queue SET status='failed', error_message=$1 WHERE id=$2`,
          [errorMessage ?? null, itemId],
        );
      }
    }
    return { ok: true };
  }

  async storeSecret(orgId: string, data: {
    connectorId?: string; secretKey: string; encryptedValue: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO integration_secrets (id, organization_id, connector_id, secret_key, encrypted_value)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, connector_id, secret_key)
       DO UPDATE SET encrypted_value=$5, rotated_at=CURRENT_TIMESTAMP`,
      [id, orgId, data.connectorId ?? null, data.secretKey, data.encryptedValue],
    );
    return { id };
  }

  async getSecretKeys(orgId: string, connectorId?: string) {
    const sql = connectorId
      ? `SELECT id, secret_key, created_at, rotated_at FROM integration_secrets WHERE organization_id=$1 AND connector_id=$2`
      : `SELECT id, secret_key, created_at, rotated_at FROM integration_secrets WHERE organization_id=$1`;
    return queryHelpers.queryAll(sql, connectorId ? [orgId, connectorId] : [orgId]);
  }

  async deleteSecret(orgId: string, secretId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM integration_secrets WHERE id=$1 AND organization_id=$2`,
      [secretId, orgId],
    );
    return { deleted: true };
  }

  // ── V4-ENT-08: Observability ──

  async recordMetric(data: {
    organizationId?: string; metricName: string; metricType?: string;
    value: number; labels?: object;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO observability_metrics (id, organization_id, metric_name, metric_type, value, labels_json)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, data.organizationId ?? null, data.metricName,
       data.metricType ?? 'counter', data.value,
       data.labels ? JSON.stringify(data.labels) : '{}'],
    );
    return { id };
  }

  async getMetrics(metricName: string, since?: string) {
    const sql = since
      ? `SELECT * FROM observability_metrics WHERE metric_name=$1 AND recorded_at>=$2 ORDER BY recorded_at DESC LIMIT 1000`
      : `SELECT * FROM observability_metrics WHERE metric_name=$1 ORDER BY recorded_at DESC LIMIT 100`;
    return queryHelpers.queryAll(sql, since ? [metricName, since] : [metricName]);
  }

  async createSlo(data: {
    organizationId?: string; sloName: string; targetPercentage: number;
    windowDays?: number;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO observability_slos (id, organization_id, slo_name, target_percentage, window_days)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, data.organizationId ?? null, data.sloName,
       data.targetPercentage, data.windowDays ?? 30],
    );
    return { id };
  }

  async getSlos(orgId?: string) {
    const sql = orgId
      ? `SELECT * FROM observability_slos WHERE organization_id=$1 ORDER BY slo_name`
      : `SELECT * FROM observability_slos ORDER BY slo_name`;
    return queryHelpers.queryAll(sql, orgId ? [orgId] : []);
  }

  async updateSloStatus(sloId: string, currentPercentage: number, budgetRemaining: number) {
    await queryHelpers.queryRun(
      `UPDATE observability_slos SET current_percentage=$1, budget_remaining=$2, last_calculated_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
      [currentPercentage, budgetRemaining, sloId],
    );
    return { ok: true };
  }

  async recordTrace(data: {
    traceId: string; spanId: string; parentSpanId?: string;
    operationName: string; serviceName?: string; durationMs?: number;
    statusCode?: string; attributes?: object;
    startedAt?: string; endedAt?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO observability_traces (id, trace_id, span_id, parent_span_id, operation_name, service_name, duration_ms, status_code, attributes_json, started_at, ended_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, data.traceId, data.spanId, data.parentSpanId ?? null,
       data.operationName, data.serviceName ?? 'consultify-api',
       data.durationMs ?? null, data.statusCode ?? null,
       data.attributes ? JSON.stringify(data.attributes) : '{}',
       data.startedAt ?? null, data.endedAt ?? null],
    );
    return { id };
  }

  async getTrace(traceId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM observability_traces WHERE trace_id=$1 ORDER BY started_at`,
      [traceId],
    );
  }

  async createDrDrill(data: {
    organizationId?: string; drillType: string; scenario: string;
    conductedBy?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO observability_dr_drills (id, organization_id, drill_type, scenario, conducted_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, data.organizationId ?? null, data.drillType, data.scenario,
       data.conductedBy ?? null],
    );
    return { id };
  }

  async updateDrDrill(drillId: string, data: {
    status: string; resultsJson?: object;
  }) {
    const sets = [`status=$1`];
    const params: unknown[] = [data.status];
    if (data.status === 'in_progress') sets.push(`started_at=CURRENT_TIMESTAMP`);
    if (data.status === 'completed') sets.push(`completed_at=CURRENT_TIMESTAMP`);
    if (data.resultsJson) { sets.push(`results_json=$2`); params.push(JSON.stringify(data.resultsJson)); }
    params.push(drillId);
    await queryHelpers.queryRun(
      `UPDATE observability_dr_drills SET ${sets.join(', ')} WHERE id=$${params.length}`,
      params,
    );
    return { ok: true };
  }

  async getDrDrills(orgId?: string) {
    const sql = orgId
      ? `SELECT * FROM observability_dr_drills WHERE organization_id=$1 ORDER BY created_at DESC`
      : `SELECT * FROM observability_dr_drills ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, orgId ? [orgId] : []);
  }
}

export const enterprisePlatformService = new EnterprisePlatformService();
