# Development Workflow & Quality Gates

This document describes the development workflow, pre-commit hooks, and quality gates implemented in Consultinity.

## 🔒 Pre-Commit Hooks

### Secret Scanning

**Status:** ✅ Active

Before every commit, staged files are automatically scanned for potential secrets using `scripts/check-secrets.js`.

**What it checks:**

- API keys (various formats)
- Passwords and tokens
- AWS credentials
- Private keys
- JWT secrets

**How to bypass (if false positive):**

1. Add file pattern to `ALLOWED_FILES` in `scripts/check-secrets.js`
2. Or use `--no-verify` flag (not recommended)

### Code Formatting

**Status:** ✅ Active

Automatically formats code using:

- **ESLint** - Code quality and style
- **Prettier** - Code formatting

**Configuration:**

- `.prettierrc` - Prettier settings (2 spaces, 100 char width)
- `.editorconfig` - Editor settings (consistent across IDEs)

### Lint-Staged

**Status:** ✅ Active

Only staged files are linted/formatted, making commits fast.

**Configuration:** `.lintstagedrc.json`

## 📝 Commit Message Validation

### Commitlint

**Status:** ✅ Active

Enforces conventional commit message format using `@commitlint/config-conventional`.

**Format:** `type(scope): subject`

**Allowed types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style (formatting)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test changes
- `chore` - Maintenance tasks
- `security` - Security fixes
- `build` - Build system changes
- `ci` - CI/CD changes

**Examples:**

```bash
feat(auth): add JWT token rotation
fix(security): prevent IDOR in user endpoints
docs: update API documentation
refactor(api): simplify error handling middleware
```

**Configuration:** `commitlint.config.js`

### Commit Message Template

**Status:** ✅ Available

Use `.gitmessage` template for consistent commit messages:

```bash
# Set as default template
git config commit.template .gitmessage

# Or use globally
git config --global commit.template .gitmessage
```

## 🚀 Pre-Push Hooks

### Validation Pipeline

**Status:** ✅ Active

Before pushing to remote, the following checks run:

1. **Linting** - `npm run lint`
2. **Type Checking** - `npm run type-check`
3. **Unit Tests** - `npm run test:unit`

**Configuration:** `.husky/pre-push`

**To skip (not recommended):**

```bash
git push --no-verify
```

## 🛠️ Development Scripts

### Quick Validation

```bash
npm run dev:check      # Lint + type-check only
npm run dev:test       # Run unit tests in watch mode
npm run dev:full       # dev:check + dev:test
```

### Full Validation

```bash
npm run verify         # Full validation (lint + type-check + tests + security)
npm run verify:quick   # Quick validation (lint + type-check + unit tests)
npm run validate       # Same as verify
```

### Security Checks

```bash
npm run security:local    # npm audit (high severity)
npm run security:check    # security:local + security tests
npm run test:security     # Security-specific tests
```

### Dependency Management

```bash
npm run deps:check       # Check for vulnerabilities (moderate+)
npm run deps:update      # Auto-fix vulnerabilities
npm run deps:security    # Snyk test + monitor (if configured)
npm run license:check    # Check license compliance
```

## 🔍 Code Quality Tools

### EditorConfig

**Status:** ✅ Configured

Ensures consistent coding styles across different editors and IDEs.

**Configuration:** `.editorconfig`

### Prettier

**Status:** ✅ Configured

**Settings:**

- 2 spaces indentation
- 100 character line width
- Single quotes
- Trailing commas (ES5)
- Semicolons enabled

**Configuration:** `.prettierrc`

### ESLint

**Status:** ✅ Configured

Uses TypeScript ESLint with React plugins.

**Configuration:** `eslint.config.js`

## 🔐 Environment Validation

### Startup Validation

**Status:** ✅ Active

Environment variables are validated on application startup.

**Configuration:** `server/src/config/envValidator.ts`

**Required variables:**

- `JWT_SECRET` (min 32 chars, 64 recommended for production)
- `NODE_ENV` (development|production|test|staging)
- `DATABASE_URL` or `DB_TYPE`

**Validation includes:**

- Required variables check
- Format validation (URLs, ports, etc.)
- Security warnings (weak secrets in production)
- AI provider availability check

**To skip (for tests):**

```bash
SKIP_ENV_VALIDATION=true npm run dev
```

## 📋 CODEOWNERS

**Status:** ✅ Configured

Automatic reviewer assignment based on file paths.

**Configuration:** `.github/CODEOWNERS`

**Teams:**

- `@security-team` - Security-critical files
- `@backend-team` - Backend code
- `@backend-lead` - Database migrations
- `@admin-team` - Admin components
- `@superadmin-team` - SuperAdmin components
- `@devops-team` - Infrastructure
- `@qa-team` - Test infrastructure
- `@tech-lead` - Configuration files

## 🧪 Testing Workflow

### Test Types

```bash
npm run test:unit         # Unit tests
npm run test:component     # Component tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests (Playwright)
npm run test:security     # Security tests
npm run test:all          # Unit + component + integration
```

### Coverage

```bash
npm run test:coverage           # Generate coverage report
npm run test:coverage:check     # Check coverage thresholds
npm run test:coverage:html      # HTML coverage report
```

## 📚 Best Practices

### Before Committing

1. ✅ Run `npm run dev:check` to catch lint/type errors
2. ✅ Write tests for new features
3. ✅ Follow conventional commit format
4. ✅ Ensure no secrets in code

### Before Pushing

1. ✅ All tests pass (`npm run test:unit`)
2. ✅ No lint errors (`npm run lint`)
3. ✅ No type errors (`npm run type-check`)
4. ✅ Consider running `npm run verify` for full check

### Before Creating PR

1. ✅ Run `npm run verify` for complete validation
2. ✅ Check security (`npm run security:check`)
3. ✅ Update documentation if needed
4. ✅ Ensure CODEOWNERS will assign correct reviewers

## 🚨 Troubleshooting

### Pre-commit hook fails

```bash
# Check what's failing
git commit -m "test"

# If secret scanning false positive, update scripts/check-secrets.js
# If formatting issue, run: npm run lint -- --fix
```

### Pre-push hook too slow

```bash
# Skip for urgent fixes (not recommended)
git push --no-verify

# Or run tests locally first
npm run test:unit
```

### Commit message rejected

```bash
# Use conventional format
git commit -m "feat(scope): description"

# Or use template
git commit  # Opens editor with .gitmessage template
```

### Environment validation fails

```bash
# Check missing variables
node -e "require('./server/src/config/envValidator.ts').validateEnv()"

# Skip for tests
SKIP_ENV_VALIDATION=true npm run test
```

## 📖 Related Documentation

- [Quality and Security Standards](../QUALITY_AND_SECURITY_STANDARD.md)
- [Security Runbooks](../SECURITY_RUNBOOKS.md)
- [GitHub Setup Checklist](../GITHUB_SETUP_CHECKLIST.md)
- [Branch Protection Setup](../BRANCH_PROTECTION_SETUP.md)
