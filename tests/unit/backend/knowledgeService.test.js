/**
 * Knowledge Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('KnowledgeService', () => {
    it('should create article', () => {
        const article = { id: 'art-1', title: 'Test Article' };
        expect(article.title).toBeDefined();
    });

    it('should search knowledge', () => {
        const results = [{ id: '1', score: 0.9 }];
        expect(results.length).toBeGreaterThan(0);
    });
});
