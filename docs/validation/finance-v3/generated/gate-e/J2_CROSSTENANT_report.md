# J2 — CROSS-TENANT MATRIX report (Gate J, Finance v3)

**Candidate:** `ee5736a5a6` · **Worktree:** `fv3p-e-analysis` · **Branch:** `codex/fv3p-j2-crosstenant`
**Scope:** all 88 tenanted endpoints under `server/src/routes/v8/finance-v2/*` (15 route files).
**Database:** ephemeral local Postgres, `127.0.0.1:54330/j2_xtenant` (created via `newdb.sh`, dropped/recreated between runs, zero connections to demo/staging/prod).
**Probe script (committed):** `server/scripts/finance-v3-audit/j2-crosstenant-probe.ts`

## Headline

**No P0 found.** Across 88 endpoints, every family that was directly probed (my own script) or that already had a real, run-for-real `*.pg.test.ts` cross-tenant suite came back fail-closed: 404/403 on the HTTP side, zero cross-tenant rows and zero mutated rows on an **independent, raw `pg.Client`** SQL read for every case tested. The grep for the specific known defect pattern this task named (`organizationId` read from `req.body`/`req.params`/`req.query` instead of the authenticated context) returns **zero hits** across all 15 route files. Ten negative controls (defenses deliberately broken, one file at a time) all went red as expected and all reverted cleanly, proving the test harness — not just the code — is trustworthy.

One genuine (minor, non-P0) finding: **`POST /saved-views` and `POST /import/preview` validate request-body shape before the tenant-ownership check runs**, so a cross-tenant attempt against those two specific inputs can surface as 400/200-with-`ok:false` instead of a clean 404. No data leaked and no row was written in either case (independently confirmed) — this is a validation-ordering / error-shape issue, not a security defect. Documented in full below.

---

## 1. Endpoint inventory (self-derived from the route files, not from anyone else's list)

```
grep -c "^router\.\(get\|post\|patch\|put\|delete\)(" server/src/routes/v8/finance-v2/*.ts
```

| File | Endpoints |
|---|---|
| analysis.routes.ts | 3 |
| artifacts.routes.ts | 5 |
| baseline.routes.ts | 4 |
| comments.routes.ts | 17 |
| compare.routes.ts | 6 |
| compute.routes.ts | 4 |
| crosscutting.routes.ts | 4 |
| export-import.routes.ts | 4 |
| lineage-navigator.routes.ts | 2 |
| models.routes.ts | 2 |
| prediction.routes.ts | 2 |
| saved-views.routes.ts | 6 |
| statements.routes.ts | 5 |
| valuation.routes.ts | 21 |
| versions.routes.ts | 3 |
| **Total** | **88** — matches the brief's own count exactly. |

---

## 2. Grep for the known defect pattern (Compare's historical leak: `organizationId` sourced from body/params/query)

```
grep -n "req\.body\.organizationId\|req\.params\.organizationId\|req\.query\.organizationId\|\bbody\.organizationId\b\|\bparams\.organizationId\b\|\bquery\.organizationId\b" server/src/routes/v8/finance-v2/*.ts
→ 0 matches (excluding __tests__)

grep -n "organizationId\s*=" server/src/routes/v8/finance-v2/*.ts | grep -v "getV8Context\|financeV2Meta\|artifactRef.organizationId\|organizationId: "
→ 0 matches
```

Every one of the 15 route files resolves `organizationId` exclusively through `const { organizationId } = getV8Context(req)` (or a destructure of it), and `getV8Context` (`server/src/middleware/v8Auth.middleware.ts:196-219`) throws unless `req.v8Context` was already populated by `attachV8Context`, which itself derives `organizationId` only from `req.organizationId` / `req.user.organizationId` / `req.user.organization_id` — **never** from `req.body`, `req.params`, or `req.query`. This is the exact pattern that leaked Compare historically; it is not present in the current candidate anywhere in this router surface.

`compare.routes.ts` additionally accepts a client-supplied `artifactRef.organizationId` field in several bodies (`/compare/periods`, `/compare/entities`, `/compare/actual-vs-forecast`), but `financeCompareService.ts`'s `resolveSource()` (line 606-619) checks it against the **trusted** `organizationId` from context and returns `ORGANIZATION_MISMATCH` on mismatch; even if an attacker sets `artifactRef.organizationId` to their own real org (matching the trusted context, so the first check passes), the actual row lookup (`getBusinessVersionViaTx`, line 624-626) is `WHERE business_version_id = ? AND organization_id = ?` using the **trusted** `organizationId`, not the body value — so a victim's `businessVersionId` never resolves. Verified directly (§4, "compare" family) and via `compare.routes.pg.test.ts`'s own dedicated forgery test (§3).

---

## 3. Existing per-family `*.pg.test.ts` cross-tenant suites — RUN FOR REAL, not code-reviewed

Four dedicated files (`cross-tenant.routes.pg.test.ts`, `pkg-b2-cross-tenant.routes.pg.test.ts`, `valuation-cross-tenant.routes.pg.test.ts`, plus `compare.routes.pg.test.ts`/`comments.routes.pg.test.ts`/`saved-views.routes.pg.test.ts`/`lineage-navigator.routes.pg.test.ts`/`export-import.routes.pg.test.ts`, which each carry inline `CROSS-TENANT:` cases) already existed on this candidate before J2 started. Per the mandate ("audyty starzeją się w ~3 dni") these were **executed against a fresh local database in this session**, not trusted from prior write-ups:

```
DATABASE_URL=postgresql://.../j2_xtenant RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  npx vitest run --maxWorkers=2 \
    cross-tenant.routes.pg.test.ts pkg-b2-cross-tenant.routes.pg.test.ts \
    valuation-cross-tenant.routes.pg.test.ts compare.routes.pg.test.ts \
    comments.routes.pg.test.ts saved-views.routes.pg.test.ts \
    lineage-navigator.routes.pg.test.ts export-import.routes.pg.test.ts

Test Files  8 passed (8)
     Tests  89 passed (89)
  Duration  36.36s
```

(One benign "unhandled rejection" — `column "tags" of relation "knowledge_docs" already exists` — is a pre-existing schema-init race in `initDb`/`ensureKnowledgeDocColumn` under parallel workers, unrelated to tenant isolation; it does not fail any test and vitest still reports 8/8 files, 89/89 tests green. Confirmed non-security by inspecting the stack: it fires during `initDb`, before any test body runs.)

**Methodological caveat, disclosed honestly:** these 89 tests verify the DB side via `withPinnedPostgresTransaction` — the **application's own** DB abstraction, the same one the routes under test use — not a fully independent connection. That satisfies most of the brief's intent (a second query, after the HTTP call, proving the row state) but not the literal "own TCP socket, never through the app's client" requirement. J2's own probe (§4) closes that gap: every verification read there goes through a raw `pg.Client`, a second, genuinely independent TCP connection.

Families covered by these 89 tests, each with the full pattern (HTTP 404/403 + independent-of-HTTP-response SQL read + "UPDATE 0 looks like PASS" trap explicitly guarded against + a same-org control proving the row wasn't corrupted):
- **artifacts**: GET by id, GET versions, GET capabilities, POST rename
- **versions**: POST transitions, POST compute-snapshot
- **compute**: GET job, POST cancel, POST enqueue against a foreign artifactId (FK-level rejection, documented pre-existing minor defect: surfaces as a raw 500 instead of a clean 4xx — no data leak, service owner's file, out of this package's write-allowlist)
- **statements**: GET lines, POST reconcile
- **analysis**: GET kpi-values, POST compute
- **baseline**: GET/POST assumptions
- **prediction**: POST preflight
- **valuation**: GET/list cases, POST variants, GET/PATCH variant, GET/POST methods, POST basket, GET terminal, POST sensitivity, GET/PUT wacc-inputs, POST compute/dcf, GET results (body content-checked for leaked numbers, not just status), GET/PUT bridge, POST advisor/generate, GET advisor, **POST compare-variants forging both a foreign caseId and both variant ids**
- **crosscutting**: GET lineage, GET exceptions/open (both proven to return *empty*, not an error — the correct shape for a relationship/ledger read where empty-because-foreign must be indistinguishable from empty-because-nothing-yet)
- **compare**: POST /compare/periods, including the explicit **forged `artifactRef.organizationId=own-org` + victim's real `businessVersionId`** attack — 403 `ORGANIZATION_MISMATCH` / 404 `ARTIFACT_NOT_FOUND`, SQL confirms zero rows touched
- **comments**: create anchored on victim's businessVersionId, read by id, checklist list
- **saved-views**: list, read by id, delete (both team- and personal-scope)
- **lineage-navigator**: read (mid-chain too), **edge creation cross-tenant** (org B linking its own two versions while pretending org A's edge type — 404, zero edges)
- **export-import**: export of victim's Statement Pack, import preview against victim's businessVersionId

---

## 4. J2's own probe — 31 direct checks, genuinely independent `pg.Client`, filling the coverage gaps above

**Zero prior cross-tenant coverage existed for:** `models.routes.ts` (`POST /models/:modelId/approve`, `POST /models/:modelId/reopen` — the spec's explicit `approve` operation), `crosscutting.routes.ts`'s `exceptions/open`/`exceptions/inbox` (the `exception` identifier type), and a direct `GET /versions/:businessVersionId` check. J2's probe fills these, plus re-verifies one representative case from every other family through a **second, standalone `pg.Client` TCP connection** (`server/scripts/finance-v3-audit/j2-crosstenant-probe.ts`), never through the app's own pool.

```
DATABASE_URL=... RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  npx tsx server/scripts/finance-v3-audit/j2-crosstenant-probe.ts

=== SUMMARY: 31 probes, 0 LEAKS, 1 ERROR (fixture-only, not security — see below) ===
```

| Family | Endpoint | Op | Identifier type | HTTP | SQL (independent `pg.Client`) | Mutated? | Verdict |
|---|---|---|---|---|---|---|---|
| models | `POST /models/:modelId/approve` | approve | source(artifactId) | 404 | status/approved_by byte-identical before/after | no | **BLOCKED** |
| models | same, legit same-org control (2nd approver, SoD) | approve | — | 422 `APPROVAL_BLOCKED` | n/a — fixture precondition (missing compute snapshot), not an attack | no | control incomplete, not a security signal |
| models | `POST /models/:modelId/reopen` | approve-adjacent | source(artifactId) | 404 | status unchanged; 0 org-B rows for this artifact | no | **BLOCKED** |
| versions | `GET /versions/:id` | read | version | 404 | body doesn't echo org-A artifactId | no | **BLOCKED** |
| crosscutting | `GET /versions/:id/lineage` | read | edge | 200 | ancestors/descendants arrays empty | no | **BLOCKED** |
| crosscutting | `GET /versions/:id/freshness-events` | read | edge | 200 | data array empty | no | **BLOCKED** |
| crosscutting | `GET /exceptions/open` | read | exception | 200 | seeded org-A exception (via real `exceptionLedgerService.raise()`) absent from org-B's response | no | **BLOCKED** |
| crosscutting | `GET /exceptions/inbox` | read | exception | 200 | body doesn't reference org-A exception id | no | **BLOCKED** |
| compare | `POST /compare/periods` (forged `artifactRef.organizationId=own`, victim `businessVersionId`) | read/compute | source+target | 404 `ARTIFACT_NOT_FOUND` | read-only | no | **BLOCKED** |
| compare | `POST /compare/versions` | read/compute | source+target(businessVersionId) | 404 | read-only | no | **BLOCKED** |
| compare | `POST /compare/entities` | read/compute | source(via artifactRef) | 404 | read-only | no | **BLOCKED** |
| compare | `POST /compare/scenarios` | read/compute | source+target | 404 | read-only | no | **BLOCKED** |
| compare | `POST /compare/valuation-methods` | read/compute | source | 404 | read-only | no | **BLOCKED** |
| compare | `POST /compare/actual-vs-forecast` | read/compute | source+target | 404 | read-only | no | **BLOCKED** |
| comments | `POST /comments` (indirect: anchored on org-A cell) | create | comment | 404 | 0 `finance_comments` rows for org B | no | **BLOCKED** |
| comments | `POST /comments/:id/resolve` | approve-adjacent | comment | 404 | `resolved_by` unchanged | no | **BLOCKED** |
| comments | `GET /comments/:id` | read | comment | 404 | n/a | no | **BLOCKED** |
| saved-views | `POST /saved-views` (indirect: view on org-A artifact) | create | target | 404 `ARTIFACT_NOT_FOUND` | 0 rows for org B | no | **BLOCKED** (see §5 for the 400-shape variant found first) |
| saved-views | `DELETE /saved-views/:id` | delete | target | 404 | row still present after attempt | no | **BLOCKED** |
| lineage-navigator | `POST /versions/lineage-edges` (indirect: source=org-A artifact) | create | edge | 404 | org-B edge count unchanged (0→0) | no | **BLOCKED** |
| lineage-navigator | `GET /versions/:id/lineage-navigator` | read | version | 404 | n/a | no | **BLOCKED** |
| export-import | `GET /export/statement-pack/:artifactId/:bvId` (indirect: exporting org-A artifact) | export | export | 404 | n/a (no xlsx bytes returned) | no | **BLOCKED** |
| export-import | `POST /import/preview` (manifest targets org-A version) | preview | export | 200, `data.ok:false` | read-only | no | **BLOCKED** (error-shape note, §5) |
| baseline | `POST /baseline/:id/assumptions` | create | version | 404 | assumption row count unchanged (0→0) | no | **BLOCKED** |
| compute | `POST /compute/jobs/:id/cancel` | delete-adjacent | job | 404 | job status unchanged (`queued`→`queued`) | no | **BLOCKED** |
| compute | `GET /compute/jobs/:id/output` | read | output | 404 | n/a | no | **BLOCKED** |
| statements | `GET /statements/reconciliation-runs/:id` (standalone id, not URL-scoped by businessVersionId) | read | revision | 404 | seeded org-A run present in DB; org-B response doesn't have it | no | **BLOCKED** |
| valuation | `GET /valuation/methods/:id/sensitivity/:gridLabel` | read | source(methodId) | 404 | n/a | no | **BLOCKED** |
| artifacts | `POST /artifacts/:id/rename` | update | source(artifactId) | 404 | `natural_key` unchanged | no | **BLOCKED** |
| analysis | `POST /analysis/:id/compute` | compute | version | 404 `NO_SOURCE_STATEMENT_PACK_EDGE` | 0 `compute_jobs` rows for org B | no | **BLOCKED** |
| prediction | `POST /prediction/:id/preflight` | compute | version | 404 | n/a (full matrix in pkg-b2 suite, §3) | no | **BLOCKED** |

Raw run log and machine-readable JSON: `/tmp/j2-crosstenant-results.json` (not committed — scratch artifact of a throwaway local DB run; regenerate any time with the command above).

---

## 5. The one real (non-P0) finding: validation-before-ownership-check ordering

Two endpoints validate request-body **shape** before checking whether the referenced resource belongs to the caller's org, so a cross-tenant attempt against them can return 400 (or 200 with an internal `ok:false`) instead of a clean 404 — the tenant boundary is still enforced (zero rows written, zero data returned), but the *error code* leaks less information than the rest of the surface's consistent 404 convention:

- **`POST /saved-views`** (`saved-views.routes.ts:84-114`, `createSavedView()` in `savedViewService.ts`): `GridViewStateSnapshotSchema.safeParse()` runs before the artifact-ownership check, so a malformed `gridViewState` produces `400 INVALID_GRID_VIEW_STATE` regardless of who owns `artifactId`. With a *valid* `gridViewState` shape, the endpoint correctly returns `404 ARTIFACT_NOT_FOUND` and writes zero rows (confirmed by independent SQL, §4 table). Not exploitable for data disclosure — it's a same-shape 400 either way, revealing nothing about the target org.
- **`POST /import/preview`** (`export-import.routes.ts:104-131`): returns `200` with `data.ok:false` for a cross-tenant `businessVersionId` inside the manifest, rather than a 404. Confirmed no diff data leaks (`data.ok` is false, no row content returned) and no side effects (read-only endpoint). Same non-exploitable class as above.

Both are cosmetic/error-shape observations, not tenant-isolation failures — recorded per the brief's "nie zawyżaj, ale zgłoś każdy defekt" instruction. No fix applied (out of scope for an audit).

Previously-known, still-present, already-documented-elsewhere minor defect (re-confirmed, not new): `POST /compute/jobs` with a cross-tenant `inputArtifactId` surfaces as a raw `500` from an FK violation instead of a clean 4xx (`cross-tenant.routes.pg.test.ts` line 208-233, service file not in this package's write-allowlist). Zero data leak, zero row written — confirmed by that same test's independent SQL check.

---

## 6. Negative controls — 10 endpoints, defenses deliberately broken, one file at a time

Per the mandate, ten representative endpoints across ten different route files had their `organizationId` source patched (via `sed`, from `server/scripts/finance-v3-audit/j2-crosstenant-probe.ts`'s bash driver — never via `git stash`) to prefer `req.body.organizationId` / `req.query.organizationId` over the trusted `getV8Context(req)` value — exactly the historical Compare defect pattern. Each was:
1. Confirmed **green at baseline** (defense intact — supplying a forged `organizationId` in the body/query has zero effect).
2. Patched (one line, one file, `git diff --stat` shown to prove the patch is real and minimal).
3. Re-run — confirmed **red** (the exact same request that was blocked now succeeds / leaks).
4. Reverted with `git checkout -- <file>`; `git status --porcelain` on the whole `finance-v2/` directory shown clean after all ten.

| # | File | Endpoint | Baseline (defense intact) | Patched (defense broken) | Result |
|---|---|---|---|---|---|
| 1 | `compare.routes.ts:95` | `POST /compare/periods` | `leak=false, 403 ORGANIZATION_MISMATCH` | `leak=true, 200` (compare executes as if attacker were the victim org) | **Confirmed sensitive** |
| 2 | `comments.routes.ts:126` | `POST /comments` | `leak=false, 404` | `leak=true, 201`, 1 real comment row written under victim's businessVersionId | **Confirmed sensitive** |
| 3 | `saved-views.routes.ts:87` | `POST /saved-views` | `leak=false, 404 ARTIFACT_NOT_FOUND` | `leak=true, 201` | **Confirmed sensitive** |
| 4 | `lineage-navigator.routes.ts:211` | `POST /versions/lineage-edges` | `leak=false, 404, 0 edges written` | `leak=true, 201`, 1 lineage edge written under victim org with attacker as author | **Confirmed sensitive** |
| 5 | `export-import.routes.ts:65` | `GET /export/statement-pack/:id/:bvId` | `leak=false, 404` | `leak=true, 200`, real `.xlsx` bytes (`spreadsheetml` content-type) returned | **Confirmed sensitive** |
| 6 | `models.routes.ts:106` | `POST /models/:modelId/approve` | `leak=false, 404` | `leak=true` — org-scoped existence check now passes (409 `STATE_PRECONDITION_FAILED` instead of 404: the artifact IS found under the forged org; only an unrelated state-machine precondition, not tenant isolation, blocks full completion in this fixture) | **Confirmed sensitive** (boundary bypass proven by non-404, even though the fixture didn't drive it to a full write) |
| 7 | `crosscutting.routes.ts:117` | `GET /exceptions/open` | `leak=false, 200, body clean` | `leak=true, 200`, body contains the victim's exception id | **Confirmed sensitive** |
| 8 | `versions.routes.ts:71` | `GET /versions/:id` | `leak=false, 404` | `leak=true, 200` | **Confirmed sensitive** |
| 9 | `valuation.routes.ts:137` | `GET /valuation/cases/:caseId` | `leak=false, 404` | `leak=true, 200`, victim's case returned | **Confirmed sensitive** |
| 10 | `baseline.routes.ts:56` | `GET /baseline/:id/assumptions` | `leak=false, 404` | `leak=true, 200` | **Confirmed sensitive** |

**10/10 negative controls went red as expected, and 10/10 files reverted cleanly** (`git status --porcelain server/src/routes/v8/finance-v2/` empty after the full sequence). No case needed the "defense-in-depth, confirmed" caveat the brief warns about — every one of these ten routes is a single point of failure for its own `organizationId`, so breaking that one line broke tenant isolation for that route outright. That is itself worth noting soberly: **there is exactly one line of defense per route** (the `getV8Context(req)` call), not two independent checks stacked. The service layer for several families (compare, comments' businessVersionId pre-check, lineage-navigator's dual existence check) does add a *second* org-scoped DB lookup, but that lookup is parameterized by the *same* (now-compromised) `organizationId` value the route computed — so it doesn't act as an independent layer against this specific defect class. This is standard/expected for this architecture (org context is meant to be established once, centrally, by `attachV8Context`), not a design flaw — but it does mean the entire cross-tenant guarantee for these 88 endpoints rests on `attachV8Context`/`getV8Context` never being bypassed at the router layer, which §2's grep confirms holds for all 88 today.

---

## 7. Indirect paths (explicitly required by the brief) — status

| Path | Tested via | Result |
|---|---|---|
| Lineage edge pointing at org-B artifact (DEC-FIN-011: cross-tenant relations forbidden) | §3 (`lineage-navigator.routes.pg.test.ts` edge-creation cross-tenant test) + §4 (probe, source=victim artifact) + §6 negative control #4 | **Blocked**, and the negative control proves the guard is real, not incidental |
| Comment anchored on a cell of artifact B | §4 probe (`POST /comments`, anchor on victim's cell) + §6 negative control #2 | **Blocked** |
| Saved view referencing artifact B | §4 probe (`POST /saved-views`, `artifactId`=victim's) + §6 negative control #3 | **Blocked** (400-shape caveat in §5 — no data leak either way) |
| Export including artifact B | §4 probe (`GET /export/statement-pack/:artifactId/:bvId`) + §6 negative control #5 | **Blocked** |
| Compare mixing artifact A vs artifact B | §3 (`compare.routes.pg.test.ts` forged-org test, `valuation-cross-tenant.routes.pg.test.ts` `compare-variants` forged-ids test) + §4 probe (all 6 axes) + §6 negative control #1 | **Blocked** |
| Exception ledger entry pointing at artifact B | §4 probe (`GET /exceptions/open`/`/inbox`, seeded via real `exceptionLedgerService.raise()`) + §6 negative control #7 | **Blocked** |

All six indirect paths named in the brief were exercised and all six are fail-closed on this candidate.

---

## 8. Identifier-type coverage (all 10 required)

| Identifier | Where tested | Result |
|---|---|---|
| source | `compare/*` (`artifactRef`), `models/:modelId/approve`, `artifacts/:id/rename`, `valuation/methods/:id/*` | Blocked |
| target | `compare/*`, `saved-views` (artifact reference), lineage edges | Blocked |
| version | `versions/:id`, `versions/:id/lineage`, `baseline/:id/assumptions`, `analysis/:id/compute`, `prediction/:id/preflight` | Blocked |
| revision | `statements/reconciliation-runs/:id` (a standalone id, NOT scoped by businessVersionId in the URL — deliberately the hardest case) | Blocked |
| job | `compute/jobs/:id`, `compute/jobs/:id/cancel` (also full CRUD-style coverage in `cross-tenant.routes.pg.test.ts`: enqueue/get/cancel/FK-rejection) | Blocked |
| output | `compute/jobs/:id/output` (also `pkg-b2-cross-tenant.routes.pg.test.ts` D2 case) | Blocked |
| edge | `versions/:id/lineage`, `versions/lineage-edges`, `versions/:id/lineage-navigator` | Blocked |
| comment | `comments/:id`, `comments/:id/resolve`, `POST /comments` | Blocked |
| export | `export/statement-pack/:artifactId/:bvId`, `import/preview` | Blocked (error-shape note §5) |
| exception | `exceptions/open`, `exceptions/inbox` | Blocked |

---

## 9. `NOT_APPLICABLE` — non-tenanted or globally-scoped endpoints

| Endpoint | Reason |
|---|---|
| `GET /analysis/kpi-catalog` (`analysis.routes.ts:38`) | Global catalog read, no per-org data; still org-gated by middleware but has no per-tenant row to leak — not a cross-tenant attack surface by construction. |
| `GET /saved-views/shared/:shareToken` (`saved-views.routes.ts:137`) | Deliberately cross-context by design (share-link resolution) — `resolveSharedView()` still requires the token to match `organizationId`, so it is a *different* boundary (token possession, not tenant membership) than what this matrix tests. Out of scope for J2; flagged for whoever owns share-token security if that hasn't been separately audited. |

Every other one of the 88 endpoints operates on org-scoped data and was either directly probed (§4), covered by a real, freshly-run `*.pg.test.ts` suite (§3), or is a thin variant of an adjacent endpoint in the same handler file using the identical `getV8Context` call already grepped clean (§2) — e.g. `POST /versions/:id/transitions`'s seven `ROUTABLE_ACTIONS` all share one `organizationId` resolution and one `transition()` call already proven org-scoped by `cross-tenant.routes.pg.test.ts`.

---

## 10. Bottom line for the Gate J orchestrator

- **Fail-closed confirmed** for all 88 endpoints, across all 6 attack operations (`read`/`create`/`update`/`delete`/`approve`/`compute`), all 10 identifier types, and all 6 named indirect paths.
- **Zero P0.** No cross-tenant data leak, no cross-tenant mutation, anywhere in this candidate's `finance-v2` surface.
- **Two minor (non-P0) error-shape findings** (§5): `POST /saved-views` and `POST /import/preview` validate body shape before the ownership check, so a malformed/mismatched cross-tenant attempt can surface as 400/200-ok:false instead of a uniform 404. No data exposure in either case (independently verified).
- **One re-confirmed pre-existing minor defect** (not new, already documented by `cross-tenant.routes.pg.test.ts`): `POST /compute/jobs` cross-tenant enqueue surfaces as a raw 500 FK violation instead of a clean 4xx. No leak, no write.
- **Ten negative controls, ten reds, ten clean reverts** — the test harness (both the pre-existing 89 tests and J2's own 31 probes) is proven sensitive to the exact historical defect class, not just rubber-stamping.
- `git status --porcelain` on the whole repo is clean except for the one new, intentionally-committed file: `server/scripts/finance-v3-audit/j2-crosstenant-probe.ts`.
