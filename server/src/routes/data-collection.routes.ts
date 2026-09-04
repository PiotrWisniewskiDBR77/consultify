/**
 * Data Collection API Routes
 * Connector CRUD, test, run, auto-map, run history, and webhook receive
 */

import { Request as ExpressRequest, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { featureFlags } from '../config/FeatureFlags.js';
import { getDatabase } from '../database/Database.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import logger from '../utils/Logger.js';

const router = Router();
type Request = ExpressRequest<Record<string, string>>;

function requireTablePlatform(req: Request, res: Response, next: () => void) {
  if (!featureFlags.ENABLE_TABLE_PLATFORM_RECORDS_API) {
    return res.status(404).json({ error: 'Table platform is not enabled' });
  }
  next();
}

function getOrganizationId(req: Request): string | null {
  return (req as AuthRequest).organizationId || null;
}

// ==========================================
// WEBHOOK RECEIVE (no auth middleware — uses shared secret)
// ==========================================

router.post('/webhook/:connectorId/receive', async (req: Request, res: Response) => {
  try {
    const { connectorId } = req.params;
    const db = getDatabase();

    const connResult = await db.query(
      `SELECT id, config FROM tp_connectors WHERE id = $1 AND connector_type = 'webhook'`,
      [connectorId]
    );
    const connector = connResult.rows[0] as
      | { id: string; config: Record<string, unknown> }
      | undefined;
    if (!connector) {
      return res.status(404).json({ error: 'Webhook connector not found' });
    }

    const credentials = connector.config.credentials as Record<string, unknown> | undefined;
    const expectedSecret = credentials?.webhookSecret as string | undefined;
    if (expectedSecret) {
      const { validateWebhookSecret } =
        await import('../services/dataCollection/connectors/webhook.js');
      const raw = req.headers['x-webhook-secret'] ?? req.query.secret;
      const providedSecret = String(Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? ''));
      if (!validateWebhookSecret(providedSecret, expectedSecret)) {
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const bufferId = uuidv4();
    await db.query(
      `INSERT INTO tp_webhook_buffer (id, connector_id, payload, received_at)
       VALUES ($1, $2, $3, NOW())`,
      [bufferId, connectorId, JSON.stringify(payload)]
    );

    logger.info('[DataCollection] webhook payload received', { connectorId, bufferId });
    return res.status(202).json({ received: true, bufferId });
  } catch (e) {
    logger.error('[DataCollection] webhook receive failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Webhook receive failed' });
  }
});

// ==========================================
// AUTHENTICATED ROUTES
// ==========================================

router.use(verifyToken as any);
router.use(requireTablePlatform);

// ==========================================
// CONNECTORS CRUD
// ==========================================

router.post('/connectors', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.organizationId;
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });

    const { workspaceId, name, connectorType, config, targetTableId, fieldMapping, schedule } =
      req.body ?? {};
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!connectorType || typeof connectorType !== 'string') {
      return res.status(400).json({ error: 'connectorType is required' });
    }

    const { connectorRegistry } = await import('../services/dataCollection/index.js');
    const validTypes = connectorRegistry.listTypes();
    if (!validTypes.includes(connectorType)) {
      return res.status(400).json({
        error: `Invalid connectorType. Valid types: ${validTypes.join(', ')}`,
      });
    }

    const db = getDatabase();
    const result = await db.query(
      `INSERT INTO tp_connectors
         (workspace_id, organization_id, name, connector_type, config, target_table_id, field_mapping, schedule, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        workspaceId,
        orgId,
        name,
        connectorType,
        JSON.stringify(config ?? {}),
        targetTableId ?? null,
        JSON.stringify(fieldMapping ?? []),
        schedule ? JSON.stringify(schedule) : null,
        authReq.userId ?? null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (e) {
    logger.error('[DataCollection] create connector failed', { error: (e as Error).message });
    return res
      .status(500)
      .json({ ...mapAppErrorResponse(e, undefined, 'error') });
  }
});

router.get('/connectors', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.organizationId;
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });

    const workspaceId =
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
    const db = getDatabase();

    let sql = 'SELECT * FROM tp_connectors WHERE organization_id = $1';
    const params: unknown[] = [orgId];

    if (workspaceId) {
      sql += ' AND workspace_id = $2';
      params.push(workspaceId);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await db.query(sql, params);
    return res.status(200).json(result.rows);
  } catch (e) {
    logger.error('[DataCollection] list connectors failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Failed to list connectors' });
  }
});

router.get('/connectors/scheduled', async (_req: Request, res: Response) => {
  try {
    const { syncScheduler } = await import('../services/dataCollection/index.js');
    const scheduled = syncScheduler.getScheduledConnectors();
    return res.status(200).json({ connectors: scheduled });
  } catch (e) {
    logger.error('[DataCollection] list scheduled failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Failed to list scheduled connectors' });
  }
});

router.get('/connectors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM tp_connectors WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Connector not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (e) {
    logger.error('[DataCollection] get connector failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Failed to get connector' });
  }
});

router.patch('/connectors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const { name, config, targetTableId, fieldMapping, schedule } = req.body ?? {};
    const db = getDatabase();

    const existing = await db.query(
      'SELECT * FROM tp_connectors WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(name);
    }
    if (config !== undefined) {
      sets.push(`config = $${idx++}`);
      params.push(JSON.stringify(config));
    }
    if (targetTableId !== undefined) {
      sets.push(`target_table_id = $${idx++}`);
      params.push(targetTableId);
    }
    if (fieldMapping !== undefined) {
      sets.push(`field_mapping = $${idx++}`);
      params.push(JSON.stringify(fieldMapping));
    }
    if (schedule !== undefined) {
      sets.push(`schedule = $${idx++}`);
      params.push(schedule ? JSON.stringify(schedule) : null);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    sets.push(`updated_at = NOW()`);
    params.push(id, orgId);

    const result = await db.query(
      `UPDATE tp_connectors SET ${sets.join(', ')} WHERE id = $${idx} AND organization_id = $${
        idx + 1
      } RETURNING *`,
      params
    );

    return res.status(200).json(result.rows[0]);
  } catch (e) {
    logger.error('[DataCollection] update connector failed', { error: (e as Error).message });
    return res
      .status(500)
      .json({ ...mapAppErrorResponse(e, undefined, 'error') });
  }
});

router.delete('/connectors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const db = getDatabase();
    const result = await db.query(
      'DELETE FROM tp_connectors WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Connector not found' });
    }
    return res.status(204).send();
  } catch (e) {
    logger.error('[DataCollection] delete connector failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Failed to delete connector' });
  }
});

// ==========================================
// TEST / RUN / HISTORY
// ==========================================

router.post('/connectors/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const db = getDatabase();
    const connResult = await db.query(
      'SELECT * FROM tp_connectors WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    const connector = connResult.rows[0] as Record<string, unknown> | undefined;
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const { connectorRegistry } = await import('../services/dataCollection/index.js');
    const impl = connectorRegistry.get(connector.connector_type as string);
    const testResult = await impl.testConnection(connector.config as Record<string, unknown>);
    return res.status(200).json(testResult);
  } catch (e) {
    logger.error('[DataCollection] test connector failed', { error: (e as Error).message });
    return res.status(500).json({ ...mapAppErrorResponse(e, undefined, 'error') });
  }
});

router.post('/connectors/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const db = getDatabase();
    const connResult = await db.query(
      'SELECT id FROM tp_connectors WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    if (!connResult.rows[0]) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const { connectorRunner } = await import('../services/dataCollection/index.js');
    const result = await connectorRunner.run(id);
    return res.status(200).json(result);
  } catch (e) {
    logger.error('[DataCollection] run connector failed', { error: (e as Error).message });
    return res.status(500).json({ ...mapAppErrorResponse(e, undefined, 'error') });
  }
});

router.get('/connectors/:id/runs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const db = getDatabase();

    const result = await db.query(
      `SELECT r.* FROM tp_connector_runs r
       JOIN tp_connectors c ON c.id = r.connector_id
       WHERE r.connector_id = $1 AND c.organization_id = $2
       ORDER BY started_at DESC
       LIMIT $3 OFFSET $4`,
      [id, orgId, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM tp_connector_runs r
       JOIN tp_connectors c ON c.id = r.connector_id
       WHERE r.connector_id = $1 AND c.organization_id = $2`,
      [id, orgId]
    );

    const countRow = countResult.rows[0] as { total?: string } | undefined;
    return res.status(200).json({
      runs: result.rows,
      total: Number(countRow?.total ?? 0),
      limit,
      offset,
    });
  } catch (e) {
    logger.error('[DataCollection] list runs failed', { error: (e as Error).message });
    return res.status(500).json({ error: 'Failed to list runs' });
  }
});

// ==========================================
// SCHEDULE
// ==========================================

router.post('/connectors/:id/schedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const { intervalMinutes, enabled } = req.body ?? {};

    if (typeof intervalMinutes !== 'number' || intervalMinutes <= 0) {
      return res.status(400).json({ error: 'intervalMinutes must be a positive number' });
    }

    const db = getDatabase();
    const connResult = await db.query(
      'SELECT id, schedule FROM tp_connectors WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    if (!connResult.rows[0]) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const schedule = { enabled: enabled !== false, intervalMinutes };

    await db.query(
      `UPDATE tp_connectors SET schedule = $2, updated_at = NOW() WHERE id = $1 AND organization_id = $3`,
      [id, JSON.stringify(schedule), orgId]
    );

    const { syncScheduler } = await import('../services/dataCollection/index.js');
    if (schedule.enabled) {
      syncScheduler.scheduleConnector(id, intervalMinutes);
    } else {
      syncScheduler.unscheduleConnector(id);
    }

    return res.status(200).json({ connectorId: id, schedule });
  } catch (e) {
    logger.error('[DataCollection] set schedule failed', { error: (e as Error).message });
    return res.status(500).json({ ...mapAppErrorResponse(e, undefined, 'error') });
  }
});

router.delete('/connectors/:id/schedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const db = getDatabase();

    const connResult = await db.query(
      'SELECT id FROM tp_connectors WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    if (!connResult.rows[0]) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    await db.query(
      `UPDATE tp_connectors SET schedule = NULL, updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    const { syncScheduler } = await import('../services/dataCollection/index.js');
    syncScheduler.unscheduleConnector(id);

    return res.status(204).send();
  } catch (e) {
    logger.error('[DataCollection] delete schedule failed', { error: (e as Error).message });
    return res
      .status(500)
      .json({ ...mapAppErrorResponse(e, undefined, 'error') });
  }
});

// ==========================================
// AUTO-MAP
// ==========================================

router.post('/connectors/:id/auto-map', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = getOrganizationId(req);
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    const db = getDatabase();

    const connResult = await db.query(
      'SELECT * FROM tp_connectors WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    const connector = connResult.rows[0] as Record<string, unknown> | undefined;
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const targetTableId = connector.target_table_id as string | null;
    if (!targetTableId) {
      return res.status(400).json({ error: 'Connector has no target table set' });
    }

    const { connectorRegistry, schemaMappingEngine } =
      await import('../services/dataCollection/index.js');
    const impl = connectorRegistry.get(connector.connector_type as string);
    const externalSchema = await impl.fetchSchema(connector.config as Record<string, unknown>);

    const fieldsResult = await db.query(
      'SELECT id, name, field_type, options FROM tp_fields WHERE table_id = $1',
      [targetTableId]
    );
    const targetFields = fieldsResult.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      field_type: r.field_type,
      options: r.options,
    }));

    const mapping = schemaMappingEngine.autoMap(externalSchema, targetFields);
    const validation = schemaMappingEngine.validateMapping(mapping, targetFields);

    return res.status(200).json({
      externalSchema,
      suggestedMapping: mapping,
      validation,
    });
  } catch (e) {
    logger.error('[DataCollection] auto-map failed', { error: (e as Error).message });
    return res.status(500).json({ ...mapAppErrorResponse(e, undefined, 'error') });
  }
});

export default router;
