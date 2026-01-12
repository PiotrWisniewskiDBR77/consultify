/**
 * Unit tests for DLP Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mock database
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

// Import service
const dlpService = require('../../../../server/services/dlpService');

describe('DLPService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dlpService.setDependencies({ db: mockDb });
    });

    describe('Policies', () => {
        describe('createPolicy', () => {
            it('should create a new DLP policy', async () => {
                mockDb.run.mockResolvedValue({ changes: 1 });

                const result = await dlpService.createPolicy({
                    name: 'PII Detection Policy',
                    description: 'Detect personal information',
                    policyType: 'pii_detection',
                    rules: [{ name: 'SSN', pattern: '\\d{3}-\\d{2}-\\d{4}' }],
                    enforcementAction: 'warn',
                    createdBy: 'admin-1'
                });

                expect(result).toBeDefined();
                expect(result.name).toBe('PII Detection Policy');
                expect(result.policyType).toBe('pii_detection');
                expect(result.enforcementAction).toBe('warn');
                expect(result.isActive).toBe(true);
            });

            it('should use default enforcement action if not provided', async () => {
                mockDb.run.mockResolvedValue({ changes: 1 });

                const result = await dlpService.createPolicy({
                    name: 'Test Policy',
                    policyType: 'custom',
                    createdBy: 'admin-1'
                });

                expect(result.enforcementAction).toBe('warn');
            });
        });

        describe('getPolicyById', () => {
            it('should return policy by ID', async () => {
                const mockPolicy = {
                    id: 'policy-123',
                    name: 'Test Policy',
                    description: 'Test description',
                    policy_type: 'pii_detection',
                    rules_json: '[{"name":"SSN"}]',
                    enforcement_action: 'block',
                    is_active: 1,
                    created_by: 'admin-1',
                    created_by_email: 'admin@test.com',
                    created_at: '2024-01-01T10:00:00Z',
                    updated_at: '2024-01-01T10:00:00Z'
                };

                mockDb.get.mockResolvedValue(mockPolicy);

                const result = await dlpService.getPolicyById('policy-123');

                expect(result).toBeDefined();
                expect(result.id).toBe('policy-123');
                expect(result.policyType).toBe('pii_detection');
                expect(result.rules).toEqual([{ name: 'SSN' }]);
                expect(result.isActive).toBe(true);
            });

            it('should return null for non-existent policy', async () => {
                mockDb.get.mockResolvedValue(null);

                const result = await dlpService.getPolicyById('non-existent');

                expect(result).toBeNull();
            });
        });

        describe('getPolicies', () => {
            it('should return all policies', async () => {
                const mockPolicies = [
                    {
                        id: 'policy-1',
                        name: 'Policy 1',
                        description: 'Description 1',
                        policy_type: 'pii_detection',
                        rules_json: '[]',
                        enforcement_action: 'warn',
                        is_active: 1,
                        created_by: 'admin-1',
                        created_at: '2024-01-01T10:00:00Z',
                        updated_at: '2024-01-01T10:00:00Z'
                    },
                    {
                        id: 'policy-2',
                        name: 'Policy 2',
                        description: 'Description 2',
                        policy_type: 'credentials',
                        rules_json: '[]',
                        enforcement_action: 'block',
                        is_active: 0,
                        created_by: 'admin-2',
                        created_at: '2024-01-02T10:00:00Z',
                        updated_at: '2024-01-02T10:00:00Z'
                    }
                ];

                mockDb.all.mockResolvedValue(mockPolicies);

                const result = await dlpService.getPolicies();

                expect(result).toHaveLength(2);
                expect(result[0].policyType).toBe('pii_detection');
                expect(result[1].policyType).toBe('credentials');
            });

            it('should filter by policy type', async () => {
                mockDb.all.mockResolvedValue([]);

                await dlpService.getPolicies({ policyType: 'pii_detection' });

                expect(mockDb.all).toHaveBeenCalledWith(
                    expect.stringContaining('policy_type = ?'),
                    expect.arrayContaining(['pii_detection'])
                );
            });

            it('should filter by active status', async () => {
                mockDb.all.mockResolvedValue([]);

                await dlpService.getPolicies({ isActive: true });

                expect(mockDb.all).toHaveBeenCalledWith(
                    expect.stringContaining('is_active = ?'),
                    expect.arrayContaining([1])
                );
            });
        });

        describe('updatePolicy', () => {
            it('should update policy', async () => {
                mockDb.run.mockResolvedValue({ changes: 1 });

                const result = await dlpService.updatePolicy('policy-123', {
                    name: 'Updated Name',
                    enforcementAction: 'block'
                });

                expect(result).toBe(true);
            });

            it('should return false if no allowed fields provided', async () => {
                const result = await dlpService.updatePolicy('policy-123', {
                    notAllowed: 'value'
                });

                expect(result).toBe(false);
            });
        });

        describe('togglePolicyActive', () => {
            it('should toggle policy active status', async () => {
                mockDb.run.mockResolvedValue({ changes: 1 });

                const result = await dlpService.togglePolicyActive('policy-123', false);

                expect(result).toBe(true);
                expect(mockDb.run).toHaveBeenCalledWith(
                    expect.stringContaining('is_active = ?'),
                    [0, 'policy-123']
                );
            });
        });

        describe('deletePolicy', () => {
            it('should delete a policy', async () => {
                mockDb.run.mockResolvedValue({ changes: 1 });

                const result = await dlpService.deletePolicy('policy-123');

                expect(result).toBe(true);
            });

            it('should return false if policy not found', async () => {
                mockDb.run.mockResolvedValue({ changes: 0 });

                const result = await dlpService.deletePolicy('non-existent');

                expect(result).toBe(false);
            });
        });
    });

    describe('Violations', () => {
        describe('recordViolation', () => {
            it('should record a violation', async () => {
                mockDb.run.mockResolvedValue({ changes: 1 });

                const result = await dlpService.recordViolation({
                    policyId: 'policy-1',
                    resourceType: 'document',
                    resourceId: 'doc-123',
                    violationType: 'ssn_detected',
                    severity: 'HIGH'
                });

                expect(result).toBeDefined();
                expect(result.policyId).toBe('policy-1');
                expect(result.violationType).toBe('ssn_detected');
                expect(result.severity).toBe('HIGH');
            });
        });

        describe('getViolations', () => {
            it('should return all violations', async () => {
                const mockViolations = [
                    {
                        id: 'v-1',
                        policy_id: 'policy-1',
                        policy_name: 'PII Policy',
                        policy_type: 'pii_detection',
                        resource_type: 'document',
                        resource_id: 'doc-1',
                        violation_type: 'ssn_detected',
                        severity: 'HIGH',
                        detected_at: '2024-01-01T10:00:00Z',
                        resolved_at: null,
                        resolved_by: null
                    }
                ];

                mockDb.all.mockResolvedValue(mockViolations);

                const result = await dlpService.getViolations();

                expect(result).toHaveLength(1);
                expect(result[0].policyName).toBe('PII Policy');
            });

            it('should filter by resolved status', async () => {
                mockDb.all.mockResolvedValue([]);

                await dlpService.getViolations({ isResolved: false });

                expect(mockDb.all).toHaveBeenCalledWith(
                    expect.stringContaining('resolved_at IS NULL'),
                    expect.anything()
                );
            });
        });

        describe('resolveViolation', () => {
            it('should resolve a violation', async () => {
                mockDb.run.mockResolvedValue({ changes: 1 });

                const result = await dlpService.resolveViolation('v-123', 'admin-1');

                expect(result).toBe(true);
            });
        });
    });

    describe('getStats', () => {
        it('should return DLP statistics', async () => {
            mockDb.get.mockResolvedValueOnce({
                total_policies: 5,
                active_policies: 3
            }).mockResolvedValueOnce({
                total_violations: 20,
                unresolved_count: 8,
                critical_count: 2,
                high_count: 5,
                medium_count: 8,
                low_count: 5
            });

            const result = await dlpService.getStats();

            expect(result.policies.total).toBe(5);
            expect(result.policies.active).toBe(3);
            expect(result.violations.total).toBe(20);
            expect(result.violations.unresolved).toBe(8);
            expect(result.violations.bySeverity.critical).toBe(2);
        });
    });

    describe('scanResource', () => {
        it('should scan resource for violations', async () => {
            mockDb.all.mockResolvedValue([{
                id: 'policy-1',
                name: 'PII Policy',
                rules_json: JSON.stringify([{
                    name: 'SSN Detection',
                    pattern: '\\d{3}-\\d{2}-\\d{4}',
                    severity: 'HIGH'
                }]),
                enforcement_action: 'warn',
                is_active: 1
            }]);
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await dlpService.scanResource(
                'document',
                'doc-123',
                'This contains SSN: 123-45-6789'
            );

            expect(result.scanned).toBe(true);
            expect(result.violationsFound).toBeGreaterThan(0);
        });
    });

    describe('constants', () => {
        it('should export policy types', () => {
            expect(dlpService.POLICY_TYPES).toBeDefined();
            expect(dlpService.POLICY_TYPES.PII_DETECTION).toBe('pii_detection');
            expect(dlpService.POLICY_TYPES.CREDENTIALS).toBe('credentials');
        });

        it('should export enforcement actions', () => {
            expect(dlpService.ENFORCEMENT_ACTIONS).toBeDefined();
            expect(dlpService.ENFORCEMENT_ACTIONS.WARN).toBe('warn');
            expect(dlpService.ENFORCEMENT_ACTIONS.BLOCK).toBe('block');
        });

        it('should export severity levels', () => {
            expect(dlpService.SEVERITY_LEVELS).toBeDefined();
            expect(dlpService.SEVERITY_LEVELS.LOW).toBe('LOW');
            expect(dlpService.SEVERITY_LEVELS.CRITICAL).toBe('CRITICAL');
        });
    });
});




