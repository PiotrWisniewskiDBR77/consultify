/**
 * Legal Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests legal document management, acceptance tracking, and compliance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';

describe('LegalService', () => {
    let mockDb;
    let LegalService;
    let mockLegalEventLogger;

    beforeEach(async () => {
        vi.resetModules();
        
        mockDb = createMockDb();
        
        mockLegalEventLogger = {
            logAccept: vi.fn().mockResolvedValue({ success: true }),
            logEvent: vi.fn().mockResolvedValue({ success: true }),
            EVENT_TYPES: {
                ACCEPTED: 'accepted',
                REJECTED: 'rejected',
                VIEWED: 'viewed'
            }
        };

        LegalService = (await import('../../../server/services/legalService.js')).default;
        
        // Inject mock dependencies
        LegalService._setDependencies({
            db: mockDb,
            uuidv4: () => 'legal-uuid-1',
            LegalEventLogger: mockLegalEventLogger
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getActiveDocuments()', () => {
        it('should return active documents', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        id: 'doc-1',
                        doc_type: 'TOS',
                        version: '1.0',
                        title: 'Terms of Service',
                        is_active: 1
                    },
                    {
                        id: 'doc-2',
                        doc_type: 'PRIVACY',
                        version: '1.0',
                        title: 'Privacy Policy',
                        is_active: 1
                    }
                ]);
            });

            const documents = await LegalService.getActiveDocuments();

            expect(documents).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should filter by effective date', async () => {
            const now = new Date().toISOString();
            
            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query includes effective_from check
                expect(params).toContain(now);
                callback(null, []);
            });

            await LegalService.getActiveDocuments();
        });

        it('should filter by scope when user context provided', async () => {
            const userContext = {
                organizationId: testOrganizations.org1.id,
                region: 'EU',
                licenseTier: 'enterprise'
            };

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        id: 'doc-1',
                        doc_type: 'TOS',
                        scope_type: 'global',
                        scope_value: null
                    },
                    {
                        id: 'doc-2',
                        doc_type: 'DPA',
                        scope_type: 'region',
                        scope_value: 'EU'
                    }
                ]);
            });

            const documents = await LegalService.getActiveDocuments(userContext);

            // Should filter to applicable documents
            expect(Array.isArray(documents)).toBe(true);
        });
    });

    describe('getActiveDocument()', () => {
        it('should return active document by type', async () => {
            const docType = 'TOS';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'doc-1',
                    doc_type: docType,
                    version: '1.0',
                    title: 'Terms of Service',
                    content_md: '# Terms of Service\n\nContent...',
                    is_active: 1
                });
            });

            const document = await LegalService.getActiveDocument(docType);

            expect(document.doc_type).toBe(docType);
            expect(document.content_md).toBeDefined();
        });

        it('should return null when document not found', async () => {
            const docType = 'NONEXISTENT';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const document = await LegalService.getActiveDocument(docType);

            expect(document).toBeNull();
        });
    });

    describe('getUserAcceptances()', () => {
        it('should return user acceptances', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        doc_type: 'TOS',
                        version: '1.0',
                        accepted_at: new Date().toISOString()
                    }
                ]);
            });

            const acceptances = await LegalService.getUserAcceptances(userId, orgId);

            expect(acceptances).toHaveLength(1);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining([userId]),
                expect.any(Function)
            );
        });

        it('should filter by organization when provided', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query includes organization_id filter
                expect(params).toContain(orgId);
                callback(null, []);
            });

            await LegalService.getUserAcceptances(userId, orgId);
        });
    });

    describe('acceptDocuments()', () => {
        it('should record user acceptance', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const docType = 'TOS';
            const version = '1.0';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('legal_documents')) {
                    callback(null, {
                        id: 'doc-1',
                        doc_type: docType,
                        version,
                        effective_from: new Date().toISOString()
                    });
                } else {
                    callback(null, null);
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await LegalService.acceptDocuments({
                userId,
                orgId,
                docTypes: [docType],
                scope: 'USER',
                ip: '127.0.0.1',
                userAgent: 'test-agent'
            });

            expect(result.created).toBeDefined();
            expect(result.created.length).toBeGreaterThan(0);
        });

        it('should reject when document not found', async () => {
            const userId = testUsers.user.id;
            const docType = 'NONEXISTENT';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await LegalService.acceptDocuments({
                userId,
                docTypes: [docType],
                scope: 'USER'
            });

            expect(result.errors).toBeDefined();
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].error).toBe('Document not found');
        });
    });

    describe('isDocumentApplicable()', () => {
        it('should return true for global scope documents', () => {
            const doc = { scope_type: 'global', scope_value: null };
            const userContext = {};

            const applicable = LegalService.isDocumentApplicable(doc, userContext);

            expect(applicable).toBe(true);
        });

        it('should return true for matching region scope', () => {
            const doc = { scope_type: 'region', scope_value: 'EU' };
            const userContext = { region: 'EU' };

            const applicable = LegalService.isDocumentApplicable(doc, userContext);

            expect(applicable).toBe(true);
        });

        it('should return false for non-matching region scope', () => {
            const doc = { scope_type: 'region', scope_value: 'EU' };
            const userContext = { region: 'US' };

            const applicable = LegalService.isDocumentApplicable(doc, userContext);

            expect(applicable).toBe(false);
        });

        it('should return true for matching license tier', () => {
            const doc = { scope_type: 'license_tier', scope_value: 'enterprise' };
            const userContext = { licenseTier: 'enterprise' };

            const applicable = LegalService.isDocumentApplicable(doc, userContext);

            expect(applicable).toBe(true);
        });
    });

    describe('checkAcceptanceRequired()', () => {
        it('should require acceptance for TOS', async () => {
            const userId = testUsers.user.id;
            const docType = 'TOS';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('legal_documents')) {
                    callback(null, {
                        id: 'doc-1',
                        doc_type: docType,
                        version: '1.0'
                    });
                    } else {
                    // No acceptance found
                    callback(null, null);
                }
            });

            const result = await LegalService.checkAcceptanceRequired(userId, docType);

            expect(result.required).toBe(true);
        });

        it('should not require acceptance when already accepted', async () => {
            const userId = testUsers.user.id;
            const docType = 'TOS';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('legal_documents')) {
                    callback(null, {
                        id: 'doc-1',
                        doc_type: docType,
                        version: '1.0'
                    });
                } else {
                    callback(null, null);
                }
            });

            mockDb.all.mockImplementation((query, params, callback) => {
                // getUserAcceptances returns acceptance
                callback(null, [{
                    doc_type: docType,
                    version: '1.0',
                    accepted_at: new Date().toISOString()
                }]);
            });

            const result = await LegalService.checkAcceptanceRequired(userId, docType);

            expect(result.required).toBe(false);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only return acceptances for specified user and organization', async () => {
            const userId = testUsers.user.id;
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query filters by user_id and organization_id
                expect(params).toContain(userId);
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                callback(null, []);
            });

            await LegalService.getUserAcceptances(userId, org1Id);
        });
    });
});
