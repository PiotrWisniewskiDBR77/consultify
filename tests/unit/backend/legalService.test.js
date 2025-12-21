import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('uuid', () => ({
    v4: () => 'uuid-1234'
}));

const mockLegalEventLogger = {
    logPublish: vi.fn(),
    logAccept: vi.fn(),
    logOrgAcceptComplete: vi.fn()
};

vi.mock('../../../server/services/legalEventLogger', () => ({
    LegalEventLogger: mockLegalEventLogger,
    EVENT_TYPES: {}
}));

import LegalService from '../../../server/services/legalService.js';

describe('LegalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });

        mockDb.run.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });
    });

    describe('getActiveDocuments', () => {
        it('should return active documents', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: 'doc-1', doc_type: 'TOS', version: '1.0' }]);
                }
            });

            const docs = await LegalService.getActiveDocuments();
            expect(docs).toHaveLength(1);
        });
    });

    describe('isDocumentApplicable', () => {
        it('should match global scope', () => {
            const doc = { scope_type: 'global' };
            const result = LegalService.isDocumentApplicable(doc, {});
            expect(result).toBe(true);
        });

        it('should match region scope', () => {
            const doc = { scope_type: 'region', scope_value: 'EU' };
            const result = LegalService.isDocumentApplicable(doc, { region: 'EU' });
            expect(result).toBe(true);
        });

        it('should mismatch region scope', () => {
            const doc = { scope_type: 'region', scope_value: 'EU' };
            const result = LegalService.isDocumentApplicable(doc, { region: 'US' });
            expect(result).toBe(false);
        });
    });

    describe('acceptDocuments', () => {
        it('should accept generic user documents', async () => {
            // Mock existing active doc
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (args[0].includes('FROM legal_documents')) {
                        cb(null, [{ id: 'doc-1', doc_type: 'TOS', version: '1.0', scope_type: 'global' }]);
                    } else {
                        cb(null, []); // No existing acceptances
                    }
                }
            });

            const result = await LegalService.acceptDocuments({
                userId: 'user-1',
                docTypes: ['TOS'],
                ip: '127.0.0.1'
            });

            expect(result.accepted).toHaveLength(1);
            expect(mockLegalEventLogger.logAccept).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO legal_acceptances'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should validate org admin role for DPA', async () => {
            // Mock DPA doc
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: 'doc-1', doc_type: 'DPA', version: '1.0', scope_type: 'global' }]);
                }
            });

            // Attempt as regular user
            await expect(LegalService.acceptDocuments({
                userId: 'user-1',
                orgId: 'org-1',
                docTypes: ['DPA'],
                userRole: 'USER'
            })).rejects.toThrow('requires ORGANIZATION_ADMIN');
        });
    });

    describe('publishDocument', () => {
        it('should publish new version', async () => {
            const docParams = {
                docType: 'TOS',
                version: '2.0',
                title: 'New TOS',
                contentMd: 'Content',
                createdBy: 'admin',
                effectiveFrom: '2024-01-01'
            };

            const result = await LegalService.publishDocument(docParams);

            expect(result.success).toBe(true);
            expect(mockLegalEventLogger.logPublish).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO legal_documents'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });
});
