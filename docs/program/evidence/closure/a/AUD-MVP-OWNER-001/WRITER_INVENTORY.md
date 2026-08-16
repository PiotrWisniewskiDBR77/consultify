# AUD-MVP-OWNER-001 — `audit_programs` writer inventory

Date: 2026-08-16
Lane: Claude A (`codex/closure-claude-a-method-evidence`)
Real DB used for verification: `postgresql://consultinity:consultinity@127.0.0.1:34915/consultinity`
(1557 tables, 703/703 migrations applied at the time of this run)

## Reproducible command

```bash
grep -rnE "(INSERT INTO|UPDATE|DELETE FROM)\s+audit_programs\b" server/src --include="*.ts" | grep -v "__tests__"
```

## Raw result at final state (post-change)

```
server/src/services/auditProgramService.ts:331:    `INSERT INTO audit_programs
server/src/services/auditProgramService.ts:380:    `UPDATE audit_programs
server/src/services/auditProgramService.ts:406:    `DELETE FROM audit_programs WHERE id = ? AND organization_id = ?`,
server/src/services/audits/programService.ts:409:    `INSERT INTO audit_programs
server/src/services/audits/programService.ts:592:    `UPDATE audit_programs
server/src/services/audits/programService.ts:654:  await auditRun(`DELETE FROM audit_programs WHERE id = $1 AND organization_id = $2`, [
server/src/services/audits/programService.ts:973:    `UPDATE audit_programs
```

Both files still *contain* SQL statements that mutate `audit_programs` — the
grep alone cannot distinguish "code exists" from "code is reachable from an
HTTP caller". What changed in this task is **reachability**, not line
presence. The table below maps every line above to its caller chain at the
final state.

## Canonical writer — count = 1

**`server/src/services/audits/programService.ts`** (the Audits kernel,
`server/src/routes/audits/programs.routes.ts`, mounted at
`/api/audits/programs*` in `server/src/Gateway.ts:1320`, unconditionally, no
flag) is the **only** HTTP-reachable writer of `audit_programs` by default.
Its INSERT (`:409`) stamps kernel-authorship columns the legacy writer never
touches: `pack_id`, `pack_key`, `pack_version`, `lifecycle_state`. A row with
a non-NULL `pack_id` is kernel-authored; a row with `pack_id IS NULL`
predates this task or was inserted directly as a fixture (see
`server/migrations/20260813_audits_method_core.sql:0` section 0 comment,
which documents this same "legacy on read" distinction).

Every legacy write in `auditProgramService.ts` — create, update (both the
`PATCH` caller and the `generate-surveys` bookkeeping caller), and delete —
is now behind the same `isLegacyProgramWriteEnabled()` kill-switch, default
OFF. **Writer inventory at default state: 1.** (Update to 2 only if an
operator explicitly sets `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true`, a
reversible, intentional rollback — not the steady state.)

## Per-line reachability at final state

| # | File:line | Statement | HTTP-reachable? | Notes |
|---|-----------|-----------|------------------|-------|
| 1 | `auditProgramService.ts:331` (INSERT, inside `createProgram()`) | legacy create | **NO** by default | `audit-programs.routes.ts` `POST /programs` returns 410 `AUDIT_PROGRAM_LEGACY_WRITE_DISABLED` **before** calling `createProgram()`, gated by `isLegacyProgramWriteEnabled()` (env `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED`, default unset = OFF = disabled). Reachable again only if that env var is explicitly set to `'true'` (reversible rollback, proven in the real-DB test's flag-ON case). |
| 2 | `auditProgramService.ts:380` (UPDATE, inside `updateProgram()`) | legacy update | **NO** by default | Two callers, BOTH gated by the same flag: (a) `PATCH /programs/:id` — 410 before `updateProgram()` runs. (b) `POST /programs/:id/generate-surveys` — **closed per lead decision 2026-08-16** (see "Resolved judgment call" below): also 410 before `updateProgram()` runs. |
| 3 | `auditProgramService.ts:406` (DELETE, inside `deleteProgram()`) | legacy delete | **NO** by default | `DELETE /programs/:id` returns 410 before calling `deleteProgram()`, same flag as #1. |
| 4 | `programService.ts:409` (INSERT, inside `createProgramCore()` ← `createProgramFromPack()`) | kernel create | YES, unconditionally | `POST /api/audits/programs` (kernel route, no flag). Canonical writer. |
| 5 | `programService.ts:592` (UPDATE, inside `updateProgram()`) | kernel update | YES, unconditionally, gated by kernel's own `program.update` capability + `lifecycle_state = 'planning'` | Not part of this task's lease (kernel file). |
| 6 | `programService.ts:654` (DELETE) | kernel delete | YES, unconditionally, gated by kernel's own `program.delete` capability + `lifecycle_state = 'planning'` | Not part of this task's lease (kernel file). |
| 7 | `programService.ts:973` (UPDATE, inside `transitionLifecycle()`) | kernel lifecycle transition | YES, unconditionally, gated by kernel's own `program.advance_lifecycle` capability | Not part of this task's lease (kernel file). |

## Resolved judgment call — `generate-surveys` bookkeeping UPDATE (line 2b) is now blocked too

First pass left this path unblocked as a "bookkeeping-only" exception (it
never creates a new `audit_programs` row or sets a kernel-authorship column,
so on its own it can't produce the "two divergent program identities"
defect). **Lead decision (2026-08-16): close it.** Rationale, as given: the
task's acceptance bar is a writer inventory of exactly 1; leaving one legacy
UPDATE path live meant the legacy service was still a second writer of the
canonical table (inventory = 2, not 1), and it is incoherent to keep a
bookkeeping write alive on a surface where create/update/delete already
return 410 — no legacy-created program can exist anymore for
`generate-surveys` to legitimately fan out.

`POST /api/audit/programs/:id/generate-surveys` now returns the same 410
`AUDIT_PROGRAM_LEGACY_WRITE_DISABLED` before calling `generateSurveys()` at
all, gated by the same `isLegacyProgramWriteEnabled()` flag. Reversible the
same way: `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true` restores it. The 8
pre-existing `generate-surveys` fan-out/SEC-3/idempotency tests in
`audit-programs.test.ts` were preserved unweakened — moved under a
flag-ON-stubbed describe block (they now prove the *rollback* path) — plus 2
new negative tests proving the default-OFF refusal. The real-DB suite adds a
dedicated fixture (`GENSURVEYS_PROGRAM_ID`) with a default-OFF negative
(byte-unchanged `SELECT` diff) and a flag-ON positive control (proves a real
`UPDATE` happens, then flips back OFF and proves refusal resumes on the same
row).

## Schema self-healing removed

`auditProgramService.ts`'s `ensureSchema()` used to run
`CREATE TABLE IF NOT EXISTS audit_programs (...)` (+ an index) on every
call — a second schema owner for a table the Audits kernel migration
(`server/migrations/20260813_audits_method_core.sql`, section 0) also
defines via `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF
NOT EXISTS`. `ensureSchema()` is now a no-op. Verified safe against the real,
fully-migrated Postgres used for this task (703/703 migrations applied,
1557 tables) — `to_regclass('public.audit_programs')` resolves and all 33
columns (11 legacy + 22 kernel-added, including `pack_id`) are present
before any service call runs; every read/write path in this task's real-DB
test suite (16/16 passing) exercises the table with `ensureSchema()` as a
no-op.
