# F2-3 PMO E3 R2 — independent re-review

**Verdict: REQUEST_CHANGES. The five PMBOK-lite gates now work on PostgreSQL after the normal application bootstrap, but the complete package still fails on a fresh canonical database and the final Polish screen exposes English readiness criteria.**

## Identity

- reviewed candidate: `34a8711abdcc827c7f8baaee0c2d9cae8d52aaa2`;
- implementation SHA from the author manifest: `4be756f1a8de787203a111766a22f53e574de588`;
- base: `f9239fe307882d5a54c2251b5f631b4a173e702e`;
- author backup was independently read back at the exact candidate SHA: `refs/heads/backup/codex/pmo-projekty-role-statusy-20260913-r2-20260914`;
- review covered CTO entries 20, 27, 31 and 32. Product code was not changed.

## Blocking findings

### P1 — `/projects` creation does not work on the canonical fresh-database path

A fresh PostgreSQL 18 database on the reviewer-owned container passed the strict migration chain. The chain does not create `projects.current_phase`, `project_members.normalized_project_role`, or `projects.goal`. The production startup path in `server/src/index.ts` awaits `initializeDatabase()`, which repairs the first two columns through the existing runtime initializers. After that exact bootstrap, all five stage-gate tests pass. It does not repair `projects.goal`.

The full E2 Gateway/RealPG test then fails at the package's real `POST /api/pmo/projects`: `ProjectController` inserts `goal`, PostgreSQL returns `42703 column "goal" of relation "projects" does not exist`, and the API returns 500 instead of 201. The remaining E2 tests fail consequentially because the project was not created. This is a source/schema contract defect in the delivered project-creation scope, not a mock or an assertion mismatch. The current staging-shaped database can hide it because that database already has the column.

Required correction: make the project creation contract compatible with the canonical migrated schema, or obtain CTO approval for an additive schema repair. The final RealPG proof must start from strict migrations, run the actual application bootstrap, then pass the complete E2 test file without hand-added columns.

### P2 — the final Polish UI is not localized completely

Both final browser captures show Polish chrome but the missing-criteria sentence contains the English backend literals `All axes assessed, Gap analysis reviewed`. `stageGateService.ts` returns English display sentences as `criterion` and `missingElements`; `ProjectStageGatesPanel.tsx` renders `missingElements.join(', ')` directly. This violates the required EN+PL behavior on the exact final screen. Return stable criterion keys and localize them in the client, or otherwise provide equivalent complete EN+PL rendering. Refresh both final captures after the fix.

## Previous blockers rechecked

- CLOSURE uses the real TEXT shape of `decisions.required`; there is no text-to-integer comparison.
- KPI readiness uses `project_kpis` plus `initiative_kpis` joined to `kpi_measurements`; it does not query the nonexistent `kpi_results` table.
- A forced missing-relation probe returned HTTP-domain error code `STAGE_GATE_CRITERION_QUERY_FAILED`, status 500, rather than `NOT_READY`.
- After the normal production bootstrap, fresh RealPG passed all five negative readiness states, all five passages, five persisted receipts, and final phase `Stabilization`.
- Budget is positive end to end: UI minimum `0.01`, Zod `.positive()`, zero rejected by test.
- The approved migration remains additive: one `stage_gates` table, five gate types, project FK with cascade, two indexes. Strict migrations passed once from empty and a second run reported `Applying migrations: 0`.
- Evidence before this review artifact measured 1,040,887 bytes in 31 files. Final light/dark hashes match the manifest. `git diff --check` is green.
- `/projects` is a real view when `VITE_PMO_PROJECTS === 'true'` and redirects to `/my-work` when absent or malformed. The flag defaults OFF.
- Static and focused behavior confirm canonical `StandardTable`/`StandardPreview`, roles and allocations, project-role authorization, foreign-tenant 404, English and Polish locale JSON, and no new `primary-*`, crimson, hex chrome color, `review_requested_at`, `RESOURCE_RESPONSIBILITY`, or dead initiative-status literal in the package delta.
- Gate passage is keyed by the five gate types and current phase. The package does not add H1b transition proposals or replace a governance gate with a status-code comparison.

## Fresh validation

- non-PG test files from the delta: 9/9 files, 23/23 tests PASS, retry 0;
- E3 RealPG after production bootstrap: 3/3 files, 5/5 tests PASS, retry 0;
- full E2 Gateway/RealPG: 1/5 PASS, 4/5 FAIL, first failure is the missing `projects.goal` column described above;
- server TypeScript: PASS, zero diagnostics;
- frontend esbuild per changed production file: 8/8 PASS;
- exact image SHA-256: 2/2 match;
- author backup readback: exact candidate SHA;
- repository diff check: PASS.

The candidate must not enter integration at this SHA. The runtime-bootstrap dependency for `current_phase` and normalized project roles is understood and proven; the remaining `goal` schema gap and visible Polish localization defect are the release blockers.
