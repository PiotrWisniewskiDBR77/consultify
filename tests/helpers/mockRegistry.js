/**
 * Mock Registry
 * 
 * Centralized registry of all service mocks to ensure consistency across tests.
 * Auto-mocks common services to prevent missing dependency errors.
 */

import { vi } from 'vitest';

/**
 * Audit Service Mocks
 */
export const auditServiceMocks = {
    multiFrameworkAuditService: {
        logCreate: vi.fn().mockResolvedValue(1),
        logUpdate: vi.fn().mockResolvedValue(2),
        logDelete: vi.fn().mockResolvedValue(3),
        logAction: vi.fn().mockResolvedValue(4),
        logWorkflowChange: vi.fn().mockResolvedValue(5),
        logReportGeneration: vi.fn().mockResolvedValue(6),
        logInitiativeGeneration: vi.fn().mockResolvedValue(7),
        ENTITY_TYPES: { ASSESSMENT: 'ASSESSMENT' },
        ACTION_TYPES: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
        ACTIONS: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' }
    },
    
    assessmentAuditLogger: {
        logAction: vi.fn().mockResolvedValue(1),
        logCreate: vi.fn().mockResolvedValue(1),
        logUpdate: vi.fn().mockResolvedValue(2),
        logDelete: vi.fn().mockResolvedValue(3)
    }
};

/**
 * Billing Service Mocks
 */
export const billingServiceMocks = {
    stripe: {
        customers: {
            create: vi.fn().mockResolvedValue({ id: 'cus_test' }),
            retrieve: vi.fn().mockResolvedValue({ id: 'cus_test' }),
            update: vi.fn().mockResolvedValue({ id: 'cus_test' })
        },
        subscriptions: {
            create: vi.fn().mockResolvedValue({ id: 'sub_test' }),
            retrieve: vi.fn().mockResolvedValue({ id: 'sub_test' }),
            update: vi.fn().mockResolvedValue({ id: 'sub_test' })
        },
        webhooks: {
            constructEvent: vi.fn()
        }
    },
    
    billingService: {
        getOrganizationBilling: vi.fn().mockResolvedValue({
            subscription_plan_id: 'plan-test',
            status: 'active'
        }),
        updateBilling: vi.fn().mockResolvedValue({ success: true })
    }
};

/**
 * AI Service Mocks
 */
export const aiServiceMocks = {
    llmApi: {
        chat: vi.fn().mockResolvedValue({ 
            text: 'Mock AI Response',
            tokens: { input: 100, output: 50 }
        }),
        stream: vi.fn().mockImplementation(async function* () {
            yield { text: 'Mock' };
            yield { text: ' AI' };
            yield { text: ' Response' };
        })
    }
};

/**
 * Usage Service Mocks
 */
export const usageServiceMocks = {
    usageService: {
        checkQuota: vi.fn().mockResolvedValue({
            allowed: true,
            limit: 1000,
            used: 500,
            percentage: 50
        }),
        recordTokenUsage: vi.fn().mockResolvedValue({ id: 'usage-1' }),
        recordStorageUsage: vi.fn().mockResolvedValue({ id: 'usage-1' }),
        getCurrentUsage: vi.fn().mockResolvedValue({ tokens: 500, storage: 0 })
    }
};

/**
 * Setup all common mocks
 * Call this in test setup files to auto-mock all common services
 */
export function setupCommonMocks() {
    // Mock audit services
    vi.mock('../../../server/services/multiFrameworkAuditService', () => ({
        default: auditServiceMocks.multiFrameworkAuditService,
        ...auditServiceMocks.multiFrameworkAuditService
    }));
    
    vi.mock('../../../server/services/assessmentAuditLogger', () => ({
        default: auditServiceMocks.assessmentAuditLogger,
        ...auditServiceMocks.assessmentAuditLogger
    }));
    
    // Mock billing services
    vi.mock('stripe', () => ({
        default: vi.fn().mockImplementation(() => billingServiceMocks.stripe)
    }));
    
    // Mock usage service
    vi.mock('../../../server/services/usageService', () => ({
        default: usageServiceMocks.usageService,
        ...usageServiceMocks.usageService
    }));
}

/**
 * Reset all mocks (optimized version)
 * Uses batch operations for better performance
 */
export function resetAllMocks() {
    // Collect all mocks first, then reset in batch
    const allMocks: Array<{ mockClear: () => void }> = [];
    
    const collectMocks = (obj: any) => {
        if (obj && typeof obj === 'object') {
            if (obj.mockClear && typeof obj.mockClear === 'function') {
                allMocks.push(obj);
            } else {
                Object.values(obj).forEach(value => {
                    if (value && typeof value === 'object') {
                        collectMocks(value);
                    }
                });
            }
        }
    };
    
    collectMocks(auditServiceMocks);
    collectMocks(billingServiceMocks);
    collectMocks(aiServiceMocks);
    collectMocks(usageServiceMocks);
    
    // Reset all mocks in batch
    allMocks.forEach(mock => mock.mockClear());
}

export default {
    auditServiceMocks,
    billingServiceMocks,
    aiServiceMocks,
    usageServiceMocks,
    setupCommonMocks,
    resetAllMocks
};

