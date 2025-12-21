import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('Ingestion Service', () => {
    let IngestionService;
    let mockDb;
    let mockRagService;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();
        mockRagService = {
            storeChunks: vi.fn().mockResolvedValue({})
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('../../../server/services/ragService', () => ({ default: mockRagService }));

        IngestionService = require('../../../server/services/ingestionService.js');
        
        // Inject mock dependencies
        IngestionService.setDependencies({
            db: mockDb,
            RagService: mockRagService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/services/ragService');
    });

    describe('chunkText', () => {
        it('should split text into chunks', () => {
            const text = 'a'.repeat(2000);
            const chunks = IngestionService.chunkText(text, 1000, 200);
            
            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks[0].length).toBeLessThanOrEqual(1000);
        });

        it('should handle empty text', () => {
            const chunks = IngestionService.chunkText('', 1000, 200);
            expect(chunks).toEqual([]);
        });
    });

    describe('storeDocument', () => {
        it('should store document in database', async () => {
            const docId = 'doc-123';
            const organizationId = 'org-123';
            const metadata = {
                filename: 'test.pdf',
                type: 'application/pdf',
                size: 1024,
                uploaded_at: new Date().toISOString()
            };
            const content = 'Test content';

            const mockStmt = {
                run: vi.fn((...args) => {
                    const callback = args[args.length - 1];
                    if (typeof callback === 'function') {
                        callback(null);
                    }
                }),
                finalize: vi.fn()
            };

            mockDb.prepare.mockReturnValue(mockStmt);

            await IngestionService.storeDocument(docId, organizationId, metadata, content);

            expect(mockDb.prepare).toHaveBeenCalled();
            expect(mockStmt.run).toHaveBeenCalled();
        });
    });
});
