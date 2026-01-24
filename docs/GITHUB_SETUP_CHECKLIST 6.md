# GitHub Setup Checklist

**Status:** ⚠️ **MANUAL ACTION REQUIRED**  
**Priority:** HIGH  
**Estimated Time:** 15-20 minutes

---

## Overview

This checklist covers the **one-time manual configuration** required in GitHub to fully enforce the Quality and Security Standard.

**Note:** All code changes, workflows, and tests are already in place. This checklist is for GitHub repository settings only.

---

## ✅ Prerequisites (Already Completed)

- [x] CI/CD workflows prepared (`.github/workflows.disabled/`) - **Ready but disabled**
- [x] Security tests added
- [x] Integration tests added
- [x] Documentation created

**Note:** Workflows are currently disabled to prevent automatic execution. Activate after GitHub configuration is complete (see `docs/WORKFLOWS_ACTIVATION_GUIDE.md`).

---

## 📋 GitHub Configuration Checklist

### 1. Branch Protection Rules

**Location:** Repository → Settings → Branches → Add rule

**For branch:** `main`

- [ ] **Require a pull request before merging**
  - [ ] Required approvals: 1
  - [ ] Dismiss stale reviews: ✅ Enabled
  - [ ] Require review from Code Owners: ✅ Enabled (if CODEOWNERS exists)

- [ ] **Require status checks to pass before merging**
  - [ ] Add status checks:
    - [ ] `test:unit`
    - [ ] `test:integration`
    - [ ] `test:security`
    - [ ] `lint`
    - [ ] `typecheck`
    - [ ] `security-scan`
    - [ ] `coverage-check`
  - [ ] Require branches to be up to date: ✅ Enabled
  - [ ] Do not allow bypassing: ✅ Enabled

- [ ] **Require conversation resolution before merging**: ✅ Enabled

- [ ] **Include administrators**: ❌ **DISABLED** (critical!)

- [ ] **Restrict pushes that create files > 100 MB**: ✅ Enabled

**Repeat for branch:** `develop` (same settings)

**Detailed instructions:** See `docs/BRANCH_PROTECTION_SETUP.md`

---

### 2. Repository Settings

**Location:** Repository → Settings → General

- [ ] **Allow force pushes**: ❌ Disabled (if available)
- [ ] **Allow deletions**: ❌ Disabled (if available)
- [ ] **GitHub Actions**: ✅ Enabled

---

### 3. GitHub Actions Secrets

**Location:** Repository → Settings → Secrets and variables → Actions

**Required Secrets (add if missing):**

- [ ] `SONAR_TOKEN` - For SonarCloud analysis (optional but recommended)
- [ ] `SNYK_TOKEN` - For Snyk security scanning (optional but recommended)
- [ ] `PACT_BROKER_URL` - For contract testing (if using Pact)
- [ ] `PACT_BROKER_USERNAME` - For contract testing (if using Pact)
- [ ] `PACT_BROKER_PASSWORD` - For contract testing (if using Pact)
- [ ] `GITLEAKS_LICENSE` - For secret scanning (if using GitLeaks)

**Note:** Workflows will run without these secrets, but some features may be disabled.

---

### 4. Activate Workflows (After GitHub Config)

**Before verification, activate workflows:**

- [ ] Move workflows from `.github/workflows.disabled/` to `.github/workflows/`
- [ ] See `docs/WORKFLOWS_ACTIVATION_GUIDE.md` for detailed steps

**Then verify:**

- [ ] Create a test PR to `main`
- [ ] Verify workflows run automatically
- [ ] Verify status checks appear in PR
- [ ] Verify merge is blocked until checks pass
- [ ] Verify force push is blocked
- [ ] Verify admin bypass is disabled (try as admin)

---

## 🚀 Quick Start (GitHub CLI)

If you prefer command-line configuration:

```bash
# Install GitHub CLI (if not installed)
# macOS: brew install gh
# Linux: apt install gh

# Authenticate
gh auth login

# Set repository (replace with your repo)
export REPO="owner/repo-name"

# Configure branch protection for main
gh api repos/$REPO/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["test:unit","test:integration","test:security","lint","typecheck","security-scan","coverage-check"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null

# Configure branch protection for develop
gh api repos/$REPO/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["test:unit","test:integration","test:security","lint","typecheck","security-scan","coverage-check"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```

---

## 📚 Related Documentation

- **Detailed Setup Guide:** `docs/BRANCH_PROTECTION_SETUP.md`
- **Quality Standard:** `docs/QUALITY_AND_SECURITY_STANDARD.md`
- **Implementation Summary:** `docs/QUALITY_SECURITY_IMPLEMENTATION_SUMMARY.md`

---

## ⚠️ Important Notes

1. **Branch protection requires repository admin access**
2. **Status checks must run at least once** before they appear in branch protection settings
3. **Workflows are already active** - they will run on next PR
4. **This is a one-time setup** - no code changes needed

---

## ✅ Completion

Once all items are checked:

- [ ] Branch protection configured for `main`
- [ ] Branch protection configured for `develop`
- [ ] Test PR created and verified
- [ ] All workflows running successfully
- [ ] Merge blocked until checks pass

**Status:** Ready for production use ✅

---

**END OF CHECKLIST**

---

_Last Updated: 2026-01-07_  
_Next Review: After GitHub configuration_
