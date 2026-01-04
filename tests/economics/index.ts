/**
 * Economics Module Test Suite
 * 
 * This module contains comprehensive tests for the Economics functionality:
 * 
 * 1. Unit Tests (economicsService.test.js)
 *    - Service layer business logic
 *    - Score calculations
 *    - Data transformations
 * 
 * 2. API Integration Tests (economicsApi.test.js)
 *    - REST endpoint validation
 *    - Request/response handling
 *    - Authentication & authorization
 *    - Input validation
 *    - Error handling
 * 
 * 3. Component Tests (components.test.tsx)
 *    - React component rendering
 *    - User interactions
 *    - State management
 *    - Accessibility
 * 
 * 4. E2E Tests (economics.e2e.test.ts)
 *    - Full workflow testing
 *    - Cross-browser compatibility
 *    - Responsive design
 *    - Error scenarios
 * 
 * Running Tests:
 * 
 * Unit & Integration:
 *   npm test -- --testPathPattern=economics
 * 
 * Component:
 *   npm test -- --testPathPattern=components.test
 * 
 * E2E:
 *   npx playwright test tests/economics/economics.e2e.test.ts
 * 
 * All Tests:
 *   npm run test:economics
 */

export const TEST_SUITE_INFO = {
    name: 'Economics Module',
    version: '1.0.0',
    tests: {
        unit: 'economicsService.test.js',
        api: 'economicsApi.test.js',
        component: 'components.test.tsx',
        e2e: 'economics.e2e.test.ts',
    },
    coverage: {
        target: 80,
        branches: 75,
        functions: 85,
        lines: 80,
    },
};

// Test utilities
export const mockAnalysis = {
    id: 'mock-analysis-id',
    name: 'Mock Analysis',
    description: 'Test analysis for unit tests',
    status: 'in_progress' as const,
    overallScore: 4.5,
    completionPercent: 60,
    organizationId: 'mock-org-id',
    createdBy: 'mock-user-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    axisScores: {},
    detailedScores: [],
};

export const mockUser = {
    id: 'mock-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    organizationId: 'mock-org-id',
};

export const mockScores = [
    {
        axisId: 'digital_processes',
        areaId: 'dp_1',
        currentLevel: 3,
        targetLevel: 5,
    },
    {
        axisId: 'digital_processes',
        areaId: 'dp_2',
        currentLevel: 4,
        targetLevel: 6,
    },
];

export const mockVersion = {
    id: 'mock-version-id',
    analysisId: 'mock-analysis-id',
    versionNumber: 1,
    versionName: 'v1.0',
    versionType: 'snapshot' as const,
    createdBy: 'mock-user-id',
    createdAt: new Date().toISOString(),
};

export const mockEvidence = {
    id: 'mock-evidence-id',
    scoreId: 'mock-score-id',
    evidenceType: 'link' as const,
    title: 'Test Evidence',
    content: 'https://example.com',
    uploadedBy: 'mock-user-id',
    uploadedAt: new Date().toISOString(),
};

// Test helpers
export function createMockRequest(overrides = {}) {
    return {
        user: mockUser,
        organizationId: mockUser.organizationId,
        body: {},
        params: {},
        query: {},
        ...overrides,
    };
}

export function createMockResponse() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
}














