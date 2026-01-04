/**
 * Evidence Ledger Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests evidence management, PII redaction, explainability links, and reasoning ledger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';
import EvidenceLedgerService from '../../../server/src/services/evidenceLedgerService.js';

describe('EvidenceLedgerService', () => {
    let mockDb;
    let uuidCounter = 0;

    beforeEach(async () => {
        uuidCounter = 0;
        mockDb = createMockDb();

        EvidenceLedgerService.setDependencies({
            db: mockDb,
            uuidv4: () => `evidence-${++uuidCounter}`
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('redactPayload()', () => {
        it('should redact PII fields from payload', () => {
            const payload = {
                email: 'user@test.com',
                firstName: 'John',
                lastName: 'Doe',
                phone: '123-456-7890',
                password: 'secret123',
                normalField: 'keep this'
            };

            const result = EvidenceLedgerService.redactPayload(payload);

            expect(result.email).toBe('[REDACTED]');
            expect(result.firstName).toBe('[REDACTED]');
            expect(result.lastName).toBe('[REDACTED]');
            expect(result.phone).toBe('[REDACTED]');
            expect(result.password).toBe('[REDACTED]');
            expect(result.normalField).toBe('keep this');
        });

        it('should redact nested PII fields', () => {
            const payload = {
                user: {
                    email: 'user@test.com',
                    address: '123 Main St'
                },
                data: 'keep this'
            };

            const result = EvidenceLedgerService.redactPayload(payload);

            expect(result.user.email).toBe('[REDACTED]');
            expect(result.user.address).toBe('[REDACTED]');
            expect(result.data).toBe('keep this');
        });

        it('should redact PII in arrays', () => {
            const payload = {
                users: [
                    { email: 'user1@test.com', name: 'User 1' },
                    { email: 'user2@test.com', name: 'User 2' }
                ]
            };

            const result = EvidenceLedgerService.redactPayload(payload);

            expect(result.users[0].email).toBe('[REDACTED]');
            expect(result.users[1].email).toBe('[REDACTED]');
        });

        it('should support additional fields to redact', () => {
            const payload = {
                customField: 'sensitive',
                normalField: 'keep'
            };

            const result = EvidenceLedgerService.redactPayload(payload, {
                additionalFields: ['customField']
            });

            expect(result.customField).toBe('[REDACTED]');
            expect(result.normalField).toBe('keep');
        });

        it('should handle null/undefined payloads', () => {
            expect(EvidenceLedgerService.redactPayload(null)).toBe(null);
            expect(EvidenceLedgerService.redactPayload(undefined)).toBe(undefined);
        });
    });

    describe('createEvidenceObject()', () => {
        it('should create an evidence object with redacted payload', async () => {
            const orgId = testOrganizations.org1.id;
            const type = EvidenceLedgerService.EVIDENCE_TYPES.METRIC_SNAPSHOT;
            const source = 'metricsService';
            const payload = {
                metric: 'efficiency',
                value: 85,
                email: 'user@test.com' // Should be redacted
            };

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await EvidenceLedgerService.createEvidenceObject(orgId, type, source, payload);

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ai_evidence_objects'),
                expect.arrayContaining([orgId, type, source])
            );

            const payloadArg = mockDb.run.mock.calls[0][1][4];
            const storedPayload = JSON.parse(payloadArg);
            expect(storedPayload.email).toBe('[REDACTED]');

            expect(result.id).toBe('evidence-1');
            expect(result.org_id).toBe(orgId);
            expect(result.type).toBe(type);
        });

        it('should reject invalid evidence type', async () => {
            const orgId = testOrganizations.org1.id;
            const invalidType = 'INVALID_TYPE';

            await expect(
                EvidenceLedgerService.createEvidenceObject(orgId, invalidType, 'source', {})
            ).rejects.toThrow('Invalid evidence type');
        });

        it('should reject missing required fields', async () => {
            await expect(
                EvidenceLedgerService.createEvidenceObject(null, 'METRIC_SNAPSHOT', 'source', {})
            ).rejects.toThrow('orgId, type, and source are required');
        });
    });

    describe('linkEvidence()', () => {
        it('should link evidence to an entity', async () => {
            const fromType = EvidenceLedgerService.ENTITY_TYPES.PROPOSAL;
            const fromId = 'proposal-123';
            const evidenceId = 'evidence-123';
            const weight = 0.8;
            const note = 'Primary evidence';

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await EvidenceLedgerService.linkEvidence(fromType, fromId, evidenceId, weight, note);

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ai_explainability_links'),
                expect.arrayContaining([fromType, fromId, evidenceId, 0.8, note])
            );

            expect(result.from_type).toBe(fromType);
            expect(result.from_id).toBe(fromId);
            expect(result.weight).toBe(0.8);
        });

        it('should normalize weight to 0-1 range', async () => {
            const fromType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const fromId = 'decision-123';
            const evidenceId = 'evidence-123';

            mockDb.run.mockResolvedValue({ changes: 1 });

            await EvidenceLedgerService.linkEvidence(fromType, fromId, evidenceId, 1.5); // Over 1.0

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([1.0])
            );
        });

        it('should reject invalid entity type', async () => {
            await expect(
                EvidenceLedgerService.linkEvidence('INVALID_TYPE', 'id', 'evidence-id')
            ).rejects.toThrow('Invalid entity type');
        });

        it('should reject missing required fields', async () => {
            await expect(
                EvidenceLedgerService.linkEvidence(null, 'id', 'evidence-id')
            ).rejects.toThrow('fromType, fromId, and evidenceId are required');
        });
    });

    describe('recordReasoning()', () => {
        it('should record reasoning entry', async () => {
            const entityType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const entityId = 'decision-123';
            const summary = 'AI determined this decision based on metrics';
            const assumptions = ['Assumption 1', 'Assumption 2'];
            const confidence = 0.85;

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await EvidenceLedgerService.recordReasoning(
                entityType,
                entityId,
                summary,
                assumptions,
                confidence
            );

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ai_reasoning_ledger'),
                expect.arrayContaining([entityType, entityId, summary, JSON.stringify(assumptions), 0.85])
            );

            expect(result.entity_type).toBe(entityType);
            expect(result.entity_id).toBe(entityId);
            expect(result.confidence).toBe(0.85);
        });

        it('should normalize confidence to 0-1 range', async () => {
            const entityType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const entityId = 'decision-123';
            const summary = 'Test';

            mockDb.run.mockResolvedValue({ changes: 1 });

            await EvidenceLedgerService.recordReasoning(entityType, entityId, summary, [], 1.5);

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([1.0])
            );
        });
    });

    describe('getExplanation()', () => {
        it('should get full explanation for an entity', async () => {
            const orgId = testOrganizations.org1.id;
            const entityType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const entityId = 'decision-123';
            const mockReasoning = [
                {
                    id: 'reasoning-1',
                    reasoning_summary: 'Test reasoning',
                    assumptions_json: '["Assumption 1"]',
                    confidence: 0.8,
                    created_at: '2024-01-01T00:00:00Z'
                }
            ];
            const mockEvidences = [
                {
                    id: 'link-1',
                    evidence_id: 'evidence-1',
                    evidence_type: 'METRIC_SNAPSHOT',
                    source: 'metricsService',
                    payload_json: '{"metric": "efficiency"}',
                    weight: 0.9,
                    note: 'Primary',
                    evidence_created_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockDb.all
                .mockResolvedValueOnce(mockReasoning)
                .mockResolvedValueOnce(mockEvidences);

            const result = await EvidenceLedgerService.getExplanation(orgId, entityType, entityId);

            expect(result.entity_type).toBe(entityType);
            expect(result.entity_id).toBe(entityId);
            expect(result.reasoning).toHaveLength(1);
            expect(result.evidences).toHaveLength(1);
            expect(result.confidence).toBe(0.8);
            expect(result.has_explanation).toBe(true);
        });

        it('should handle empty explanation', async () => {
            const orgId = testOrganizations.org1.id;
            const entityType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const entityId = 'decision-123';

            mockDb.all.mockResolvedValue([]);

            const result = await EvidenceLedgerService.getExplanation(orgId, entityType, entityId);

            expect(result.has_explanation).toBe(false);
            expect(result.confidence).toBe(0);
        });
    });

    describe('hasEvidence()', () => {
        it('should check if entity has evidence', async () => {
            const entityType = EvidenceLedgerService.ENTITY_TYPES.PROPOSAL;
            const entityId = 'proposal-123';

            mockDb.get.mockResolvedValue({ count: 2 });

            const result = await EvidenceLedgerService.hasEvidence(entityType, entityId);

            expect(result).toBe(true);
        });

        it('should return false when no evidence exists', async () => {
            const entityType = EvidenceLedgerService.ENTITY_TYPES.PROPOSAL;
            const entityId = 'proposal-123';

            mockDb.get.mockResolvedValue({ count: 0 });

            const result = await EvidenceLedgerService.hasEvidence(entityType, entityId);

            expect(result).toBe(false);
        });
    });

    describe('createAndLinkEvidence()', () => {
        it('should create evidence and link it in one operation', async () => {
            const orgId = testOrganizations.org1.id;
            const entityType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const entityId = 'decision-123';
            const evidenceType = EvidenceLedgerService.EVIDENCE_TYPES.SIGNAL;
            const source = 'signalEngine';
            const payload = { signal: 'risk_detected' };

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await EvidenceLedgerService.createAndLinkEvidence(
                orgId,
                entityType,
                entityId,
                evidenceType,
                source,
                payload
            );

            expect(result.evidence).toBeDefined();
            expect(result.link).toBeDefined();
            expect(result.evidence.id).toBe('evidence-1');
        });
    });

    describe('getEvidencesByOrg()', () => {
        it('should get evidences for organization', async () => {
            const orgId = testOrganizations.org1.id;
            const mockEvidences = [
                {
                    id: 'evidence-1',
                    type: 'METRIC_SNAPSHOT',
                    payload_json: '{"metric": "efficiency"}'
                }
            ];

            mockDb.all.mockResolvedValue(mockEvidences);

            const result = await EvidenceLedgerService.getEvidencesByOrg(orgId);

            expect(result).toHaveLength(1);
            expect(result[0].payload).toEqual({ metric: 'efficiency' });
        });
    });

    describe('exportExplanation()', () => {
        it('should export explanation as JSON pack', async () => {
            const orgId = testOrganizations.org1.id;
            const entityType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const entityId = 'decision-123';

            mockDb.all.mockResolvedValue([]);

            const result = await EvidenceLedgerService.exportExplanation(orgId, entityType, entityId, 'json');

            expect(result.metadata.format).toBe('json');
            expect(result.metadata.entity_type).toBe(entityType);
            expect(result.summary).toBeDefined();
        });

        it('should export explanation as PDF pack', async () => {
            const orgId = testOrganizations.org1.id;
            const entityType = EvidenceLedgerService.ENTITY_TYPES.DECISION;
            const entityId = 'decision-123';
            const mockReasoning = [
                {
                    reasoning_summary: 'Test',
                    assumptions_json: '[]',
                    confidence: 0.8,
                    created_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockDb.all
                .mockResolvedValueOnce(mockReasoning)
                .mockResolvedValueOnce([]);

            const result = await EvidenceLedgerService.exportExplanation(orgId, entityType, entityId, 'pdf');

            expect(result.metadata.format).toBe('pdf');
            expect(result.render_options).toBeDefined();
            expect(result.render_options.include_confidence_chart).toBe(true);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should scope evidences by organization_id', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockResolvedValue([]);

            await EvidenceLedgerService.getEvidencesByOrg(orgId);

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('WHERE org_id = ?'),
                expect.arrayContaining([orgId])
            );
        });

        it('should scope explanation queries by org_id', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockResolvedValue([]);

            await EvidenceLedgerService.getExplanation(orgId, 'DECISION', 'id');

            expect(mockDb.all).toHaveBeenLastCalledWith(
                expect.stringContaining('AND e.org_id = ?'),
                expect.arrayContaining(['id', orgId])
            );
        });
    });

    describe('Enums', () => {
        it('should export EVIDENCE_TYPES', () => {
            expect(EvidenceLedgerService.EVIDENCE_TYPES).toBeDefined();
            expect(EvidenceLedgerService.EVIDENCE_TYPES.METRIC_SNAPSHOT).toBe('METRIC_SNAPSHOT');
            expect(EvidenceLedgerService.EVIDENCE_TYPES.SIGNAL).toBe('SIGNAL');
        });

        it('should export ENTITY_TYPES', () => {
            expect(EvidenceLedgerService.ENTITY_TYPES).toBeDefined();
            expect(EvidenceLedgerService.ENTITY_TYPES.PROPOSAL).toBe('proposal');
            expect(EvidenceLedgerService.ENTITY_TYPES.DECISION).toBe('decision');
        });
    });
});
