# F2-2 Realizacja E2 Praca — exact-SHA independent review

**Verdict: ACCEPT for candidate `e9879d2850d09b0650be68b60bc63026deb4e7f8` on base `29d1db9f00793dab6aeac5f68656200cddf9e529`.**

## Scope and integrity

- Review was performed on the clean `codex/realizacja-cztery-przyciski-20260913` worktree. No implementation file was changed by the reviewer.
- `E2_FREEZE_MANIFEST.json` contains 62 entries. Every byte count and SHA-256 matches the corresponding Git blob at content commit `ce44aa8edcccc52564a69364b49c6e64d7cad50d`; that commit is the direct parent of the frozen candidate.
- Retained `evidence/f2-2-realizacja` is 1,060 KiB, below the 2 MiB package cap. The sparse worktree intentionally omits older `e0-e1` working-tree paths; all four omitted files remain present and hash-correct in the candidate Git tree.
- No migration is included.

## Behavioral evidence

- All 14 test files changed by the candidate were run individually with `npx vitest run <file> --retry=0`: **97/97 tests PASS**.
- PostgreSQL 18 evidence used package-owned `cx-s4-e2-pg` on port 5290, database `consultify_s4`, with `DB_TYPE=postgres`, `RUN_DB_TESTS=1`, and `MOCK_DB=false`: **2/2 files, 5/5 tests PASS** through ApiGateway and signed JWTs.
- The real database tests prove one durable weekly snapshot under concurrent requests (HTTP 201/200, one row, identical persisted receipt), weekly and on-demand generation, project-name lineage, governed manager resource mutation with audit readback, rejection for an unauthorized member, and protection of the adjacent legacy writer.
- Source review confirms that all work-state reads and persisted snapshot lookups are scoped by the JWT-derived organization ID. The client cannot submit generated report content.
- The three contractual windows are calculated from one Monday boundary: previous week, next week, and next 30 days. Completed work uses completion time. Missing owner/date and blocked/overdue states remain explicit reasons rather than fabricated measurements.
- `executionCaseVersion: null` renders descriptive missing-data copy instead of `v—`.
- Frontend and server gates remain default OFF. The frontend flag test proves implicit OFF plus explicit opt-in/opt-out; the real API test proves HTTP 404 while the server gate is OFF. The scheduler may be registered, but its tick exits without work unless explicitly enabled.

## UI canon

- The full `ExecutionHub` shell uses `StandardModuleBar`; management attention uses the real `StandardTable` row kebab and `StandardPreview` with header, meta, details, relations, What's next, canonical action pills, and preview kebab.
- Row actions expose only backed capabilities: Open source record, Escalate, Delegate, Change resources, and Open preview. No invented edit/archive/delete action is present.
- Status, priority, reason, type, project, and owner values use human-facing EN+PL labels or canonical names. The mounted canon test proves that a raw owner ID is absent.
- No new `primary-*`/crimson usage or native `<select>` appears in the reviewed production UI delta.
- Visual inspection passed for three full-Hub 1440×1200 captures: EN light, EN dark, and PL dark. The selected preview is open, project and owner names are readable, and the author browser receipt records zero console, page, and HTTP errors.

## Build and static gates

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p server/tsconfig.json --noEmit --pretty false`: **exit 0**.
- Focused esbuild of `executionWorkAnalysisService.ts`, `ExecutionHub.tsx`, and `WorkIntelligenceReport.tsx`: **3/3 exit 0**.
- Production Vite build with `dev-render/vite.execution-work-analysis.config.ts`: **exit 0**. It retains inherited CSS/chunk warnings and does not turn those warnings into an S4 acceptance claim.
- Duplicate JSON keys: EN 0, PL 0. `git diff --check`: PASS.

The candidate is accepted for CTO exact-SHA integration review. This review does not authorize deployment or enabling either feature flag.
