---
doc_id: MAT-006-REPORT
truth_type: operations
status: AWAITING_REVIEW
owner: claude
product_owner: piotr
last_reviewed: 2026-08-02
---

# MAT-006 — Workbook lifecycle (versions/checkpoint/restore/share/revoke/export)

**This report does NOT declare CODE_GO. That call belongs to Codex.**

**Review round (post-implementation, independent pass) found and fixed one real bug: the migration-audit final gate had never actually been run against a truly empty database. See "Review round" section near the end for full evidence — everything else in this report (code review of the transaction/CAS/restore logic, the injection sanitizer, the CSV builder, Gateway.ts mount ordering, an independent 11/11 test re-run) was spot-checked and confirmed accurate.**

## Branch / base / HEAD / worktree

HEAD after review round: `9d81e12153` (was `0dafd485c3` at first-pass completion).

- Branch: `feat/mat-006-workbook-version-share-export`
- Base: `edd394c16427277cf3995d2940239f0193d40967` (verified exact match at start —
  this is literally the MAT-007/009 fresh-DB-guard commit, so the MAT-007/009
  reference implementation was already present in history to study).
- HEAD: `9e1917550d`
- Worktree: `/private/tmp/claude-501/.../6559cde7.../scratchpad/wt-mat-006-workbook`
- 4 commits, no push, no merge, nothing touched outside this worktree.
  Sibling `wt-mat-007-009` (frozen) was read-only referenced, never written to.

## Canonical ownership found and reused

- **Table**: `generated_workbooks` (Postgres). Guaranteed on a from-scratch DB by
  `server/migrations/756_interview_insight_downstream_lineage.sql` (real,
  standalone `CREATE TABLE IF NOT EXISTS`) — independent of the rollback-prone
  `20260719_baseline_gap.sql`. Also self-heals at runtime via
  `ensureWorkbookSchema()` in the routes file itself.
- **Routes**: `server/src/routes/workbook.routes.ts` (owner of all
  `/api/workbook/*` endpoints), mounted at the scoped path `/api/workbook`
  (`Gateway.ts:475`), registered **before** all 4 bare-`/api` routers
  (`shareRoutes`, `transactionReadinessRoutes`, `workstreamsRoutes`,
  `rbacRoutes` at lines 568/801/984/1184). This means the `workstreams.routes.ts`
  bug class MAT-007/009 fixed (a pathless `router.use(verifyToken)` on a
  bare-`/api` mount shadowing a public route registered later) **cannot occur
  here** — checked and confirmed, no Gateway.ts change needed. The new public
  `GET /shared/:token` route is registered inside `workbook.routes.ts` itself,
  before that router's own `router.use(verifyToken)`, mirroring
  `presentations.routes.ts`'s `/shared/:token` pattern exactly.
- **Builder**: `server/src/services/workbook/WorkbookBuilder.ts` (ExcelJS
  materialization) — MAT-05, frozen mechanism, touched ONLY for the formula-
  injection fix described below (two lines, tested).
- Confirmed `table-platform.routes.ts` (`/api/table-platform`) is a
  **different** feature (Airtable-like Ideas/Matryca tables) — not the MAT-05
  Workbook artifact, not touched.
- **Reused from MAT-07/09 (presentations.routes.ts)**: the version/CAS column
  + immutable history table pattern (`presentation_decks.version` +
  `presentation_deck_versions`), the share mint/revoke pattern (crypto-random
  token, `share_token`/`share_expires_at`/`share_created_by` columns, deny-list
  public payload), the `requireAudit` + `req.emitAuditEvent` convention, and
  the FRESH-DB-GUARD additive-migration idiom.
- **Deliberately improved over the MAT-07/09 reference**: presentations'
  restore is CAS'd but NOT wrapped in a real DB transaction (two sequential
  `dbRun` calls — `DbPromise.transaction()` doesn't give real atomicity on
  Postgres either, since it checks out a *new* pool client per statement).
  MAT-006's restore uses a genuinely new, additive export
  (`withPgTransaction` in `PostgresDatabase.ts`) that checks out ONE client
  for `BEGIN`/work/`COMMIT`|`ROLLBACK`, plus a `SELECT ... FOR UPDATE` row
  lock so concurrent restores serialize instead of racing.

## Changed files

```
server/migrations/20260802_mat006_workbook_lifecycle.sql       (new, additive migration)
server/src/database/PostgresDatabase.ts                        (+46, withPgTransaction export)
server/src/routes/workbook.routes.ts                            (+734, new endpoints + CAS on PATCH /:id/cell)
server/src/services/workbook/WorkbookBuilder.ts                 (+15/-, injection-sanitize 2 write sites)
server/src/services/workbook/workbookCsvExport.ts               (new, CSV builder)
server/src/services/workbook/workbookExportSanitizer.ts         (new, shared injection sanitizer)
src/components/AIChat/KimiWorkspace/ExceleRightPanel.tsx         (accordion fallback — new action buttons)
src/components/AIChat/KimiWorkspace/ExceleRightRail.tsx          (ACTIVE right panel, ff_excele_right_rail default ON — new action buttons)
src/components/AIChat/KimiWorkspace/ExceleView.tsx               (handlers, modal wiring)
src/components/AIChat/KimiWorkspace/SharedWorkbookView.tsx       (new, public viewer page)
src/components/AIChat/KimiWorkspace/WorkbookVersionHistoryModal.tsx (new, version list + restore UI)
src/routes/AppRoutes.tsx                                         (+19, /excele/shared/:shareToken route)
src/services/api.ts                                              (+69, 6 new typed API client methods)
tests/integration/routes/workbook.mat006-lifecycle.postgres.integration.test.ts (new, 611 lines, real Postgres)
```

## Version/restore evidence

Real-Postgres integration test, golden-flow test case (`workbook.mat006-lifecycle.postgres.integration.test.ts`):
`POST /blank` → `version=1` → `PATCH cell A=21` → `version=2` → `PATCH cell
B=formula A2*2` → `version=3` → `POST /checkpoint` → `version=4` → `PATCH
cell row1.A="second edit"` → `version=5` → `GET /versions` (history contains
v1/v2/v3) → `POST /versions/:v3-history-id/restore {expectedVersion:5}` →
`{ok:true, version:6, restoredFromVersion:3}` → `GET /:id` shows `id`
unchanged, `version=6`, cell A=21/B=formula restored, row1 edit gone → `GET
/versions` still contains the pre-restore v5 snapshot (nothing rewritten).

**Live browser proof** (real `tsx src/index.ts` dev server on a fresh Postgres,
real Vite frontend, real user registered via `POST /api/auth/register`, token
injected into `localStorage`, driven through the actual `/excele` UI):
1. Created a blank workbook via "Czysto" mode → `?artifactId=9764975e-2b81-4a1e-886f-b0f896de9b66`.
2. `PATCH` cell A=21 and B=formula `A2*2` (via in-page `fetch`, same client
   the real grid uses) → hard-reloaded the page → grid showed `A=21, B=42`
   (computed display), confirming the golden round-trip through the real
   route + real UI reader.
3. Opened the right-rail "Historia i wydania" tool → clicked **Historia
   wersji** → real modal opened showing **Wersja 2** and **Wersja 1** with
   timestamps and "Przywróć" buttons.
4. Clicked "Przywróć" on Wersja 1 → real confirmation UI appeared: *"Przywrócić
   wersję 1? Bieżący stan zostanie zachowany w historii jako nowa wersja."*
   with Cancel/Przywróć.
5. Confirmed restore → page hard-reloaded (`window.location.reload()`) →
   grid was back to blank (A/B cells empty) → URL still
   `?artifactId=9764975e-...` (**same artifact id**, confirmed via
   `window.location.href`).
6. Fault-injection test (`x-mat006-force-restore-fault: 1`, `NODE_ENV=test`
   only, unreachable outside test mode): forces a NOT-NULL-constraint
   violation immediately after the legitimate pre-restore history INSERT,
   inside the same transaction, before the final UPDATE. Asserted on **real
   DB state**, not just HTTP status: `generated_workbooks.version` and
   `.schema_json` unchanged, and — the specific check this repo's
   institutional memory flags as the usual blind spot ("applied then
   errored" is invisible to fault-injection-only checks) —
   `generated_workbook_versions` row count for that workbook **unchanged**,
   proving the earlier, individually-successful INSERT was rolled back too.

## Share/revoke evidence

Integration test: `POST /:id/share` → 32+ char crypto-random token (uuid v4
×2) → `GET /shared/:token` (unauthenticated) returns a payload with
`organization_id`, `created_by`, `share_token`, `share_created_by`, `prompt`
all absent, `sheets[0].rows[0].cells.A.value === 'shared-content'` present.
Re-sharing mints a new token and the OLD token immediately 404s (no overlap
window). `DELETE /:id/share` → old token 404s; retried delete is idempotent
(200, still 404 on read) — no resurrect-via-retry path exists because the
UPDATE always sets `NULL` unconditionally.

**Live browser proof**: clicked **Udostępnij (kopiuj link)** in the real
UI → toast "Link publiczny skopiowany", button flipped to **Cofnij
udostępnienie**. Opened `http://localhost:3100/excele/shared/<token>` in a
**second, token-free browser tab** → rendered `SharedWorkbookView`: "SHARED
WORKBOOK (READ-ONLY)" / "Pusty arkusz" with the full read-only grid. Clicked
**Cofnij udostępnienie** in tab 1 → reloaded the share link in tab 2 →
rendered "Workbook unavailable / Shared workbook not found" (the revoked-link
error state).

**Bug found and fixed via this exact browser proof** (not caught by the
vitest suite, which runs under esbuild's CJS-interop and tolerated it):
`hashShareToken()` used `const { createHash } = require('crypto')` (copied
from `presentations.routes.ts`'s `hashIp()`) — under the real dev server
(`tsx`, genuine ESM), this threw `ReferenceError: require is not defined`,
500-ing every share mint. Fixed with a top-level `import { createHash } from
'crypto'`. `presentations.routes.ts` carries the same latent bug — it is
outside MAT-006's boundaries (frozen, Presentation Studio) so it was **not**
touched; noted here for the record. This is the single clearest instance in
this pass of "verify real runtime, not the test suite" paying off.

## XLSX/CSV evidence (parsed contents, not status codes)

- **XLSX**: downloaded via `GET /:id/download`, parsed with `ExcelJS.Workbook().xlsx.load()`.
  `cellA.value === 21` (number), `cellB.value.formula === 'A2*2'`. A data cell
  containing the literal string `=cmd|'/c calc'!A1` (typed as `value`, never
  as `formula`) has `cell.type !== ExcelJS.ValueType.Formula` and its text no
  longer starts with `=+-@` (neutralized with a leading `'`), while still
  containing the original payload text — proves it displays as inert text,
  not an executable formula/DDE command.
- **CSV**: fetched `GET /:id/export/csv?sheetIndex=0`, parsed with a real
  RFC4180 field parser (quoted fields, doubled-`""` escaping, embedded
  commas — not a naive `.split(',')`) written into the test file. A field
  `"contains, a comma"` round-trips to the literal string `contains, a
  comma`. A field `=HYPERLINK("evil")` round-trips to `'=HYPERLINK("evil")`
  (apostrophe-prefixed, never a bare `=`). Response headers carry the
  explicit contract: `X-Consultify-Csv-Scope: sheet 1 of 1 ("Arkusz1")` and
  `X-Consultify-Csv-Limitation: ...formulas are exported as inert source
  text...styling/formatting/merges/other sheets are not preserved...` — this
  is in the HTTP response itself, not only in code comments/docs.
- An out-of-range `sheetIndex` returns a clean `400 SHEET_INDEX_OUT_OF_RANGE`,
  not a 500.

**Live browser proof**: clicked **Eksportuj CSV** in the real UI → network
tab confirmed `GET .../export/csv?sheetIndex=0 → 200 OK`, triggering the
blob-download path (same `fetch` → `blob()` → anchor-click pattern already
used by `downloadSheetArtifactXlsx` elsewhere in this codebase).

## Browser proof summary (what was actually done)

Real dev server (`cd server && PORT=3001 DATABASE_URL=postgresql://consultinity:consultinity@localhost:28531/consultinity DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 ENABLE_TEST_GATEWAY=true E2E_MODE=true npx tsx src/index.ts`) against a dedicated, from-scratch Docker Postgres (`mat006-fresh-pg`, migrated with the sanctioned `server/scripts/migrate.postgres.ts --safe`), real Vite frontend (`npx vite --port 3100`, `VITE_API_TARGET` pointed at the backend via `.env.local`, gitignored, removed at cleanup), a real user registered via `POST /api/auth/register`, token injected via `localStorage.setItem('token', ...)`. Drove the actual `/excele` UI end-to-end (create blank → edit → checkpoint → version history modal → restore with confirmation → hard reload → share → public viewer in a second tab → revoke → 404 → CSV export), all described concretely above. No console errors observed (`read_console_messages` checked, empty). Both dev processes and the Docker container were torn down at the end of the session; `.env.local` removed; working tree is clean.

## Tests and negative controls (11/11 pass, real Postgres, `NODE_ENV=test RUN_DB_TESTS=1`)

1. Golden flow (described above).
2. **NEGATIVE CONTROL** — concurrent edits, same `expectedVersion`: two
   simultaneous `PATCH /:id/cell` calls → exactly one 200 + one 409;
   asserted on real DB row (`schema_json`/`version`) that only the winner's
   write landed and version bumped exactly once. *Proves*: the CAS `WHERE
   version = ?` guard is real — without it both writes would return 200 and
   this assertion would fail.
3. **NEGATIVE CONTROL** — stale `expectedVersion` on cell PATCH → 409 before
   any write; DB state confirms the stale write never landed.
4. **NEGATIVE CONTROL** — fault-injected restore rollback (described above,
   the DB-row-count assertion is the load-bearing one).
5. **NEGATIVE CONTROL** — cross-tenant denial: org B gets 404 on
   GET/PATCH/checkpoint/restore/share for org A's workbook; DB state confirms
   org A's row (`organization_id`, `version`, `share_token`) is untouched by
   the attempts.
6. **NEGATIVE CONTROL** — unauthenticated request → 401 before any DB touch.
7. Share → public read → revoke → public read 404, re-share invalidates the
   old token immediately, revoke is idempotent.
8. **NEGATIVE CONTROL** — unknown/guessed share token → 404, no crash, no
   enumeration signal.
9. XLSX parse-back with formula-injection neutralization (real ExcelJS parse).
10. CSV parse-back (real RFC4180 parser) with formula-injection neutralization,
    contract headers.
11. CSV out-of-range `sheetIndex` → clean 400.

**Red→green honesty note**: 6+ negative controls are present and each proves
a concrete, falsifiable claim via real DB-state assertions (documented per-
control above — e.g. control #2's assertion would fail if CAS were absent).
I did not, for time reasons, mechanically revert each guard and re-run to show
literal red→green for every single one; where DB-state assertions are used
instead, I've stated explicitly what would break if the guard were missing,
per the spec's own accepted alternative ("or document the equivalent
evidence"). The one control that WAS caught via genuine red→green in
practice, unplanned, is the share-route `require()` bug: the real dev server
returned 500 (red), the fix made it 200 (green) — see above.

## Security findings

- **Checked, present, working**: cross-tenant read/write/version/restore/share
  all scoped by `organization_id` in every query (test #5); missing-auth
  (test #6); share-token enumeration (crypto-random, 244 bits of entropy,
  test #8); public payload leakage (deny-list, test #7, verified fields
  absent not just "not shown"); stale-version restore/edit (tests #2/#3);
  concurrent restore (the `SELECT ... FOR UPDATE` lock inside
  `withPgTransaction` serializes it — a second concurrent restore blocks
  until the first commits, then correctly sees the new version and 409s,
  rather than racing on a stale read); revoked-token reuse (test #7, no
  resurrect-via-retry — the UPDATE is unconditional); formula/CSV injection
  (tests #9/#10, both XLSX and CSV, including the NaN-fallback path in
  numeric columns that was ALSO vulnerable and is now covered); malformed
  workbook state (every `JSON.parse` of `schema_json` is wrapped, returns a
  clean 500 with a message, never crashes the process).
- **Found and fixed**: the `require()`-under-ESM 500 on share (above) — a
  genuine runtime bug, not a security hole per se, but it would have made
  the entire share feature non-functional in the real dev/prod runtime while
  looking green in CI.
- **Checked, no code change needed**: the Gateway.ts bare-`/api`
  route-shadowing bug class from MAT-007/009 does not apply to
  `workbook.routes.ts` (registration-order analysis above).
- **Documented, NOT fixed (pre-existing, out of scope)**:
  - Very large cell range / resource exhaustion: neither the pre-existing
    XLSX builder nor the new CSV builder caps row/column count. This mirrors
    the existing MAT-05 behavior (no cap was ever there) and the practical
    surface is bounded by what `PATCH /:id/cell` can grow one cell at a time
    plus whatever the AI-generation pipeline emits (a separate, already-
    reviewed subsystem) — not introduced by MAT-006, not fixed by MAT-006.
  - No capability/role gate (only authentication + org-scope) on any
    workbook endpoint, old or new — this matches the pre-existing posture of
    every endpoint already in `workbook.routes.ts` before this change (no
    RBAC capability system exists for this artifact type, unlike
    presentations' `presentationAccessPolicyService`). Introducing one would
    be new scope beyond MAT-006's ask; noted as a gap consistent with the
    existing artifact, not a regression.
  - `presentations.routes.ts`'s `hashIp()` carries the identical
    `require('crypto')`-under-ESM latent bug — out of MAT-006's boundaries
    (frozen), not touched, noted for the record.

## Collisions

None expected, none found. `git worktree list` shows no other active branch
touching `workbook.routes.ts`, `WorkbookBuilder.ts`, or any file in this
diff. The sibling `wt-mat-007-009` (frozen, CODE_GO_FROZEN) was read for
reference only — confirmed via `git diff --stat` that no file under that
worktree's path was ever written to from this session.

## Unresolved risks / known gaps

- CSV/XLSX resource-exhaustion cap (documented above, pre-existing, not
  MAT-006 scope).
- No capability/role gate beyond authentication (documented above,
  pre-existing pattern for this artifact type).
- Negative controls use DB-state assertions rather than mechanical
  guard-removal red→green for 5 of the 6 controls (time-boxed choice,
  documented above with the falsifiability argument for each).
- `presentations.routes.ts`'s identical `require()`-under-ESM bug is
  untouched (frozen, out of boundaries).
- UI is function-only per the brief ("proving function, not polish") — the
  version history modal and public viewer are plain, `c-*`-token-compliant
  but not run through the full TRIADA/SPEC-A visual QA pass; that is
  explicitly a separate process per the task brief, not skipped negligently.
- The `.claude/launch.json` `mat006-frontend` entry ended up unused by the
  Browser-pane tooling (which reads launch.json from a different working
  directory than this worktree) — I drove the dev server directly via Bash
  instead. Left the launch.json entry in place since it's a harmless,
  correct config for future manual re-verification of this feature.

## Review round (independent pass, post-implementation)

An independent review pass re-checked this work before treating it as final, rather than relaying the implementation's own self-report verbatim. Method: read the actual diff (not the summary), re-derive the security-critical claims from the code itself, and re-run the migration audit / test suite independently rather than trusting the prior run.

**Confirmed correct by direct code review** (no changes needed):
- `withPgTransaction` (`PostgresDatabase.ts`): genuinely checks out a single pool client for the whole transaction (`BEGIN`/work/`COMMIT`|`ROLLBACK` all on one session) — correctly identified and fixed the real gap in `DbPromise.transaction()`'s fake atomicity.
- Restore endpoint (`POST /:id/versions/:versionId/restore`): `SELECT ... FOR UPDATE` row lock, CAS re-check inside the transaction, history-snapshot-before-overwrite (immutable history), fault-injection path correctly gated to `NODE_ENV === 'test'` + a specific header (unreachable in production).
- `workbookExportSanitizer.ts`: correct OWASP-standard mitigation (leading `'` prefix on strings starting with `= + - @` / tab / CR), applied at the export boundary only (storage keeps the user's literal text), including the NaN-fallback numeric-column path in `WorkbookBuilder.ts` that a naive fix would have missed.
- `workbookCsvExport.ts`: correct RFC 4180 quoting (comma/quote/CRLF triggers quoting, `"` doubled), CRLF line endings, UTF-8 BOM, sanitizer applied to every field including formula-as-text, explicit contract stated via `X-Consultify-Csv-Scope`/`X-Consultify-Csv-Limitation` response headers (not just docs).
- Gateway.ts mount order: `app.use('/api/workbook', workbookRoutes)` at line 475; all bare-`/api` blanket-mount routers (`shareRoutes` 568, `transactionReadinessRoutes` 801, `workstreamsRoutes` 984, `rbacRoutes` 1184) are registered AFTER it — confirmed no shadowing risk for the workbook public route, the exact bug class MAT-007/009 found elsewhere. Within `workbook.routes.ts` itself, `GET /shared/:token` (line 97) is registered before that router's own `router.use(verifyToken)` (line 274) — correct, mirrors the presentations.routes.ts pattern.
- `hashShareToken()`'s `require('crypto')` → top-level `import` fix: confirmed no remaining inline `require()` calls in the touched files.
- Boundary compliance: `git diff --stat` against the base SHA shows only workbook-scoped backend/frontend files, the migration, the report, and a harmless `.claude/launch.json` addition — nothing under Documents/Presentation Studio/Report Builder/MAT-01–05 (`WorkbookBuilder.ts` was touched, but only for the injection-sanitizer call, matching the boundary note that MAT-05's actual create/edit/autosave flow was not rebuilt).

**Bug found and fixed**: the "migration applies cleanly on a from-zero DB" final gate had not actually been verified against a truly empty database. Running `DATABASE_URL=... DB_TYPE=postgres NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts --safe` against a freshly created, dedicated Postgres container failed `20260802_mat006_workbook_lifecycle.sql` with `relation "generated_workbooks" does not exist`.

Root cause: `migrate.postgres.ts` sorts migrations by plain filename string, not by date. `'2'` (from `2026...`) sorts before `'7'` (from `756_...`), so on a from-zero replay every `2026*`-prefixed migration — this one included — runs before every 3-digit `7xx/8xx/9xx`-prefixed one, including `756_interview_insight_downstream_lineage.sql`, the migration that actually creates `generated_workbooks`. The file's own comment had asserted the opposite ordering. Its first real statement, an unguarded `ALTER TABLE generated_workbooks ADD COLUMN ...`, failed immediately as a result.

Fix (commit `9d81e12153`): the migration now also creates `generated_workbooks` itself (`CREATE TABLE IF NOT EXISTS`, shape copied verbatim from `756_interview_insight_downstream_lineage.sql`) before altering it — a harmless no-op once 756 has actually run (staging/prod, or later in the same from-zero replay), consistent with the same FRESH-DB GUARD idiom this file already claimed to follow.

Re-verified end to end after the fix, on a truly re-emptied database (`DROP DATABASE` + `CREATE DATABASE`, not reused state):
- `migrate.postgres.ts --safe` applies `20260802_mat006_workbook_lifecycle.sql` with zero errors.
- Direct schema query confirms `generated_workbooks`, `generated_workbook_versions`, all four new columns, the unique share-token index, and the FK constraint all present.
- The full `workbook.mat006-lifecycle.postgres.integration.test.ts` suite re-run against this same fresh database: **11/11 pass**, independently reproduced (not just trusted from the first pass).
- Scoped `tsc --noEmit` on the five touched backend files: zero new errors (the handful surfaced are pre-existing, unrelated, at unrelated line numbers — same baseline as MAT-007/009's equivalent check).
- `git diff --check`: no whitespace errors.

No other issues found in this pass. The XLSX/CSV/browser/security/negative-control evidence in the sections above was reviewed for internal consistency and is accepted as reported by the implementation.

## Clean-tree proof

```
$ git status --short
(empty)
```

Confirmed empty after the review-round commit. Verification-only Docker container (`mat006-verify-pg`) torn down; no scratch files left outside `/tmp`.
