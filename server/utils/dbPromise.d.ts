declare namespace _default {
    export { all };
    export { get };
    export { run };
    export { transaction };
    export { tableExists };
    export { exec };
    export { safeAll };
    export { count };
    export { dbLogger as logger };
}
export default _default;
/**
 * Promise wrapper for db.all() - returns array of rows
 *
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters (default: [])
 * @param {Object} options - Options { timeout, fallback }
 * @returns {Promise<Array>} - Array of rows (empty array on error if fallback enabled)
 */
declare function all(sql: string, params?: any[], options?: Object): Promise<any[]>;
/**
 * Promise wrapper for db.get() - returns single row
 *
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters (default: [])
 * @param {Object} options - Options { timeout, fallback }
 * @returns {Promise<Object|null>} - Single row or null (null on error if fallback enabled)
 */
declare function get(sql: string, params?: any[], options?: Object): Promise<Object | null>;
/**
 * Promise wrapper for db.run() - executes INSERT/UPDATE/DELETE
 *
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters (default: [])
 * @param {Object} options - Options { timeout, fallback }
 * @returns {Promise<{success: boolean, lastID?: number, changes?: number, error?: string}>}
 */
declare function run(sql: string, params?: any[], options?: Object): Promise<{
    success: boolean;
    lastID?: number;
    changes?: number;
    error?: string;
}>;
/**
 * Execute multiple statements in a transaction
 *
 * @param {Array<{sql: string, params: Array}>} statements - Array of statements
 * @returns {Promise<{success: boolean, results: Array, error?: string}>}
 */
declare function transaction(statements: Array<{
    sql: string;
    params: any[];
}>): Promise<{
    success: boolean;
    results: any[];
    error?: string;
}>;
/**
 * Check if a table exists
 *
 * @param {string} tableName - Name of table to check
 * @returns {Promise<boolean>}
 */
declare function tableExists(tableName: string): Promise<boolean>;
/**
 * Execute raw SQL and return result (for migrations, etc.)
 *
 * @param {string} sql - SQL to execute
 * @returns {Promise<{success: boolean, error?: string}>}
 */
declare function exec(sql: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Safe query wrapper that always returns an array (for SELECT queries)
 * Useful when you want to iterate over results without null checks
 *
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
declare function safeAll(sql: string, params?: any[]): Promise<any[]>;
/**
 * Count rows matching a query
 *
 * @param {string} table - Table name
 * @param {string} where - WHERE clause (without WHERE keyword)
 * @param {Array} params - Query parameters
 * @returns {Promise<number>}
 */
declare function count(table: string, where?: string, params?: any[]): Promise<number>;
declare namespace dbLogger {
    function debug(msg: any, data: any): void;
    function warn(msg: any, data: any): void;
    function error(msg: any, data: any): void;
}
//# sourceMappingURL=dbPromise.d.ts.map