# Database & Mock Verification Master Plan
**Status**: DRAFT
**Owner**: AI Lead Agent
**Date**: 2026-01-04

## Overview
This document outlines a multi-stage program to verify system integrity, specifically focusing on database connectivity and the elimination of temporary mocks, placeholders, and hardcoded data.

## 🎯 Program Objectives
1.  **Verify Real Database Connections**: Ensure `DbPromise` and `Database.ts` are connecting to valid, persistent storage (PostgreSQL/SQLite) and not SILENTLY falling back to in-memory mocks in production.
2.  **Audit Service Dependencies**: Identify services that conditionally mock their own dependencies (like `BillingCommandService` checking `if (!deps.stripe)`).
3.  **Eliminate Code Placeholders**: Systematically resolve `TODO`, `FIXME`, and hardcoded "mock" strings.
4.  **Schema Alignment**: Verify that the running application matches the expected schema.

---

## 📅 Phased Execution Plan

### Phase 1: Database Connectivity & Integrity (Role: Database Specialist)
*Goal: Confirm "All Green" on Database and Cache connections.*

- [ ] **1.1 Connection Verification script**
    - Create `scripts/verify-db-connection.ts`
    - Explicitly test `getDatabaseAsync()` vs `getDatabase()` behavior.
    - Assert that `process.env.MOCK_DB` is `false`.
    - Verify Redis connection via `redisClient.js`.
- [ ] **1.2 Schema Validation**
    - List all tables in the active database.
    - Compare against `types/schema.ts` or known source of truth.
    - Flag missing tables (e.g., `ai_drafts`, `project_memory` mentioned in tests).
- [ ] **1.3 Data Persistence Test**
    - Write a script to INSERT a record, restart the "app" (or script context), and SELECT it back.

### Phase 2: Service Mock & dependency Audit (Role: Backend Architect)
*Goal: Identify "Ghost Mocks" hiding in business logic.*

- [ ] **2.1 Dependency Injection Scan**
    - Audit all classes accepting `dependencies` or `deps`.
    - Grep for `if (!deps.X) { return mock_... }`.
    - **Target Files**: `BillingCommandService.ts`, `LtvAnalyticsService.ts`.
- [ ] **2.2 Environment Variable Audit**
    - Check missing keys that trigger mock mode (e.g., `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`).
    - Create a report of "Active Mocks due to Missing Config".

### Phase 3: Codebase Cleanup (Role: Code Janitor)
*Goal: Resolve "TODO" debt and hardcoded values.*

- [ ] **3.1 "TODO: Typescript Migration" Sweep**
    - Count files with "Fully migrate to TypeScript".
    - Prioritize critical paths (e.g., `routes/`).
- [ ] **3.2 Hardcoded Value Scan**
    - Grep for `const mock... =`.
    - Grep for `return { ... }` that looks like static data in `services/`.
- [ ] **3.3 Placeholder Comments**
    - Scan for `// Placeholder`, `// TODO`, `// FIXME`.

---

## 🤖 Agent Assignment Protocol

| Phase | Recommended Agent Persona | Toolset Required |
| :--- | :--- | :--- |
| **Phase 1** | **Database Specialist** | `run_command` (node scripts), `db_query` (if avail), `read_file` |
| **Phase 2** | **Backend Architect** | `grep_search`, `read_file` (deep analysis of DI logic) |
| **Phase 3** | **Refactoring Bot** | `grep_search`, `replace_file_content` |

## 📝 Execution Log

(Agents will append their progress here)

- *[2026-01-04]* Plan Created.
