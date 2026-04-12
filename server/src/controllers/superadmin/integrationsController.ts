import { type AuthenticatedRequest, catchAsync, deps, tableExists } from './shared.js';
import logger from '../../utils/Logger.js';

// =========================================
// INTEGRATIONS & WEBHOOKS
// =========================================

/**
 * Get system integrations
 */
export const getIntegrations = catchAsync(async (req, res, next) => {
  try {
    const integrations = (await deps.IntegrationService?.getIntegrations?.('system')) || [];
    if (integrations && integrations.length > 0) {
      res.json({ integrations });
      return;
    }

    // Try to get from database
    const dbIntegrations = (await new Promise((resolve) => {
      deps.db.all(
        `SELECT * FROM integrations WHERE organization_id = 'system' OR organization_id IS NULL ORDER BY created_at DESC`,
        [],
        (err, rows) => resolve(rows || [])
      );
    })) as any[];

    if (dbIntegrations && dbIntegrations.length > 0) {
      res.json({ integrations: dbIntegrations });
      return;
    }

    res.json({ integrations: [] });
  } catch (error) {
    logger.error('getIntegrations error:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

/**
 * Connect a system integration
 */
export const connectIntegration = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const integration = await deps.IntegrationService.createIntegration({
    organization_id: 'system',
    type: provider,
    name: `System ${provider}`,
    enabled: true,
  });
  res.json(integration);
});

/**
 * Disconnect a system integration
 */
export const disconnectIntegration = catchAsync(async (req, res, next) => {
  const provider = (req.params as any).provider || (req.params as any).id;
  if (!provider) return res.status(400).json({ error: 'provider is required' });

  // Resolve integration ID by provider/type for system scope
  const row = await deps.db.get(
    `SELECT id FROM integrations
     WHERE type = ? AND (organization_id = 'system' OR organization_id IS NULL)
     ORDER BY created_at DESC
     LIMIT 1`,
    [provider]
  );
  if (!(row as any)?.id) {
    res.json({ success: true, deleted: false });
    return;
  }
  const success = await deps.IntegrationService.deleteIntegration((row as any).id);
  res.json({ success, deleted: true });
});

/**
 * Test a system integration
 */
export const testIntegration = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const result = await deps.IntegrationService.syncIntegration(provider); // Using sync as test/refresh
  res.json(result);
});

/**
 * Refresh a system integration
 */
export const refreshIntegration = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const result = await deps.IntegrationService.syncIntegration(provider);
  res.json(result);
});

/**
 * Update system integration config
 */
export const updateIntegrationConfig = catchAsync(async (req, res, next) => {
  const { provider } = req.params;
  const config = req.body;
  const result = await deps.IntegrationService.updateIntegration(provider, { config });
  res.json(result);
});

/**
 * Get system webhooks
 */
export const getWebhooks = catchAsync(async (req, res, next) => {
  try {
    const webhooks = (await deps.WebhookService?.getWebhooks?.('system')) || [];
    if (webhooks && webhooks.length > 0) {
      res.json({ webhooks });
      return;
    }

    // Try to get from database
    const dbWebhooks = (await new Promise((resolve) => {
      deps.db.all(
        `SELECT * FROM webhooks WHERE organization_id = 'system' OR organization_id IS NULL ORDER BY created_at DESC`,
        [],
        (err, rows) => resolve(rows || [])
      );
    })) as any[];

    if (dbWebhooks && dbWebhooks.length > 0) {
      res.json({ webhooks: dbWebhooks });
      return;
    }

    res.json({ webhooks: [] });
  } catch (error) {
    logger.error('getWebhooks error:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

/**
 * Create a system webhook
 */
export const createWebhook = catchAsync(async (req, res, next) => {
  const webhook = await deps.WebhookService.createWebhook({
    ...req.body,
    organization_id: 'system',
  });
  res.json(webhook);
});

/**
 * Update a system webhook
 */
export const updateWebhook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const webhook = await deps.WebhookService.updateWebhook(id, req.body);
  res.json(webhook);
});

/**
 * Delete a system webhook
 */
export const deleteWebhook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.WebhookService.deleteWebhook(id);
  res.json(result);
});

/**
 * Test a system webhook
 */
export const testWebhook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await deps.WebhookService.testWebhook(id);
  res.json(result);
});

/**
 * Get system webhook deliveries
 */
export const getWebhookDeliveries = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const deliveries = await deps.WebhookService.getDeliveries(id);
  res.json(deliveries);
});
