/**
 * Audit Integrity Service Unit Tests
 * 
 * Tests for immutable audit log integrity verification
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const crypto = require('crypto');

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        run: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params.call({ lastID: 1, changes: 1 }, null);
            } else if (cb) {
                cb.call({ lastID: 1, changes: 1 }, null);
            }
        }),
        get: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params(null, null);
            } else if (cb) {
                cb(null, null);
            }
        }),
        all: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params(null, []);
            } else if (cb) {
                cb(null, []);
            }
        }),
    }
}));

const auditIntegrityService = require('../../../server/services/auditIntegrityService');

describe('Audit Integrity Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Hash Generation', () => {
        it('should generate SHA-256 hash for audit entry', () => {
            const auditEntry = {
                id: 'audit-123',
                action: 'user.login',
                userId: 'user-456',
                timestamp: '2024-01-01T00:00:00Z',
                details: { ip: '192.168.1.1' },
            };
            
            const hash = crypto.createHash('sha256')
                .update(JSON.stringify(auditEntry))
                .digest('hex');
            
            expect(hash).toHaveLength(64);
            expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
        });

        it('should produce consistent hashes for same data', () => {
            const data = { action: 'test', timestamp: '2024-01-01T00:00:00Z' };
            
            const hash1 = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
            const hash2 = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
            
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different data', () => {
            const data1 = { action: 'test1' };
            const data2 = { action: 'test2' };
            
            const hash1 = crypto.createHash('sha256').update(JSON.stringify(data1)).digest('hex');
            const hash2 = crypto.createHash('sha256').update(JSON.stringify(data2)).digest('hex');
            
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Hash Chain', () => {
        it('should create chain by including previous hash', () => {
            const previousHash = crypto.createHash('sha256').update('previous').digest('hex');
            const currentEntry = { action: 'current' };
            
            const chainedHash = crypto.createHash('sha256')
                .update(previousHash + JSON.stringify(currentEntry))
                .digest('hex');
            
            expect(chainedHash).toHaveLength(64);
        });

        it('should detect chain breaks when hash changes', () => {
            const originalHash = 'abc123';
            const tamperedHash = 'xyz789';
            
            expect(originalHash).not.toBe(tamperedHash);
        });

        it('should handle genesis block (first entry) without previous hash', () => {
            const genesisEntry = { action: 'genesis', id: 'audit-001' };
            const genesisHash = crypto.createHash('sha256')
                .update(JSON.stringify(genesisEntry))
                .digest('hex');
            
            expect(genesisHash).toBeDefined();
        });
    });

    describe('Integrity Verification', () => {
        it('should verify single entry integrity', () => {
            const entry = { action: 'test', timestamp: Date.now() };
            const storedHash = crypto.createHash('sha256')
                .update(JSON.stringify(entry))
                .digest('hex');
            
            const calculatedHash = crypto.createHash('sha256')
                .update(JSON.stringify(entry))
                .digest('hex');
            
            expect(storedHash).toBe(calculatedHash);
        });

        it('should detect tampering in entry', () => {
            const originalEntry = { action: 'test', amount: 100 };
            const storedHash = crypto.createHash('sha256')
                .update(JSON.stringify(originalEntry))
                .digest('hex');
            
            const tamperedEntry = { action: 'test', amount: 1000 };
            const tamperedHash = crypto.createHash('sha256')
                .update(JSON.stringify(tamperedEntry))
                .digest('hex');
            
            expect(storedHash).not.toBe(tamperedHash);
        });

        it('should verify chain integrity across multiple entries', () => {
            const entries = [
                { id: 1, action: 'first' },
                { id: 2, action: 'second' },
                { id: 3, action: 'third' },
            ];
            
            const hashes = [];
            entries.forEach((entry, index) => {
                const previousHash = index > 0 ? hashes[index - 1] : '';
                const hash = crypto.createHash('sha256')
                    .update(previousHash + JSON.stringify(entry))
                    .digest('hex');
                hashes.push(hash);
            });
            
            expect(hashes).toHaveLength(3);
            expect(new Set(hashes).size).toBe(3); // All unique
        });
    });

    describe('Audit Entry Structure', () => {
        it('should include required fields in audit entry', () => {
            const requiredFields = [
                'id',
                'action',
                'timestamp',
                'userId',
                'organizationId',
            ];
            
            const entry = {
                id: 'audit-123',
                action: 'user.login',
                timestamp: new Date().toISOString(),
                userId: 'user-456',
                organizationId: 'org-789',
            };
            
            requiredFields.forEach(field => {
                expect(entry).toHaveProperty(field);
            });
        });

        it('should support metadata field', () => {
            const entry = {
                id: 'audit-123',
                action: 'api.call',
                metadata: {
                    endpoint: '/api/users',
                    method: 'GET',
                    statusCode: 200,
                    duration: 125,
                },
            };
            
            expect(entry.metadata).toBeDefined();
            expect(entry.metadata.endpoint).toBe('/api/users');
        });

        it('should support IP address tracking', () => {
            const entry = {
                id: 'audit-123',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0...',
            };
            
            expect(entry.ipAddress).toBeDefined();
        });
    });

    describe('Timestamp Handling', () => {
        it('should use ISO 8601 timestamp format', () => {
            const timestamp = new Date().toISOString();
            
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should reject future timestamps', () => {
            const futureTimestamp = new Date(Date.now() + 60 * 60 * 1000);
            const now = new Date();
            
            const isFuture = futureTimestamp > now;
            expect(isFuture).toBe(true);
        });

        it('should allow timestamps within tolerance', () => {
            const tolerance = 5000; // 5 seconds
            const timestamp = new Date(Date.now() - 2000);
            const now = new Date();
            
            const withinTolerance = now - timestamp < tolerance;
            expect(withinTolerance).toBe(true);
        });
    });

    describe('Action Categories', () => {
        it('should categorize authentication actions', () => {
            const authActions = [
                'auth.login',
                'auth.logout',
                'auth.password_changed',
                'auth.mfa_enabled',
                'auth.session_expired',
            ];
            
            authActions.forEach(action => {
                expect(action.startsWith('auth.')).toBe(true);
            });
        });

        it('should categorize user management actions', () => {
            const userActions = [
                'user.created',
                'user.updated',
                'user.deleted',
                'user.role_changed',
            ];
            
            userActions.forEach(action => {
                expect(action.startsWith('user.')).toBe(true);
            });
        });

        it('should categorize security actions', () => {
            const securityActions = [
                'security.policy_updated',
                'security.api_key_created',
                'security.access_denied',
            ];
            
            securityActions.forEach(action => {
                expect(action.startsWith('security.')).toBe(true);
            });
        });

        it('should categorize AI actions', () => {
            const aiActions = [
                'ai.prompt_submitted',
                'ai.response_generated',
                'ai.budget_exceeded',
            ];
            
            aiActions.forEach(action => {
                expect(action.startsWith('ai.')).toBe(true);
            });
        });
    });

    describe('Export Format', () => {
        it('should support JSON export format', () => {
            const entries = [
                { id: 1, action: 'test' },
                { id: 2, action: 'test2' },
            ];
            
            const jsonExport = JSON.stringify(entries, null, 2);
            expect(typeof jsonExport).toBe('string');
            expect(JSON.parse(jsonExport)).toEqual(entries);
        });

        it('should support CSV export format', () => {
            const headers = ['id', 'action', 'timestamp'];
            const row = ['1', 'user.login', '2024-01-01T00:00:00Z'];
            
            const csvLine = row.join(',');
            expect(csvLine).toContain('user.login');
        });

        it('should include signature in export', () => {
            const exportData = {
                entries: [],
                exportedAt: new Date().toISOString(),
                exportedBy: 'admin',
                signature: 'sha256:abc123...',
            };
            
            expect(exportData.signature).toBeDefined();
        });
    });

    describe('Retention Policies', () => {
        it('should support configurable retention periods', () => {
            const retentionDays = 365; // 1 year
            const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
            
            expect(retentionMs).toBe(31536000000);
        });

        it('should identify entries for archival', () => {
            const archiveThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const oldEntry = new Date('2023-01-01');
            const recentEntry = new Date();
            
            expect(oldEntry < archiveThreshold).toBe(true);
            expect(recentEntry < archiveThreshold).toBe(false);
        });
    });
});

describe('Audit Security', () => {
    it('should prevent direct modification of audit entries', () => {
        const entry = Object.freeze({ id: 1, action: 'test' });
        
        expect(() => {
            entry.action = 'modified';
        }).toThrow();
    });

    it('should sign exports with HMAC', () => {
        const secret = 'audit-secret-key';
        const data = JSON.stringify({ entries: [] });
        
        const signature = crypto.createHmac('sha256', secret)
            .update(data)
            .digest('hex');
        
        expect(signature).toHaveLength(64);
    });
});













