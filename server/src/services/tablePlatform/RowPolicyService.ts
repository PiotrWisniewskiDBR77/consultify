/**
 * Table Platform Row Policy Service
 * Row-level permission policies that restrict record visibility and editability per role.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export interface RowPolicy {
  id: string;
  table_id: string;
  name: string;
  role: string;
  condition_field_id: string | null;
  condition_operator: string;
  condition_value: string | null;
  permission: 'read' | 'write' | 'none';
  is_active: boolean;
  created_at: string;
}

type EffectivePermission = 'read' | 'write' | 'none';

const VALID_OPERATORS = new Set([
  'equals',
  'not_equals',
  'contains',
  'is_empty',
  'is_not_empty',
  'gt',
  'lt',
  'gte',
  'lte',
]);

const VALID_PERMISSIONS = new Set(['read', 'write', 'none']);

function sanitizeFieldKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '');
}

const rowPolicyService = {
  async createPolicy(
    tableId: string,
    name: string,
    role: string,
    conditionFieldId: string | undefined,
    conditionOperator: string,
    conditionValue: string | undefined,
    permission: string
  ): Promise<RowPolicy> {
    const db = getDatabase();
    try {
      if (!VALID_OPERATORS.has(conditionOperator)) {
        throw new Error(`Invalid condition_operator: ${conditionOperator}`);
      }
      if (!VALID_PERMISSIONS.has(permission)) {
        throw new Error(`Invalid permission: ${permission}`);
      }

      const result = await db.query(
        `INSERT INTO tp_row_policies (table_id, name, role, condition_field_id, condition_operator, condition_value, permission)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          tableId,
          name,
          role,
          conditionFieldId ?? null,
          conditionOperator,
          conditionValue ?? null,
          permission,
        ]
      );
      return result.rows[0] as RowPolicy;
    } catch (e) {
      logger.error('[RowPolicyService] createPolicy failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listPolicies(tableId: string): Promise<RowPolicy[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT * FROM tp_row_policies WHERE table_id = $1 ORDER BY created_at ASC',
        [tableId]
      );
      return result.rows as RowPolicy[];
    } catch (e) {
      logger.error('[RowPolicyService] listPolicies failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async updatePolicy(
    policyId: string,
    updates: Partial<
      Pick<
        RowPolicy,
        | 'name'
        | 'role'
        | 'condition_field_id'
        | 'condition_operator'
        | 'condition_value'
        | 'permission'
        | 'is_active'
      >
    >
  ): Promise<RowPolicy | null> {
    const db = getDatabase();
    try {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.role !== undefined) {
        setClauses.push(`role = $${idx++}`);
        values.push(updates.role);
      }
      if (updates.condition_field_id !== undefined) {
        setClauses.push(`condition_field_id = $${idx++}`);
        values.push(updates.condition_field_id);
      }
      if (updates.condition_operator !== undefined) {
        if (!VALID_OPERATORS.has(updates.condition_operator)) {
          throw new Error(`Invalid condition_operator: ${updates.condition_operator}`);
        }
        setClauses.push(`condition_operator = $${idx++}`);
        values.push(updates.condition_operator);
      }
      if (updates.condition_value !== undefined) {
        setClauses.push(`condition_value = $${idx++}`);
        values.push(updates.condition_value);
      }
      if (updates.permission !== undefined) {
        if (!VALID_PERMISSIONS.has(updates.permission)) {
          throw new Error(`Invalid permission: ${updates.permission}`);
        }
        setClauses.push(`permission = $${idx++}`);
        values.push(updates.permission);
      }
      if (updates.is_active !== undefined) {
        setClauses.push(`is_active = $${idx++}`);
        values.push(updates.is_active);
      }

      if (setClauses.length === 0) return null;

      values.push(policyId);
      const result = await db.query(
        `UPDATE tp_row_policies SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      return (result.rows[0] as RowPolicy) ?? null;
    } catch (e) {
      logger.error('[RowPolicyService] updatePolicy failed', {
        policyId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deletePolicy(policyId: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const result = await db.query('DELETE FROM tp_row_policies WHERE id = $1', [policyId]);
      return (result as any).rowCount > 0;
    } catch (e) {
      logger.error('[RowPolicyService] deletePolicy failed', {
        policyId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async evaluateAccess(
    tableId: string,
    recordData: Record<string, unknown>,
    _userId: string,
    userRole: string
  ): Promise<EffectivePermission> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT * FROM tp_row_policies
         WHERE table_id = $1 AND is_active = true AND role = $2
         ORDER BY created_at ASC`,
        [tableId, userRole]
      );
      const policies = result.rows as RowPolicy[];

      if (policies.length === 0) return 'write';

      let effective: EffectivePermission = 'write';

      for (const policy of policies) {
        const matches = this._evaluateCondition(policy, recordData);
        if (matches) {
          if (policy.permission === 'none') return 'none';
          if (policy.permission === 'read' && effective === 'write') {
            effective = 'read';
          }
        }
      }

      return effective;
    } catch (e) {
      logger.error('[RowPolicyService] evaluateAccess failed', {
        tableId,
        error: (e as Error).message,
      });
      return 'write';
    }
  },

  _evaluateCondition(policy: RowPolicy, recordData: Record<string, unknown>): boolean {
    if (!policy.condition_field_id) return true;

    const fieldValue = String(recordData[policy.condition_field_id] ?? '');
    const conditionValue = policy.condition_value ?? '';

    switch (policy.condition_operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'contains':
        return fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
      case 'is_empty':
        return fieldValue === '' || fieldValue === 'undefined' || fieldValue === 'null';
      case 'is_not_empty':
        return fieldValue !== '' && fieldValue !== 'undefined' && fieldValue !== 'null';
      case 'gt':
        return parseFloat(fieldValue) > parseFloat(conditionValue);
      case 'lt':
        return parseFloat(fieldValue) < parseFloat(conditionValue);
      case 'gte':
        return parseFloat(fieldValue) >= parseFloat(conditionValue);
      case 'lte':
        return parseFloat(fieldValue) <= parseFloat(conditionValue);
      default:
        return true;
    }
  },

  async buildRowFilterClause(
    tableId: string,
    userRole: string,
    params: unknown[],
    startIdx: number
  ): Promise<{ sql: string; nextIdx: number }> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT * FROM tp_row_policies
         WHERE table_id = $1 AND is_active = true AND role = $2 AND permission = 'none'
         ORDER BY created_at ASC`,
        [tableId, userRole]
      );
      const denyPolicies = result.rows as RowPolicy[];

      if (denyPolicies.length === 0) {
        return { sql: 'TRUE', nextIdx: startIdx };
      }

      const exclusions: string[] = [];
      let idx = startIdx;

      for (const policy of denyPolicies) {
        if (!policy.condition_field_id) {
          return { sql: 'FALSE', nextIdx: idx };
        }

        const safeKey = sanitizeFieldKey(policy.condition_field_id);
        if (!safeKey) continue;

        const dataKey = `r.data->>$${idx}`;
        params.push(policy.condition_field_id);
        idx++;

        switch (policy.condition_operator) {
          case 'equals':
            params.push(policy.condition_value);
            exclusions.push(`NOT (${dataKey} = $${idx})`);
            idx++;
            break;
          case 'not_equals':
            params.push(policy.condition_value);
            exclusions.push(`NOT (${dataKey} != $${idx} OR ${dataKey} IS NULL)`);
            idx++;
            break;
          case 'contains':
            params.push(`%${policy.condition_value ?? ''}%`);
            exclusions.push(`NOT (${dataKey} ILIKE $${idx})`);
            idx++;
            break;
          case 'is_empty':
            exclusions.push(`NOT (${dataKey} IS NULL OR ${dataKey} = '')`);
            break;
          case 'is_not_empty':
            exclusions.push(`NOT (${dataKey} IS NOT NULL AND ${dataKey} != '')`);
            break;
          case 'gt':
            params.push(policy.condition_value);
            exclusions.push(`NOT ((${dataKey})::numeric > ($${idx})::numeric)`);
            idx++;
            break;
          case 'lt':
            params.push(policy.condition_value);
            exclusions.push(`NOT ((${dataKey})::numeric < ($${idx})::numeric)`);
            idx++;
            break;
          case 'gte':
            params.push(policy.condition_value);
            exclusions.push(`NOT ((${dataKey})::numeric >= ($${idx})::numeric)`);
            idx++;
            break;
          case 'lte':
            params.push(policy.condition_value);
            exclusions.push(`NOT ((${dataKey})::numeric <= ($${idx})::numeric)`);
            idx++;
            break;
          default:
            break;
        }
      }

      if (exclusions.length === 0) {
        return { sql: 'TRUE', nextIdx: idx };
      }

      return { sql: exclusions.join(' AND '), nextIdx: idx };
    } catch (e) {
      logger.error('[RowPolicyService] buildRowFilterClause failed', {
        tableId,
        userRole,
        error: (e as Error).message,
      });
      return { sql: 'TRUE', nextIdx: startIdx };
    }
  },
};

export default rowPolicyService;
