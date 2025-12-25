/**
 * Test Utilities for Assessment Module Tests
 * Common test helpers, factories, and mocks
 */

import { vi } from 'vitest';

// =========================================================================
// TYPES
// =========================================================================

export interface MockUser {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    role: string;
}

export interface MockAssessment {
    id: string;
    projectId: string;
    organizationId: string;
    axisScores: Record<string, AxisScore>;
    overallScore: number;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export interface AxisScore {
    actual: number;
    target: number;
    justification: string;
    evidence?: string[];
}

export interface MockWorkflow {
    id: string;
    assessmentId: string;
    status: string;
    currentVersion: number;
    reviewers: MockReviewer[];
    completedReviews: number;
    totalReviews: number;
}

export interface MockReviewer {
    userId: string;
    role: string;
    status: 'PENDING' | 'COMPLETED';
    submittedAt?: string;
}

// =========================================================================
// AXIS CONSTANTS
// =========================================================================

export const AXIS_IDS = [
    'processes',
    'digitalProducts',
    'businessModels',
    'dataManagement',
    'culture',
    'cybersecurity',
    'aiMaturity'
] as const;

export const WORKFLOW_STATUSES = [
    'DRAFT',
    'IN_REVIEW',
    'AWAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'ARCHIVED'
] as const;

// =========================================================================
// FACTORY FUNCTIONS
// =========================================================================

/**
 * Create a mock user with optional overrides
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
        id: `user-${Date.now()}`,
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123',
        role: 'PROJECT_MANAGER',
        ...overrides
    };
}

/**
 * Create a mock assessment with optional overrides
 */
export function createMockAssessment(overrides: Partial<MockAssessment> = {}): MockAssessment {
    return {
        id: `assessment-${Date.now()}`,
        projectId: 'project-123',
        organizationId: 'org-123',
        axisScores: createDefaultAxisScores(),
        overallScore: 3.5,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
}

/**
 * Create default axis scores with all required axes
 */
export function createDefaultAxisScores(): Record<string, AxisScore> {
    const scores: Record<string, AxisScore> = {};
    
    AXIS_IDS.forEach(axisId => {
        scores[axisId] = {
            actual: 3,
            target: 5,
            justification: `Default justification for ${axisId}`,
            evidence: []
        };
    });
    
    return scores;
}

/**
 * Create a mock workflow with optional overrides
 */
export function createMockWorkflow(overrides: Partial<MockWorkflow> = {}): MockWorkflow {
    return {
        id: `workflow-${Date.now()}`,
        assessmentId: 'assessment-123',
        status: 'DRAFT',
        currentVersion: 1,
        reviewers: [],
        completedReviews: 0,
        totalReviews: 0,
        ...overrides
    };
}

/**
 * Create a mock reviewer with optional overrides
 */
export function createMockReviewer(overrides: Partial<MockReviewer> = {}): MockReviewer {
    return {
        userId: `reviewer-${Date.now()}`,
        role: 'CTO',
        status: 'PENDING',
        ...overrides
    };
}

// =========================================================================
// MOCK CREATORS
// =========================================================================

/**
 * Create a mock database object
 */
export function createMockDb() {
    return {
        run: vi.fn((sql: string, params: any[], callback?: Function) => {
            if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            return Promise.resolve({ lastID: 1 });
        }),
        get: vi.fn((sql: string, params: any[], callback?: Function) => {
            if (callback) callback(null, null);
            return Promise.resolve(null);
        }),
        all: vi.fn((sql: string, params: any[], callback?: Function) => {
            if (callback) callback(null, []);
            return Promise.resolve([]);
        }),
        serialize: vi.fn((callback: Function) => callback()),
        close: vi.fn()
    };
}

/**
 * Create a mock request object
 */
export function createMockRequest(overrides: any = {}) {
    return {
        user: createMockUser(),
        params: {},
        query: {},
        body: {},
        headers: {},
        ...overrides
    };
}

/**
 * Create a mock response object
 */
export function createMockResponse() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    res.setHeader = vi.fn().mockReturnValue(res);
    return res;
}

/**
 * Create a mock next function
 */
export function createMockNext() {
    return vi.fn();
}

// =========================================================================
// AI MOCK RESPONSES
// =========================================================================

export const mockAIResponses = {
    guidance: {
        axisId: 'processes',
        guidance: 'Focus on automating core business processes...',
        mode: 'AI_GENERATED' as const,
        context: { gap: 2 }
    },
    
    validation: {
        hasInconsistencies: false,
        inconsistencies: [],
        overallAssessment: 'Assessment appears consistent'
    },
    
    gapAnalysis: {
        axisId: 'processes',
        axisName: 'Digital Processes',
        currentScore: 3,
        targetScore: 5,
        gap: 2,
        gapSeverity: 'MEDIUM' as const,
        pathway: [
            { level: 4, description: 'Integrated workflows', estimatedMonths: 6 },
            { level: 5, description: 'End-to-end digital', estimatedMonths: 9 }
        ],
        estimatedTotalMonths: 15
    },
    
    insights: {
        insights: [
            { type: 'STRENGTH', title: 'Strong in processes', axis: 'processes' },
            { type: 'PRIORITY_GAP', title: 'Focus on culture', axis: 'culture' }
        ],
        summary: { axesAssessed: 7, averageMaturity: '3.5' }
    },
    
    justificationSuggestion: {
        axisId: 'processes',
        score: 4,
        suggestion: 'Organizacja wdrożyła zintegrowane systemy CRM i ERP...',
        mode: 'AI_GENERATED' as const
    },
    
    evidenceSuggestion: {
        evidence: ['Dokumentacja systemowa', 'Metryki KPI', 'Wyniki audytów'],
        mode: 'AI_GENERATED' as const
    },
    
    targetSuggestion: {
        currentScore: 3,
        suggestedTarget: 5,
        ambitionLevel: 'balanced',
        reasoning: 'Balanced approach for sustainable growth',
        timeEstimate: '18 miesięcy'
    },
    
    executiveSummary: {
        summary: 'Organizacja osiągnęła średni poziom dojrzałości cyfrowej...',
        metrics: {
            averageMaturity: '3.5',
            averageTarget: '5.0',
            overallGap: '1.5'
        },
        topStrengths: ['processes'],
        priorityGaps: ['culture'],
        mode: 'AI_GENERATED' as const
    }
};

// =========================================================================
// HOOK TESTING HELPERS
// =========================================================================

/**
 * Create a wrapper for testing React hooks
 */
export function createHookWrapper(providers: React.ComponentType<{ children: React.ReactNode }>[]) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return providers.reduceRight(
            (acc, Provider) => <Provider>{acc}</Provider>,
            children
        );
    };
}

/**
 * Wait for async operations in hooks
 */
export async function waitForHookUpdate(callback: () => void, delay = 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
    callback();
}

// =========================================================================
// ASSERTION HELPERS
// =========================================================================

/**
 * Assert that an object has all required assessment fields
 */
export function assertValidAssessment(assessment: any) {
    expect(assessment).toHaveProperty('id');
    expect(assessment).toHaveProperty('projectId');
    expect(assessment).toHaveProperty('axisScores');
    expect(assessment).toHaveProperty('overallScore');
    
    // Verify all axes exist
    AXIS_IDS.forEach(axisId => {
        expect(assessment.axisScores).toHaveProperty(axisId);
    });
}

/**
 * Assert that a workflow is in valid state
 */
export function assertValidWorkflow(workflow: any) {
    expect(workflow).toHaveProperty('id');
    expect(workflow).toHaveProperty('assessmentId');
    expect(workflow).toHaveProperty('status');
    expect(WORKFLOW_STATUSES).toContain(workflow.status);
    expect(workflow).toHaveProperty('currentVersion');
    expect(workflow.currentVersion).toBeGreaterThan(0);
}

/**
 * Assert that axis scores are within valid range
 */
export function assertValidScores(scores: Record<string, AxisScore>) {
    Object.values(scores).forEach(score => {
        expect(score.actual).toBeGreaterThanOrEqual(1);
        expect(score.actual).toBeLessThanOrEqual(7);
        expect(score.target).toBeGreaterThanOrEqual(1);
        expect(score.target).toBeLessThanOrEqual(7);
        expect(score.justification).toBeDefined();
    });
}

// =========================================================================
// TIMER HELPERS
// =========================================================================

/**
 * Setup fake timers with cleanup
 */
export function setupFakeTimers() {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    
    afterEach(() => {
        vi.useRealTimers();
    });
}

/**
 * Advance timers and flush promises
 */
export async function advanceTimersAndFlush(ms: number) {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
}

// =========================================================================
// NETWORK MOCKING HELPERS
// =========================================================================

/**
 * Create a mock fetch function
 */
export function createMockFetch(responses: Record<string, any>) {
    return vi.fn((url: string, options?: RequestInit) => {
        const matchingUrl = Object.keys(responses).find(key => url.includes(key));
        
        if (matchingUrl) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(responses[matchingUrl]),
                status: 200
            });
        }
        
        return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Not found' })
        });
    });
}

/**
 * Create error response for fetch mock
 */
export function createErrorFetch(statusCode: number, errorMessage: string) {
    return vi.fn(() => 
        Promise.resolve({
            ok: false,
            status: statusCode,
            json: () => Promise.resolve({ error: errorMessage })
        })
    );
}

// =========================================================================
// CLEANUP HELPERS
// =========================================================================

/**
 * Standard cleanup after each test
 */
export function standardCleanup() {
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });
}

/**
 * Reset all module mocks
 */
export function resetAllMocks() {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
}

