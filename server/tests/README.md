# Backend Tests Documentation

## Overview

This directory contains all backend tests for the TypeScript migration. Tests are organized into unit tests and integration tests.

## Structure

```
server/tests/
├── unit/
│   └── backend/
│       ├── config/          # Config tests
│       ├── cron/            # Cron job tests
│       ├── database/        # Database tests
│       ├── routes/          # Route tests
│       ├── services/        # Service tests
│       └── utils/           # Utility tests
├── integration/
│   └── backend/
│       └── routes/          # Integration tests for routes
└── utils/
    ├── test-helpers.ts      # Test utilities
    └── test-fixtures.ts     # Test data fixtures
```

## Running Tests

### Run all tests
```bash
npm run test:backend
```

### Run tests in watch mode
```bash
npm run test:backend:watch
```

### Run tests with coverage
```bash
npm run test:backend:coverage
```

### Run specific test file
```bash
npm run test:backend -- server/tests/unit/backend/cron/TrialCron.test.ts
```

## Test Coverage Goals

- **Cron Jobs (Stage 6):** 80%+ coverage
- **Entry Point (Stage 7):** 100% coverage
- **Routes:** 95%+ coverage
- **Services:** 90%+ coverage
- **Utils:** 100% coverage
- **Config:** 95%+ coverage

## Writing Tests

### Unit Tests

Unit tests should:
- Test individual functions/methods in isolation
- Use mocks for dependencies
- Be fast and deterministic
- Have clear, descriptive names

Example:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functionToTest } from '../../../../src/module/File.js';

describe('functionToTest', () => {
    it('should do something', () => {
        const result = functionToTest();
        expect(result).toBe(expected);
    });
});
```

### Integration Tests

Integration tests should:
- Test multiple components working together
- Use real dependencies where possible
- Test actual HTTP requests/responses
- Be slower but more realistic

Example:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../../src/index.js';

describe('API Integration', () => {
    it('should handle GET /api/health', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
    });
});
```

## Test Utilities

### Mock Database
```typescript
import { createMockDatabase } from '../utils/test-helpers.js';

const mockDb = createMockDatabase();
```

### Mock Request/Response
```typescript
import { createMockRequest, createMockResponse } from '../utils/test-helpers.js';

const req = createMockRequest();
const res = createMockResponse();
```

### Test Fixtures
```typescript
import { databaseFixtures, serviceFixtures } from '../utils/test-fixtures.js';

const testUser = databaseFixtures.users[0];
```

## Coverage Reports

Coverage reports are generated in:
- `server/coverage/` - HTML coverage report
- `server/coverage/coverage-final.json` - JSON coverage data

View HTML report:
```bash
open server/coverage/index.html
```

## CI/CD Integration

Tests run automatically in CI/CD pipeline:
- On every push
- Before merging PRs
- Coverage reports are uploaded as artifacts

## Best Practices

1. **Isolation:** Each test should be independent
2. **Naming:** Use descriptive test names
3. **Arrange-Act-Assert:** Structure tests clearly
4. **Mocking:** Mock external dependencies
5. **Coverage:** Aim for high coverage but focus on important paths
6. **Speed:** Keep tests fast (< 1s per test)
7. **Clarity:** Tests should be readable and maintainable

## Troubleshooting

### Tests failing with database errors
- Ensure test database is configured
- Check database migrations are up to date
- Verify database connection in test environment

### Tests timing out
- Check for async operations not being awaited
- Verify mocks are properly configured
- Increase timeout if needed (not recommended)

### Coverage not updating
- Ensure tests are actually running
- Check coverage configuration in vitest.config.ts
- Verify files are not excluded from coverage
