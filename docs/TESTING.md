# Testing Documentation - Enterprise Customers Module

## Overview

This document describes the testing strategy and test coverage for the Enterprise Customers Module.

## Test Structure

```
tests/
├── unit/
│   └── backend/
│       └── services/
│           ├── organizationMetadataService.test.js
│           └── supportTicketService.test.js
├── integration/
│   └── routes/
│       ├── superadmin-organizations-extended.test.js
│       ├── superadmin-security.test.js
│       └── superadmin-support.test.js
├── e2e/
│   └── superadmin/
│       ├── customers-module-security.spec.ts
│       └── customers-module-support.spec.ts
└── helpers/
    └── auth.js
```

## Test Types

### 1. Unit Tests

**Location:** `tests/unit/backend/services/`

**Purpose:** Test individual service functions in isolation.

**Coverage:**
- `organizationMetadataService.test.js` - Tests for organization metadata operations
- `supportTicketService.test.js` - Tests for support ticket operations

**Running:**
```bash
npm run test:unit
```

**Example:**
```javascript
describe('OrganizationMetadataService', () => {
    it('should return metadata for an organization', async () => {
        const result = await OrganizationMetadataService.getMetadata('org1');
        expect(result).toBeArray();
    });
});
```

### 2. Integration Tests

**Location:** `tests/integration/routes/`

**Purpose:** Test API endpoints with database interactions.

**Coverage:**
- `superadmin-organizations-extended.test.js` - Organization endpoints
- `superadmin-security.test.js` - Security endpoints
- `superadmin-support.test.js` - Support endpoints

**Running:**
```bash
npm run test:integration
```

**Example:**
```javascript
describe('GET /api/superadmin/organizations/:id/metadata', () => {
    it('should return organization metadata', async () => {
        const response = await request(app)
            .get('/api/superadmin/organizations/org-123/metadata')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
```

### 3. E2E Tests

**Location:** `tests/e2e/superadmin/`

**Purpose:** Test complete user flows in the browser.

**Coverage:**
- `customers-module-security.spec.ts` - Security module UI tests
- `customers-module-support.spec.ts` - Support module UI tests

**Running:**
```bash
npm run test:e2e
```

**Example:**
```typescript
test('should add IP to whitelist', async ({ page }) => {
    await page.goto('/superadmin/customers?tab=security');
    await page.click('text=Add IP');
    await page.fill('input[placeholder*="IP"]', '192.168.1.1');
    await page.click('button:has-text("Add IP")');
    await expect(page.locator('text=192.168.1.1')).toBeVisible();
});
```

## Test Helpers

### Authentication Helpers

**Location:** `tests/helpers/auth.js`

**Functions:**
- `createTestToken(payload)` - Create a test JWT token
- `createSuperAdminToken()` - Create a SuperAdmin token

**Usage:**
```javascript
const { createSuperAdminToken } = require('./helpers/auth');
const token = createSuperAdminToken();
```

## Test Coverage Goals

### Current Coverage

- **Unit Tests:** 2 service files (OrganizationMetadata, SupportTicket)
- **Integration Tests:** 3 route files (Organizations, Security, Support)
- **E2E Tests:** 2 spec files (Security, Support)

### Target Coverage

- **Unit Tests:** All 20 services (currently 2/20 = 10%)
- **Integration Tests:** All endpoint groups (currently 3/9 = 33%)
- **E2E Tests:** All major user flows (currently 2/5 = 40%)

## Running Tests

### All Tests
```bash
npm run test:all
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests Only
```bash
npm run test:e2e
```

### With Coverage
```bash
npm run test:coverage
```

## Test Data

### Seed Data

Test data is seeded using `server/seed/seed_enterprise_customers.js`:

- Organizations: 1-10 test organizations
- Users: 1-20 test users
- Support Tickets: 5 test tickets
- Security Events: 5 test events
- IP Whitelist: 3 test IPs
- Email Templates: 2 test templates

### Running Seed
```bash
node server/seed/seed_enterprise_customers.js
```

## Test Environment

### Requirements

- Node.js 18+
- SQLite database (test database is created automatically)
- Playwright (for E2E tests)

### Environment Variables

```env
NODE_ENV=test
DB_TYPE=sqlite
JWT_SECRET=test-secret
```

## Continuous Integration

### GitHub Actions

Tests should run on:
- Pull requests
- Pushes to main branch
- Scheduled nightly runs

### Test Reports

Test results are generated in:
- `coverage/` - Coverage reports
- `test-results/` - Playwright test results
- `playwright-report/` - Playwright HTML reports

## Known Issues

1. **Database Timing:** Some tests may fail if database isn't fully initialized. Use delays or wait for initPromise.

2. **Mock Database:** Unit tests use mocked database. Ensure mocks match actual database behavior.

3. **E2E Authentication:** E2E tests require proper authentication setup. Update login logic in beforeEach hooks.

## Future Improvements

1. **Increase Coverage:** Add tests for all remaining services and endpoints
2. **Performance Tests:** Add load testing for critical endpoints
3. **Visual Regression:** Add visual regression tests for UI components
4. **API Contract Tests:** Add contract tests for API endpoints
5. **Accessibility Tests:** Add a11y tests for frontend components

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Follow existing test patterns
3. Add test to appropriate test suite
4. Update this documentation

### Updating Tests

When updating functionality:
1. Update corresponding tests
2. Ensure tests still pass
3. Update test documentation if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)









