# Development Guide

This guide covers development workflows, coding standards, and best practices for contributing to Consultify.

## Table of Contents

- [Git Workflow](#git-workflow)
- [Coding Standards](#coding-standards)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Debugging](#debugging)
- [Code Review Process](#code-review-process)

## Git Workflow

### Branch Strategy

- **main** – Production-ready code
- **develop** – Integration branch for features
- **feature/** – Feature branches (e.g., `feature/new-dashboard`)
- **bugfix/** – Bug fix branches (e.g., `bugfix/login-error`)
- **hotfix/** – Critical production fixes

### Commit Messages

Follow conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` – New feature
- `fix` – Bug fix
- `docs` – Documentation changes
- `style` – Code style changes (formatting, etc.)
- `refactor` – Code refactoring
- `test` – Test additions/changes
- `chore` – Build process or auxiliary tool changes

**Examples:**
```
feat(assessment): add DRD axis selector component
fix(auth): resolve JWT token expiration issue
docs(api): update authentication endpoint documentation
```

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes and commit with descriptive messages
3. Push branch and create Pull Request
4. Ensure all tests pass
5. Request code review
6. Address review feedback
7. Merge after approval

## Coding Standards

### TypeScript

- **Strict Mode:** Enabled in `tsconfig.json`
- **Type Safety:** Avoid `any` type; use proper types or `unknown`
- **Interfaces:** Prefer interfaces over types for object shapes
- **Naming:** Use PascalCase for types/interfaces, camelCase for variables

**Example:**
```typescript
interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const getUserProfile = async (userId: string): Promise<UserProfile> => {
  // Implementation
};
```

### React Components

- **Functional Components:** Use functional components with hooks
- **Component Naming:** PascalCase (e.g., `UserDashboard.tsx`)
- **Props Interface:** Define props interface above component
- **Hooks:** Use custom hooks for reusable logic

**Example:**
```typescript
interface UserDashboardProps {
  userId: string;
  onNavigate: (view: AppView) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ userId, onNavigate }) => {
  // Component implementation
};
```

### File Organization

- **One component per file** – Each component in its own file
- **Co-location** – Keep related files together (component + styles + tests)
- **Barrel exports** – Use `index.ts` for clean imports

**Example Structure:**
```
components/
  dashboard/
    UserDashboard.tsx
    UserDashboard.test.tsx
    index.ts
```

### Naming Conventions

- **Files:** PascalCase for components (`UserDashboard.tsx`), camelCase for utilities (`apiClient.ts`)
- **Components:** PascalCase (`UserDashboard`)
- **Functions:** camelCase (`getUserProfile`)
- **Constants:** UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Types/Interfaces:** PascalCase (`UserProfile`)

### Code Style

- **Indentation:** 2 spaces (no tabs)
- **Quotes:** Single quotes for strings (JavaScript), double quotes for JSX attributes
- **Semicolons:** Use semicolons
- **Trailing Commas:** Use in multi-line objects/arrays
- **Line Length:** Max 100 characters (soft limit)

**Example:**
```typescript
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3,
};

const Component = () => (
  <div className="container">
    <h1>Title</h1>
  </div>
);
```

## Project Structure

### Frontend Structure

```
components/          # Reusable React components
  ├── assessment/   # Assessment-related components
  ├── ai/          # AI-related components
  ├── dashboard/   # Dashboard components
  └── ...
views/              # Page-level views
services/           # Frontend services (API clients)
store/              # Zustand state management
hooks/              # Custom React hooks
contexts/           # React contexts
utils/              # Utility functions
types.ts           # TypeScript type definitions
```

### Backend Structure

```
server/
  ├── routes/       # API route handlers
  ├── services/    # Business logic services
  ├── middleware/  # Express middleware
  ├── ai/          # AI orchestration
  ├── migrations/  # Database migrations
  ├── cron/        # Scheduled jobs
  ├── config/      # Configuration files
  └── utils/       # Utility functions
```

### Import Organization

1. External dependencies (React, libraries)
2. Internal absolute imports (`@/components`, `@/services`)
3. Relative imports (`./Component`, `../utils`)
4. Type imports (`import type { User } from './types'`)

**Example:**
```typescript
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { LocalComponent } from './LocalComponent';
import type { UserProfile } from './types';
```

## Testing

### Test Structure

Tests are organized in the `tests/` directory:

```
tests/
  ├── unit/         # Unit tests
  ├── component/   # Component tests
  ├── integration/ # Integration tests
  └── e2e/         # End-to-end tests (Playwright)
```

### Running Tests

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit          # Unit tests
npm run test:component     # Component tests
npm run test:integration   # Integration tests
npm run test:e2e          # E2E tests (Playwright)
npm run test:backend      # Backend tests

# Run with coverage
npm run test:coverage
```

### Writing Tests

**Unit Tests (Vitest):**
```typescript
import { describe, it, expect } from 'vitest';
import { calculateROI } from './economics';

describe('calculateROI', () => {
  it('should calculate ROI correctly', () => {
    const result = calculateROI(1000, 500);
    expect(result).toBe(100);
  });
});
```

**Component Tests (React Testing Library):**
```typescript
import { render, screen } from '@testing-library/react';
import { UserDashboard } from './UserDashboard';

describe('UserDashboard', () => {
  it('renders user information', () => {
    render(<UserDashboard userId="123" />);
    expect(screen.getByText(/user/i)).toBeInTheDocument();
  });
});
```

**E2E Tests (Playwright):**
```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

### Test Best Practices

- **Test Behavior, Not Implementation** – Test what the code does, not how
- **Arrange-Act-Assert** – Structure tests clearly
- **Descriptive Names** – Test names should describe what is being tested
- **Isolation** – Tests should be independent and not rely on each other
- **Mock External Dependencies** – Mock API calls, database, etc.

## Debugging

### Frontend Debugging

**React DevTools:**
- Install React DevTools browser extension
- Inspect component hierarchy and props
- Monitor state changes

**Browser DevTools:**
- Use `console.log()` for debugging (remove before commit)
- Use breakpoints in browser DevTools
- Inspect network requests in Network tab

**Vite DevTools:**
- Hot Module Replacement (HMR) for instant updates
- Error overlay shows compilation errors

### Backend Debugging

**Console Logging:**
```javascript
const logger = require('./utils/logger');
logger.info('Processing request', { userId, organizationId });
logger.error('Error occurred', error);
```

**Debug Mode:**
```bash
# Enable debug logging
DEBUG=* npm run dev:backend

# Or specific module
DEBUG=server:routes:* npm run dev:backend
```

**Node.js Inspector:**
```bash
# Start with inspector
node --inspect server/index.js

# Or with breakpoint
node --inspect-brk server/index.js
```

### Database Debugging

**SQLite:**
```bash
# Open SQLite database
sqlite3 server/consultify.db

# Run queries
SELECT * FROM users LIMIT 10;
```

**PostgreSQL:**
```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Run queries
SELECT * FROM users LIMIT 10;
```

## Code Review Process

### Before Submitting

- [ ] Code follows project coding standards
- [ ] All tests pass (`npm run test:all`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] No console.log statements left
- [ ] Documentation updated if needed

### Review Checklist

**Functionality:**
- [ ] Code works as intended
- [ ] Edge cases handled
- [ ] Error handling implemented
- [ ] No security vulnerabilities

**Code Quality:**
- [ ] Code is readable and maintainable
- [ ] No code duplication
- [ ] Proper error handling
- [ ] Performance considerations

**Testing:**
- [ ] Tests cover new functionality
- [ ] Tests are meaningful and not just coverage
- [ ] Edge cases tested

**Documentation:**
- [ ] Code is self-documenting
- [ ] Complex logic has comments
- [ ] API changes documented

### Review Feedback

- **Be Constructive** – Provide actionable feedback
- **Be Respectful** – Code review is a learning opportunity
- **Explain Why** – Explain the reasoning behind suggestions
- **Approve When Ready** – Don't block on minor issues

## Development Tools

### Recommended VS Code Extensions

- **ESLint** – Code linting
- **Prettier** – Code formatting
- **TypeScript** – TypeScript support
- **React Snippets** – React code snippets
- **GitLens** – Git integration

### Useful Commands

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code (if Prettier configured)
npm run format

# Build for production
npm run build

# Preview production build
npm run preview
```

## Common Patterns

### API Calls

```typescript
import { Api } from '@/services/api';

const fetchUser = async (userId: string) => {
  try {
    const user = await Api.get(`/users/${userId}`);
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
};
```

### State Management (Zustand)

```typescript
import { create } from 'zustand';

interface UserStore {
  user: User | null;
  setUser: (user: User) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

### Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof ApiError) {
    // Handle API error
    toast.error(error.message);
  } else {
    // Handle unexpected error
    logger.error('Unexpected error:', error);
    toast.error('An unexpected error occurred');
  }
}
```

## Next Steps

- **[Architecture Guide](02-architecture.md)** – Understand system architecture
- **[API Reference](API_REFERENCE.md)** – API documentation
- **[Getting Started](01-getting-started.md)** – Setup instructions

---

*For questions or clarifications, please open an issue or contact the development team.*




