import { randomUUID } from 'node:crypto';

import { SIGNAL_SEVERITY_RANK, type SignalSeverity } from '../../types/executionVisibility.js';
import type { RuleHit, SignalQuery, SignalRule, WorkSignalRow } from '../../types/workSignals.js';
import { sendSystemAlert } from '../systemAlertNotifier.js';
import { validateRuleRegistry } from './ruleRegistry.js';

export interface SignalRunError {
  ruleId: string;
  message: string;
  at: string;
}

export interface SignalRunResult {
  runId: string;
  status: 'OK' | 'PARTIAL' | 'FAILED';
  rulesEvaluated: number;
  signalsOpened: number;
  signalsUpdated: number;
  signalsResolved: number;
  errors: SignalRunError[];
}

const severityFor = (rule: SignalRule, hit: RuleHit): SignalSeverity =>
  typeof rule.severity === 'function' ? rule.severity(hit) : rule.severity;

export async function evaluateSignalRules(params: {
  db: SignalQuery;
  organizationId: string;
  rules: readonly SignalRule[];
  trigger?: 'CRON' | 'ON_DEMAND' | 'BACKFILL';
  now?: Date;
}): Promise<SignalRunResult> {
  const { db, organizationId } = params;
  const rules = validateRuleRegistry(params.rules);
  const now = params.now ?? new Date();
  const started = Date.now();
  const runId = randomUUID();
  const errors: SignalRunError[] = [];
  let signalsOpened = 0;
  let signalsUpdated = 0;
  let signalsResolved = 0;

  await db.query(
    `INSERT INTO work_signal_runs
       (run_id, organization_id, kind, trigger, started_at, status)
     VALUES (?, ?, 'DETERMINISTIC', ?, ?, 'RUNNING')`,
    [runId, organizationId, params.trigger ?? 'ON_DEMAND', now.toISOString()]
  );

  try {
    const openRows = await db.query<WorkSignalRow>(
      `SELECT * FROM work_signals WHERE organization_id = ? AND status = 'OPEN'`,
      [organizationId]
    );
    const openByRule = new Map<string, WorkSignalRow[]>();
    for (const row of openRows) {
      const rows = openByRule.get(row.rule_id) ?? [];
      rows.push(row);
      openByRule.set(row.rule_id, rows);
    }

    for (const rule of rules) {
      let hits: RuleHit[];
      try {
        hits = await rule.evaluate({ organizationId, db, now });
      } catch (error) {
        errors.push({
          ruleId: rule.ruleId,
          message: error instanceof Error ? error.message : String(error),
          at: new Date().toISOString(),
        });
        continue;
      }

      const selectedHits = [...hits]
        .sort((a, b) => {
          const severityDelta =
            SIGNAL_SEVERITY_RANK[severityFor(rule, b)] - SIGNAL_SEVERITY_RANK[severityFor(rule, a)];
          return severityDelta || a.subjectId.localeCompare(b.subjectId);
        })
        .slice(0, rule.maxPerRunPerOrg);
      const hitByKey = new Map(selectedHits.map((hit) => [rule.dedupeKey(hit), hit]));
      const existingForRule = openByRule.get(rule.ruleId) ?? [];

      for (const existing of existingForRule) {
        const hit = hitByKey.get(existing.dedupe_key);
        if (!hit) {
          await db.query(
            `UPDATE work_signals
                SET status = 'RESOLVED', resolved_reason = 'CONDITION_CLEARED',
                    resolved_at = ?, updated_at = ?
              WHERE organization_id = ? AND signal_id = ? AND status = 'OPEN'`,
            [now.toISOString(), now.toISOString(), organizationId, existing.signal_id]
          );
          signalsResolved += 1;
          continue;
        }
        if (existing.rule_version !== rule.ruleVersion) {
          await db.query(
            `UPDATE work_signals
                SET status = 'SUPERSEDED', resolved_reason = 'SUPERSEDED',
                    resolved_at = ?, updated_at = ?
              WHERE organization_id = ? AND signal_id = ? AND status = 'OPEN'`,
            [now.toISOString(), now.toISOString(), organizationId, existing.signal_id]
          );
          signalsResolved += 1;
          continue;
        }
        await db.query(
          `UPDATE work_signals
              SET last_observed_at = ?, severity = ?, evidence = ?::jsonb,
                  action = ?::jsonb, audience_user_id = ?, audience_role = ?,
                  title_params = ?::jsonb, body_params = ?::jsonb, run_id = ?, updated_at = ?
            WHERE organization_id = ? AND signal_id = ? AND status = 'OPEN'`,
          [
            now.toISOString(),
            severityFor(rule, hit),
            JSON.stringify(rule.evidence(hit)),
            JSON.stringify(rule.action(hit)),
            rule.audience(hit).userId,
            rule.audience(hit).role?.toUpperCase() ?? null,
            JSON.stringify(hit.titleParams ?? {}),
            JSON.stringify(hit.bodyParams ?? {}),
            runId,
            now.toISOString(),
            organizationId,
            existing.signal_id,
          ]
        );
        hitByKey.delete(existing.dedupe_key);
        signalsUpdated += 1;
      }

      for (const [dedupeKey, hit] of hitByKey) {
        const audience = rule.audience(hit);
        await db.query(
          `INSERT INTO work_signals
             (signal_id, organization_id, dedupe_key, domain, signal_type, origin,
              severity, subject_type, subject_id, project_id, audience_user_id,
              audience_role, title_key, title_params, body_key, body_params,
              evidence, action, rule_id, rule_version, expires_at, run_id,
              first_observed_at, last_observed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'DETERMINISTIC', ?, ?, ?, ?, ?, ?, ?, ?::jsonb,
                   ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            organizationId,
            dedupeKey,
            rule.domain,
            rule.signalType,
            severityFor(rule, hit),
            rule.subjectType,
            hit.subjectId,
            hit.projectId ?? null,
            audience.userId,
            audience.role?.toUpperCase() ?? null,
            rule.titleKey,
            JSON.stringify(hit.titleParams ?? {}),
            rule.bodyKey ?? null,
            JSON.stringify(hit.bodyParams ?? {}),
            JSON.stringify(rule.evidence(hit)),
            JSON.stringify(rule.action(hit)),
            rule.ruleId,
            rule.ruleVersion,
            rule.ttlHours
              ? new Date(now.getTime() + rule.ttlHours * 3_600_000).toISOString()
              : null,
            runId,
            now.toISOString(),
            now.toISOString(),
            now.toISOString(),
            now.toISOString(),
          ]
        );
        signalsOpened += 1;
      }
    }

    const status = errors.length ? 'PARTIAL' : 'OK';
    await db.query(
      `UPDATE work_signal_runs
          SET finished_at = ?, status = ?, rules_evaluated = ?, signals_opened = ?,
              signals_updated = ?, signals_resolved = ?, errors = ?::jsonb, duration_ms = ?
        WHERE organization_id = ? AND run_id = ?`,
      [
        new Date().toISOString(),
        status,
        rules.length,
        signalsOpened,
        signalsUpdated,
        signalsResolved,
        JSON.stringify(errors),
        Math.max(1, Date.now() - started),
        organizationId,
        runId,
      ]
    );
    return {
      runId,
      status,
      rulesEvaluated: rules.length,
      signalsOpened,
      signalsUpdated,
      signalsResolved,
      errors,
    };
  } catch (error) {
    const globalError = {
      ruleId: '__GLOBAL__',
      message: error instanceof Error ? error.message : String(error),
      at: new Date().toISOString(),
    };
    errors.push(globalError);
    await db.query(
      `UPDATE work_signal_runs
          SET finished_at = ?, status = 'FAILED', errors = ?::jsonb, duration_ms = ?
        WHERE organization_id = ? AND run_id = ?`,
      [
        new Date().toISOString(),
        JSON.stringify(errors),
        Math.max(1, Date.now() - started),
        organizationId,
        runId,
      ]
    );
    await sendSystemAlert({
      title: 'Work signal producer failed',
      message: `${organizationId}: ${globalError.message}`,
      severity: 'CRITICAL',
      source: 'WORK_SIGNALS',
      throttleKey: `work-signals:${organizationId}`,
      throttleMs: 300_000,
    });
    return {
      runId,
      status: 'FAILED',
      rulesEvaluated: 0,
      signalsOpened,
      signalsUpdated,
      signalsResolved,
      errors,
    };
  }
}
