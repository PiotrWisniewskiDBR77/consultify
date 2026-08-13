# IE-000 — source collision, ownership and initial allowlist

Status: `ACCEPTED`
Observed source SHA: `635fd2d48d`
Observed source dirty entries: `323`
Rule: `FOREIGN_DIRTY` is read-only evidence until separately reconciled.

## 1. High-collision runtime files

These source-worktree files already contain uncommitted work and MUST NOT be copied or edited as a package:

| Area | Foreign dirty files | Disposition |
| --- | --- | --- |
| Initiatives navigation | `InitiativesHub.tsx`, `Analysis/PortfolioAnalysisView.tsx` | `FOREIGN_DIRTY`; compare hunk-by-hunk only after foundation contracts exist |
| Execution navigation | `ExecutionHub.tsx`, `ExecutionManagementView.tsx` | `FOREIGN_DIRTY`; no early tab rewrite |
| My Work core | `MyWorkHub.tsx`, Task/Decision/Inbox panels and many Idea/Canvas files | `FOREIGN_DIRTY`; initial integration via contracts/tests, not shell edits |
| Shared table/preview | ModuleHub controls, `ModuleMenu3`, `TableWithPreviewLayout`, PreviewPane, StandardTable/Preview/ModuleBar | `FOREIGN_DIRTY`; consume committed API first; do not import dirty shared layer |
| API client/packages | `src/services/api.ts`, `package.json`, `package-lock.json` | `FOREIGN_DIRTY`; no dependency or client-core change in foundation slice |

## 2. Untracked source candidates

These files may contain useful implementation attempts but have no committed lineage in the baseline. They are `PRESENT_NOT_ACCEPTED`, not dependencies:

- Initiatives: `PortfolioAnalysisTable`, `CandidatesTable`, `InitiativeObservabilityTable`, `InitiativesGoalsTable`, `PortfolioHealthTable`, preview builder and tests;
- Execution: `ExecutionManagementTable` and reporting smoke test;
- Shared: bulk selection, canvas context menu, table-setting locks, preview contract/geometry/structured list and tests;
- My Work: `tableSurfaceCapabilities.ts`;
- unrelated server artifact/assessment files in the same source tree.

Each candidate requires semantic comparison with the owner canon and an independent test before selective porting. Existing screenshots or source-anchor tests are not acceptance.

## 3. Lower-collision foundation areas

At the observed source state, the following target areas have no listed dirty source modification and are eligible for a narrow initial slice after file-level recheck:

- new shared domain contracts under a dedicated Initiatives/Execution namespace;
- new registry adapter and contract tests without changing `InitiativesHub`;
- Initiative section registry tests and compatibility adapter files;
- new governance-policy types/resolver and tests;
- new OCC/idempotency/outbox contracts/tests where they do not modify shared database infrastructure;
- implementation documentation and evidence collectors.

This is not permission to change existing server/database infrastructure. Any discovered overlap reclassifies the file before edit.

## 4. Initial Slice 0 allowlist

The first implementation package is restricted to new files plus explicitly reviewed clean existing files:

```text
docs/implementation/**
src/contracts/initiatives-execution/**                 # new
src/components/Initiatives/cardRegistry/**              # new
server/src/domain/initiatives-execution/**              # new
tests/unit/initiatives-execution/**                      # new
tests/integration/initiatives-execution/**               # new
```

Potential existing-file edits require a separate ledger entry and baseline diff before modification. In particular, this allowlist excludes both Hubs, My Work Hub, shared tables/previews, `api.ts`, package manifests, central DB wrappers and migrations.

## 5. First contract package

Implement, in order:

1. canonical `CardKey` and 26-card metadata contract;
2. mapping contract for current frontend registry, DB section types and template keys;
3. governance profile/policy types and org -> project -> Initiative resolution;
4. lifecycle/gate/readiness/disposition projections;
5. command metadata for expected version, client request ID, correlation and read-back state;
6. unit/contract tests that fail on missing/duplicate cards, invalid lifecycle values, unresolved authority and unsafe defaults.

No user-facing mount or database mutation is part of this package.

## 5A. Slice 1 foundation-migration ledger

Before the first realDB write slice, the allowlist is expanded by exactly one new migration:

```text
server/migrations/932_initiatives_execution_material_commands.sql  # new
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts        # new
server/src/routes/pmo/initiatives.routes.ts                        # reviewed two-hunk mount
src/services/initiatives-execution/runtimeApi.ts                   # new
src/components/Initiatives/SourceProposalRegistrationWorkbench.tsx # new
src/components/Initiatives/SourceProposalRegistrationSurface.tsx   # new
```

Rationale and constraints:

- the standard PostgreSQL runner and package scripts execute `server/migrations/`; the contradictory
  `server/migrations/README.md` reference to `migrations-v2` is not treated as runtime evidence;
- there is one migration copy only;
- the migration is additive and wraps its schema changes in a transaction;
- rollback is forward-only: stop the feature/writer, retain audit/outbox/receipts, then apply a
  compensating migration; destructive down-migration is prohibited;
- the integration test loads this exact SQL file into the dedicated PostgreSQL database;
- no migration runner, package script, central database wrapper or pre-existing schema file is edited.
- the parent Initiatives router was clean in the source collision audit immediately before edit;
  its allowlisted change is restricted to one import and one `/runtime-v1` mount.

## 6. Completion evidence

- source worktree count remained `323` after isolation and documentation work;
- isolated worktree began clean at the same SHA;
- high-collision and untracked candidates are listed;
- initial allowlist excludes all identified collisions;
- no source file was reset, staged, committed, copied or modified by this implementation track.

## 7. Baseline verification limitations

After exact baseline dependencies were installed with `npm ci --ignore-scripts`, the global server typecheck failed in numerous pre-existing files outside this track, including Interview/Organization controllers, collaboration gateways, middleware, unrelated routes and export/table-platform services. None is in the initial allowlist and none was modified here.

Consequences:

- global server typecheck is `BASELINE_FAIL`, not evidence against or for this slice;
- new server-domain files require isolated strict typecheck plus focused tests;
- before final integration, the global baseline must be reconciled on the integration SHA or an accepted scoped typecheck must prove every changed dependency closure;
- errors are not suppressed, mass-fixed or attributed to this Epic without a baseline comparison.
