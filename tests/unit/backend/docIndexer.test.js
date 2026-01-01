import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';
import path from 'path';

// Mock fs
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn()
    }
}));

describe('DocIndexer Service', () => {
    let DocIndexer;
    let docIndexer;
    let originalCwd;

    beforeEach(() => {
        originalCwd = process.cwd();
        vi.clearAllMocks();
        
        // Mock console methods
        global.console = {
            ...console,
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        // Reset module cache
        vi.resetModules();
        
        // Mock fs.existsSync to return true for test files
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('# Test Document\n\n## Section 1\n\nContent here.\n\n## Section 2\n\nMore content.');
        
        const module = require('../../../server/services/ai/docIndexer');
        DocIndexer = module.DocIndexer;
        docIndexer = new DocIndexer();
    });

    afterEach(() => {
        process.cwd = () => originalCwd;
        vi.restoreAllMocks();
    });

    describe('DocIndexer class', () => {
        it('should create instance', () => {
            const indexer = new DocIndexer();
            expect(indexer).toBeDefined();
            expect(indexer.indexedDocs).toBeDefined();
            expect(indexer.projectRoot).toBeDefined();
        });

        it('should chunk content correctly', () => {
            const indexer = new DocIndexer();
            const content = '# Title\n\n## Section 1\n\nParagraph 1.\n\nParagraph 2.\n\n## Section 2\n\nParagraph 3.';
            const chunks = indexer.chunkContent(content, 100);
            
            expect(chunks.length).toBeGreaterThan(0);
            chunks.forEach(chunk => {
                expect(chunk.length).toBeGreaterThan(50);
            });
        });

        it('should handle large content by splitting into chunks', () => {
            const indexer = new DocIndexer();
            const largeContent = '# Title\n\n' + 'x'.repeat(2000);
            const chunks = indexer.chunkContent(largeContent, 500);
            
            expect(chunks.length).toBeGreaterThan(1);
        });

        it('should filter out small chunks', () => {
            const indexer = new DocIndexer();
            const content = 'Short';
            const chunks = indexer.chunkContent(content, 100);
            
            expect(chunks.length).toBe(0);
        });

        it('should search indexed documents', async () => {
            const indexer = new DocIndexer();
            
            // Mock indexed docs
            indexer.indexedDocs.set('test.md', {
                path: 'test.md',
                category: 'test',
                priority: 1,
                content: 'Test content with keyword',
                chunks: ['chunk with keyword', 'another chunk'],
                indexedAt: new Date().toISOString()
            });

            const results = indexer.search('keyword');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].score).toBeGreaterThan(0);
        });

        it('should filter search by category', async () => {
            const indexer = new DocIndexer();
            
            indexer.indexedDocs.set('test1.md', {
                path: 'test1.md',
                category: 'test',
                priority: 1,
                content: 'Test content',
                chunks: ['chunk with keyword'],
                indexedAt: new Date().toISOString()
            });

            indexer.indexedDocs.set('test2.md', {
                path: 'test2.md',
                category: 'other',
                priority: 1,
                content: 'Other content',
                chunks: ['chunk with keyword'],
                indexedAt: new Date().toISOString()
            });

            const results = indexer.search('keyword', { category: 'test' });
            
            expect(results.every(r => r.category === 'test')).toBe(true);
        });

        it('should limit search results', async () => {
            const indexer = new DocIndexer();
            
            // Add multiple matching docs
            for (let i = 0; i < 10; i++) {
                indexer.indexedDocs.set(`test${i}.md`, {
                    path: `test${i}.md`,
                    category: 'test',
                    priority: 1,
                    content: 'Test content with keyword',
                    chunks: ['chunk with keyword'],
                    indexedAt: new Date().toISOString()
                });
            }

            const results = indexer.search('keyword', { limit: 5 });
            
            expect(results.length).toBeLessThanOrEqual(5);
        });

        it('should get context for topic', async () => {
            const indexer = new DocIndexer();
            
            indexer.indexedDocs.set('test.md', {
                path: 'test.md',
                category: 'test',
                priority: 1,
                content: 'Language independence principles',
                chunks: ['chunk about language independence'],
                indexedAt: new Date().toISOString()
            });

            const context = indexer.getContextForTopic('language');
            
            expect(context).toBeDefined();
            expect(typeof context).toBe('string');
        });

        it('should get prompt engineering KB', () => {
            const indexer = new DocIndexer();
            const kb = indexer.getPromptEngineeringKB();
            
            expect(kb).toBeDefined();
            expect(kb.length).toBeGreaterThan(0);
        });

        it('should get indexed documents metadata', async () => {
            const indexer = new DocIndexer();
            
            indexer.indexedDocs.set('test.md', {
                path: 'test.md',
                category: 'test',
                priority: 1,
                content: 'Test',
                chunks: ['chunk1', 'chunk2'],
                indexedAt: new Date().toISOString()
            });

            const docs = indexer.getIndexedDocuments();
            
            expect(docs.length).toBe(1);
            expect(docs[0].path).toBe('test.md');
            expect(docs[0].chunkCount).toBe(2);
        });

        it('should get statistics', async () => {
            const indexer = new DocIndexer();
            
            indexer.indexedDocs.set('test1.md', {
                path: 'test1.md',
                category: 'test',
                priority: 1,
                content: 'Test content',
                chunks: ['chunk1', 'chunk2'],
                indexedAt: new Date().toISOString()
            });

            indexer.indexedDocs.set('test2.md', {
                path: 'test2.md',
                category: 'test',
                priority: 1,
                content: 'More content',
                chunks: ['chunk3'],
                indexedAt: new Date().toISOString()
            });

            const stats = indexer.getStats();
            
            expect(stats.documentCount).toBe(2);
            expect(stats.totalChunks).toBe(3);
            expect(stats.totalCharacters).toBeGreaterThan(0);
            expect(stats.categoryCounts.test).toBe(2);
        });

        it('should handle missing documents gracefully', async () => {
            const indexer = new DocIndexer();
            fs.existsSync.mockReturnValue(false);
            
            await indexer.indexDocument({
                path: 'nonexistent.md',
                category: 'test',
                priority: 1
            });
            
            // Should not throw
            expect(indexer.indexedDocs.has('nonexistent.md')).toBe(false);
        });
    });

    describe('PROMPT_ENGINEERING_KB', () => {
        it('should export prompt engineering knowledge base', () => {
            const module = require('../../../server/services/ai/docIndexer');
            expect(module.PROMPT_ENGINEERING_KB).toBeDefined();
            expect(module.PROMPT_ENGINEERING_KB.length).toBeGreaterThan(0);
        });
    });
});


