/**
 * Organization Column Resolver (Fix Pack 2)
 * 
 * Provides a helper to dynamically determine the org column name in tables
 * where naming may vary (org_id vs organization_id).
 * 
 * This is the MVP-safe approach that avoids risky schema migrations.
 */

import db from '../database';

interface TableColumn {
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
}

/**
 * Get the organization column name for a given table.
 * 
 * @param tableName - The table to check
 * @returns Column name ('organization_id' or 'org_id')
 * @throws Error - If no org column found
 */
export async function getOrgColumn(tableName: string): Promise<string> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err: Error | null, cols: TableColumn[]) => {
            if (err) return reject(err);

            const names = (cols || []).map(c => c.name);

            if (names.includes('organization_id')) {
                return resolve('organization_id');
            }
            if (names.includes('org_id')) {
                return resolve('org_id');
            }

            reject(new Error(`Table ${tableName} has no organization column (expected 'organization_id' or 'org_id')`));
        });
    });
}

/**
 * Preset resolvers for common tables.
 * Caches the result after first lookup.
 */
const columnCache: Record<string, string> = {};

export async function getOrgColumnCached(tableName: string): Promise<string> {
    if (!columnCache[tableName]) {
        columnCache[tableName] = await getOrgColumn(tableName);
    }
    return columnCache[tableName];
}

export interface OrgWhereClause {
    clause: string;
    value: string;
}

/**
 * Build a WHERE clause for org filtering.
 * 
 * @param tableName - Table name or alias
 * @param orgId - Organization ID value
 * @returns Promise with clause and value
 */
export async function orgWhereClause(tableName: string, orgId: string): Promise<OrgWhereClause> {
    const col = await getOrgColumnCached(tableName);
    return {
        clause: `${tableName}.${col} = ?`,
        value: orgId
    };
}

