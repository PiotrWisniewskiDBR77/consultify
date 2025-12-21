import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

import EvidenceLedgerService from '../../../server/services/evidenceLedgerService.js';

describe('EvidenceLedgerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        EvidenceLedgerService.setDependencies({
            db: mockDb,
            uuidv4: () => 'uuid-1234'
        });

        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });
    });

    describe('redactPayload', () => {
        it('should redact common PII fields', () => {
            const payload = {
                username: 'jdoe',
                email: 'test@example.com',
                metadata: {
                    phoneNumber: '123-456-7890', // should be caught by generalized matching or specific list
                    // List in snippet: 'email', 'phone', ...
                    phone: '123'
                },
                safe: 'safe_value'
            };

            const redacted = EvidenceLedgerService.redactPayload(payload);

            expect(redacted.email).toBe('[REDACTED]');
            expect(redacted.metadata.phone).toBe('[REDACTED]');
            expect(redacted.safe).toBe('safe_value');
        });

        it('should handle arrays', () => {
            const payload = {
                users: [
                    { name: 'John', email: 'john@example.com' },
                    { name: 'Jane', email: 'jane@example.com' }
                ]
            };

            const redacted = EvidenceLedgerService.redactPayload(payload);
            expect(redacted.users[0].email).toBe('[REDACTED]');
        });
    });

    describe('createEvidenceObject', () => {
        it('should create and redact evidence', async () => {
            const payload = { secret: 'hidden' };
            const result = await EvidenceLedgerService.createEvidenceObject('org-1', 'METRIC_SNAPSHOT', 'source', payload);

            expect(result.id).toBe('uuid-1234');
            expect(mockDb.run).toHaveBeenCalled();
            const params = mockDb.run.mock.calls[0][1];
            expect(params[4]).toContain('[REDACTED]');
            expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO ai_evidence_objects');
        });
    });

    describe('linkEvidence', () => {
        it('should link evidence to entity', async () => {
            const result = await EvidenceLedgerService.linkEvidence('proposal', 'p1', 'e1');

            expect(result.id).toBe('uuid-1234');
            expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO ai_explainability_links');
        });
    });

    describe('recordReasoning', () => {
        it('should record reasoning entry', async () => {
            const result = await EvidenceLedgerService.recordReasoning('decision', 'd1', 'Reason', ['A1']);

            expect(result.id).toBe('uuid-1234');
            expect(mockDb.run.mock.calls[0][0]).toContain('INSERT INTO ai_reasoning_ledger');
        });
    });
});
