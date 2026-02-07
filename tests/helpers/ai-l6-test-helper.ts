/**
 * AI L6 Test Helper
 * Shared utilities for L6 AI integration tests.
 *
 * Provides mock LLM, database initialization, and test fixtures.
 */

import { vi } from 'vitest';

// ============================================================================
// Mock OpenAI Provider (prevents real API calls)
// ============================================================================

export function createMockOpenAIProvider() {
    return {
        embed: vi.fn().mockResolvedValue({
            data: [{ embedding: Array(1536).fill(0).map(() => Math.random() * 2 - 1) }],
        }),
        complete: vi.fn().mockResolvedValue({
            text: 'Mock AI response for testing',
            tokens: { prompt: 50, completion: 100 },
            model: 'gpt-4o-mini',
        }),
        chat: vi.fn().mockResolvedValue({
            choices: [{ message: { role: 'assistant', content: 'Mock response' } }],
        }),
    };
}

// ============================================================================
// Test Fixtures
// ============================================================================

export const TEST_USER = {
    id: 'l6-test-user-001',
    organizationId: 'l6-test-org-001',
    email: 'l6test@example.com',
    role: 'ADMIN',
};

export const TEST_ORG = {
    id: 'l6-test-org-001',
    name: 'L6 Test Organization',
    plan: 'enterprise',
};

export const TEST_CONVERSATION = {
    id: 'l6-test-conv-001',
    userId: TEST_USER.id,
    organizationId: TEST_ORG.id,
    title: 'L6 Test Conversation',
};

export const TEST_EMBEDDING_TEXT = 'This is a sample document about project management best practices for enterprise consulting.';

export const TEST_FEEDBACK = {
    userId: TEST_USER.id,
    organizationId: TEST_ORG.id,
    feedbackType: 'like' as const,
    rating: 5,
    comment: 'Great response, very helpful.',
};

// ============================================================================
// Vector Helpers
// ============================================================================

/**
 * Generate a deterministic test vector of given dimensions.
 * Useful for cosine similarity testing.
 */
export function generateTestVector(dimensions: number, seed: number = 1): number[] {
    const vector: number[] = [];
    let x = seed;
    for (let i = 0; i < dimensions; i++) {
        // Simple PRNG for deterministic vectors
        x = (x * 16807) % 2147483647;
        vector.push((x / 2147483647) * 2 - 1);
    }
    return vector;
}

/**
 * Compute cosine similarity between two vectors (standalone, for test verification).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Run SQL on the test database, ignoring "table already exists" errors.
 */
export async function safeExecSql(db: any, sql: string): Promise<void> {
    return new Promise<void>((resolve) => {
        db.run(sql, (err: any) => {
            if (err && !err.message?.includes('already exists')) {
                console.warn(`SQL warning: ${err.message}`);
            }
            resolve();
        });
    });
}

/**
 * Query all rows from the database.
 */
export async function queryAll(db: any, sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err: any, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Query single row from the database.
 */
export async function queryOne(db: any, sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Run a write query on the test database.
 */
export async function execSql(db: any, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (this: any, err: any) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
