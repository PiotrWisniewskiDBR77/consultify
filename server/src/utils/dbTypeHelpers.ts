/**
 * Database Type Helpers
 * Utility functions for type-safe database query results
 */

/**
 * Type assertion helper for database query results
 * Converts unknown/{} types to Record<string, unknown>
 */
export function asRecord<T = Record<string, unknown>>(obj: unknown): T {
    return obj as T;
}

/**
 * Type assertion helper for array of database query results
 */
export function asRecordArray<T = Record<string, unknown>>(arr: unknown): T[] {
    return arr as unknown[] as T[];
}

/**
 * Type guard to check if value is a record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if value is an array of records
 */
export function isRecordArray(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.every(isRecord);
}

/**
 * Safe property accessor for database records
 */
export function getProperty<T = unknown>(record: Record<string, unknown>, key: string): T | undefined {
    return record[key] as T | undefined;
}

/**
 * Safe property accessor with default value
 */
export function getPropertyWithDefault<T>(record: Record<string, unknown>, key: string, defaultValue: T): T {
    return (record[key] as T | undefined) ?? defaultValue;
}
