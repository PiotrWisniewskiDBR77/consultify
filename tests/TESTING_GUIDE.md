# Testing Guide

## Enterprise SaaS Architecture - TypeScript Backend

## Overview

This guide provides comprehensive instructions for writing, running, and maintaining tests for the Consultinity backend system. The testing strategy follows a 5-level approach to ensure 95%+ coverage across all layers.

## Testing Strategy - 5 Levels

### Level 1: Static Analysis & Integrity (100% coverage)

- **ESLint**: Code quality and style checks
- **TypeScript Check**: Type safety validation
- **Import Validation**: Verify all imports are correct
- **Type Safety**: Check for `any` usage

**Commands:**

```bash
npm run lint
npm run type-check
```

### Level 2: Unit Testing (95%+ coverage)

- **Routes**: Test individual route handlers
- **Services**: Test business logic
- **Middleware**: Test request/response handling
- **Utils**: Test utility functions
- **Config**: Test configuration loading

**Commands:**

```bash
npm run test:backend
npm run test:unit
```

### Level 3: Component Testing (95%+ coverage)

- **Frontend Components**: React component tests
- **Accessibility**: A11y tests

**Commands:**

```bash
npm run test:component
```

### Level 4: Integration & API Testing (95%+ coverage)

- **Routes Integration**: Test full request/response flows
- **Services Integration**: Test service interactions
- **Middleware Chain**: Test middleware execution order

**Commands:**

```bash
npm run test:integration
```

### Level 5: System & Performance Testing (95%+ coverage)

- **Load Tests**: Test under concurrent load
- **Stress Tests**: Test system limits
- **E2E Tests**: Test complete user journeys

**Commands:**

```bash
npm run test:e2e
npm run test:performance
npm run test:load
```

## Writing Tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ComponentName', () => {
  let mockDependency: MockType;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mocks
  });

  describe('methodName', () => {
    it('should do something', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle errors', () => {
      // Test error cases
    });
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Clear Names**: Use descriptive test names
3. **AAA Pattern**: Arrange, Act, Assert
4. **Mock External Dependencies**: Don't rely on external services
5. **Test Edge Cases**: Include boundary conditions
6. **Test Error Paths**: Verify error handling

## Coverage Requirements

- **Critical Components**: 95%+ coverage
- **Important Components**: 90%+ coverage
- **Other Components**: 85%+ coverage

## Running Tests

```bash
# All tests
npm run test:all

# With coverage
npm run test:coverage

# Specific level
npm run test:unit
npm run test:integration
npm run test:e2e
```

## CI/CD Integration

Tests run automatically on:

- Pull requests
- Commits to main branch
- Nightly builds

Coverage reports are generated and tracked over time.
