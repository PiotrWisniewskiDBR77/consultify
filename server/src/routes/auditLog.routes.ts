/**
 * Audit Log Routes
 * API endpoints for viewing audit trail
 */
import { Request, Response, Router } from 'express';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { validateOrgMembership, verifyToken } from '../middleware/auth.middleware.js';
import contextDocumentService from '../services/organizationContext/ContextDocumentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeLimit(raw: unknown, fallback = 50, max = 200): number {
  return Math.min(Math.max(parseInt(String(raw || fallback), 10) || fallback, 1), max);
}

async function recordAdminAuditEvent(params: {
  organizationId: string;
  userId: string | null;
  actionType: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  req: Request;
}): Promise<string | null> {
  const auditEventId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await dbRun(
      `INSERT INTO audit_log
       (id, organization_id, user_id, action_type, resource_type, resource_id, details,
        ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditEventId,
        params.organizationId,
        params.userId,
        params.actionType,
        params.resourceType,
        params.resourceId,
        JSON.stringify(params.details),
        params.req.ip || null,
        params.req.get('user-agent') || null,
        new Date().toISOString(),
      ],
      { fallback: true } as any
    );
    return auditEventId;
  } catch {
    // Best-effort only. The operation response remains honest through its own result payload.
    return null;
  }
}

router.get(
  '/organization-context/lineage',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const targetId = typeof req.query.targetId === 'string' ? req.query.targetId.trim() : '';
    const targetType = typeof req.query.targetType === 'string' ? req.query.targetType.trim() : '';
    const workflow = typeof req.query.workflow === 'string' ? req.query.workflow.trim() : '';
    const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim() : '';
    const where = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    if (targetType) {
      where.push('target_type = ?');
      params.push(targetType);
    }
    if (targetId) {
      where.push('target_id = ?');
      params.push(targetId);
    }
    if (workflow) {
      where.push('workflow = ?');
      params.push(workflow);
    }
    if (eventType) {
      where.push('event_type = ?');
      params.push(eventType);
    }
    params.push(limit);

    const rows = await dbAll(
      `SELECT id, user_id, target_type, target_id, workflow, event_type,
              requested_document_ids_json, selected_document_ids_json, used_chunks_json,
              degraded, degraded_reasons_json, metadata_json, created_at
       FROM organization_context_lineage_events
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
      params,
      { fallback: true } as any
    );

    return res.json({
      data: (rows || []).map((row: any) => ({
        id: String(row.id || ''),
        userId: row.user_id ? String(row.user_id) : null,
        targetType: String(row.target_type || ''),
        targetId: String(row.target_id || ''),
        workflow: String(row.workflow || ''),
        eventType: String(row.event_type || ''),
        requestedDocumentIds: parseJsonArray(row.requested_document_ids_json).map(String),
        selectedDocumentIds: parseJsonArray(row.selected_document_ids_json).map(String),
        usedChunks: parseJsonArray(row.used_chunks_json),
        degraded: Boolean(Number(row.degraded || 0)),
        degradedReasons: parseJsonArray(row.degraded_reasons_json).map(String),
        metadata: parseJsonObject(row.metadata_json),
        createdAt: String(row.created_at || ''),
      })),
      meta: {
        contract: 'organization_context_lineage_audit_read_v1',
        limit,
        filters: {
          targetType: targetType || null,
          targetId: targetId || null,
          workflow: workflow || null,
          eventType: eventType || null,
        },
      },
    });
  })
);

router.get(
  '/organization-context/storage-events',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const documentId = typeof req.query.documentId === 'string' ? req.query.documentId.trim() : '';
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId.trim() : '';
    const where = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    if (documentId) {
      where.push('document_id = ?');
      params.push(documentId);
    }
    if (projectId) {
      where.push('project_id = ?');
      params.push(projectId);
    }
    params.push(limit);

    const rows = await dbAll(
      `SELECT id, user_id, document_id, project_id, scope, bytes_delta, event_type,
              source_upload, metadata_json, created_at
       FROM organization_context_storage_events
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
      params,
      { fallback: true } as any
    );

    return res.json({
      data: (rows || []).map((row: any) => ({
        id: String(row.id || ''),
        userId: row.user_id ? String(row.user_id) : null,
        documentId: String(row.document_id || ''),
        projectId: row.project_id ? String(row.project_id) : null,
        scope: String(row.scope || ''),
        bytesDelta: Number(row.bytes_delta || 0),
        eventType: String(row.event_type || ''),
        sourceUpload: row.source_upload ? String(row.source_upload) : null,
        metadata: parseJsonObject(row.metadata_json),
        createdAt: String(row.created_at || ''),
      })),
      meta: {
        contract: 'organization_context_storage_audit_read_v1',
        limit,
      },
    });
  })
);

router.get(
  '/organization-context/processing-jobs/summary',
  verifyToken,
  validateOrgMembership,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const summary = await contextDocumentService.getContextProcessingQueueSummary({
      organizationId: orgId,
    });
    return res.json({
      data: summary,
      meta: {
        contract: 'organization_context_processing_queue_summary_v1',
      },
    });
  })
);

router.get(
  '/organization-context/processing-jobs',
  verifyToken,
  validateOrgMembership,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = safeLimit(req.query.limit, 50, 200);
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const documentId = typeof req.query.documentId === 'string' ? req.query.documentId.trim() : '';
    const where = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (documentId) {
      where.push('document_id = ?');
      params.push(documentId);
    }
    params.push(limit);

    const rows = await dbAll(
      `SELECT id, user_id, document_id, project_id, scope, pipeline_type, status,
              attempt_count, processor_version, source_upload, error_code,
              error_message_safe, metadata_json, locked_at, locked_by, started_at,
              finished_at, created_at, updated_at
       FROM organization_context_processing_jobs
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
      params,
      { fallback: true } as any
    );

    return res.json({
      data: (rows || []).map((row: any) => ({
        id: String(row.id || ''),
        userId: row.user_id ? String(row.user_id) : null,
        documentId: String(row.document_id || ''),
        projectId: row.project_id ? String(row.project_id) : null,
        scope: String(row.scope || ''),
        pipelineType: String(row.pipeline_type || ''),
        status: String(row.status || ''),
        attemptCount: Number(row.attempt_count || 0),
        processorVersion: row.processor_version ? String(row.processor_version) : null,
        sourceUpload: row.source_upload ? String(row.source_upload) : null,
        errorCode: row.error_code ? String(row.error_code) : null,
        errorMessageSafe: row.error_message_safe ? String(row.error_message_safe) : null,
        metadata: parseJsonObject(row.metadata_json),
        lockedAt: row.locked_at ? String(row.locked_at) : null,
        lockedBy: row.locked_by ? String(row.locked_by) : null,
        startedAt: row.started_at ? String(row.started_at) : null,
        finishedAt: row.finished_at ? String(row.finished_at) : null,
        createdAt: String(row.created_at || ''),
        updatedAt: row.updated_at ? String(row.updated_at) : null,
      })),
      meta: {
        contract: 'organization_context_processing_jobs_read_v1',
        limit,
      },
    });
  })
);

router.post(
  '/organization-context/processing-jobs/recover-stale-locks',
  verifyToken,
  validateOrgMembership,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const confirmation = String((req.body as any)?.confirmation || '').trim();
    if (confirmation !== 'recover_context_stale_locks') {
      return res.status(400).json({
        code: 'CONFIRMATION_REQUIRED',
        message:
          'Recovering stale context locks is an explicit admin action. Send confirmation=recover_context_stale_locks.',
      });
    }

    const result = await contextDocumentService.recoverStaleContextProcessingLocksForAdmin({
      organizationId: orgId,
      staleLockMs: Number((req.body as any)?.staleLockMs || 15 * 60 * 1000),
    });
    await recordAdminAuditEvent({
      organizationId: orgId,
      userId: req.user?.id || null,
      actionType: 'organization_context.stale_locks_recovered',
      resourceType: 'organization_context_processing_jobs',
      resourceId: 'stale-locks',
      details: { confirmation, result },
      req,
    });

    return res.json({
      data: result,
      meta: {
        contract: 'organization_context_stale_locks_recovery_v1',
        explicitAction: true,
        confirmation,
      },
    });
  })
);

router.post(
  '/organization-context/processing-jobs/:jobId/requeue',
  verifyToken,
  validateOrgMembership,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const jobId = String(req.params.jobId || '').trim();
    const confirmation = String((req.body as any)?.confirmation || '').trim();
    if (!jobId) return res.status(400).json({ code: 'JOB_ID_REQUIRED' });
    if (confirmation !== 'requeue_context_processing_job') {
      return res.status(400).json({
        code: 'CONFIRMATION_REQUIRED',
        message:
          'Requeueing a dead-letter context job is an explicit admin action. Send confirmation=requeue_context_processing_job.',
      });
    }

    const result = await contextDocumentService.requeueDeadLetterContextProcessingJob({
      organizationId: orgId,
      jobId,
      userId: req.user?.id || null,
    });
    if (!result.requeued) {
      return res.status(result.reason === 'job_not_found' ? 404 : 409).json({
        code: String(result.reason || 'requeue_rejected').toUpperCase(),
        data: result,
      });
    }

    await recordAdminAuditEvent({
      organizationId: orgId,
      userId: req.user?.id || null,
      actionType: 'organization_context.processing_job_requeued',
      resourceType: 'organization_context_processing_job',
      resourceId: jobId,
      details: { confirmation, result },
      req,
    });

    return res.json({
      data: result,
      meta: {
        contract: 'organization_context_processing_job_requeue_v1',
        explicitAction: true,
        confirmation,
      },
    });
  })
);

router.post(
  '/organization-context/processing-jobs/run-worker',
  verifyToken,
  validateOrgMembership,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const confirmation = String((req.body as any)?.confirmation || '').trim();
    if (confirmation !== 'run_context_worker_once') {
      return res.status(400).json({
        code: 'CONFIRMATION_REQUIRED',
        message:
          'Running the organization context worker is an explicit admin action. Send confirmation=run_context_worker_once.',
      });
    }

    const limit = Math.min(Math.max(Number((req.body as any)?.limit || 5), 1), 25);
    const runId = `context-worker-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await contextDocumentService.processQueuedContextDocumentJobs({
      limit,
      recoverStaleLocks: true,
      organizationId: orgId,
    });
    const auditEventId = await recordAdminAuditEvent({
      organizationId: orgId,
      userId: req.user?.id || null,
      actionType: 'organization_context.worker_run_requested',
      resourceType: 'organization_context_processing_jobs',
      resourceId: runId,
      details: { confirmation, limit, runId, result },
      req,
    });

    return res.json({
      data: {
        ...result,
        runId,
        auditEventId,
        auditRecorded: Boolean(auditEventId),
      },
      meta: {
        contract: 'organization_context_worker_run_v1',
        explicitAction: true,
        confirmation,
        runId,
        auditEventId,
      },
    });
  })
);

router.get(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { page = '1', limit = '50', action, userId, resource, from, to } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let where = 'WHERE al.organization_id = ?';
    const params: any[] = [orgId];
    if (action) {
      where += ' AND al.action_type = ?';
      params.push(action);
    }
    if (userId) {
      where += ' AND al.user_id = ?';
      params.push(userId);
    }
    if (resource) {
      where += ' AND al.resource_type = ?';
      params.push(resource);
    }
    if (from) {
      where += ' AND al.created_at >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND al.created_at <= ?';
      params.push(to);
    }

    params.push(parseInt(limit as string), offset);

    const logs = await dbAll(
      `
    SELECT al.id, al.action_type, al.resource_type, al.resource_id, al.details,
           al.ip_address, al.user_agent, al.created_at,
           u.first_name, u.last_name, u.email
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `,
      params
    );

    const countResult = await dbGet<{ count: number }>(
      `
    SELECT COUNT(*) as count FROM audit_log al ${where}
  `,
      params.slice(0, -2)
    );

    res.json({
      data: logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: Number(countResult?.count ?? 0),
        totalPages: Math.ceil(Number(countResult?.count ?? 0) / parseInt(limit as string)),
      },
    });
  })
);

router.get(
  '/actions',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const actions = await dbAll(
      `
    SELECT DISTINCT action_type, COUNT(*) as count
    FROM audit_log WHERE organization_id = ?
    GROUP BY action_type ORDER BY count DESC
  `,
      [orgId]
    );
    res.json((actions || []).map((r: any) => ({ ...r, count: Number(r.count ?? 0) })));
  })
);

router.get(
  '/export',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { from, to, format = 'json' } = req.query;

    let where = 'WHERE organization_id = ?';
    const params: any[] = [orgId];
    if (from) {
      where += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND created_at <= ?';
      params.push(to);
    }

    const logs = await dbAll(
      `
    SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT 10000
  `,
      params
    );

    if (format === 'csv') {
      const header = 'id,action_type,resource_type,resource_id,user_id,ip_address,created_at\n';
      const rows = logs
        .map(
          (l: any) =>
            `${l.id},${l.action_type},${l.resource_type},${l.resource_id},${l.user_id},${l.ip_address},${l.created_at}`
        )
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
      return res.send(header + rows);
    }

    res.json(logs);
  })
);

router.get(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const log = await dbGet(
      `
    SELECT al.*, u.first_name, u.last_name, u.email
    FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
    WHERE al.id = ? AND al.organization_id = ?
  `,
      [id, orgId]
    );
    if (!log) return res.status(404).json({ error: 'Audit log entry not found' });
    res.json(log);
  })
);

export default router;
