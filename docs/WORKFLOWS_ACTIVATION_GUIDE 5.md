# Workflows Activation Guide

**Status:** ⚠️ **Workflows are DISABLED** - Ready for activation when needed  
**Last Updated:** 2026-01-07

---

## Overview

All CI/CD workflows are prepared and ready, but currently **disabled** to prevent automatic execution.

**Location:** `.github/workflows.disabled/`

**When to activate:** After GitHub branch protection is configured and team is ready.

---

## Available Workflows

### 1. Quality Gate (`quality-gate.yml`)

**Purpose:** Blocks PRs that don't meet quality standards

**Triggers:**
- Pull requests to `main` and `develop`
- Runs: Lint, typecheck, tests, coverage check

**Activation:** Move to `.github/workflows/` when ready

---

### 2. Security Scan (`security.yml`)

**Purpose:** Comprehensive security auditing

**Triggers:**
- Push to `main` and `develop`
- Pull requests
- Scheduled (weekly)
- Manual (workflow_dispatch)

**Scans:**
- NPM audit
- Snyk scan
- OWASP Dependency Check
- Trivy filesystem scan
- GitLeaks secret scan
- CodeQL analysis

**Activation:** Move to `.github/workflows/` when ready

---

### 3. Contract Tests (`contract-test.yml`)

**Purpose:** API contract validation

**Triggers:**
- Pull requests to `main` and `develop`
- Push to `main`

**Tests:**
- Consumer contract tests
- Provider verification
- Pact broker publishing

**Activation:** Move to `.github/workflows/` when ready

---

### 4. Performance Tests (`performance.yml`)

**Purpose:** Performance benchmarking

**Triggers:**
- Pull requests to `main`
- Scheduled (weekly)
- Manual (workflow_dispatch)

**Tests:**
- API benchmarks
- Frontend performance (Lighthouse)
- Resource profiling
- Database query performance

**Activation:** Move to `.github/workflows/` when ready

---

## Activation Steps

### Step 1: Verify Prerequisites

Before activating workflows, ensure:

- [ ] GitHub branch protection configured (see `docs/GITHUB_SETUP_CHECKLIST.md`)
- [ ] Required secrets configured in GitHub Settings → Secrets
- [ ] Team is ready for automated CI/CD enforcement
- [ ] Test environment is ready

---

### Step 2: Activate Workflows

**Option A: Activate All at Once**

```bash
# From repository root
cd .github
mv workflows.disabled/quality-gate.yml workflows/
mv workflows.disabled/security.yml workflows/security.yml
mv workflows.disabled/contract-test.yml workflows/
mv workflows.disabled/performance.yml workflows/
```

**Option B: Activate Gradually**

1. Start with `quality-gate.yml` (safest)
2. Add `security.yml` after quality gate is stable
3. Add `contract-test.yml` when contracts are ready
4. Add `performance.yml` last (optional)

---

### Step 3: Verify Activation

After moving workflows:

1. Create a test PR
2. Verify workflows appear in GitHub Actions tab
3. Verify workflows run automatically
4. Check that status checks appear in PR

---

### Step 4: Monitor First Runs

- Watch for any errors
- Verify all required secrets are configured
- Check that status checks appear correctly
- Ensure workflows complete successfully

---

## Deactivation (If Needed)

If workflows need to be disabled again:

```bash
# Move workflows back to disabled folder
cd .github
mv workflows/*.yml workflows.disabled/
```

**Note:** This will stop all automatic CI/CD checks.

---

## Current Status

**Workflows:** ⚠️ **DISABLED** (in `.github/workflows.disabled/`)  
**Ready for activation:** ✅ YES  
**All files prepared:** ✅ YES  
**Documentation complete:** ✅ YES

---

## Related Documentation

- **GitHub Setup:** `docs/GITHUB_SETUP_CHECKLIST.md`
- **Branch Protection:** `docs/BRANCH_PROTECTION_SETUP.md`
- **Quality Standard:** `docs/QUALITY_AND_SECURITY_STANDARD.md`

---

**END OF GUIDE**

---

*Workflows are ready but disabled. Activate when team is ready for automated CI/CD enforcement.*



