# Development Guide - Consultinity

## Quick Start

### Prerequisites

- Node.js 20.x
- npm 10.x
- SQLite3 (for local development)
- Redis (optional, for caching)

### Initial Setup

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd consultinity
   npm ci
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   # Edit .env with your local settings
   ```

3. **Database Setup**

   ```bash
   cd server
   npm run db:migrate
   npm run db:seed
   ```

4. **Start Development Servers**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Environment Variables

See [`.env.example`](.env.example) for all available variables.

### Critical Variables

- `DATABASE_URL` - SQLite database path
- `JWT_SECRET` - Session encryption key
- `NODE_ENV` - Environment (development/production)

### Optional Variables

- `REDIS_URL` - Redis connection for caching
- `SENTRY_DSN` - Error tracking
- `OPENAI_API_KEY` - AI features

For CI/CD secrets, see [`GITHUB_SECRETS_SETUP.md`](.gemini/antigravity/brain/<conversation-id>/GITHUB_SECRETS_SETUP.md)

## Development Workflow

### Running Tests

```bash
# All tests
npm test

# By level (5-Level Coverage Strategy)
npm run test:unit           # Level 1: Unit tests
npm run test:component      # Level 2: Component tests
npm run test:integration    # Level 3: Integration tests
npm run test:e2e           # Level 4: E2E tests
npm run test:performance   # Level 5: Performance tests

# With coverage
npm run test:coverage
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npx prettier --write .
```

### Building

```bash
# Frontend only
npm run build

# Backend only
npm run build:backend

# Full production build
npm run build && npm run build:backend
```

## Project Structure

```
consultinity/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── views/             # Page-level components
│   ├── hooks/             # Custom React hooks
│   └── store/             # Zustand state management
├── server/                # Backend Node.js application
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Utilities
│   └── tests/             # Backend tests
├── tests/                 # Frontend tests
│   ├── unit/              # Unit tests
│   ├── components/        # Component tests
│   ├── integration/       # Integration tests
│   └── e2e/              # End-to-end tests
├── config/                # Configuration files
├── docs/                  # Documentation
└── scripts/               # Build and utility scripts
```

## Common Tasks

### Adding a New Feature

1. Create feature branch: `git checkout -b feature/your-feature`
2. Implement feature with tests
3. Run quality checks: `npm run type-check && npm run lint && npm test`
4. Commit with conventional commits: `git commit -m "feat: add new feature"`
5. Push and create PR

### Debugging

**Frontend:**

- React DevTools browser extension
- Console logs in browser DevTools
- Zustand DevTools for state inspection

**Backend:**

- VSCode debugger (launch.json configured)
- Console logs in terminal
- SQLite browser for database inspection

### Database Migrations

```bash
cd server
npm run db:migrate        # Run migrations
npm run db:rollback       # Rollback last migration
npm run db:seed          # Seed test data
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000 or 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Database Locked

```bash
# Remove lock files
rm consultinity.db-wal consultinity.db-shm
```

### Module Not Found

```bash
# Clean install
rm -rf node_modules package-lock.json
npm ci
```

### Husky Pre-commit Failing

The pre-commit hook runs `lint-staged` which formats and lints your code.
If it fails:

1. Check the error message
2. Fix linting errors: `npm run lint -- --fix`
3. Retry commit

### TypeScript Errors

```bash
# Full type check
npm run type-check

# Check specific file
npx tsc --noEmit path/to/file.ts
```

## Performance Tips

- Use React DevTools Profiler to identify slow components
- Enable Redis for caching in development
- Use `npm run test:performance` to catch regressions
- Monitor bundle size with `npm run build -- --stats`

## Additional Resources

- [Architecture Documentation](docs/architecture/)
- [API Documentation](docs/api/)
- [Testing Strategy](docs/testing/)
- [Deployment Guide](docs/deployment/)

## Getting Help

- Check existing issues on GitHub
- Review documentation in `docs/`
- Ask in team Slack channel
- Contact: CTO for technical decisions

---

**Last Updated:** 2026-01-06
**Maintained by:** Engineering Team
