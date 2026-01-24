# Test Implementation Guide

## Current Status

### Test Files Generated

- **Services**: 391 test files (382 newly created)
- **Routes**: 185 test files (171 newly created)
- **Total**: 576 test files

### Implementation Status

- **Files with placeholders**: 583 files
- **Total placeholders**: 1,403
- **Total tests**: 1,881
- **Coverage needed**: 74.59%

## Priority Implementation Order

### Phase 1: Critical Routes (95%+ coverage)

1. `webhooks.routes.test.ts` - 25 placeholders
2. `billing.routes.test.ts` - 15 placeholders
3. `projects.routes.test.ts` - 11 placeholders

### Phase 2: Important Routes (90%+ coverage)

4. `initiatives.routes.test.ts` - 10 placeholders
5. `tasks.routes.test.ts` - 10 placeholders
6. `users.routes.test.ts` - 7 placeholders

### Phase 3: Critical Services (95%+ coverage)

7. `WebhookService.test.ts` - 6 placeholders
8. `TaskService.test.ts` - 6 placeholders

### Phase 4: Utils & Config (100% coverage)

9. `DbPromise.test.ts` - 7 placeholders

## Implementation Pattern

### Example: Route Test Implementation

**Before (Placeholder):**

```typescript
describe('GET /api/projects', () => {
  it('should return projects for organization', () => {
    expect(true).toBe(true);
  });
});
```

**After (Full Implementation):**

```typescript
describe('GET /api/projects', () => {
  it('should return projects for organization', async () => {
    const mockProjects = [
      { id: 'proj1', name: 'Project 1', organization_id: 'org-123' },
      { id: 'proj2', name: 'Project 2', organization_id: 'org-123' },
    ];

    (ProjectController.getProjects as vi.Mock).mockImplementation((req, res) => {
      res.json(mockProjects);
    });

    const res = await request(app).get('/api/projects').set('Authorization', 'Bearer token');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual(mockProjects);
    expect(ProjectController.getProjects).toHaveBeenCalledOnce();
  });
});
```

### Example: Service Test Implementation

**Before (Placeholder):**

```typescript
describe('getTasks', () => {
  it('should return tasks with filters', async () => {
    expect(true).toBe(true);
  });
});
```

**After (Full Implementation):**

```typescript
describe('getTasks', () => {
  it('should return tasks with filters', async () => {
    const mockTasks = [{ id: 'task1', title: 'Task 1', project_id: 'proj-123', status: 'todo' }];

    (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: mockTasks,
    });

    const tasks = await taskService.getTasks({ projectId: 'proj-123' });

    expect(tasks).toBeDefined();
    expect(tasks.length).toBeGreaterThan(0);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      expect.arrayContaining(['proj-123'])
    );
  });
});
```

## Implementation Checklist

For each test file:

- [ ] Replace `expect(true).toBe(true)` with actual assertions
- [ ] Mock all external dependencies (database, services, etc.)
- [ ] Test happy path scenarios
- [ ] Test error scenarios
- [ ] Test edge cases (empty arrays, null values, etc.)
- [ ] Test validation (invalid input, missing required fields)
- [ ] Test authorization (unauthorized access, insufficient permissions)
- [ ] Verify mock calls (ensure services are called correctly)
- [ ] Clean up mocks in `afterEach` if needed

## Running Tests

```bash
# Run all tests
npm run test:all

# Run backend tests only
npm run test:backend

# Run with coverage
npm run test:coverage

# Check coverage thresholds
npm run test:coverage:check

# Run specific test file
npm run test:backend -- server/tests/unit/backend/routes/billing.routes.test.ts
```

## Coverage Goals

- **Critical Components**: 95%+ (lines, functions, statements), 90%+ (branches)
- **Important Components**: 90%+ (lines, functions, statements), 85%+ (branches)
- **Other Components**: 85%+ (lines, functions, statements), 80%+ (branches)

## Tools

- **Find placeholders**: `npx tsx scripts/fill-test-implementations.ts`
- **Generate new tests**: `bash scripts/generate-all-service-tests.sh`
- **Generate route tests**: `bash scripts/generate-all-route-tests.sh`

## Next Steps

1. Start with critical routes (webhooks, billing, projects)
2. Move to important routes (initiatives, tasks, users)
3. Implement critical services tests
4. Fill utils and config tests
5. Batch process remaining tests
6. Run coverage check and fix any gaps
