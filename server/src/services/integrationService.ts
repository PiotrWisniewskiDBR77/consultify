/**
 * Integration Service
 * FLOW-INTEGRATION-001: External system integrations
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface IntegrationProvider {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description?: string;
  authType: 'oauth2' | 'api_key' | 'webhook';
  isActive: boolean;
  isBeta: boolean;
  isEnterpriseOnly: boolean;
}

export interface Integration {
  id: string;
  organizationId: string;
  providerId: string;
  providerName?: string;
  status: 'active' | 'paused' | 'error' | 'disconnected';
  externalAccountId?: string;
  externalAccountName?: string;
  settings: Record<string, unknown>;
  lastSyncAt?: string;
  lastError?: string;
  connectedAt: string;
}

export interface SyncMapping {
  id: string;
  integrationId: string;
  localType: string;
  localId: string;
  externalType: string;
  externalId: string;
  syncStatus: string;
}

export interface SyncResult {
  status: 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsFailed: number;
  errors?: string[];
}

// ==========================================
// SERVICE
// ==========================================

class IntegrationService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // PROVIDERS
  // ==========================================

  /**
   * Get available integration providers
   */
  async getProviders(category?: string): Promise<IntegrationProvider[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM integration_providers WHERE is_active = 1`;
    const params: string[] = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY sort_order, display_name`;

    const rows = await db.all<{
      id: string;
      name: string;
      display_name: string;
      category: string;
      description: string;
      auth_type: string;
      is_active: number;
      is_beta: number;
      is_enterprise_only: number;
    }>(query, params);

    return (rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name,
      category: r.category,
      description: r.description,
      authType: r.auth_type as IntegrationProvider['authType'],
      isActive: r.is_active === 1,
      isBeta: r.is_beta === 1,
      isEnterpriseOnly: r.is_enterprise_only === 1,
    }));
  }

  // ==========================================
  // INTEGRATIONS
  // ==========================================

  /**
   * Get organization integrations
   */
  async getIntegrations(orgId: string): Promise<Integration[]> {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      organization_id: string;
      provider_id: string;
      status: string;
      external_account_id: string;
      external_account_name: string;
      settings: string;
      last_sync_at: string;
      last_error: string;
      connected_at: string;
      provider_name: string;
    }>(
      `SELECT i.*, p.name as provider_name
             FROM integrations i
             JOIN integration_providers p ON i.provider_id = p.id
             WHERE i.organization_id = ?
             ORDER BY i.connected_at DESC`,
      [orgId]
    );

    return (rows || []).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      providerId: r.provider_id,
      providerName: r.provider_name,
      status: r.status as Integration['status'],
      externalAccountId: r.external_account_id,
      externalAccountName: r.external_account_name,
      settings: JSON.parse(r.settings || '{}'),
      lastSyncAt: r.last_sync_at,
      lastError: r.last_error,
      connectedAt: r.connected_at,
    }));
  }

  /**
   * Connect integration
   */
  async connectIntegration(input: {
    organizationId: string;
    providerId: string;
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    externalAccountId?: string;
    externalAccountName?: string;
    settings?: Record<string, unknown>;
    connectedBy: string;
  }): Promise<Integration> {
    const db = await this.getDb();
    const id = `int-${uuidv4()}`;
    const now = new Date().toISOString();

    // Get provider auth type
    const provider = await db.get<{ auth_type: string }>(
      'SELECT auth_type FROM integration_providers WHERE id = ?',
      [input.providerId]
    );

    await db.run(
      `INSERT INTO integrations (
                id, organization_id, provider_id, auth_type,
                access_token, refresh_token, api_key,
                external_account_id, external_account_name,
                settings, status, connected_by, connected_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.providerId,
        provider?.auth_type || 'oauth2',
        input.accessToken || null,
        input.refreshToken || null,
        input.apiKey || null,
        input.externalAccountId || null,
        input.externalAccountName || null,
        JSON.stringify(input.settings || {}),
        input.connectedBy,
        now,
        now,
      ]
    );

    logger.info(
      `[IntegrationService] Connected integration ${input.providerId} for org ${input.organizationId}`
    );

    return this.getIntegration(id) as Promise<Integration>;
  }

  /**
   * Get single integration
   */
  async getIntegration(integrationId: string): Promise<Integration | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      provider_id: string;
      status: string;
      external_account_id: string;
      external_account_name: string;
      settings: string;
      last_sync_at: string;
      last_error: string;
      connected_at: string;
    }>(`SELECT * FROM integrations WHERE id = ?`, [integrationId]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      providerId: row.provider_id,
      status: row.status as Integration['status'],
      externalAccountId: row.external_account_id,
      externalAccountName: row.external_account_name,
      settings: JSON.parse(row.settings || '{}'),
      lastSyncAt: row.last_sync_at,
      lastError: row.last_error,
      connectedAt: row.connected_at,
    };
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(integrationId: string, userId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `UPDATE integrations SET 
                status = 'disconnected',
                access_token = NULL,
                refresh_token = NULL,
                api_key = NULL,
                disconnected_at = ?,
                disconnected_by = ?,
                updated_at = ?
             WHERE id = ?`,
      [now, userId, now, integrationId]
    );

    logger.info(`[IntegrationService] Disconnected integration ${integrationId}`);
  }

  /**
   * Update integration settings
   */
  async updateSettings(integrationId: string, settings: Record<string, unknown>): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(`UPDATE integrations SET settings = ?, updated_at = ? WHERE id = ?`, [
      JSON.stringify(settings),
      now,
      integrationId,
    ]);
  }

  /**
   * Pause/Resume integration
   */
  async setIntegrationStatus(integrationId: string, status: 'active' | 'paused'): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(`UPDATE integrations SET status = ?, updated_at = ? WHERE id = ?`, [
      status,
      now,
      integrationId,
    ]);
  }

  // ==========================================
  // SYNC
  // ==========================================

  /**
   * Create sync mapping
   */
  async createSyncMapping(input: {
    integrationId: string;
    localType: string;
    localId: string;
    externalType: string;
    externalId: string;
    externalUrl?: string;
  }): Promise<string> {
    const db = await this.getDb();
    const id = `sync-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO integration_sync_mappings (
                id, integration_id, local_type, local_id,
                external_type, external_id, external_url,
                sync_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
      [
        id,
        input.integrationId,
        input.localType,
        input.localId,
        input.externalType,
        input.externalId,
        input.externalUrl || null,
        now,
        now,
      ]
    );

    return id;
  }

  /**
   * Get sync mapping by local entity
   */
  async getSyncMapping(
    integrationId: string,
    localType: string,
    localId: string
  ): Promise<SyncMapping | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      integration_id: string;
      local_type: string;
      local_id: string;
      external_type: string;
      external_id: string;
      sync_status: string;
    }>(
      `SELECT * FROM integration_sync_mappings 
             WHERE integration_id = ? AND local_type = ? AND local_id = ?`,
      [integrationId, localType, localId]
    );

    if (!row) return null;

    return {
      id: row.id,
      integrationId: row.integration_id,
      localType: row.local_type,
      localId: row.local_id,
      externalType: row.external_type,
      externalId: row.external_id,
      syncStatus: row.sync_status,
    };
  }

  /**
   * Log sync operation
   */
  async logSync(input: {
    integrationId: string;
    syncType: string;
    direction: string;
    triggerType?: string;
    result: SyncResult;
    durationMs?: number;
  }): Promise<void> {
    const db = await this.getDb();
    const id = `log-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO integration_sync_log (
                id, integration_id, sync_type, direction, trigger_type,
                status, items_processed, items_created, items_updated, items_failed,
                error_details, started_at, completed_at, duration_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.integrationId,
        input.syncType,
        input.direction,
        input.triggerType || 'manual',
        input.result.status,
        input.result.itemsProcessed,
        input.result.itemsCreated,
        input.result.itemsUpdated,
        input.result.itemsFailed,
        input.result.errors ? JSON.stringify(input.result.errors) : null,
        now,
        now,
        input.durationMs || 0,
      ]
    );

    // Update integration last_sync_at
    await db.run(`UPDATE integrations SET last_sync_at = ?, updated_at = ? WHERE id = ?`, [
      now,
      now,
      input.integrationId,
    ]);
  }

  // ==========================================
  // WEBHOOKS
  // ==========================================

  /**
   * Process incoming webhook
   */
  async processWebhook(
    provider: string,
    payload: Record<string, unknown>,
    signature?: string
  ): Promise<{ success: boolean; message: string }> {
    logger.info(`[IntegrationService] Processing ${provider} webhook`);

    // Provider-specific webhook handling would go here
    // For now, just log and return success

    return { success: true, message: 'Webhook processed' };
  }
}

// Export singleton
const integrationService = new IntegrationService();
export default integrationService;

// Named exports
export const getProviders = (category?: string) => integrationService.getProviders(category);
export const getIntegrations = (orgId: string) => integrationService.getIntegrations(orgId);
export const connectIntegration = (
  input: Parameters<typeof integrationService.connectIntegration>[0]
) => integrationService.connectIntegration(input);
export const getIntegration = (integrationId: string) =>
  integrationService.getIntegration(integrationId);
export const disconnectIntegration = (integrationId: string, userId: string) =>
  integrationService.disconnectIntegration(integrationId, userId);
export const updateSettings = (integrationId: string, settings: Record<string, unknown>) =>
  integrationService.updateSettings(integrationId, settings);
export const setIntegrationStatus = (integrationId: string, status: 'active' | 'paused') =>
  integrationService.setIntegrationStatus(integrationId, status);
export const createSyncMapping = (
  input: Parameters<typeof integrationService.createSyncMapping>[0]
) => integrationService.createSyncMapping(input);
export const getSyncMapping = (integrationId: string, localType: string, localId: string) =>
  integrationService.getSyncMapping(integrationId, localType, localId);
export const logSync = (input: Parameters<typeof integrationService.logSync>[0]) =>
  integrationService.logSync(input);
export const processWebhook = (
  provider: string,
  payload: Record<string, unknown>,
  signature?: string
) => integrationService.processWebhook(provider, payload, signature);
