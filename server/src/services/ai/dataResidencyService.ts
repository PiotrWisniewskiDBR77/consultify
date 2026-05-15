/**
 * Data Residency Service
 *
 * Enforces data residency policies per organization:
 * - EU-only routing when required
 * - Region-based model filtering
 * - Integration with modelRouter org policy
 */
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface DataResidencyPolicy {
  enforceEuOnly: boolean;
  dataResidencyRegion: string | null;
  allowedRegions: string[];
  deniedRegions: string[];
}

const EU_REGIONS = ['EU', 'EU-WEST', 'EU-CENTRAL', 'EUROPE', 'DE', 'FR', 'NL', 'IE'];

class DataResidencyService {
  async getPolicy(organizationId: string): Promise<DataResidencyPolicy> {
    const config = (await dbGet(
      `SELECT data_residency_region, enforce_eu_only
       FROM organization_ai_config
       WHERE organization_id = ?`,
      [organizationId]
    ).catch(() => null)) as any;

    if (!config) {
      return {
        enforceEuOnly: false,
        dataResidencyRegion: null,
        allowedRegions: [],
        deniedRegions: [],
      };
    }

    const enforceEu = Boolean(config.enforce_eu_only);

    return {
      enforceEuOnly: enforceEu,
      dataResidencyRegion: config.data_residency_region || null,
      allowedRegions: enforceEu ? EU_REGIONS : [],
      deniedRegions: [],
    };
  }

  async setPolicy(
    organizationId: string,
    policy: Partial<DataResidencyPolicy>,
    updatedBy: string
  ): Promise<void> {
    const existing = await dbGet(
      `SELECT id FROM organization_ai_config WHERE organization_id = ?`,
      [organizationId]
    );

    if (existing) {
      const sets: string[] = ["updated_at = datetime('now')", 'updated_by = ?'];
      const params: unknown[] = [updatedBy];

      if (policy.enforceEuOnly !== undefined) {
        sets.push('enforce_eu_only = ?');
        params.push(policy.enforceEuOnly ? 1 : 0);
      }
      if (policy.dataResidencyRegion !== undefined) {
        sets.push('data_residency_region = ?');
        params.push(policy.dataResidencyRegion);
      }

      params.push(organizationId);
      await dbRun(
        `UPDATE organization_ai_config SET ${sets.join(', ')} WHERE organization_id = ?`,
        params
      );
    } else {
      const { randomUUID } = await import('node:crypto');
      await dbRun(
        `INSERT INTO organization_ai_config
          (id, organization_id, enforce_eu_only, data_residency_region, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          randomUUID(),
          organizationId,
          policy.enforceEuOnly ? 1 : 0,
          policy.dataResidencyRegion || null,
          updatedBy,
        ]
      );
    }

    await this.syncModelRouterPolicy(organizationId, policy);
  }

  async isModelAllowed(
    organizationId: string,
    modelRegions: string[]
  ): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await this.getPolicy(organizationId);

    if (!policy.enforceEuOnly && !policy.dataResidencyRegion) {
      return { allowed: true };
    }

    if (policy.enforceEuOnly) {
      const hasEuRegion = modelRegions.some((r) => EU_REGIONS.includes(r.toUpperCase()));
      if (!hasEuRegion) {
        return {
          allowed: false,
          reason: `EU-only routing enforced. Model regions [${modelRegions.join(', ')}] do not include EU.`,
        };
      }
    }

    if (policy.dataResidencyRegion) {
      const hasRequiredRegion = modelRegions.some(
        (r) => r.toUpperCase() === policy.dataResidencyRegion?.toUpperCase()
      );
      if (!hasRequiredRegion) {
        return {
          allowed: false,
          reason: `Data residency requires region ${policy.dataResidencyRegion}. Model regions: [${modelRegions.join(', ')}]`,
        };
      }
    }

    return { allowed: true };
  }

  private async syncModelRouterPolicy(
    organizationId: string,
    policy: Partial<DataResidencyPolicy>
  ): Promise<void> {
    try {
      const orgPolicy = (await dbGet(
        `SELECT policy FROM organization_ai_policy WHERE organization_id = ?`,
        [organizationId]
      )) as any;

      const existingPolicy = orgPolicy?.policy
        ? typeof orgPolicy.policy === 'string'
          ? JSON.parse(orgPolicy.policy)
          : orgPolicy.policy
        : {};

      if (policy.enforceEuOnly) {
        existingPolicy.allow_regions = EU_REGIONS;
      } else if (policy.dataResidencyRegion) {
        existingPolicy.allow_regions = [policy.dataResidencyRegion.toUpperCase()];
      }

      await dbRun(
        `INSERT INTO organization_ai_policy (organization_id, policy, updated_at, created_at)
         VALUES (?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(organization_id) DO UPDATE SET
           policy = excluded.policy,
           updated_at = datetime('now')`,
        [organizationId, JSON.stringify(existingPolicy)]
      ).catch(() => {});
    } catch (err: any) {
      logger.debug(`[DataResidency] Policy sync skipped: ${err?.message}`);
    }
  }
}

export const dataResidencyService = new DataResidencyService();
export default dataResidencyService;
