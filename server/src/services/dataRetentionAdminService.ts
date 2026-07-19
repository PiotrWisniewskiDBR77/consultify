// @ts-nocheck
/**
 * Data Retention (Admin/Compliance) Service
 *
 * Backs SuperAdminController.getDataRetentionPolicies / createDataRetentionPolicy
 * (GET/POST /api/superadmin/compliance/retention-policies).
 *
 * RED-D W5/W6 (2026-07-19): shared.ts previously wired `DataRetentionService` to a
 * phantom stub — `{ getPolicy: async () => ({}) }` (singular `getPolicy`, no
 * `createPolicy`) — while the controller calls `getPolicies(organizationId)` /
 * `createPolicy(body)`, causing "deps.DataRetentionService.getPolicies is not a
 * function" (500). Do not confuse this with `services/retentionPolicyService.ts`,
 * which is an unrelated per-org AI-data cleanup tier engine (conversations/
 * messages/memory), not a CRUD service over the `data_retention_policies` table.
 *
 * Table (additive migration 20260719_red_pmoadmin_data_retention_policies.sql,
 * columns mirrored from server/migrations/015_enterprise_customers_module.sql and
 * migrations-v2/001_baseline_20260413.sql):
 *   id, organization_id (nullable = global policy), data_type, retention_days,
 *   auto_delete, archive_before_delete, created_at.
 */
import { randomUUID } from 'crypto';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

class DataRetentionAdminServiceClass {
  private db: IDatabase;
  private logger: any;

  constructor(deps?: { db?: IDatabase; logger?: any }) {
    this.db = deps?.db || getDatabase();
    this.logger = deps?.logger || _logger;
  }

  setDependencies(deps: { db?: IDatabase; logger?: any }) {
    if (deps.db) this.db = deps.db;
    if (deps.logger) this.logger = deps.logger;
  }

  /**
   * List retention policies. When organizationId is provided, returns that
   * org's policies plus any global (organization_id IS NULL) policies.
   * Without it, returns every policy row.
   */
  async getPolicies(organizationId?: string | null): Promise<any[]> {
    if (organizationId) {
      return await this.db.all(
        `SELECT id, organization_id, data_type, retention_days, auto_delete,
                archive_before_delete, created_at
         FROM data_retention_policies
         WHERE organization_id = ? OR organization_id IS NULL
         ORDER BY created_at DESC`,
        [organizationId]
      );
    }
    return await this.db.all(
      `SELECT id, organization_id, data_type, retention_days, auto_delete,
              archive_before_delete, created_at
       FROM data_retention_policies
       ORDER BY created_at DESC`
    );
  }

  async createPolicy(input: {
    organizationId?: string | null;
    dataType: string;
    retentionDays: number;
    autoDelete?: boolean;
    archiveBeforeDelete?: boolean;
  }): Promise<any> {
    if (!input?.dataType || input?.retentionDays == null) {
      throw new Error('dataType and retentionDays are required');
    }
    const id = randomUUID();
    await this.db.run(
      `INSERT INTO data_retention_policies
         (id, organization_id, data_type, retention_days, auto_delete, archive_before_delete)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId || null,
        input.dataType,
        input.retentionDays,
        input.autoDelete === false ? 0 : 1,
        input.archiveBeforeDelete === false ? 0 : 1,
      ]
    );
    return {
      id,
      organizationId: input.organizationId || null,
      dataType: input.dataType,
      retentionDays: input.retentionDays,
      autoDelete: input.autoDelete !== false,
      archiveBeforeDelete: input.archiveBeforeDelete !== false,
    };
  }
}

const dataRetentionAdminService = new DataRetentionAdminServiceClass();
export default dataRetentionAdminService;
