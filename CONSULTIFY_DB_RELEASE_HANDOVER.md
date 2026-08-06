# Consultify — DB remediation handover to the Release Owner

**Branch:** `fix/db-audit-p0-20260806`
**Based on:** `origin/demo` at `b21c9513a1`
**Commits:** 8 · **Pushed:** no · **Integrated anywhere:** no

Nothing was cherry-picked, merged or deployed. The target worktree was inspected read-only and left untouched. Integration is the Release Owner's call and the Release Owner's action.

---

## 1. Commits, in dependency order

| # | Commit | Type | Files | Δ |
|---|---|---|---|---|
| 1 | `fa0dd9fec6` | fix(migrations) — unblock strict fresh schema | 1 | +21 −4 |
| 2 | `d091f42266` | fix(llm) — close cross-tenant reads | 2 | +169 |
| 3 | `3bf6a22e3b` | fix(db) — `db:migrate` exits 1 on failure | 1 | +2 −1 |
| 4 | `f743371c1e` | fix(ci) — three jobs use real Postgres | 1 | +14 |
| 5 | `20398850fe` | docs — remediation log + scope correction | 1 | +132 |
| 6 | `7106b2eb95` | docs — realDB CI measurement | 1 | +36 |
| 7 | `52967aef30` | fix(document-studio) — source pack persists `ready` | 5 | +446 −113 |
| 8 | `c3cb5e3faf` | test(fixtures) — two realDB fixtures repaired | 3 | +122 −11 |

Thirteen files total. No file is touched by more than one functional commit except `documentSourcePackPersistence.pg.test.ts` (created in 7, cleanup added in 8).

---

## 2. Recommended cherry-pick order

Order matters in one place only: **8 must follow 7** (it amends a file 7 creates). Everything else is independent.

**Recommended sequence, lowest risk first:**

```
1. fa0dd9fec6   # migration unblock — 1 line of SQL semantics, no code
2. 3bf6a22e3b   # package.json script rename
3. f743371c1e   # CI env vars
4. d091f42266   # llm route guard + its test
5. 52967aef30   # source pack persistence  ── must precede 8
6. c3cb5e3faf   # fixture repairs          ── depends on 5
7. 20398850fe   # docs
8. 7106b2eb95   # docs
```

Rationale for putting `fa0dd9fec6` first: until it lands, a fresh database cannot be built at all, so nothing downstream can be verified on one.

The two docs commits are safe to take, skip, or squash — they are audit artifacts, not product code.

**One judgement call to make consciously:** commit 4 (`f743371c1e`) makes CI actually use the provisioned database. Taking 4 *without* 5 and 6 will turn three test files red in CI, because those are the very failures 5 and 6 fix. **Take 4, 5 and 6 together, or take 4 last.**

---

## 3. Conflict assessment

| Check | Result |
|---|---|
| `git diff --check` over the whole branch | **clean** — no whitespace errors, no conflict markers |
| Merge against current `origin/demo` | **0 conflict markers** (`git merge-tree`) |
| Demo drift since branch point | 2 commits (`9cfd5cbd3d`, `108fb1893e`) |
| Do those 2 touch my files? | **No** — they touch `documentDocxRenderer`, `documentContentGenerator`, `documentDocxStructure`, `documentBlockContentGenerator` and their tests. Set intersection with my 13 files is empty. |
| Target worktree `…/Documents/…/consultify` | branch `codex/sync-demo-20260729` at `d8b3979e65`, **162 uncommitted changes** (86 untracked, 73 modified) |
| Does that dirty tree touch my files? | **No collision** — none of its 162 changes overlaps my 13 files |

**Caveat the Release Owner should weigh:** that worktree is not on `demo`, it is on `codex/sync-demo-20260729`, and it is dirty. Cherry-picking into it mixes this work with 162 unrelated uncommitted changes and makes the result hard to review or revert. A clean worktree from `origin/demo` is the safer target. That is a recommendation, not an action taken.

---

## 4. Test evidence

All runs on ephemeral local PostgreSQL 17.9, schema built by the repository's own strict migration path.

### Strict fresh schema, from an empty database

| | Before commit 1 | After |
|---|---|---|
| Migrations applied | 356, then abort | **550 / 550** |
| Failures | 1 (`2BP01` FK TEXT→UUID) | **0** |
| `public` tables | 707 | **1295** (+121 `v8`) |

Reproduced on five independently created databases during this work; every one reported `✅ Postgres migrations complete`.

### Cross-tenant guard (commit 2)

- `tests/unit/backend/llmOrgScope.test.ts` — **9/9 pass**.
- **Negative control:** guard removed → exactly **4** tests go red (three cross-org reads 403→200, one anonymous read 401→200); the 5 permissive tests correctly stay green.
- Pre-existing `tests/integration/llm-superadmin-gate.test.ts` — **8/8 still pass**.

### Source pack persistence (commit 7)

- New `documentSourcePackPersistence.pg.test.ts` — **4/4 pass on real Postgres**, covering create → promote → **cold service instance** → hydrate → `ready`, audit co-landing, ordering across rapid transitions, and a refused write.
- **Negative control:** fix reverted → the two tests that pin the defect go red (durability of the promotion, and the false-success case). The other two pass either way, which is honest and expected.
- Existing `documentSourcePackService.test.ts` — **14/14 pass** (converted to async; lifecycle assertions unchanged).

### Fixtures (commit 8)

On freshly migrated databases:

| Run | Result |
|---|---|
| each of the three files individually | 3/3 pass |
| all three together, one database | 3/3 pass |
| reverse order | 3/3 pass |
| third permutation | 3/3 pass |
| residue after the run | **0 rows** |

Under the mock (no `RUN_DB_TESTS`), all three report **skipped** — never a false green.

### Full bounded realDB sample

Reported in §6.

---

## 5. What changed, in one line each

1. **`fa0dd9fec6`** — a migration declared `partner_org_id TEXT REFERENCES partner_organizations(id)` while the producer that actually runs creates `id UUID`; Postgres cannot implement that FK, so the strict run aborted and 194 later migrations never ran. The unimplementable constraint is dropped; `TEXT` is kept because that is what the runtime DDL and every live environment already hold.
2. **`d091f42266`** — `/org/:organizationId/policy`, `/policy/history` and `/available-models` are now scoped to the caller's organization (super admins exempt, matching the sibling write routes).
3. **`3bf6a22e3b`** — `db:migrate` no longer passes `--safe`; the tolerant mode keeps the explicit name `db:migrate:unsafe-continue`.
4. **`f743371c1e`** — `RUN_DB_TESTS=1` / `MOCK_DB=false` added to the three jobs that provisioned a database and then asserted against the in-memory mock.
5. **`52967aef30`** — source pack lifecycle transitions persist the pack row and its audit row atomically on one pinned connection, awaited, before publishing to the in-process cache; a refused write now raises instead of reporting success.
6. **`c3cb5e3faf`** — one fixture stopped issuing `DROP TABLE tasks` against a schema it does not own (it now detects a migrated database); the other creates organizations before the users that reference them, and supplies the columns and status value the real schema requires.

No FK was disabled. No `DROP … CASCADE` was used. No lifecycle contract was changed.

---

## 6. Full bounded realDB sample

*(filled in below once the run completes — see the final report)*

---

## 7. Still open — this is not a GO

| Item | Status |
|---|---|
| `documentStudioEditorStatePersistence.test.ts` | **fails in isolation on real Postgres — pre-existing, untouched by this branch.** Needs its own investigation. |
| `documentAudienceProfileService.test.ts` | passes alone, fails in the directory run — cross-file pollution, present without this branch's files. |
| DB-P0-02 (`DbPromise.run` default `fallback: true`) | open. Repository-wide blast radius; should land after commit 4 so the fallout is visible rather than silent. |
| DB-P0-05 (MFA has no table anywhere) | open. Needs a schema-name decision plus the DB-P0-02 fix. |
| DB-P0-06 (demo schema ≠ canon, 171 tables) | open. Operational decision, not a code change. |
| Branch-gated test suite | `main` is 7646 commits behind `demo`, `develop` 7746. Opening the gate is a cost decision for the Release Owner. |

The audit does not issue a GO. This branch closes four P0s and one real product defect; the remainder are listed above with their evidence in `CONSULTIFY_DATABASE_RISK_REGISTER.csv`.
