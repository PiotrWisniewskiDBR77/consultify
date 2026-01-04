import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';

describe('Ingestion Service', () => {
    let IngestionService;
    let mockDb;
    let mockRagService;

    beforeEach(async () => {
        vi.resetModules();

        // 1. Setup mocks
        mockDb = createMockDb();
        mockRagService = {
            storeChunks: vi.fn().mockResolvedValue({})
        };

        // 2. Register mocks for subsequent imports
        vi.doMock('../../../server/database.js', () => ({ default: mockDb }));
        vi.doMock('../../../server/src/services/ragService.js', () => ({ default: mockRagService }));

        // Mock fs and pdf-parse just in case they are used or cause issues
        vi.doMock('fs', () => ({
            default: {
                readFileSync: vi.fn(),
                unlinkSync: vi.fn()
            },
            readFileSync: vi.fn(),
            unlinkSync: vi.fn()
        }));
        vi.doMock('pdf-parse', () => ({ default: vi.fn() }));

        // 3. Dynamic import of the system under test
        const module = await import('../../../server/src/services/ingestionService.js');
        IngestionService = module.default;

        // 4. Manual injection (redundant but safe)
        IngestionService.setDependencies({
            db: mockDb,
            RagService: mockRagService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database.js');
        vi.doUnmock('../../../server/src/services/ragService.js');
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

            // Spy on statement run
            const mockStmtRun = vi.fn((...args) => {
                const cb = args.length > 0 && typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
                if (cb) cb(null);
            });

            mockDb.prepare.mockReturnValue({
                run: mockStmtRun,
                finalize: vi.fn()
            });

            await IngestionService.storeDocument(docId, organizationId, metadata, content);

            expect(mockDb.prepare).toHaveBeenCalled();
            expect(mockStmtRun).toHaveBeenCalled();
        });
    });
});
