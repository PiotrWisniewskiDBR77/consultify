import type { Pool } from 'pg';

export interface EffectiveGovernancePolicy {
  policyId: string;
  version: number;
  baseline: 'BASELINE_SMALL' | 'STANDARD' | 'COMPLEX';
  strictness: number;
  source: 'PRODUCT' | 'ORGANIZATION' | 'PROJECT' | 'INITIATIVE';
  config: Record<string, unknown>;
}

interface PolicyRow {
  policy_id: string;
  version: number;
  baseline: EffectiveGovernancePolicy['baseline'];
  strictness: number;
  scope_type: EffectiveGovernancePolicy['source'];
  config_json: Record<string, unknown>;
  downgrade_decision_id: string | null;
}

export class GovernancePolicyResolutionError extends Error {}

export class PostgresGovernancePolicyResolver {
  constructor(private readonly pool: Pool) {}

  private async find(
    organizationId: string,
    scopeType: EffectiveGovernancePolicy['source'],
    scopeId: string
  ): Promise<PolicyRow | null> {
    const result = await this.pool.query<PolicyRow>(
      `SELECT policy_id, version, baseline, strictness, scope_type, config_json,
              downgrade_decision_id
         FROM ie_governance_policies
        WHERE organization_id = $1 AND scope_type = $2 AND scope_id = $3 AND status = 'ACTIVE'
        LIMIT 1`,
      [organizationId, scopeType, scopeId]
    );
    return result.rows[0] ?? null;
  }

  async resolve(
    organizationId: string,
    projectId: string,
    initiativeId?: string | null
  ): Promise<EffectiveGovernancePolicy> {
    const product = await this.find('*', 'PRODUCT', 'DEFAULT');
    if (!product) throw new GovernancePolicyResolutionError('Product baseline is missing');
    const organization = await this.find(organizationId, 'ORGANIZATION', organizationId);
    const project = await this.find(organizationId, 'PROJECT', projectId);
    const initiative = initiativeId
      ? await this.find(organizationId, 'INITIATIVE', initiativeId)
      : null;
    const chain = [product, organization, project, initiative].filter(
      (policy): policy is PolicyRow => Boolean(policy)
    );
    for (let index = 1; index < chain.length; index += 1) {
      const parent = chain[index - 1];
      const child = chain[index];
      if (child.strictness < parent.strictness && !child.downgrade_decision_id) {
        throw new GovernancePolicyResolutionError(
          `Governance downgrade ${parent.policy_id} -> ${child.policy_id} requires Decision`
        );
      }
    }
    const effective = chain[chain.length - 1];
    let bindingRows: Array<{
      role_key: string;
      principal_id: string;
      delegation_json: Record<string, unknown> | null;
    }> = [];
    try {
      const bindings = await this.pool.query<{
        role_key: string;
        principal_id: string;
        delegation_json: Record<string, unknown> | null;
      }>(
        `SELECT role_key,principal_id,delegation_json FROM ie_governance_role_bindings WHERE organization_id=$1 AND policy_id=$2 AND policy_version=$3 AND (project_id='*' OR project_id=$4)`,
        [organizationId, effective.policy_id, effective.version, projectId]
      );
      bindingRows = bindings.rows;
    } catch (error: any) {
      if (error?.code !== '42P01') throw error;
    }
    const roleBindings = bindingRows.map((row) => ({
      roleKey: row.role_key,
      principalId: row.principal_id,
      ...(row.delegation_json ?? {}),
    }));
    return {
      policyId: effective.policy_id,
      version: effective.version,
      baseline: effective.baseline,
      strictness: effective.strictness,
      source: effective.scope_type,
      config: { ...(effective.config_json ?? {}), roleBindings },
    };
  }
}
