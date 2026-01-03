/**
 * Common Type Definitions
 * Shared types for reducing any/unknown usage across the codebase
 */

// Database query result types
export interface DatabaseRow {
    [key: string]: unknown;
}

export interface DatabaseQueryResult<T = DatabaseRow> {
    rows: T[];
    rowCount: number;
}

// API Request/Response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Middleware types
export interface RequestData {
    [key: string]: unknown;
}

export interface ResponseData {
    [key: string]: unknown;
}

// Database callback types (for migration from callbacks)
export type DatabaseCallback<T = DatabaseRow> = (err: Error | null, result?: T) => void;
export type DatabaseRowsCallback<T = DatabaseRow[]> = (err: Error | null, rows?: T) => void;

// Generic utility types
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
    [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {}



