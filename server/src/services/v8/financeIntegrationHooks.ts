/**
 * P05 Finance Integration Hooks
 *
 * Side-effects triggered after key Finance lane lifecycle events:
 * - Lane run completion (readback confirmed)
 * - Switchover finalization
 * - Degraded state detection
 *
 * Each hook is fire-and-forget (errors logged, never thrown to caller).
 */

import { v4 as uuidv4 } from 'uuid';

import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import notificationService from '../notificationService.js';

const LOG_PREFIX = '[V8:FinanceHooks]';

// ---------------------------------------------------------------------------
// ART-4: Register lane run as V8 artifact
// ---------------------------------------------------------------------------

export async function registerLaneRunArtifact(params: {
  runId: string;
  organizationId: string;
  actor: string;
  step: string;
}): Promise<void> {
  try {
    const { registerArtifactOrigin } = await import('./artifactRegistryService.js');
    await registerArtifactOrigin({
      organizationId: params.organizationId,
      outputType: 'sheet',
      artifactFamily: 'document',
      originRuntime: 'native_artifact',
      originRecordId: params.runId,
      titleSnapshot: `Finance Lane Run — ${params.step}`,
      ownerUserId: params.actor,
      createdBy: params.actor,
      deliveryState: params.step === 'readback' ? 'published' : 'draft',
      visibilityScope: 'organization',
    });
    logger.info(`${LOG_PREFIX} Registered lane run ${params.runId} as artifact`);
  } catch (err) {
    logger.warn(`${LOG_PREFIX} registerLaneRunArtifact failed (non-blocking)`, err);
  }
}

// ---------------------------------------------------------------------------
// CTX-2: Capture context snapshot after readback confirmed
// ---------------------------------------------------------------------------

export async function captureFinanceContextSnapshot(params: {
  runId: string;
  organizationId: string;
  actor: string;
  snapshotId?: string;
}): Promise<void> {
  try {
    const { captureSnapshot } = await import('./contextSnapshotService.js');
    const artifactRefs = [
      {
        artifactId: params.runId,
        artifactType: 'finance_lane_run',
        artifactModule: 'finance',
        relationship: 'produced' as any,
      },
    ];
    if (params.snapshotId) {
      artifactRefs.push({
        artifactId: params.snapshotId,
        artifactType: 'finance_version_snapshot',
        artifactModule: 'finance',
        relationship: 'produced' as any,
      });
    }
    await captureSnapshot({
      workspaceId: params.organizationId,
      organizationId: params.organizationId,
      artifactRefs,
      effectiveScopeRef: `finance:lane_run:${params.runId}`,
      resolvedRoleRef: 'finance_operator',
      initiatorUserId: params.actor,
      consumerClass: 'execution',
      privacyMode: false,
      sourceContextRefs: [],
    });
    logger.info(`${LOG_PREFIX} Captured context snapshot for run ${params.runId}`);
  } catch (err) {
    logger.warn(`${LOG_PREFIX} captureFinanceContextSnapshot failed (non-blocking)`, err);
  }
}

// ---------------------------------------------------------------------------
// WF-1: Emit KPI signal after readback confirmed
// ---------------------------------------------------------------------------

export async function emitFinanceCycleSignal(params: {
  runId: string;
  organizationId: string;
  actor: string;
}): Promise<void> {
  try {
    const { createKpiSignal } = await import('./resultsROIService.js');
    await createKpiSignal({
      organizationId: params.organizationId,
      kpiId: `finance_lane_${params.runId}`,
      signalType: 'reconciliation_needed',
      severity: 'low',
      description: `Finance lane run ${params.runId} completed (readback confirmed). Review KPI-Finance reconciliation.`,
      evidencePointers: [`finance_lane_run:${params.runId}`],
    });
    logger.info(`${LOG_PREFIX} Emitted finance_cycle KPI signal for run ${params.runId}`);
  } catch (err) {
    logger.warn(`${LOG_PREFIX} emitFinanceCycleSignal failed (non-blocking)`, err);
  }
}

// ---------------------------------------------------------------------------
// WF-2: Upsert Finance lane issues into canonical inbox
// ---------------------------------------------------------------------------

export async function upsertFinanceInboxItems(params: {
  runId: string;
  organizationId: string;
  actor: string;
  degradedCount: number;
  currentStep: string;
}): Promise<void> {
  try {
    const title =
      params.degradedCount > 0
        ? `Finance lane: ${params.degradedCount} degraded issue(s) at ${params.currentStep}`
        : `Finance lane active — step: ${params.currentStep}`;

    await notificationService.send({
      userId: params.actor,
      organizationId: params.organizationId,
      type: 'FINANCE_LANE_REVIEW',
      title,
      body: `Lane run ${params.runId} at step ${params.currentStep}`,
      priority: params.degradedCount > 0 ? 'high' : 'normal',
      entityType: 'finance_lane_run',
      entityId: params.runId,
      isActionable: true,
      dedupeKey: `finance-lane:${params.runId}`,
    });
    logger.info(`${LOG_PREFIX} Sent finance inbox notification for run ${params.runId}`);
  } catch (err) {
    logger.warn(`${LOG_PREFIX} upsertFinanceInboxItems failed (non-blocking)`, err);
  }
}

// ---------------------------------------------------------------------------
// WF-3: Create decision record on switchover finalization
// ---------------------------------------------------------------------------

export async function recordSwitchoverDecision(params: {
  snapshotId: string;
  organizationId: string;
  actor: string;
  versionType: string;
}): Promise<void> {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO decisions (id, organization_id, title, description, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'approved', ?, ?, ?)`,
      [
        id,
        params.organizationId,
        `Finance switchover: ${params.versionType} version finalized`,
        `Version snapshot ${params.snapshotId} promoted to ${params.versionType} (finalized by ${params.actor})`,
        params.actor,
        now,
        now,
      ]
    );
    logger.info(
      `${LOG_PREFIX} Recorded switchover decision ${id} for snapshot ${params.snapshotId}`
    );
  } catch (err) {
    logger.warn(`${LOG_PREFIX} recordSwitchoverDecision failed (non-blocking)`, err);
  }
}

// ---------------------------------------------------------------------------
// WF-4: Push degraded states to radar triage
// ---------------------------------------------------------------------------

export async function pushDegradedToRadar(params: {
  runId: string;
  organizationId: string;
  degradedReasons: string[];
}): Promise<void> {
  try {
    const { createTriageSignal } = await import('./radarTriageService.js');
    for (const reason of params.degradedReasons) {
      await createTriageSignal({
        organizationId: params.organizationId,
        category: 'finance_kpi',
        bands: { urgency: 2, impact: 2, confidence: 2 } as any,
        whyNow: {
          primaryDriver: 'variance' as const,
          timeWindow: 'this_week' as const,
          rationaleText: `Finance lane run ${params.runId} degraded: ${reason}`,
        },
        evidence: {
          sources: [`finance_lane_run:${params.runId}`],
          dataPoints: [{ label: 'degraded_reason', value: reason }],
        } as any,
        handoffPayload: { runId: params.runId, reason },
      });
    }
    logger.info(`${LOG_PREFIX} Pushed ${params.degradedReasons.length} degraded item(s) to radar`);
  } catch (err) {
    logger.warn(`${LOG_PREFIX} pushDegradedToRadar failed (non-blocking)`, err);
  }
}

// ---------------------------------------------------------------------------
// ART-3: Send Finance event notifications
// ---------------------------------------------------------------------------

export async function sendFinanceNotification(params: {
  organizationId: string;
  actor: string;
  event: 'lane_completed' | 'switchover_finalized' | 'reconciliation_mismatch' | 'degraded';
  detail?: string;
}): Promise<void> {
  try {
    const NotificationService = (await import('../notificationService.js')).default;
    const eventTitles: Record<string, string> = {
      lane_completed: 'Finance lane completed',
      switchover_finalized: 'Finance version switchover finalized',
      reconciliation_mismatch: 'Finance KPI reconciliation mismatch detected',
      degraded: 'Finance lane degraded state detected',
    };
    await NotificationService.send({
      userId: params.actor,
      organizationId: params.organizationId,
      type: `finance.${params.event}`,
      title: eventTitles[params.event] || 'Finance event',
      body: params.detail || eventTitles[params.event] || '',
      message: params.detail || eventTitles[params.event] || '',
      severity: params.event === 'reconciliation_mismatch' ? 'WARNING' : 'INFO',
      isActionable: params.event !== 'lane_completed',
      actionUrl: '/finance',
    });
    logger.info(`${LOG_PREFIX} Sent ${params.event} notification`);
  } catch (err) {
    logger.warn(`${LOG_PREFIX} sendFinanceNotification failed (non-blocking)`, err);
  }
}
