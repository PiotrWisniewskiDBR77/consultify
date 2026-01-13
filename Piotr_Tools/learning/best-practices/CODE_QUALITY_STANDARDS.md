# Code Quality Standards

**Source**: Lessons from building Consultify to 96% test coverage and VC DD readiness

---

## 🎯 The Golden Rules

### 1. **Type Safety is Non-Negotiable**

**BAD**:

```typescript
function processUser(data: any) {
  return data.email.toLowerCase(); // Runtime error if email is undefined
}
```

**GOOD**:

```typescript
interface User {
  email: string;
  name: string;
}

function processUser(user: User): string {
  return user.email.toLowerCase(); // Compile-time safety
}
```

**Consultify Standard**: 85%+ TypeScript adoption, aiming for 100%

### 2. **Test Everything That Can Break**

**Test Pyramid**:

```
Many unit tests     : Fast, isolated, business logic
Some integration    : API + Database interactions
Few E2E tests       : Critical user flows
```

**Coverage Target**: 90%+ (Consultify: 96%)

**What to Test**:

- ✅ Business logic (units)
- ✅ API endpoints (integration)
- ✅ Database queries (integration with real DB)
- ✅ User flows (E2E with Playwright)
- ✅ Edge cases and error handling

**What NOT to Test**:

- ❌ Third-party libraries (trust them)
- ❌ Simple getters/setters
- ❌ Configuration files

### 3. **No Magic, Only Clarity**

**BAD** (clever but confusing):

```typescript
const x = u?.o?.d?.map((i) => ({ ...i, n: i.n.toUpperCase() })) || [];
```

**GOOD** (clear and maintainable):

```typescript
const organizationData = user?.organization?.data || [];
const uppercasedNames = organizationData.map((item) => ({
  ...item,
  name: item.name.toUpperCase(),
}));
```

**Rule**: Code is read 10x more than written. Optimize for readability.

---

## 📝 Naming Conventions

### Variables & Functions

```typescript
// GOOD
const userEmail = 'test@example.com';
const isAuthenticated = true;
const hasPermission = checkUserPermission(user, 'admin');

function calculateTotalPrice(items: Item[]): number {
  // Clear what it does
}

// BAD
const e = 'test@example.com'; // What is 'e'?
const flag = true; // What flag?
const x = check(u, 'admin'); // Too cryptic
```

### Classes & Components

```typescript
// PascalCase for classes/components
class UserService { }
class DatabaseConnection { }
const LoginButton = () => <button>Login</button>;

// Interfaces prefixed with 'I' or descriptive names
interface User { }
interface IApiResponse { }
```

### Files

```
// Good structure
UserService.ts
AuthController.ts
user-profile.component.tsx
database-connection.ts

// Bad
service.ts  // Too generic
USR.ts      // Abbreviations
File1.ts    // Meaningless
```

---

## 🏗️ Architecture Principles

### SOLID Principles

#### S - Single Responsibility

```typescript
// BAD: Class does too much
class User {
  save() {}
  sendEmail() {}
  generateReport() {}
  processPayment() {}
}

// GOOD: Each class has one job
class UserRepository {
  save(user: User) {}
}

class EmailService {
  send(to: string, content: string) {}
}

class ReportGenerator {
  generate(user: User) {}
}
```

#### O - Open/Closed (Open for extension, closed for modification)

```typescript
// Use interfaces for extensibility
interface AIProvider {
  chat(messages: Message[]): Promise<string>;
}

class OpenAIProvider implements AIProvider {}
class ClaudeProvider implements AIProvider {}
class GeminiProvider implements AIProvider {}

// Can add new providers without modifying existing code
```

### Dependency Injection

```typescript
// BAD: Tight coupling
class UserController {
  constructor() {
    this.db = new Database(); // Hard to test
  }
}

// GOOD: Inject dependencies
class UserController {
  constructor(private db: Database) {}
}

// Easy to test with mock
const mockDb = { query: jest.fn() };
const controller = new UserController(mockDb);
```

---

## 🔒 Security Best Practices

### Input Validation

```typescript
import { z } from 'zod';

// Define schema
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(200),
});

// Validate before processing
app.post('/api/users', (req, res) => {
  try {
    const data = CreateUserSchema.parse(req.body);
    // data is now type-safe and validated
  } catch (error) {
    return res.status(400).json({ error: 'Invalid input' });
  }
});
```

### SQL Injection Prevention

```typescript
// NEVER EVER DO THIS
const userId = req.params.id;
const query = `SELECT * FROM users WHERE id = ${userId}`; // ❌❌❌

// ALWAYS use parameterized queries
const query = 'SELECT * FROM users WHERE id = ?';
const user = db.prepare(query).get(userId); // ✅
```

### Password Security

```typescript
import bcrypt from 'bcrypt';

// Hash passwords (never store plain text)
const hashedPassword = await bcrypt.hash(password, 12);

// Verify passwords
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

---

## 📊 Performance Optimization

### Database Queries

```typescript
// BAD: N+1 query problem
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  user.organization = await db.query('SELECT * FROM organizations WHERE id = ?', [
    user.organization_id,
  ]); // Query inside loop!
}

// GOOD: Join or batch query
const users = await db.query(`
  SELECT u.*, o.name as organization_name
  FROM users u
  LEFT JOIN organizations o ON u.organization_id = o.id
`);
```

### Caching

```typescript
// Cache expensive operations
const cache = new Map();

async function getExpensiveData(key: string) {
  if (cache.has(key)) {
    return cache.get(key); // Fast!
  }

  const data = await expensiveOperation(key);
  cache.set(key, data);
  return data;
}

// Use Redis for distributed caching
await redis.setex('user:123', 3600, JSON.stringify(user));
const cached = await redis.get('user:123');
```

---

## 🧪 Testing Patterns

### Arrange-Act-Assert (AAA)

```typescript
test('should create user', async () => {
  // Arrange: Set up test data
  const userData = {
    email: 'test@example.com',
    name: 'Test User',
  };

  // Act: Execute the function
  const user = await createUser(userData);

  // Assert: Verify the result
  expect(user.email).toBe('test@example.com');
  expect(user.id).toBeDefined();
});
```

### Test Fixtures

```typescript
// Create reusable test data
export function createTestUser(overrides = {}) {
  return {
    id: generateId(),
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    ...overrides,
  };
}

// Use in tests
test('user permissions', () => {
  const admin = createTestUser({ role: 'admin' });
  const member = createTestUser({ role: 'member' });

  expect(hasPermission(admin, 'delete')).toBe(true);
  expect(hasPermission(member, 'delete')).toBe(false);
});
```

---

## 📚 Documentation Standards

### Code Comments

```typescript
// BAD: Obvious comment
// Increment i by 1
i++;

// GOOD: Explain WHY
// Skip deleted users to avoid processing stale data
if (user.deletedAt) continue;

// EXCELLENT: Explain complex business logic
/**
 * Calculate prorated refund for subscription cancellation.
 *
 * We use days remaining / days in billing cycle because:
 * 1. Monthly plans have variable days (28-31)
 * 2. Ensures fair refund regardless of cancellation date
 * 3. Matches accounting requirements per CFO guidance
 */
function calculateRefund(subscription: Subscription): number {
  // Implementation
}
```

### README Standards

Every project needs:

```markdown
# Project Name

Brief description (1 sentence)

## Quick Start

# How to run in 5 minutes

## Documentation

Link to full docs

## Contributing

How to contribute

## License
```

---

## 🎯 Code Review Checklist

Before merging:

- [ ] Tests pass locally
- [ ] No TypeScript errors
- [ ] Code follows naming conventions
- [ ] No hardcoded secrets
- [ ] Documentation updated
- [ ] No console.logs left in
- [ ] Error handling added
- [ ] Performance considered
- [ ] Security reviewed

---

## 🚀 Continuous Improvement

**Measure Quality**:

- Test coverage: `npm run test:coverage`
- Type coverage: `npx type-coverage`
- Linting: `npm run lint`
- Bundle size: `npm run build -- --analyze`

**Set Standards**:

```json
// package.json
"scripts": {
  "precommit": "npm run lint && npm test",
  "quality-gate": "npm run lint && npm run test:coverage && npm run build"
}
```

**Fail Fast**:

- CI must pass before merge
- Coverage threshold enforced
- No TypeScript `any` allowed
- Lint errors block deploy

---

## 💡 Remember

> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." - Martin Fowler

**The #1 Rule**: Write code that YOU will understand in 6 months.

---

**From Consultify**: These standards got us to 96% coverage, 100% test pass rate, and VC DD readiness. They work.
