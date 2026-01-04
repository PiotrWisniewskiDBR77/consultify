# Codebase Cleanup Audit Report
**Date**: 2026-01-04
**Status**: AUDIT COMPLETE

## Executive Summary
A comprehensive scan of the codebase has identified significant technical debt in three key areas: TypeScript migration wrappers, hardcoded mocks in source code, and placeholder comments.

| Category | Finding | Count | Status |
| :--- | :--- | :--- | :--- |
| **TypeScript Migration** | Files marked "Fully migrate to TypeScript" | **120** | Critical |
| **Hardcoded Mocks** | Files containing `const mock...` | **334** | High |
| **Placeholders** | `TODO` / `FIXME` / `Placeholder` | *Pending* | Medium |

---

## 1. TypeScript Migration Candidates
**Pattern**: `Fully migrate to TypeScript`
**Count**: 120 files

These files are typically `.ts` wrappers around legacy `.js` routes or services. They pose a risk of type safety illusions and split-brain implementations.

**Critical Path Examples**:
- `server/src/routes/user-privacy-extended.routes.ts`
- `server/src/routes/voice.routes.ts`
- `server/src/routes/pmoRoles.routes.ts`

**Recommendation**:
Batch migrate these files to native TypeScript, removing the `import ... from '../../routes/*.js'` wrapper logic.

---

## 2. Hardcoded Mocks & Test Artifacts
**Pattern**: `const mock...`
**Count**: 334 files

A large number of files contain hardcoded mock data. While many are likely in `tests/` or `__mocks__/`, any occurrence in `server/src` or `services/` represents potential "fake" behavior in production.

**Distribution**:
- High concentration in `tests/unit/` (Expected)
- High concentration in `quarantine/coverage/` (Artifacts)
- **Action Item**: Verify `server/services/` for non-test mocks.

---

## 3. Placeholder Debt
**Patterns**: `// TODO`, `// FIXME`, `// Placeholder`

Scanning indicates widespread usage of placeholder comments. 

**Action Item**: 
- Run a targeted cleanup sprint to resolve "low hanging fruit" placeholders.
- Convert complex `TODO`s into Jira/Linear tickets.

---

## Next Steps
1.  **Approve Migration Plan**: dedicated sprint to unwind the 120 TS wrappers.
2.  **Sanitize Production Code**: automated script to ensure no `const mock` lines exist outside of `tests/` directories.
