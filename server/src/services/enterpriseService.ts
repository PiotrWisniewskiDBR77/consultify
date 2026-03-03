/**
 * Enterprise Service
 * FLOW-ENTERPRISE-001: Enterprise features management
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface EnterpriseContract {
  id: string;
  organizationId: string;
  contractType: 'standard' | 'annual' | 'enterprise' | 'custom';
  contractNumber?: string;
  startDate: string;
  endDate?: string;
  slaLevel: string;
  uptimeGuarantee: number;
  status: string;
  maxUsers?: number;
  maxProjects?: number;
  accountManagerName?: string;
  accountManagerEmail?: string;
}

export interface DataResidency {
  id: string;
  organizationId: string;
  region: string;
  regionLocked: boolean;
  dataSovereigntyRequired: boolean;
  crossBorderTransferAllowed: boolean;
  aiProcessingRegion: string;
}

export interface WhiteLabelConfig {
  id: string;
  organizationId: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  customDomain?: string;
  customDomainVerified: boolean;
  emailFromName?: string;
  emailFromAddress?: string;
  hideConsultifyBranding: boolean;
  isEnabled: boolean;
}

export interface SLAMetrics {
  month: string;
  uptimePercentage: number;
  slaTarget: number;
  slaMet: boolean;
  incidentsTotal: number;
  ticketsTotal: number;
  ticketsWithinSla: number;
  avgResponseTimeMinutes?: number;
  creditAmount: number;
}

// ==========================================
// SERVICE
// ==========================================

class EnterpriseService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // CONTRACTS
  // ==========================================

  /**
   * Get enterprise contract
   */
  async getContract(orgId: string): Promise<EnterpriseContract | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      contract_type: string;
      contract_number: string;
      start_date: string;
      end_date: string;
      sla_level: string;
      uptime_guarantee: number;
      status: string;
      max_users: number;
      max_projects: number;
      account_manager_name: string;
      account_manager_email: string;
    }>(`SELECT * FROM enterprise_contracts WHERE organization_id = ? AND status = 'active'`, [
      orgId,
    ]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      contractType: row.contract_type as EnterpriseContract['contractType'],
      contractNumber: row.contract_number,
      startDate: row.start_date,
      endDate: row.end_date,
      slaLevel: row.sla_level,
      uptimeGuarantee: row.uptime_guarantee,
      status: row.status,
      maxUsers: row.max_users,
      maxProjects: row.max_projects,
      accountManagerName: row.account_manager_name,
      accountManagerEmail: row.account_manager_email,
    };
  }

  /**
   * Create/Update contract
   */
  async saveContract(
    orgId: string,
    contract: Partial<EnterpriseContract>,
    userId: string
  ): Promise<string> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const existing = await this.getContract(orgId);

    if (existing) {
      await db.run(
        `UPDATE enterprise_contracts SET 
                    contract_type = ?, sla_level = ?, uptime_guarantee = ?,
                    max_users = ?, max_projects = ?,
                    account_manager_name = ?, account_manager_email = ?,
                    updated_at = ?
                 WHERE id = ?`,
        [
          contract.contractType || existing.contractType,
          contract.slaLevel || existing.slaLevel,
          contract.uptimeGuarantee || existing.uptimeGuarantee,
          contract.maxUsers,
          contract.maxProjects,
          contract.accountManagerName,
          contract.accountManagerEmail,
          now,
          existing.id,
        ]
      );
      return existing.id;
    }

    const id = `contract-${uuidv4()}`;
    const contractNumber = `ENT-${Date.now().toString(36).toUpperCase()}`;

    await db.run(
      `INSERT INTO enterprise_contracts (
                id, organization_id, contract_type, contract_number,
                start_date, sla_level, uptime_guarantee, status,
                max_users, max_projects,
                account_manager_name, account_manager_email,
                created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        contract.contractType || 'enterprise',
        contractNumber,
        contract.startDate || now.split('T')[0],
        contract.slaLevel || 'enterprise',
        contract.uptimeGuarantee || 99.9,
        contract.maxUsers,
        contract.maxProjects,
        contract.accountManagerName,
        contract.accountManagerEmail,
        userId,
        now,
      ]
    );

    return id;
  }

  // ==========================================
  // DATA RESIDENCY
  // ==========================================

  /**
   * Get data residency config
   */
  async getDataResidency(orgId: string): Promise<DataResidency | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      region: string;
      region_locked: number;
      data_sovereignty_required: number;
      cross_border_transfer_allowed: number;
      ai_processing_region: string;
    }>(`SELECT * FROM data_residency WHERE organization_id = ?`, [orgId]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      region: row.region,
      regionLocked: row.region_locked === 1,
      dataSovereigntyRequired: row.data_sovereignty_required === 1,
      crossBorderTransferAllowed: row.cross_border_transfer_allowed === 1,
      aiProcessingRegion: row.ai_processing_region,
    };
  }

  /**
   * Configure data residency
   */
  async configureDataResidency(
    orgId: string,
    config: Partial<DataResidency>,
    userId: string
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const existing = await this.getDataResidency(orgId);

    if (existing) {
      if (existing.regionLocked && config.region !== existing.region) {
        throw new Error('Data residency region is locked and cannot be changed');
      }

      await db.run(
        `UPDATE data_residency SET 
                    region = ?, data_sovereignty_required = ?,
                    cross_border_transfer_allowed = ?, ai_processing_region = ?
                 WHERE organization_id = ?`,
        [
          config.region || existing.region,
          config.dataSovereigntyRequired ? 1 : 0,
          config.crossBorderTransferAllowed !== false ? 1 : 0,
          config.aiProcessingRegion || 'same',
          orgId,
        ]
      );
    } else {
      const id = `residency-${uuidv4()}`;
      await db.run(
        `INSERT INTO data_residency (
                    id, organization_id, region, data_sovereignty_required,
                    cross_border_transfer_allowed, ai_processing_region,
                    configured_at, configured_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          orgId,
          config.region || 'eu',
          config.dataSovereigntyRequired ? 1 : 0,
          config.crossBorderTransferAllowed !== false ? 1 : 0,
          config.aiProcessingRegion || 'same',
          now,
          userId,
        ]
      );
    }
  }

  // ==========================================
  // WHITE-LABEL
  // ==========================================

  /**
   * Get white-label config
   */
  async getWhiteLabelConfig(orgId: string): Promise<WhiteLabelConfig | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      logo_light_url: string;
      logo_dark_url: string;
      favicon_url: string;
      color_primary: string;
      color_secondary: string;
      custom_domain: string;
      custom_domain_status: string;
      email_from_name: string;
      email_from_address: string;
      hide_consultify_branding: number;
      is_enabled: number;
    }>(`SELECT * FROM white_label_config WHERE organization_id = ?`, [orgId]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      logoLightUrl: row.logo_light_url,
      logoDarkUrl: row.logo_dark_url,
      faviconUrl: row.favicon_url,
      colorPrimary: row.color_primary,
      colorSecondary: row.color_secondary,
      customDomain: row.custom_domain,
      customDomainVerified: row.custom_domain_status === 'verified',
      emailFromName: row.email_from_name,
      emailFromAddress: row.email_from_address,
      hideConsultifyBranding: row.hide_consultify_branding === 1,
      isEnabled: row.is_enabled === 1,
    };
  }

  /**
   * Update white-label config
   */
  async updateWhiteLabelConfig(orgId: string, config: Partial<WhiteLabelConfig>): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const existing = await this.getWhiteLabelConfig(orgId);

    if (existing) {
      const fields: string[] = ['updated_at = ?'];
      const values: (string | number | null)[] = [now];

      if (config.logoLightUrl !== undefined) {
        fields.push('logo_light_url = ?');
        values.push(config.logoLightUrl);
      }
      if (config.logoDarkUrl !== undefined) {
        fields.push('logo_dark_url = ?');
        values.push(config.logoDarkUrl);
      }
      if (config.colorPrimary !== undefined) {
        fields.push('color_primary = ?');
        values.push(config.colorPrimary);
      }
      if (config.colorSecondary !== undefined) {
        fields.push('color_secondary = ?');
        values.push(config.colorSecondary);
      }
      if (config.customDomain !== undefined) {
        fields.push('custom_domain = ?');
        values.push(config.customDomain);
      }
      if (config.hideConsultifyBranding !== undefined) {
        fields.push('hide_consultify_branding = ?');
        values.push(config.hideConsultifyBranding ? 1 : 0);
      }
      if (config.isEnabled !== undefined) {
        fields.push('is_enabled = ?');
        values.push(config.isEnabled ? 1 : 0);
      }

      values.push(orgId);

      await db.run(
        `UPDATE white_label_config SET ${fields.join(', ')} WHERE organization_id = ?`,
        values
      );
    } else {
      const id = `wl-${uuidv4()}`;
      await db.run(
        `INSERT INTO white_label_config (
                    id, organization_id, logo_light_url, logo_dark_url,
                    color_primary, color_secondary, custom_domain,
                    hide_consultify_branding, is_enabled, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          orgId,
          config.logoLightUrl || null,
          config.logoDarkUrl || null,
          config.colorPrimary || null,
          config.colorSecondary || null,
          config.customDomain || null,
          config.hideConsultifyBranding ? 1 : 0,
          config.isEnabled ? 1 : 0,
          now,
        ]
      );
    }
  }

  // ==========================================
  // SLA
  // ==========================================

  /**
   * Get SLA metrics
   */
  async getSLAMetrics(orgId: string, months: number = 6): Promise<SLAMetrics[]> {
    const db = await this.getDb();

    const rows = await db.all<{
      month: string;
      uptime_percentage: number;
      sla_target: number;
      sla_met: number;
      incidents_total: number;
      tickets_total: number;
      tickets_within_sla: number;
      avg_first_response_minutes: number;
      credit_amount: number;
    }>(
      `SELECT * FROM sla_tracking 
             WHERE organization_id = ? 
             ORDER BY month DESC LIMIT ?`,
      [orgId, months]
    );

    return (rows || []).map((r) => ({
      month: r.month,
      uptimePercentage: r.uptime_percentage,
      slaTarget: r.sla_target,
      slaMet: r.sla_met === 1,
      incidentsTotal: r.incidents_total,
      ticketsTotal: r.tickets_total,
      ticketsWithinSla: r.tickets_within_sla,
      avgResponseTimeMinutes: r.avg_first_response_minutes,
      creditAmount: r.credit_amount,
    }));
  }
}

// Export singleton
const enterpriseService = new EnterpriseService();
export default enterpriseService;

// Named exports
export const getContract = (orgId: string) => enterpriseService.getContract(orgId);
export const saveContract = (
  orgId: string,
  contract: Parameters<typeof enterpriseService.saveContract>[1],
  userId: string
) => enterpriseService.saveContract(orgId, contract, userId);
export const getDataResidency = (orgId: string) => enterpriseService.getDataResidency(orgId);
export const configureDataResidency = (
  orgId: string,
  config: Parameters<typeof enterpriseService.configureDataResidency>[1],
  userId: string
) => enterpriseService.configureDataResidency(orgId, config, userId);
export const getWhiteLabelConfig = (orgId: string) => enterpriseService.getWhiteLabelConfig(orgId);
export const updateWhiteLabelConfig = (
  orgId: string,
  config: Parameters<typeof enterpriseService.updateWhiteLabelConfig>[1]
) => enterpriseService.updateWhiteLabelConfig(orgId, config);
export const getSLAMetrics = (orgId: string, months?: number) =>
  enterpriseService.getSLAMetrics(orgId, months);
