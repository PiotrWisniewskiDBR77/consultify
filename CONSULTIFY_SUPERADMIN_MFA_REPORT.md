# Consultify — Super Admin MFA rift: findings, fix and integration

**Work branch:** `fix/superadmin-mfa-20260806` @ `3d61edc2fd` — fix commit `f423df7cad`, rebased onto the newest `origin/demo` @ `6afe2004ba`
**Verification branch:** `verify/superadmin-mfa-on-rc` @ `cb2b576169` — release candidate `3241455c88` + the same commit, cherry-picked cleanly

> Rebased from `768f654f32` to `6afe2004ba` after `demo` advanced three commits (`644152f6b8`, `032bbc5aa4`, `6afe2004ba` — Document Studio and workbook templates). Set intersection with this branch's four files is **empty**; the rebase was clean and every result below was re-measured on the rebased commit.
**Pushed / merged / deployed:** no. **Demo touched:** no. **RC or Documents worktree touched:** no.

---

## 1. Verdict

| Path | Status |
|---|---|
| `user_mfa_methods` — read (`GET /api/superadmin/users/:id/mfa`) | **IMPLEMENTED** — wired end-to-end, was failing, now works |
| `user_mfa_methods` — writes (`totp/setup`, `totp/verify`) | **NOT_CONNECTED** — no caller anywhere in `src/`; repaired but still unreferenced |
| `user_mfa` (`/api/mfa/*`, settings panel) | **IMPLEMENTED** in the RC (`20260806_mfa_user_mfa_table.sql`); absent from plain `origin/demo` |
| `MFAService` (`AuthController`, `auth.routes`) | **NOT a third model** — an honest stub returning `FEATURE_UNAVAILABLE` |
| Are the two models duplicates? | **No — two justified models.** See §3. Not merged. |

**No feature flag was touched.** Storage and queries are correct; the product posture is exactly what it was.

---

## 2. The three defects, all invisible without a real database

### D1 — the table existed in no environment
`user_mfa_methods` is created only by `015_enterprise_customers_module.sql`. That file is numbered `< 500`, so `isSqliteOnlyMigration()` excludes it from every run, and it is not in `PROMOTED_LEGACY_PRODUCERS` (verified on both `origin/demo` and the RC — the list is `081`, `073`, `215`, `256`). The panel read therefore failed with `42P01`.

Impact is **honest failure, not a false success**: `MFAView.tsx` sets `loadError` and raises a toast. The operator saw an error, not an empty-but-plausible list.

### D2 — a SQLite string literal read as a Postgres identifier
```
method_type = "totp"     ← identifier in Postgres → 42703
```
Two occurrences, in `verifyTOTP`'s `SELECT` and its follow-up `UPDATE`.

### D3 — `require()` inside an ESM module
`setupTOTP` and `verifyTOTP` called `require('speakeasy')`. The package is `"type": "module"`, the file has 19 ESM imports and no `createRequire`, so `require` is undefined — both handlers threw `ReferenceError` **before reaching any SQL**. `speakeasy@2.0.0` is a real dependency (root `package.json`), CommonJS, so a default import is the correct interop.

### Explicitly NOT a defect
`datetime("now")` — `adaptQuery` rewrites it to `NOW()` for either quote style ([PostgresDatabase.ts:871](server/src/database/PostgresDatabase.ts#L871)). It was normalised for readability only, and this is recorded so nobody "fixes" it again.

---

## 3. Producer / consumer matrix

| | `user_mfa` | `user_mfa_methods` |
|---|---|---|
| **Producer migration** | `20260806_mfa_user_mfa_table.sql` (in the RC) | `015_enterprise_customers_module.sql` — **excluded**; now also `20260806_superadmin_mfa_methods_table.sql` (this commit) |
| **Consumers** | `mfa.routes.ts` (13 refs), `settings.routes.ts` (1) | `SuperAdminController.ts` (4 refs) |
| **Routes** | `/api/mfa/*` — 6 endpoints | `/api/superadmin/users/:id/mfa{,/totp/setup,/totp/verify}` — 3 endpoints |
| **Guard** | `verifyToken` — self-service, acts on own account | `verifyToken` + `verifySuperAdmin` (router-level, `superadmin.routes.ts:345,348`) — acts on **another** user |
| **Cardinality** | one row per user, PK `user_id` | many rows per user — `method_type` × `is_primary` |
| **Shape** | TOTP only: `secret`, `enabled`, `backup_codes`, counters | multi-method: `method_type`, `phone_number`, `backup_codes_json`, `is_primary` |
| **UI caller** | settings MFA panel | `MFAView.tsx` → `Api.getMFAMethods` (**read only**) |
| **Boolean style** | `BOOLEAN` | `INTEGER` compared to `1` |

**Not duplicates.** They differ in actor (self vs administrator), cardinality (one vs many), and capability (single factor vs method registry). A merge would be a product decision about whether the platform supports multiple factors per user — out of scope here, and deliberately not taken.

What *is* an accident is that they were built independently and neither had a working migration. That is now fixed on both sides without unifying them, so a future merge remains a pure rename rather than a data migration — which is why the new migration copies 015's column contract character-for-character, including `INTEGER` for `is_enabled`/`is_primary` (switching to `BOOLEAN` would silently break `WHERE is_primary = 1`).

---

## 4. Changes

`f423df7cad` — 3 files, +283 −7.

| File | Change |
|---|---|
| `server/migrations/20260806_superadmin_mfa_methods_table.sql` | **new** — versioned migration; column contract copied from 015; FK to `users` `ON DELETE CASCADE`; 015's two indexes plus one matching the controller's actual lookup |
| `server/src/controllers/SuperAdminController.ts` | ESM `import speakeasy`; two `"totp"` → `'totp'`; `datetime("now")` → `datetime('now')` |
| `server/src/controllers/__tests__/superadminMfaMethods.pg.test.ts` | **new** — 6 real-DB tests |

No ad-hoc DDL. No behaviour change. No flag change.

---

## 5. Test evidence

All on ephemeral local PostgreSQL 17.9.

### Strict fresh schema, from an empty database

| Base | Result |
|---|---|
| newest `origin/demo` @ `6afe2004ba` | **FAILS — 356 applied, 1 error** (`partner_program_ledger_partner_org_id_fkey cannot be implemented`) |
| RC `3241455c88` + this commit | **PASSES — 552 / 552, 0 errors**, 1297 tables, both `user_mfa` and `user_mfa_methods` present |

The failure on plain demo is **not caused by this work** — it is the FK defect fixed in the already-integrated DB package, which lives in the RC and not yet in `demo`. See §7.

### `superadminMfaMethods.pg.test.ts` — 6/6

| Test | Covers |
|---|---|
| panel read returns a stored factor | positive persistence, D1 |
| setup persists and survives a fresh read | positive persistence + **fresh reopen via a cold controller instance**, D3 |
| verify resolves the primary TOTP predicate | D2, D3 |
| a refused write does not report success | negative failed-write / no false success |
| a non-superadmin cannot reach any of the 3 endpoints | permission |
| an unauthenticated caller cannot reach the read | permission |

The guards are the **real** `verifyToken` + `verifySuperAdmin`, applied in the same order the router applies them, with real signed JWTs and roles stored in the database — not mocked away.

### Negative controls — three, each red on the matching revert

| Revert | Result |
|---|---|
| drop the new migration | 3 tests red |
| restore `method_type = "totp"` | the verify test red |
| restore `require('speakeasy')` | the TOTP tests red |

### Combined and hygiene

Both MFA suites together on one candidate-based database: **2 files, all green**. Residue after the run: `user_mfa=0`, `user_mfa_methods=0`, zero fixture organizations. Under the mock (no `RUN_DB_TESTS`) the file reports **skipped**, never a false green.

---

## 6. Integration instructions

1. Cherry-pick **`f423df7cad`** onto the release candidate. Verified: it applies to `3241455c88` with **zero conflicts** (that is exactly what `verify/superadmin-mfa-on-rc` @ `cb2b576169` is).
2. It touches three files, none of which the DB package or the RC's other commits modify.
3. Order: **after** the DB package, because strict fresh schema only passes with the partner-ledger FK fix in place. No other ordering constraint.
4. Nothing else is required — no flag, no config, no data backfill.

---

## 7. Risks and open items

| Item | Assessment |
|---|---|
| **`origin/demo` cannot build a fresh schema** | The FK fix is in the RC, not in `demo`. Until the DB package lands on `demo`, anyone branching from `demo` gets a 356-migration failure. This is the single most consequential thing in this report and it is **not** mine to resolve. |
| **`totp/setup` and `totp/verify` have no caller** | Repaired, but unreferenced by any UI. **Recommendation: formal quarantine** — either delete the two handlers and their routes, or mark them explicitly experimental. I did not remove them: they are guarded, now correct, and removal is a product decision. |
| **`setupTOTP` never clears a previous primary** | It always inserts `is_primary = 1` without demoting existing rows, so repeated enrolment yields multiple primaries and `verifyTOTP`'s `SELECT` would return an arbitrary one. Pre-existing behaviour, in the dead write path. **Not changed** — that is a contract change. A partial unique index would enforce it, but would also reject data the current code can produce. |
| **The two models remain unmerged** | Intentional. Merging is a product decision about multi-factor support. |
| **`user_mfa_methods` has no organization column** | Correct for a platform-wide superadmin surface, but it means tenant scoping is entirely the `verifySuperAdmin` guard. Consistent with the 0-RLS posture recorded in the database audit. |
| **MFA remains off** | Nothing here enables it. `MFAService` still returns `FEATURE_UNAVAILABLE` to the login path. Storage being ready does not make the feature live. |
