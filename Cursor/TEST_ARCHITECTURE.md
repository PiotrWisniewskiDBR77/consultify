# Consultify — Complete Test Architecture & Implementation Plan

> **Status**: 🚀 Ready for Implementation  
> **Owner**: CTO  
> **Goal**: Maximum test coverage with security-first approach, eliminating DB/LLM mocking issues

---

## Executive Summary

This document defines a comprehensive 5-level testing architecture (Unit/Integration/Component/E2E/Performance) with:
- **Dependency Injection** pattern for all services (eliminates DB mocking issues)
- **LLM API Mocking** system (mocks `/api/ai/chat` endpoint, not direct provider calls)
- **Quality Gates** with security-first prioritization
- **Coverage Targets**: 95%+ for critical paths, 85%+ overall (100% is aspirational, not absolute)

---

## 1. Architecture Overview

### 1.1 Test Pyramid

```
                    ┌─────────────┐
                    │   E2E (5%)  │  Critical user journeys
                    └─────────────┘
                 ┌───────────────────┐
                 │ Integration (15%) │  Routes + DB + Auth
                 └───────────────────┘
              ┌─────────────────────────┐
              │   Component (20%)       │  React components
              └─────────────────────────┘
           ┌───────────────────────────────┐
           │      Unit (60%)                │  Services, utilities
           └───────────────────────────────┘
```

### 1.2 Dependency Injection Architecture

**Problem**: Services directly import `require('../database')`, causing mocking issues.

**Solution**: Standardize `setDependencies()` pattern across all services.

```javascript
// Pattern: All services use dependency container
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4,
    // ... other deps
};

const Service = {
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    // ... service methods
};
```

**Implementation**: 
- `tests/helpers/dependencyInjector.js` - Centralized DI helper
- Auto-inject mocks in `tests/setup.ts`
- Legacy services refactored incrementally

### 1.3 LLM API Mocking Strategy

**Problem**: LLM calls go through `/api/ai/chat` endpoint (user's API), not direct provider calls.

**Solution**: Mock the HTTP endpoint, not the provider SDKs.

```javascript
// tests/__mocks__/llmApi.js
export const mockLLMApi = {
    chat: vi.fn().mockResolvedValue({
        text: 'Mock AI Response',
        tokens: { input: 100, output: 50 },
        model: 'mock-model'
    }),
    stream: vi.fn().mockImplementation(async function* () {
        yield 'Mock';
        yield ' AI';
        yield ' Response';
    })
};
```

**Usage in tests**:
- Unit tests: Mock `aiService.callLLM()` directly
- Integration tests: Mock Express route handler
- E2E tests: Mock `/api/ai/chat` endpoint with Playwright route interception

---

## 2. Quality Gates & Prioritization

### 2.1 Critical Paths (Must Have 95%+ Coverage)

#### Security & Multi-Tenant Isolation
- ✅ `server/services/accessPolicyService.js` - Access control
- ✅ `server/services/permissionService.js` - PBAC enforcement
- ✅ `server/services/aiRoleGuard.js` - AI action blocking
- ✅ `server/services/regulatoryModeGuard.js` - Regulatory compliance
- ✅ `server/middleware/authMiddleware.js` - Token verification
- ✅ `server/middleware/permissionMiddleware.js` - Permission checks
- ✅ All routes with `verifyToken` - Tenant isolation

#### Billing & Cost Control
- ✅ `server/services/aiCostControlService.js` - Budget enforcement
- ✅ `server/services/tokenBillingService.js` - Token billing
- ✅ `server/services/billingService.js` - Stripe integration
- ✅ `server/services/settlementService.js` - Financial settlements

#### Data Isolation
- ✅ All DB queries must filter by `organization_id`
- ✅ All routes must verify `req.organizationId` matches resource
- ✅ Export/legal services must enforce tenant boundaries

### 2.2 High Priority (85%+ Coverage)

#### AI Services
- `server/services/aiService.js` - Core LLM orchestration
- `server/services/aiActionExecutor.js` - Action execution
- `server/services/aiDecisionGovernance.js` - Decision governance
- `server/services/aiPolicyEngine.js` - Policy enforcement
- `server/services/aiAuditLogger.js` - Audit logging

#### Business Services
- `server/services/invitationService.js` - User invitations
- `server/services/organizationService.js` - Org management
- `server/services/legalService.js` - Legal compliance
- `server/services/governanceService.js` - Governance

### 2.3 Standard Priority (75%+ Coverage)

- Remaining AI services (analytics, reporting, etc.)
- Remaining business services
- React components (critical UI flows)
- Routes (non-critical endpoints)

---

## 3. Implementation Roadmap

### Phase 1: Foundation (Week 1) ⚡ CRITICAL

**Goal**: Fix DB mocking, establish DI pattern, create LLM mocks.

#### Tasks:
1. ✅ Create `tests/helpers/dependencyInjector.js`
   - Standardized DI helper
   - Auto-inject mocks for common dependencies
   - Support for legacy services

2. ✅ Create `tests/__mocks__/llmApi.js`
   - Mock `/api/ai/chat` endpoint
   - Mock streaming responses
   - Deterministic responses for tests

3. ✅ Refactor critical services to use DI
   - `accessPolicyService.js`
   - `permissionService.js`
   - `aiCostControlService.js` (already done)
   - `tokenBillingService.js`

4. ✅ Update `tests/setup.ts`
   - Auto-inject mocks via DI helper
   - Configure LLM API mocks globally

**Deliverable**: All critical services testable without DB mocking issues.

---

### Phase 2: Critical Security Tests (Week 2) 🔒

**Goal**: 95%+ coverage for security, multi-tenant, billing.

#### Unit Tests (Priority 1):
- [ ] `tests/unit/backend/accessPolicyService.test.js`
- [ ] `tests/unit/backend/permissionService.test.js`
- [ ] `tests/unit/backend/aiRoleGuard.test.js`
- [ ] `tests/unit/backend/regulatoryModeGuard.test.js`
- [ ] `tests/unit/backend/tokenBillingService.test.js`
- [ ] `tests/unit/backend/billingService.test.js`
- [ ] `tests/unit/backend/settlementService.test.js`

#### Integration Tests (Priority 1):
- [ ] `tests/integration/routes/auth.test.js` - Token verification, tenant isolation
- [ ] `tests/integration/routes/access-control.test.js` - Permission enforcement
- [ ] `tests/integration/routes/billing.test.js` - Billing endpoints
- [ ] `tests/integration/routes/tokenBilling.test.js` - Token billing

**Test Scenarios**:
- ✅ User from Org A cannot access Org B data
- ✅ Permission denied returns 403
- ✅ Budget exceeded blocks AI calls
- ✅ Regulatory mode blocks mutations
- ✅ AI role guard blocks unauthorized actions

**Deliverable**: Security tests passing, 95%+ coverage on critical paths.

---

### Phase 3: AI Services Tests (Week 3-4) 🤖

**Goal**: 85%+ coverage for AI services.

#### Unit Tests:
- [ ] `tests/unit/backend/aiService.test.js` (extend existing)
- [ ] `tests/unit/backend/aiActionExecutor.test.js`
- [ ] `tests/unit/backend/aiDecisionGovernance.test.js`
- [ ] `tests/unit/backend/aiPolicyEngine.test.js`
- [ ] `tests/unit/backend/aiAuditLogger.test.js`
- [ ] `tests/unit/backend/aiAnalyticsService.test.js` (extend existing)
- [ ] `tests/unit/backend/aiExecutiveReporting.test.js` (extend existing)
- [ ] `tests/unit/backend/aiContextBuilder.test.js`
- [ ] `tests/unit/backend/aiKnowledgeManager.test.js` (extend existing)
- [ ] `tests/unit/backend/aiMemoryManager.test.js`
- [ ] `tests/unit/backend/aiPromptHierarchy.test.js`
- [ ] `tests/unit/backend/aiFailureHandler.test.js`
- [ ] `tests/unit/backend/aiIntegrationService.test.js`
- [ ] `tests/unit/backend/aiMaturityMonitor.test.js`
- [ ] `tests/unit/backend/aiRiskChangeControl.test.js`
- [ ] `tests/unit/backend/aiWorkloadIntelligence.test.js`
- [ ] `tests/unit/backend/aiExternalDataControl.test.js`
- [ ] `tests/unit/backend/aiExplainabilityService.test.js`

**Test Scenarios**:
- ✅ LLM calls use correct provider/model
- ✅ Cost tracking logs usage correctly
- ✅ Budget enforcement works
- ✅ Action execution respects governance
- ✅ Audit logging captures all actions
- ✅ Error handling and retries work

**Deliverable**: All AI services tested, 85%+ coverage.

---

### Phase 4: Business Services Tests (Week 5-6) 💼

**Goal**: 75%+ coverage for business services.

#### Unit Tests:
- [ ] `tests/unit/backend/invitationService.test.js`
- [ ] `tests/unit/backend/organizationService.test.js`
- [ ] `tests/unit/backend/legalService.test.js`
- [ ] `tests/unit/backend/governanceService.test.js`
- [ ] `tests/unit/backend/connectorService.test.js`
- [ ] `tests/unit/backend/playbookResolver.test.js`
- [ ] `tests/unit/backend/pmoAnalysisService.test.js`
- [ ] `tests/unit/backend/roadmapService.test.js`
- [ ] `tests/unit/backend/stabilizationService.test.js`
- [ ] `tests/unit/backend/reportingService.test.js`
- [ ] `tests/unit/backend/notificationService.test.js`
- [ ] `tests/unit/backend/webhookService.test.js`
- [ ] ... (remaining 30+ services)

**Deliverable**: Business services tested, 75%+ coverage.

---

### Phase 5: Integration Tests (Week 7) 🔗

**Goal**: Test routes + DB + auth integration.

#### Integration Tests:
- [ ] `tests/integration/routes/invitations.test.js`
- [ ] `tests/integration/routes/sessions.test.js`
- [ ] `tests/integration/routes/analytics.test.js`
- [ ] `tests/integration/routes/feedback.test.js`
- [ ] `tests/integration/routes/notifications.test.js`
- [ ] `tests/integration/routes/documents.test.js`
- [ ] `tests/integration/routes/aiAnalytics.test.js`
- [ ] `tests/integration/routes/llm.test.js`
- [ ] `tests/integration/routes/pmoContext.test.js`
- [ ] `tests/integration/routes/superadmin.test.js`
- [ ] `tests/integration/routes/settings.test.js`
- [ ] `tests/integration/routes/webhooks.test.js`
- [ ] `tests/integration/routes/teams.test.js`

**Test Scenarios**:
- ✅ Routes require authentication
- ✅ Routes enforce permissions
- ✅ Routes filter by organization
- ✅ Routes handle errors correctly
- ✅ Routes return correct status codes

**Deliverable**: All routes tested, integration coverage 80%+.

---

### Phase 6: Component Tests (Week 8) ⚛️

**Goal**: Test critical React components.

#### Component Tests:
- [ ] `tests/components/Sidebar.test.tsx`
- [ ] `tests/components/ChatPanel.test.tsx`
- [ ] `tests/components/Select.test.tsx`
- [ ] `tests/components/SplitLayout.test.tsx`
- [ ] `tests/components/ModelSelector.test.tsx`
- [ ] `tests/components/AIAnalyticsDashboard.test.tsx`
- [ ] `tests/components/InitiativeCard.test.tsx` (extend)
- [ ] `tests/components/InitiativeDetailModal.test.tsx`
- [ ] `tests/components/TaskDetailModal.test.tsx`
- [ ] `tests/components/InviteUserModal.test.tsx`
- [ ] `tests/components/MaturityMatrix.test.tsx`
- [ ] `tests/components/RoadmapGantt.test.tsx`
- [ ] `tests/components/RoadmapKanban.test.tsx`
- [ ] `tests/components/ai/ActionDecisionDialog.test.tsx`
- [ ] `tests/components/ai/ActionProposalCard.test.tsx`
- [ ] `tests/components/ai/PlaybookRunViewer.test.tsx`
- [ ] `tests/components/ai/ConfidenceBadge.test.tsx`
- [ ] ... (remaining 40+ components)

**Test Scenarios**:
- ✅ Components render correctly
- ✅ User interactions work (clicks, inputs)
- ✅ Permission-based UI rendering
- ✅ Error states display correctly
- ✅ Loading states work

**Deliverable**: Critical components tested, 75%+ coverage.

---

### Phase 7: E2E Tests (Week 9) 🎭

**Goal**: Test critical user journeys.

#### E2E Tests:
- [ ] `tests/e2e/aiActions.spec.ts`
  - Generate AI proposal
  - Approval flow
  - Execution monitoring
  - Rollback scenarios

- [ ] `tests/e2e/playbooks.spec.ts`
  - Playbook creation
  - Dry-run execution
  - Branch conditions
  - Step monitoring

- [ ] `tests/e2e/billing.spec.ts`
  - Token purchase
  - Budget setup
  - Usage tracking

- [ ] `tests/e2e/settings.spec.ts`
  - Org settings
  - User management
  - Permission management

- [ ] `tests/e2e/invitations.spec.ts`
  - Invite user
  - Accept invitation
  - Role assignment

- [ ] `tests/e2e/analytics.spec.ts`
  - Dashboard views
  - Report generation

- [ ] `tests/e2e/governance.spec.ts`
  - Regulatory mode
  - AI role guard
  - Policy enforcement

**Deliverable**: Critical user journeys tested, E2E coverage 60%+.

---

### Phase 8: Performance Tests (Week 10) ⚡

**Goal**: Establish performance baselines and budgets.

#### Performance Tests:
- [ ] `tests/performance/aiPerformance.test.js`
  - AI proposal generation time (< 5s)
  - Playbook execution time (< 10s)
  - Memory footprint (< 500MB)

- [ ] `tests/performance/databaseQueries.test.js`
  - Query latency (< 100ms p95)
  - Connection pool efficiency

- [ ] `tests/performance/apiThroughput.test.js`
  - Requests/second (target: 100+)
  - Concurrent users (target: 50+)

- [ ] `tests/performance/concurrency.test.js`
  - Race conditions
  - Deadlock detection

- [ ] `tests/performance/memoryLeaks.test.js`
  - Memory growth over time
  - GC efficiency

**Deliverable**: Performance baselines established, budgets enforced.

---

## 4. Quality Gates

### 4.1 Coverage Thresholds

| Module Type | Statements | Branches | Functions | Lines |
|------------|-----------|----------|-----------|-------|
| **Critical** (Security/Billing) | 95% | 90% | 95% | 95% |
| **High Priority** (AI Services) | 85% | 80% | 85% | 85% |
| **Standard** (Business/UI) | 75% | 70% | 75% | 75% |
| **Overall** | 85% | 80% | 85% | 85% |

### 4.2 Quality Gates (CI/CD)

```yaml
# .github/workflows/tests.yml (or similar)
quality_gates:
  - name: Critical Path Coverage
    threshold: 95%
    paths:
      - server/services/accessPolicyService.js
      - server/services/permissionService.js
      - server/services/aiCostControlService.js
      - server/services/tokenBillingService.js
  
  - name: Security Tests
    required: true
    paths:
      - tests/unit/backend/accessPolicyService.test.js
      - tests/unit/backend/permissionService.test.js
      - tests/integration/routes/auth.test.js
  
  - name: Multi-Tenant Isolation
    required: true
    paths:
      - tests/integration/routes/**/*.test.js
  
  - name: Performance Budgets
    required: true
    paths:
      - tests/performance/**/*.test.js
```

### 4.3 Pre-Commit Hooks

```bash
# .husky/pre-commit
npm run test:unit:critical  # Fast security tests
npm run lint
```

---

## 5. Test Infrastructure

### 5.1 Dependency Injection Helper

**File**: `tests/helpers/dependencyInjector.js`

```javascript
import { vi } from 'vitest';

/**
 * Standardized dependency injection helper
 * Provides mocks for common dependencies used across services
 */
export const createMockDb = () => ({
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn(),
    }),
    serialize: vi.fn((cb) => cb && cb()),
    initPromise: Promise.resolve()
});

export const createMockLLMApi = () => ({
    chat: vi.fn().mockResolvedValue({
        text: 'Mock AI Response',
        tokens: { input: 100, output: 50 },
        model: 'mock-model'
    }),
    stream: vi.fn().mockImplementation(async function* () {
        yield 'Mock';
        yield ' AI';
        yield ' Response';
    })
});

export const injectDependencies = (service, deps) => {
    if (service.setDependencies) {
        service.setDependencies(deps);
    } else {
        console.warn(`Service ${service.constructor?.name || 'Unknown'} does not support setDependencies`);
    }
};
```

### 5.2 LLM API Mock

**File**: `tests/__mocks__/llmApi.js`

```javascript
import { vi } from 'vitest';

/**
 * Mock LLM API endpoint
 * Mocks /api/ai/chat and /api/ai/chat/stream
 */
export const mockLLMApi = {
    chat: vi.fn().mockResolvedValue({
        text: 'Mock AI Response',
        tokens: { input: 100, output: 50 },
        model: 'mock-model',
        cost: 0.001
    }),
    
    stream: vi.fn().mockImplementation(async function* () {
        const chunks = ['Mock', ' AI', ' Response'];
        for (const chunk of chunks) {
            yield chunk;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }),
    
    reset: () => {
        mockLLMApi.chat.mockClear();
        mockLLMApi.stream.mockClear();
    }
};

// Default mock response
mockLLMApi.chat.mockResolvedValue({
    text: 'Mock AI Response',
    tokens: { input: 100, output: 50 },
    model: 'mock-model',
    cost: 0.001
});

export default mockLLMApi;
```

### 5.3 Test Fixtures

**File**: `tests/fixtures/testData.js`

```javascript
/**
 * Standardized test data fixtures
 * Use these across all tests for consistency
 */
export const testUsers = {
    admin: {
        id: 'user-admin-123',
        email: 'admin@test.com',
        role: 'ADMIN',
        organizationId: 'org-test-123'
    },
    user: {
        id: 'user-123',
        email: 'user@test.com',
        role: 'USER',
        organizationId: 'org-test-123'
    },
    superadmin: {
        id: 'user-superadmin-123',
        email: 'superadmin@test.com',
        role: 'SUPERADMIN',
        organizationId: null
    }
};

export const testOrganizations = {
    org1: {
        id: 'org-test-123',
        name: 'Test Organization 1'
    },
    org2: {
        id: 'org-test-456',
        name: 'Test Organization 2'
    }
};

export const testProjects = {
    project1: {
        id: 'proj-test-123',
        name: 'Test Project 1',
        organizationId: 'org-test-123'
    }
};
```

---

## 6. Running Tests

### 6.1 Test Commands

```bash
# Unit tests (all)
npm run test:unit

# Unit tests (critical only)
npm run test:unit:critical

# Integration tests
npm run test:integration

# Component tests
npm run test:component

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# All tests with coverage
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

### 6.2 Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html

# Check coverage thresholds
npm run test:coverage -- --reporter=json-summary
```

---

## 7. Success Metrics

### 7.1 Coverage Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statements | 28% | 85% | 🟡 |
| Branches | 19% | 80% | 🟡 |
| Functions | 24% | 85% | 🟡 |
| Lines | 29% | 85% | 🟡 |
| **Critical Path** | ~40% | 95% | 🟡 |

### 7.2 Quality Metrics

- ✅ Zero security vulnerabilities in critical paths
- ✅ 100% multi-tenant isolation tests passing
- ✅ 100% billing accuracy tests passing
- ✅ Performance budgets met (< 5s AI calls, < 100ms DB queries)
- ✅ Zero flaky tests (deterministic, no time-based races)

---

## 8. Maintenance & Evolution

### 8.1 Test Maintenance

- **Weekly**: Review flaky tests, update fixtures
- **Monthly**: Review coverage gaps, add missing tests
- **Quarterly**: Performance baseline updates, budget adjustments

### 8.2 Adding New Tests

1. **Identify level**: Unit/Integration/Component/E2E/Performance
2. **Use fixtures**: Import from `tests/fixtures/testData.js`
3. **Use DI**: Inject dependencies via `dependencyInjector.js`
4. **Mock LLM**: Use `mockLLMApi` for AI calls
5. **Follow naming**: `*.test.js` or `*.spec.ts` (E2E)

### 8.3 Refactoring Services

When refactoring services:
1. Add `setDependencies()` if missing
2. Update tests to use DI
3. Remove direct `require('../database')` imports
4. Update `dependencyInjector.js` if needed

---

## 9. Appendix

### 9.1 Test File Structure

```
tests/
├── __mocks__/
│   ├── server/
│   │   └── database.js          # DB mock
│   └── llmApi.js                 # LLM API mock
├── fixtures/
│   └── testData.js               # Test data fixtures
├── helpers/
│   ├── dependencyInjector.js     # DI helper
│   └── dbHelper.js               # DB test utilities
├── unit/
│   └── backend/
│       ├── accessPolicyService.test.js
│       ├── permissionService.test.js
│       └── ...
├── integration/
│   └── routes/
│       ├── auth.test.js
│       └── ...
├── components/
│   ├── Sidebar.test.tsx
│   └── ...
├── e2e/
│   ├── aiActions.spec.ts
│   └── ...
└── performance/
    ├── aiPerformance.test.js
    └── ...
```

### 9.2 Service Dependency Injection Checklist

When creating/updating a service:

- [ ] Service uses `deps` container pattern
- [ ] Service exports `setDependencies()` method
- [ ] Service does not directly `require('../database')`
- [ ] Service tests use `dependencyInjector.js`
- [ ] Service tests are deterministic (no time/UUID races)

---

## 10. Next Steps

1. ✅ **Review this plan** - Confirm approach and priorities
2. ⚡ **Phase 1**: Implement DI helper and LLM mocks (Week 1)
3. 🔒 **Phase 2**: Critical security tests (Week 2)
4. 🤖 **Phase 3-8**: Continue with remaining phases

---

**Last Updated**: 2025-01-XX  
**Status**: 🚀 Ready for Implementation




