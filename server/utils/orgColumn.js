/**
 * Organization Column Resolver (Fix Pack 2)
 * 
 * Provides a helper to dynamically determine the org column name in tables
 * where naming may vary (org_id vs organization_id).
 * 
 * This is the MVP-safe approach that avoids risky schema migrations.
 */

const db = require('../database');

/**
 * Get the organization column name for a given table.
 * 
 * @param {string} tableName - The table to check
 * @returns {Promise<string>} - Column name ('organization_id' or 'org_id')
 * @throws {Error} - If no org column found
 */
async function getOrgColumn(tableName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, cols) => {
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
const columnCache = {};

async function getOrgColumnCached(tableName) {
    if (!columnCache[tableName]) {
        columnCache[tableName] = await getOrgColumn(tableName);
    }
    return columnCache[tableName];
}

/**
 * Build a WHERE clause for org filtering.
 * 
 * @param {string} tableName - Table name or alias
 * @param {string} orgId - Organization ID value
 * @returns {Promise<{clause: string, value: string}>}
 */
async function orgWhereClause(tableName, orgId) {
    const col = await getOrgColumnCached(tableName);
    return {
        clause: `${tableName}.${col} = ?`,
        value: orgId
    };
}

module.exports = {
    getOrgColumn,
    getOrgColumnCached,
    orgWhereClause
};
