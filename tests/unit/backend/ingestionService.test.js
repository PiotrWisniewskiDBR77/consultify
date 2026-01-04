import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Ingestion Service Tests
 * Tests for data import/export and document processing
 * CRITICAL FOR ENTERPRISE DATA MANAGEMENT
 */
describe('Ingestion Service', () => {
    let IngestionService;
    let mocks;

    beforeEach(async () => {
        vi.resetModules();

        // Setup unified mocks
        mocks = setupStandardTest();
        
        // Service-specific RAG service mock
        mocks.ragService = {
            storeChunks: vi.fn().mockResolvedValue({})
        };

        // Register mocks for subsequent imports
        vi.doMock('../../../server/database.js', () => ({ default: mocks.db }));
        vi.doMock('../../../server/src/services/ragService.js', () => ({ default: mocks.ragService }));

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

        // Dynamic import of the system under test
        const module = await import('../../../server/src/services/ingestionService.js');
        IngestionService = module.default;

        // Inject dependencies using unified pattern
        IngestionService.setDependencies({
            db: mocks.db,
            RagService: mocks.ragService
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

            mocks.db.prepare.mockReturnValue({
                run: mockStmtRun,
                finalize: vi.fn()
            });

            await IngestionService.storeDocument(docId, organizationId, metadata, content);

            expect(mocks.db.prepare).toHaveBeenCalled();
            expect(mockStmtRun).toHaveBeenCalled();
        });
    });
});
