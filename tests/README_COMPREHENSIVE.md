# Comprehensive Test Suite Documentation

## Overview

This document describes the comprehensive test suite for the Consultify application, including error handling, resilience, and recovery tests.

## Test Structure

### Level 1: Unit Tests
- **Location**: `tests/unit/`
- **Purpose**: Test individual functions and services in isolation
- **Backend**: `tests/unit/backend/`
- **Frontend**: `tests/unit/` (excluding backend)

### Level 2: Component Tests
- **Location**: `tests/components/`
- **Purpose**: Test React components and their interactions
- **Includes**: Error boundaries, error recovery, component resilience

### Level 3: Integration Tests
- **Location**: `tests/integration/`
- **Purpose**: Test API endpoints, database operations, and service integrations
- **Includes**: 
  - `errorHandling.test.js` - Comprehensive error handling tests
  - `apiResilience.test.js` - API resilience and recovery tests
  - `criticalEndpoints.test.js` - Critical endpoint tests

### Level 4: Error Recovery Tests
- **Location**: `tests/unit/backend/errorRecovery.test.js`
- **Purpose**: Test backend error recovery mechanisms

## Running Tests

### Run All Tests
```bash
npm run test:all
```

### Run Specific Test Suite
```bash
# Unit tests
npm run test:unit

# Component tests
npm run test:component

# Integration tests
npm run test:integration

# Backend tests only
npm run test:backend
```

### Run Comprehensive Test Suite
```bash
./scripts/run-all-tests.sh
```

## Test Coverage

### Error Handling Tests
- ✅ API error responses (404, 400, 401, 500)
- ✅ Database error handling
- ✅ Async error handling
- ✅ Error response format consistency
- ✅ Rate limiting error handling
- ✅ Server resilience
- ✅ Error logging

### Resilience Tests
- ✅ Health check resilience
- ✅ Request validation resilience
- ✅ Concurrent request handling
- ✅ Timeout handling
- ✅ Memory leak prevention
- ✅ Error recovery
- ✅ Input sanitization
- ✅ Resource exhaustion protection

### Critical Endpoints Tests
- ✅ Health check endpoint
- ✅ Authentication endpoints
- ✅ Project endpoints
- ✅ User endpoints
- ✅ AI endpoints
- ✅ Error handling in critical endpoints
- ✅ Performance of critical endpoints

### Component Error Handling
- ✅ Error boundary functionality
- ✅ Error recovery in components
- ✅ Async error handling
- ✅ Null/undefined prop handling
- ✅ Missing context handling

### Backend Error Recovery
- ✅ Database error recovery
- ✅ Service error recovery
- ✅ Transaction error recovery
- ✅ Connection recovery

## Test Results

### Current Status
- **Total Test Suites**: 5+
- **Unit Tests**: 200+ tests
- **Component Tests**: 50+ tests
- **Integration Tests**: 40+ tests
- **Error Handling Tests**: 30+ tests

### Known Issues
Some tests may fail due to:
- Mock database setup issues
- Async timing issues
- Missing test data setup

These are being addressed incrementally.

## Best Practices

1. **Always use test database**: Tests use SQLite in-memory database
2. **Clean up after tests**: Use `cleanTables()` in `afterEach`
3. **Mock external services**: Use mocks for LLM, Redis, etc.
4. **Test error cases**: Always test both success and failure paths
5. **Test resilience**: Test that system recovers from errors

## Troubleshooting

### Tests fail with database errors
- Ensure `initTestDb()` is called in `beforeEach`
- Check that database schema is initialized

### Tests fail with permission errors
- Check `.env` file permissions
- Ensure test environment variables are set

### Tests timeout
- Increase timeout for slow tests
- Check for hanging async operations

## Contributing

When adding new tests:
1. Follow existing test structure
2. Use descriptive test names
3. Test both success and failure cases
4. Clean up test data after tests
5. Document any special setup required

