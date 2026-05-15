# Branch Protection Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2026-01-07

---

## Overview

This document provides instructions for configuring GitHub Branch Protection Rules to enforce the Quality and Security Standard.

**Reference:** `docs/QUALITY_AND_SECURITY_STANDARD.md` Section 4

> Branch protection must match the current GitHub Actions jobs from `.github/workflows/test-suite.yml`.
> Do not use legacy check names from removed workflows.

---

## Required Branch Protection Rules

### Protected Branches

The following branches MUST be protected:

- `main` (production)
- `develop` (integration)

---

## Configuration Steps

### 1. Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **Settings** → **Branches**
3. Click **Add rule** or edit existing rule for `main`

---

### 2. Branch Name Pattern

**Pattern:** `main` (and `develop`)

---

### 3. Protect Matching Branches

Enable the following settings:

#### ✅ Require a pull request before merging

- **Required number of approvals:** 1
- **Dismiss stale pull request approvals when new commits are pushed:** ✅ Enabled
- **Require review from Code Owners:** ✅ Enabled (if CODEOWNERS file exists)
- **Restrict who can dismiss pull request reviews:** ✅ Enabled (restrict to admins)

#### ✅ Require status checks to pass before merging

**Required status checks:**

- `🔍 Lint & Type Check`
- `🛡️ Test Quality (Anti-Placeholder)`
- `🚫 Skip/Only Gate`
- `🎯 Levels Coverage Gates (L1–L3)`
- `🔒 Security Integrity Gate`
- `🔒 Security Tests`
- `🔒 Critical Path Coverage Check`
- `📈 Patch Coverage Gate (≥80%)`
- `📋 Test Summary`

**Options:**

- ✅ **Require branches to be up to date before merging**
- ✅ **Do not allow bypassing the above settings**

#### ✅ Require conversation resolution before merging

✅ Enabled

#### ✅ Require signed commits

⚠️ Optional (recommended for enterprise)

#### ✅ Require linear history

⚠️ Optional (recommended for clean history)

#### ✅ Include administrators

✅ **ENABLED** - No admin bypass (except emergency with post-mortem)

#### ✅ Restrict pushes that create files larger than 100 MB

✅ Enabled

---

### 4. Save Configuration

Click **Create** or **Save changes**

---

## Status Check Names

The following status checks are required (configured in active CI workflows):

| Check Name         | Workflow File      | Description              |
| ------------------ | ------------------ | ------------------------ |
| `🔍 Lint & Type Check` | `test-suite.yml` | ESLint + TypeScript validation |
| `🛡️ Test Quality (Anti-Placeholder)` | `test-suite.yml` | Test quality gate |
| `🚫 Skip/Only Gate` | `test-suite.yml` | Guard against skipped/only tests |
| `🎯 Levels Coverage Gates (L1–L3)` | `test-suite.yml` | Coverage threshold gate |
| `🔒 Security Integrity Gate` | `test-suite.yml` | Security integrity checks |
| `🔒 Security Tests` | `test-suite.yml` | Security test suite |
| `🔒 Critical Path Coverage Check` | `test-suite.yml` | Critical path coverage |
| `📈 Patch Coverage Gate (≥80%)` | `test-suite.yml` | Patch coverage threshold |
| `📋 Test Summary` | `test-suite.yml` | Final CI summary |

---

## Emergency Bypass Procedure

If CI/CD must be bypassed for emergency (P0 security incident or production outage):

1. **Document the emergency:**
   - Create issue: `EMERGENCY-[DATE]-[NUMBER]`
   - Document: Why CI was bypassed, what changed, impact

2. **Get approval:**
   - Tech Lead approval required
   - Security Lead approval required (for security-related changes)

3. **Post-mortem:**
   - Complete within 24 hours
   - Document: Root cause, prevention measures, CI/CD improvements

4. **Update documentation:**
   - Add to `docs/INCIDENT_RESPONSE_PLAYBOOK.md`
   - Update this document if process changes

---

## Verification

After configuration, verify:

1. ✅ Create test PR to `main`
2. ✅ Verify status checks are required
3. ✅ Verify merge is blocked until checks pass
4. ✅ Verify force push is blocked
5. ✅ Verify admin bypass is disabled

---

## Troubleshooting

### Status checks not appearing

**Problem:** Status checks don't appear in branch protection settings

**Solution:**

1. Ensure workflows are in `.github/workflows/` (not `.github/workflows.disabled/`)
2. Ensure workflows have correct `name:` field
3. Push a commit to trigger workflow run
4. Wait for workflow to complete
5. Refresh branch protection settings page

### Workflow not triggering

**Problem:** Workflow doesn't run on PR

**Solution:**

1. Check workflow file syntax (YAML)
2. Verify `on:` trigger includes `pull_request:`
3. Check GitHub Actions tab for errors
4. Verify repository has Actions enabled

### Admin bypass still allowed

**Problem:** Admins can still bypass protection

**Solution:**

1. Verify "Include administrators" is **DISABLED**
2. Check repository settings → General → Allow force pushes (should be disabled)
3. Verify user permissions (admin vs maintainer)

---

## Related Documentation

- **Quality and Security Standard:** `docs/QUALITY_AND_SECURITY_STANDARD.md`
- **CI/CD Pipeline:** `docs/engineering/CI_CD_PIPELINE.md`
- **Incident Response:** `docs/INCIDENT_RESPONSE_PLAYBOOK.md`

---

## GitHub CLI Alternative

If you prefer command-line configuration:

```bash
# Install GitHub CLI if not installed
# brew install gh  # macOS
# apt install gh   # Linux

# Authenticate
gh auth login

# Configure branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["🔍 Lint & Type Check","🛡️ Test Quality (Anti-Placeholder)","🚫 Skip/Only Gate","🎯 Levels Coverage Gates (L1–L3)","🔒 Security Integrity Gate","🔒 Security Tests","🔒 Critical Path Coverage Check","📈 Patch Coverage Gate (≥80%)","📋 Test Summary"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```

**Note:** Replace `:owner` and `:repo` with your repository owner and name.

---

**END OF GUIDE**

---

_This configuration enforces the Quality and Security Standard. Non-compliance blocks deployment._
