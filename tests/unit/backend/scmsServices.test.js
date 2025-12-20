// SCMS Step 4-6 Services Unit Tests
// Tests for Roadmap, Execution, Stabilization, Economics - Constants & Structure

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        get: vi.fn((sql, params, callback) => callback(null, null)),
        run: vi.fn((sql, params, callback) => callback && callback.call({ changes: 1 }, null)),
        all: vi.fn((sql, params, callback) => callback(null, []))
    }
}));

describe('NotificationService', () => {
    let NotificationService;

    beforeEach(async () => {
        vi.clearAllMocks();
        NotificationService = (await import('../../../server/services/notificationService.js')).default;
    });

    describe('NOTIFICATION_TYPES', () => {
        it('should have notification types defined', () => {
            expect(Object.keys(NotificationService.NOTIFICATION_TYPES).length).toBeGreaterThan(10);
        });

        it('should include TASK_ASSIGNED type', () => {
            expect(NotificationService.NOTIFICATION_TYPES.TASK_ASSIGNED).toBe('TASK_ASSIGNED');
        });

        it('should include DECISION_REQUIRED type', () => {
            expect(NotificationService.NOTIFICATION_TYPES.DECISION_REQUIRED).toBe('DECISION_REQUIRED');
        });

        it('should include AI_RISK_DETECTED type', () => {
            expect(NotificationService.NOTIFICATION_TYPES.AI_RISK_DETECTED).toBe('AI_RISK_DETECTED');
        });
    });

    describe('SEVERITY', () => {
        it('should define INFO severity', () => {
            expect(NotificationService.SEVERITY.INFO).toBe('INFO');
        });

        it('should define WARNING severity', () => {
            expect(NotificationService.SEVERITY.WARNING).toBe('WARNING');
        });

        it('should define CRITICAL severity', () => {
            expect(NotificationService.SEVERITY.CRITICAL).toBe('CRITICAL');
        });
    });
});

describe('MyWorkService', () => {
    let MyWorkService;

    beforeEach(async () => {
        vi.clearAllMocks();
        MyWorkService = (await import('../../../server/services/myWorkService.js')).default;
    });

    describe('Service Structure', () => {
        it('should export getMyWork function', () => {
            expect(typeof MyWorkService.getMyWork).toBe('function');
        });

        it('should export _getMyTasks helper function', () => {
            expect(typeof MyWorkService._getMyTasks).toBe('function');
        });

        it('should export _getMyAlerts helper function', () => {
            expect(typeof MyWorkService._getMyAlerts).toBe('function');
        });
    });
});

describe('ExecutionMonitorService', () => {
    let ExecutionMonitorService;

    beforeEach(async () => {
        vi.clearAllMocks();
        ExecutionMonitorService = (await import('../../../server/services/executionMonitorService.js')).default;
    });

    describe('Service Structure', () => {
        it('should export runDailyMonitor function', () => {
            expect(typeof ExecutionMonitorService.runDailyMonitor).toBe('function');
        });

        it('should export generateExecutionSummary function', () => {
            expect(typeof ExecutionMonitorService.generateExecutionSummary).toBe('function');
        });
    });
});

describe('EscalationService', () => {
    let EscalationService;

    beforeEach(async () => {
        vi.clearAllMocks();
        EscalationService = (await import('../../../server/services/escalationService.js')).default;
    });

    describe('Service Structure', () => {
        it('should export createEscalation function', () => {
            expect(typeof EscalationService.createEscalation).toBe('function');
        });

        it('should export getEscalations function', () => {
            expect(typeof EscalationService.getEscalations).toBe('function');
        });

        it('should export acknowledgeEscalation function', () => {
            expect(typeof EscalationService.acknowledgeEscalation).toBe('function');
        });

        it('should export resolveEscalation function', () => {
            expect(typeof EscalationService.resolveEscalation).toBe('function');
        });

        it('should export runAutoEscalation function', () => {
            expect(typeof EscalationService.runAutoEscalation).toBe('function');
        });
    });
});

describe('StabilizationService', () => {
    let StabilizationService;

    beforeEach(async () => {
        vi.clearAllMocks();
        StabilizationService = (await import('../../../server/services/stabilizationService.js')).default;
    });

    describe('STABILIZATION_STATUSES', () => {
        it('should define STABILIZED status', () => {
            expect(StabilizationService.STABILIZATION_STATUSES.STABILIZED).toBe('STABILIZED');
        });

        it('should define PARTIALLY_STABILIZED status', () => {
            expect(StabilizationService.STABILIZATION_STATUSES.PARTIALLY_STABILIZED).toBe('PARTIALLY_STABILIZED');
        });

        it('should define UNSTABLE status', () => {
            expect(StabilizationService.STABILIZATION_STATUSES.UNSTABLE).toBe('UNSTABLE');
        });

        it('should define NOT_APPLICABLE status', () => {
            expect(StabilizationService.STABILIZATION_STATUSES.NOT_APPLICABLE).toBe('NOT_APPLICABLE');
        });
    });

    describe('Service Structure', () => {
        it('should export checkEntryCriteria function', () => {
            expect(typeof StabilizationService.checkEntryCriteria).toBe('function');
        });

        it('should export checkExitCriteria function', () => {
            expect(typeof StabilizationService.checkExitCriteria).toBe('function');
        });

        it('should export closeProject function', () => {
            expect(typeof StabilizationService.closeProject).toBe('function');
        });
    });
});

describe('EconomicsService', () => {
    let EconomicsService;

    beforeEach(async () => {
        vi.clearAllMocks();
        EconomicsService = (await import('../../../server/services/economicsService.js')).default;
    });

    describe('VALUE_TYPES', () => {
        it('should have 5 value types', () => {
            expect(Object.keys(EconomicsService.VALUE_TYPES)).toHaveLength(5);
        });

        it('should define COST_REDUCTION type', () => {
            expect(EconomicsService.VALUE_TYPES.COST_REDUCTION).toBe('COST_REDUCTION');
        });

        it('should define REVENUE_INCREASE type', () => {
            expect(EconomicsService.VALUE_TYPES.REVENUE_INCREASE).toBe('REVENUE_INCREASE');
        });

        it('should define RISK_REDUCTION type', () => {
            expect(EconomicsService.VALUE_TYPES.RISK_REDUCTION).toBe('RISK_REDUCTION');
        });

        it('should define EFFICIENCY type', () => {
            expect(EconomicsService.VALUE_TYPES.EFFICIENCY).toBe('EFFICIENCY');
        });

        it('should define STRATEGIC_OPTION type', () => {
            expect(EconomicsService.VALUE_TYPES.STRATEGIC_OPTION).toBe('STRATEGIC_OPTION');
        });
    });

    describe('Service Structure', () => {
        it('should export createValueHypothesis function', () => {
            expect(typeof EconomicsService.createValueHypothesis).toBe('function');
        });

        it('should export getValueSummary function', () => {
            expect(typeof EconomicsService.getValueSummary).toBe('function');
        });

        it('should export detectMissingValueHypotheses function', () => {
            expect(typeof EconomicsService.detectMissingValueHypotheses).toBe('function');
        });
    });
});

describe('ReportingService', () => {
    let ReportingService;

    beforeEach(async () => {
        vi.clearAllMocks();
        ReportingService = (await import('../../../server/services/reportingService.js')).default;
    });

    describe('Service Structure', () => {
        it('should export generateExecutiveOverview function', () => {
            expect(typeof ReportingService.generateExecutiveOverview).toBe('function');
        });

        it('should export generateProjectHealthReport function', () => {
            expect(typeof ReportingService.generateProjectHealthReport).toBe('function');
        });

        it('should export generateGovernanceReport function', () => {
            expect(typeof ReportingService.generateGovernanceReport).toBe('function');
        });
    });
});

describe('NarrativeService', () => {
    let NarrativeService;

    beforeEach(async () => {
        vi.clearAllMocks();
        NarrativeService = (await import('../../../server/services/narrativeService.js')).default;
    });

    describe('Service Structure', () => {
        it('should export generateWeeklySummary function', () => {
            expect(typeof NarrativeService.generateWeeklySummary).toBe('function');
        });

        it('should export generateExecutiveMemo function', () => {
            expect(typeof NarrativeService.generateExecutiveMemo).toBe('function');
        });

        it('should export generateProgressNarrative function', () => {
            expect(typeof NarrativeService.generateProgressNarrative).toBe('function');
        });
    });
});
