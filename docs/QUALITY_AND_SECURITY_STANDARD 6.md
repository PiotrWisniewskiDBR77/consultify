# Quality and Security Standard - Consultinity

**Version:** 1.0.0  
**Status:** MANDATORY ENFORCEMENT  
**Last Updated:** 2026-01-07

---

## ⚠️ CRITICAL: This Document is the Source of Truth

**This document defines the REQUIRED standard, not the current state.**

Code MUST align with this standard. Non-compliance blocks deployment.

---

## 1️⃣ Purpose & Scope

### Application Context

Consultinity is a **B2B, multi-tenant SaaS platform** providing:
- AI-powered digital transformation consulting
- Enterprise project management (PMO)
- Multi-organization data isolation
- Role-based access control (RBAC/ABAC)

### Core Principle

**Security and quality are architectural elements, not optional features.**

Every code change MUST pass through the quality control system. There are no exceptions.

### Scope

This standard applies to:
- All code in `server/` and `src/`
- All API endpoints
- All database operations
- All third-party integrations
- All deployment processes

---

## 2️⃣ Testing Strategy (MANDATORY)

### Principle

**Code without tests is considered incomplete.**

A Pull Request without corresponding tests is automatically rejected.

### Required Test Levels

#### A. Unit Tests (REQUIRED)

**Scope:**
- Domain logic (pricing, permissions, workflow rules)
- Input validation and data transformations
- Error paths (not just happy path)
- Business rule enforcement

**Location:** `tests/unit/`

**Coverage Threshold:** 85% statements, 80% branches

**Critical Files:** 95% coverage required for:
- `server/src/services/accessPolicyService.ts`
- `server/src/middleware/permission.middleware.ts`
- `server/src/services/permissionService.ts`

**KPI:** Meaningful coverage, not cosmetic. Every business rule must have a test.

---

#### B. Contract / Schema Tests (REQUIRED)

**Scope:**
- API response format validation (OpenAPI/JSON Schema)
- Type checking (required fields, data types, error codes)
- Date/ID format validation
- Pagination contract compliance

**Location:** `tests/contracts/`

**Tool:** Pact or custom schema validators

**Enforcement:**
- Breaking changes MUST be versioned
- Contract tests MUST run on every PR
- Contract violations block merge

**KPI:** Zero breaking changes without versioning.

---

#### C. Integration Tests (REQUIRED)

**Scope:**
- API + Database + Cache + Queue + External services
- Transactional integrity (rollback on failure)
- Idempotency (retry safety)
- Timeout handling
- Circuit breaker behavior

**Location:** `tests/integration/`

**Critical Paths:**
- Authentication flow
- Multi-tenant data isolation
- Payment processing
- AI API calls
- File uploads/downloads

**KPI:** All critical business paths covered end-to-end.

---

#### D. E2E / UI Tests (REQUIRED)

**Scope:**
- Top 10-20 critical user flows:
  1. User registration and onboarding
  2. Login and authentication
  3. Organization creation
  4. Project creation and management
  5. AI chat interaction
  6. Assessment workflow
  7. Billing and subscription
  8. Admin panel access
  9. SuperAdmin operations
  10. Data export

**Location:** `tests/e2e/`

**Tool:** Playwright

**Principle:** Tests verify processes, not pixels. UI tests must be stable and maintainable.

**KPI:** Critical flows must pass before production deployment.

---

#### E. Security Tests (REQUIRED)

**Location:** `tests/security/`

**Security tests are part of the definition of done.**

See Section 5 for detailed security testing matrix.

---

## 3️⃣ Security-First Principles (ENFORCED)

### Rule 1: Multi-Tenant Isolation is Mandatory

**Enforcement:**
- Every database query MUST include `organization_id` filter
- API endpoints MUST verify tenant context from authenticated user
- Cross-tenant data access MUST return 403/404 (no metadata leakage)
- Tests MUST verify isolation for every endpoint

**Implementation:**
- Middleware enforces tenant context
- Database layer validates organization_id
- Audit logs track all cross-tenant access attempts

---

### Rule 2: Deny-by-Default Authorization

**Enforcement:**
- New endpoints default to DENY
- Explicit permission grants required
- No implicit access based on role alone
- Permission matrix MUST be documented

**Implementation:**
- `permission.middleware.ts` enforces RBAC
- Permission matrix generated automatically
- Tests verify deny-by-default behavior

---

### Rule 3: RBAC / ABAC Enforced by Middleware

**Enforcement:**
- Every protected endpoint uses `requirePermission()` middleware
- Role checks happen at middleware level, not in controllers
- Permission changes require code review + security review

**Implementation:**
- `server/src/middleware/permission.middleware.ts`
- `server/src/services/permissionService.ts`
- Permission matrix: `docs/RBAC_MATRIX.md`

---

### Rule 4: No Secrets in Code, Ever

**Enforcement:**
- All secrets in environment variables or secret management
- GitLeaks scan blocks PR if secrets detected
- API keys, passwords, tokens NEVER committed
- Secret rotation documented in runbooks

**Implementation:**
- Pre-commit hooks scan for secrets
- CI/CD secret scanning (GitLeaks)
- `.env.example` shows required variables (no values)

---

### Rule 5: No Endpoint Without Permission Tests

**Enforcement:**
- Every new endpoint MUST have:
  - Permission test (positive case)
  - Permission denial test (negative case)
  - Multi-tenant isolation test
- PR without tests is rejected

**Implementation:**
- Test template: `tests/templates/endpoint-security.test.template`
- CI enforces test coverage for new routes

---

### Rule 6: No Deploy Without Passing Security Gate

**Enforcement:**
- Security gate MUST pass before merge
- High/Critical vulnerabilities block deployment
- Security tests MUST pass
- SAST/DAST scans MUST pass

**Implementation:**
- CI/CD security gate (see Section 4)

---

## 4️⃣ CI/CD Quality & Security Gate (CRITICAL)

### ⚠️ CRITICAL: CI/CD MUST BE ENABLED

**Current Status:** Workflows are in `.github/workflows.disabled/` - **THIS IS NON-COMPLIANT**

**Required Action:** All workflows MUST be active in `.github/workflows/`

---

### Pull Request Merge Requirements

A Pull Request **CANNOT** be merged if:

1. ❌ Tests failed (unit, integration, E2E, security)
2. ❌ Security scan detected High/Critical vulnerabilities
3. ❌ Coverage dropped below thresholds
4. ❌ Lint/Typecheck errors
5. ❌ Contract tests failed
6. ❌ Secret scanning detected credentials

---

### Required CI/CD Components

#### On Every PR (Mandatory):

1. **Lint + Typecheck**
   - ESLint validation
   - TypeScript type checking
   - Prettier formatting check

2. **Unit + Integration Tests**
   - Fast subset (< 5 minutes)
   - Critical path tests
   - Coverage check

3. **Contract Tests**
   - API schema validation
   - Breaking change detection

4. **SAST (Static Application Security Testing)**
   - CodeQL analysis
   - SonarCloud security hotspots
   - Custom security rules

5. **Dependency Scanning**
   - `npm audit` (High/Critical)
   - Snyk scan
   - OWASP Dependency Check
   - SBOM generation

6. **Secret Scanning**
   - GitLeaks scan
   - Blocks merge if secrets detected

7. **Security Test Subset**
   - Multi-tenant isolation tests
   - Permission matrix tests
   - Auth hardening tests

---

#### Nightly / Pre-Release (Full Suite):

1. **Full Integration Suite**
   - All integration tests
   - Database transaction tests
   - External service integration

2. **DAST (Dynamic Application Security Testing)**
   - OWASP ZAP scan
   - API fuzzing
   - Vulnerability scanning

3. **Fuzzing**
   - Input fuzzing for critical endpoints
   - Property-based testing

4. **Performance Smoke Tests**
   - Verify no 10x performance degradation
   - Load test critical endpoints

---

#### Release to Production:

1. **Staging Deployment**
   - Deploy to staging first
   - Production-like test data
   - Full E2E suite

2. **Automated Smoke Tests**
   - Post-deployment verification
   - Critical path validation

3. **Canary / Feature Flags**
   - Gradual rollout for risky changes
   - Kill switch ready

---

### Branch Protection Rules (REQUIRED)

**GitHub Branch Protection MUST enforce:**

- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Disallow force pushes
- ✅ Disallow deletions
- ✅ No admin bypass (except emergency with post-mortem)

**Required Status Checks:**
- `test:unit`
- `test:integration`
- `test:security`
- `lint`
- `typecheck`
- `security-scan`
- `coverage-check`

**⚠️ CONFIGURATION NOTE:** Branch protection must be configured manually in GitHub repository settings. See `docs/BRANCH_PROTECTION_SETUP.md` for detailed step-by-step instructions. This is a one-time setup that requires repository admin access.

---

## 5️⃣ Security Testing Matrix (MANDATORY)

### Security tests are part of the definition of done.

Every security test MUST:
- Be automated
- Run in CI/CD
- Fail build on security violation
- Have clear pass/fail criteria

---

### A. Multi-Tenant Isolation Tests (REQUIRED)

**Location:** `tests/security/multi-tenant-isolation.test.js`

**Required Scenarios:**
- ✅ Tenant A cannot access Tenant B data
- ✅ Cross-tenant IDOR attempts return 403/404
- ✅ SQL injection in tenant queries fails safely
- ✅ Metadata leakage prevention (no hints about existence)
- ✅ AI multi-tenant isolation (prompt/context isolation)

**Every endpoint MUST have tenant isolation test.**

---

### B. IDOR (Insecure Direct Object Reference) Tests (REQUIRED)

**Location:** `tests/security/idor.test.js`

**Required Scenarios:**
- ✅ Random ID access returns 403/404
- ✅ Enumeration attacks fail (no timing differences)
- ✅ UUID validation prevents injection
- ✅ Resource ownership verification

---

### C. RBAC Matrix Tests (REQUIRED)

**Location:** `tests/security/rbac-security.test.js`

**Required:**
- ✅ Automatic matrix generation: `role × action × resource × tenant`
- ✅ Deny-by-default verification
- ✅ Permission escalation prevention
- ✅ Cross-organization permission tests

**Tool:** Auto-generate matrix from code (TO BE IMPLEMENTED)

---

### D. Auth Hardening Tests (REQUIRED)

**Location:** `tests/auth/`, `tests/security/`

**Required Scenarios:**
- ✅ Session expiration and invalidation
- ✅ JWT token rotation
- ✅ Refresh token rotation on use
- ✅ Token revocation on logout
- ✅ Replay attack prevention
- ✅ Brute force protection (rate limiting)
- ✅ CSRF protection
- ✅ CORS policy enforcement

---

### E. Input Abuse Tests (REQUIRED)

**Location:** `tests/security/input-sanitization.test.js`

**Required Scenarios:**
- ✅ SQL injection prevention
- ✅ XSS prevention
- ✅ Command injection prevention
- ✅ SSRF prevention
- ✅ Fuzzing: long strings, nested JSON, nulls, arrays
- ✅ AI prompt injection prevention

**KPI:** No unvalidated data reaches critical sinks (DB, shell, fetch, templates).

---

### F. API Security Tests (REQUIRED)

**Location:** `tests/security/`

**Required:**
- ✅ Rate limiting enforcement
- ✅ Request size limits
- ✅ Timeout handling
- ✅ Error message sanitization (no stack traces in production)

---

## 6️⃣ Environments & Data

### Staging Environment

**Requirement:** Staging MUST be 1:1 with production:
- Same IAM configuration
- Same CORS policies
- Same cookie/header settings
- Same security headers
- Same database schema

**Non-compliance:** Staging that differs from production is considered non-compliant.

---

### Test Data Management

**Required Test Tenants:**
- Tenant A: `test-org-a` (Admin, Manager, Viewer roles)
- Tenant B: `test-org-b` (Admin, Manager, Viewer roles)
- Tenant C: `test-org-c` (SuperAdmin access)

**Required Test Users:**
- `admin@test-org-a.com` (Admin role)
- `manager@test-org-a.com` (Manager role)
- `viewer@test-org-a.com` (Viewer role)
- `superadmin@test.com` (SuperAdmin role)

**Toxic Test Data:**
- SQL injection strings: `' OR '1'='1`
- XSS payloads: `<script>alert('XSS')</script>`
- Large payloads: 10MB+ JSON
- Unicode edge cases: emoji, null bytes, control characters
- Nested structures: 100+ levels deep

**Data Masking:**
- Production data copied to staging MUST be masked
- PII fields MUST be anonymized
- Encryption keys MUST be rotated

---

## 7️⃣ Operational Security & Monitoring

### Audit Logs (MANDATORY)

**Requirement:** All security-relevant actions MUST be logged:
- Authentication attempts (success/failure)
- Permission denials
- Cross-tenant access attempts
- Admin actions
- Data exports
- API key usage

**Location:** `server/src/services/AuditLogService.ts`

**Retention:** 90 days minimum

**Access:** Audit logs accessible only to SuperAdmin role

---

### Alerting (MANDATORY)

**Required Alerts:**
- Auth failures spike (> 10/min)
- 403/401 spike (> 5% of requests)
- Admin endpoint access spike
- Unusual data access patterns
- Failed security test in CI

**Implementation:** Monitoring dashboard + Slack/email alerts

---

### Incident Playbooks (MANDATORY)

**Location:** `docs/SECURITY_RUNBOOKS.md`, `docs/INCIDENT_RESPONSE_PLAYBOOK.md`

**Required Playbooks:**
- Token leak response
- Tenant leak suspicion
- Dependency critical CVE
- Account compromise
- Data breach

**Every playbook MUST be tested quarterly.**

---

### Kill Switch / Feature Flags (REQUIRED)

**Requirement:** Critical features MUST have kill switches:
- AI API calls
- Payment processing
- External integrations
- Data exports

**Implementation:** Feature flags in `src/contexts/FeatureFlagsContext.tsx`

**Access:** SuperAdmin only, instant activation

---

## 8️⃣ Metrics & Governance

### Required Metrics (MANDATORY TRACKING)

#### 1. Change Failure Rate
- **Definition:** % of deployments causing rollback/hotfix
- **Target:** < 5%
- **Tracking:** GitHub Actions + deployment logs

#### 2. MTTR (Mean Time To Recovery)
- **Definition:** Average time to fix production incident
- **Target:** < 1 hour (P0), < 4 hours (P1)
- **Tracking:** Incident response logs

#### 3. Security Gate Pass Rate
- **Definition:** % of PRs passing security gate on first try
- **Target:** > 95%
- **Tracking:** CI/CD logs

#### 4. Permission Coverage
- **Definition:** % of endpoints with permission tests
- **Target:** 100%
- **Tracking:** Test coverage reports

#### 5. Vulnerability SLA
- **Definition:** Time to patch High/Critical CVEs
- **Target:** < 24 hours (Critical), < 7 days (High)
- **Tracking:** Security scan reports

#### 6. Test Coverage
- **Definition:** Code coverage percentage
- **Target:** 85% statements, 80% branches
- **Tracking:** Coverage reports (Vitest + SonarCloud)

---

### Metrics Dashboard (REQUIRED)

**Location:** SuperAdmin dashboard or separate monitoring tool

**Required Views:**
- Security metrics (gate pass rate, vuln SLA)
- Quality metrics (coverage, change failure rate)
- Operational metrics (MTTR, incident count)

**Update Frequency:** Real-time or hourly

---

## 9️⃣ Enforcement Rules

### Non-Compliance Consequences

#### PR Without Tests → **REJECTED**
- Automated check blocks merge
- Comment added: "This PR lacks required tests. See docs/QUALITY_AND_SECURITY_STANDARD.md"

#### Bypass CI → **FORBIDDEN**
- Force push to protected branches blocked
- Admin bypass requires:
  - Post-mortem document
  - Security review
  - Approval from Tech Lead + Security Lead

#### Emergency Deploy → **REQUIRES POST-MORTEM**
- Emergency deploys allowed only for:
  - P0 security incidents
  - Production outages
- Post-mortem MUST be completed within 24 hours
- Post-mortem MUST include:
  - Why CI was bypassed
  - What went wrong
  - How to prevent in future

#### Security Gate Failure → **BLOCKED**
- High/Critical vulnerabilities block merge
- Security test failures block merge
- No exceptions without Security Lead approval

---

### Compliance Verification

**Quarterly Audit:**
- Review all PRs for test coverage
- Verify CI/CD enforcement
- Check security gate pass rate
- Review incident response times

**Annual Review:**
- Update this standard based on lessons learned
- Review and update playbooks
- Security penetration testing
- Compliance certification (if applicable)

---

## 🔟 Implementation Checklist

### Immediate Actions (Week 1)

- [x] **Document Standard Created**
  - `docs/QUALITY_AND_SECURITY_STANDARD.md` created

- [x] **Prepare CI/CD workflows**
  - ✅ Workflows ready in `.github/workflows.disabled/`
  - ✅ Prepared: `quality-gate.yml`, `security.yml`, `contract-test.yml`, `performance.yml`
  - ⚠️ **Currently DISABLED** - Will not run automatically until activated
  - See `docs/WORKFLOWS_ACTIVATION_GUIDE.md` for activation instructions

- [ ] **Configure Branch Protection** ⚠️ **MANUAL ACTION REQUIRED**
  - See `docs/BRANCH_PROTECTION_SETUP.md` for instructions
  - Requires GitHub repository admin access
  - One-time configuration in GitHub Settings → Branches

- [x] **Add Missing Security Tests**
  - ✅ Replay attack tests (`tests/security/replay-attack.test.js`)
  - ✅ SSRF tests (`tests/security/ssrf-prevention.test.js`)
  - ✅ IDOR comprehensive tests (`tests/security/idor.test.js`)

### Short-Term (Month 1)

- [ ] **RBAC Matrix Generator**
  - Auto-generate permission matrix from code
  - Verify coverage

- [ ] **Transaction & Idempotency Tests**
  - Add to integration tests
  - Verify rollback behavior

- [ ] **DAST Integration**
  - OWASP ZAP in nightly runs
  - API fuzzing setup

### Medium-Term (Quarter 1)

- [ ] **Metrics Dashboard**
  - Implement tracking
  - Create dashboard views

- [ ] **Staging 1:1 Verification**
  - Audit staging configuration
  - Align with production

- [ ] **Playbook Testing**
  - Run incident drills
  - Update playbooks

---

## 📚 Related Documentation

- **Architecture:** `docs/ARCHITECTURE.md`
- **Testing Strategy:** `docs/TESTING.md`, `docs/TESTING_STRATEGY_5_LEVELS.md`
- **Security Runbooks:** `docs/SECURITY_RUNBOOKS.md`
- **Incident Response:** `docs/INCIDENT_RESPONSE_PLAYBOOK.md`
- **CI/CD Pipeline:** `docs/CI_CD_PIPELINE.md`

---

## 📝 Document Maintenance

**Owner:** Tech Lead + Security Lead  
**Review Frequency:** Quarterly  
**Update Trigger:** Major architecture changes, security incidents, compliance requirements

**Version History:**
- `1.0.0` (2026-01-07): Initial standard definition

---

**END OF STANDARD**

---

*This document is the source of truth. Code MUST comply. Non-compliance blocks deployment.*

