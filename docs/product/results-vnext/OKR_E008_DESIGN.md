# OKR-E008 — Teresa, Perspectives, Legacy — FROZEN DESIGN

## §-IO. Integration Owner rulings (binding; override any contrary provisional wording below)

Status: **FROZEN**. Integration Owner: Claude (orchestrator session, 2026-08-10).
The sections below are the design draft as researched, accepted in full, subject to these rulings.

**Cross-cutting rulings — these resolve the recurring open questions common to every OKR draft:**

| # | Recurring question | Ruling |
|---|---|---|
| IO-1 | Prior OKR epics are designed but **not landed as code**; every cited signature/table/column comes from frozen docs, not running code. Several drafts independently confirmed this by direct grep. | **Correct, acknowledged, and NOT a blocker to freezing the design — but it IS a hard build-time gate.** The implementer MUST re-verify every cross-epic signature, table, and column against actually-landed code before writing against it, and MUST report divergence rather than silently adapting. The OKR epics land strictly in order E001→E008; each implementation begins by re-reading its predecessors' landed code. |
| IO-2 | A policy value the design needs has **no column on `okr_vnext_programs`** (attention thresholds, clamping rules, status-suggestion policy). | **Do NOT `ALTER TABLE okr_vnext_programs` for it in this epic.** Use an explicitly-named constant or return `not_calculable`, and record the gap in the closure entry. Reserving a column costs a migration on a table that may already hold data; naming the gap costs nothing and keeps it visible. Mirrors `reflection_required_for_close`'s own reserve-and-flag precedent. |
| IO-3 | A capability is plausible and useful but **no AC in the ledger names it**. | **Do not build it.** Name it in the closure entry as a deferred, unowned gap. Every prior domain held this line; speculative scope is exactly what the per-epic AC tables exist to prevent. |
| IO-4 | A cross-epic boundary is assumed but unconfirmed by any AC. | **Restate it forward explicitly** in the closure entry, addressed to whoever implements the neighbouring epic — never leave it a silent assumption. Precedent: OKR-E002 D13's `resolveScopeVisibility` gap, restated rather than quietly resolved. |
| IO-5 | A formula, threshold, or gradient is **not specified in any source document**. | **Never invent one carrying a free parameter.** Either use the definitionally-forced value (e.g. binary = 1.0/0.0) or return `not_calculable` with a reason. A fabricated gradient inside a number that feeds review decisions is the same class of risk as ROI's NPV/rounding gap. |
| IO-6 | The design needs a change to a file **outside this epic's own allowlist** (another module's controller, a shared platform primitive). | **Permitted only when additive and strictly backward-compatible** (new optional field, new exported function, widened guard that rejects nothing previously accepted). It must be its own separate commit, named in the closure entry as a cross-module change. Anything more invasive stops and reports instead. |

Any open question in this draft not addressed by an epic-specific ruling below stands **exactly as the draft documented it** — flagged, unresolved, and to be restated in the closure entry rather than silently decided during implementation.

---

Status: IN PROGRESS (incremental write for crash resilience). Eighth and last epic
of the OKR domain, Results Next program. Worktree:
`consultify-results-vnext-g0-20260809`, branch `codex/results-vnext-g0-20260809`.
Landed as of this draft: OKR-E001 (Program & Cycle), OKR-E002 (Materialized Set).
OKR-E003..E007 have partial scratchpad drafts only (not frozen docs in repo).
ROI-E008 (Teresa/Legacy/Ops combined) is FROZEN and is the most recent sibling
pattern — this design follows its conventions wherever OKR's AC table doesn't
diverge.

---

## 0. Source of truth — OKR-E008 AC table (VERBATIM from EPIC_LEDGER_LIVE.md lines 97-107)

### OKR-E008 Teresa, Perspectives, Legacy

| Pole | OKR-F-025-AC-01 | OKR-F-026-AC-01 | OKR-F-027-AC-01 | OKR-F-028-AC-01 | OKR-F-029-AC-01 (izolujący AC) |
|---|---|---|---|---|---|
| Decision ID | D15 | D15 | D15 | D10 | D09, D13 |
| Requirement | Pierwszy vertical slice: "Objective → Teresa suggestion → accept/reject → draft saved" z provenance, bez cichej mutacji. Teresa nigdy nie wymyśla current value/progress/confidence/blocker/przyczyny/intencji. | Check-in assistance + manager brief cytują autoryzowane referencje; restricted data filtrowana PRZED retrieval, nie redagowana po. | Reflection/next-cycle synthesis = proponowany patch wymagający jawnej akceptacji; brak autonomicznego submit/approval/scoring/carry-forward. | Projekcje personal/team-BU/company zwracają te same Set IDs i wersje dla tego samego Set — dowód że to widoki, nie kopie. | **Legacy (`okr_cycles/objectives/key_results/check_ins`) → `LEGACY_READ_ONLY_ARCHIVE`; ZERO przeniesienia naruszeń D09 do `okr_vnext_*`** (FK do KPI, dropdown "Related KPI", cross-domain import w serwisie). |
| Aggregate/owner | Teresa advisor (drafting/quality) | Teresa advisor (check-in/brief) | Teresa advisor (reflection) | OKRSet read projections | Legacy (frozen) vs vNext (isolated) |
| Command/query/API | `POST .../advisor/draft`, `POST .../advisor/quality-review` | `POST .../advisor/check-in`, `POST .../advisor/manager-brief` | `POST .../advisor/reflection` | `GET .../okr/my`, `/team-health`, `/company` | brak nowych write-route dla legacy (celowo) |
| Schema/migration/constraint | `okr_vnext_objectives` (Teresa provenance metadata) | `okr_vnext_checkins`, manager-brief read model | `okr_vnext_reflections` (proposed patch) | parity test na `id`/`current_version` w 3 projekcjach | **ZERO FK z `okr_vnext_*` do `okr_key_results`/`initiative_kpis`/`kpi_definition_versions`** |
| Roles/visibility | Objective Owner (accept/reject) | KR Owner, Manager | Set/Objective Owner | wg scope | Auditor (read legacy), Program Admin |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

Governing note: this table governs. Everything below is orientation/derivation from it.

Five ACs, three "halves":
- **HALF A — Teresa**: OKR-F-025 (draft/quality-review, vertical slice), OKR-F-026
  (check-in assistance + manager brief), OKR-F-027 (reflection/next-cycle synthesis
  proposal-only)
- **HALF B — Perspectives**: OKR-F-028 (personal/team-BU/company projections, parity proof)
- **HALF C — Legacy**: OKR-F-029 (isolating AC — legacy archive + D09 violation isolation)

Cross-references to earlier OKR epics baked into this table:
- OKR-F-026 manager brief reuses OKR-E006's `GET .../okr/attention` (Manager attention
  read model, OKR-F-020) as its citation source — Teresa must cite THAT read model, not
  invent its own signal.
- OKR-F-027 reflection proposal targets OKR-E007's `okr_vnext_reflections` (OKR-F-021) —
  Teresa proposes a patch shaped like a `OKRReflection`, human still calls
  `POST .../sets/:id/final-score` / `POST .../objectives/:id/reflection` to commit.
- OKR-F-028 "my/team-health/company" perspectives must return identical Set IDs/versions
  — direct analog of KPI's `listMyKpis`/`listOrganizationKpiAttention` parity requirement,
  but OKR-E002 (OKR-F-004-AC-02, line 30) ALREADY specified `GET .../sets?perspective=&cycle=&scope=`
  and `GET .../okr/company` as part of the Materialized Set epic. See §B.4 for reconciliation.
- OKR-F-029 explicitly targets the D09 violation already named in OKR-E004
  (OKR-F-012-AC-01, `okrService.ts::getSuggestedValueForKeyResult` reading `kpi_time_series`
  directly / importing `kpiDefinitionService.js`) — E004 fixes the vNext suggestion path,
  E008/OKR-F-029 fixes the LEGACY archive boundary so that violation is never inherited.

---

## 1. Landed-code verification notes (grepped directly, 2026-08-10)

### 1.1 `teresaCopilotCanon.ts` (892 lines) — CRITICAL FINDING

`HandoffTargetModule` union (lines 26-43) currently contains:
`radar | initiatives | calendar | notebook | interview | excele | ideas |
results | kpi | roi | execution | finance | meeting | outputs | documents |
tables | presentations`.

**`'okr'` is NOT present.** Unlike `'kpi'`/`'roi'`, which were pre-reserved
platform slots from RN-G1 (confirmed by ROI_E008_DESIGN.md D1: "`HandoffTargetModule`
already reserves `'roi'` (RN-G1)"), `'okr'` was never reserved. This means
OKR-E008, unlike its two siblings, must ALSO edit the `HandoffTargetModule`
union type itself (add `'okr'` to the literal list), not just append to
`P08_HANDOFF_TARGET_MODULES`. This is a genuine scope difference from the
task prompt's framing (which listed only the canon-entry/module-array/
forbidden-verbs asks) — flagged in §D Open Questions, but treated here as
settled: add it, since the alternative (not registering it) makes the whole
epic impossible.

`P08_HANDOFF_TARGETS` (const object, line 255) has `kpi:`/`roi:` entries
matching KPI_E006/ROI_E008 docs exactly (verified).

`P08_HANDOFF_TARGET_MODULES` (line 360-371) currently:
```ts
export const P08_HANDOFF_TARGET_MODULES: HandoffTargetModule[] = [
  'radar', 'initiatives', 'calendar', 'notebook', 'interview', 'excele',
  'ideas', 'documents', 'presentations',
  'kpi', // KPI-E006, appended — existing 9 entries untouched
  'roi', // ROI-E008, appended — existing 10 entries untouched
];
```
OKR-E008 appends `'okr', // OKR-E008, appended — existing 11 entries untouched`.

`P08_KPI_FORBIDDEN_VERBS` / `P08_ROI_FORBIDDEN_VERBS` both landed exactly as
their design docs specified (verified by direct read, lines ~374-440+).

### 1.2 `teresaCopilotService.ts` (3239 lines)

- Imports from `../resultsVnext/`: exactly 7 lines total — 4 for kpi (lines
  35-39, incl. `AtomicWriteConflictError`), 2 for roi (lines 43-44). This IS
  the real, current grep-able whitelist baseline OKR-E008's own proof must
  extend.
- `performHandoff`'s switch (~line 2140-2187): `case 'kpi':` /
  `case 'roi':` each one line, dispatching to `handleResultsKpiHandoff`/
  `handleResultsRoiHandoff`. OKR-E008 adds `case 'okr':` the same way.
- `undoProposal` (~line 1880-1939): **NOT a switch** — sequential
  `if (row.target_module === 'kpi') {...throw P08_UNDO_NOT_SUPPORTED...}`,
  then `if (row.target_module === 'roi') {...throw...}`, THEN the generic
  `if (row.target_module !== 'excele') throw P08_UNDO_UNSUPPORTED_TARGET`.
  The KPI block's own inline comment documents this as a **deviation from
  KPI_E006_TERESA_DESIGN.md's own assumption of an existing switch** — no
  switch exists; the flat if-chain is real structure. OKR-E008 must add a
  THIRD `if (row.target_module === 'okr') {...}` block in the same position
  (above the generic `!== 'excele'` check), same shape.
- `handleResultsRoiHandoff`/`handleRoiPirLessonsDraft`/
  `recordTeresaRoiHandoffResult` (lines 3056-3118, 3040-3054) match
  ROI_E008_DESIGN.md §A2 almost verbatim, one real deviation: `draftPayload:
  draft as unknown as Record<string, unknown>` — an explicit double-cast
  needed because `server/tsconfig.json` is stricter than the root config
  and a named interface (no index signature) doesn't structurally satisfy
  `Record<string,unknown>` under it without widening. **OKR-E008's own
  handler(s) must use the same `as unknown as Record<string, unknown>` cast
  wherever a typed payload interface is passed into a `Record<string,
  unknown>`-typed command input field** — this is a real, repo-wide
  TS-strictness fact, not a one-off ROI quirk.
- `recordTeresaKpiHandoffResult` (KPI) and `recordTeresaRoiHandoffResult`
  (ROI) are both small local helpers, same INSERT shape into
  `teresa_handoff_results`, differing only in the hardcoded
  `target_module` literal (`'kpi'` / `'roi'`). OKR-E008 adds
  `recordTeresaOkrHandoffResult` with `target_module='okr'`, identical shape.
- `AtomicWriteConflictError` import (kpi block) is re-thrown as-is on CAS
  conflict — OKR-E008's own write path should follow the same
  truth-preserving re-throw if it uses `executeAtomicCommand`/CAS (need to
  confirm OKR's actual atomic-write helper name from OKR-E001-E007 code,
  see §2 below).

### 1.3 `readOnlyGuard.middleware.ts` — reused UNCHANGED (confirmed, 35 lines,
matches KPI_E007_DESIGN.md §5 verbatim). OKR-E008 imports `denyMutations`
from this exact file, zero edits.

### 1.4 `kpiLegacyArchive.routes.ts` (landed, 364 lines) — real deviations
from KPI_E007_DESIGN.md, both already flagged in the file's own header
comment and reconfirmed here:
  1. `router.use(denyMutations)` (no path arg), NOT `router.all('*',
     denyMutations)` — Express 5.2.1's path-to-regexp v6+ throws on a bare
     `'*'` string at router construction time.
  2. `validateParams`/`validateQuery` middleware from
     `validation.middleware.ts`, NOT inline `Schema.parse(req.query)` in a
     try/catch — this repo's real global error handler
     (`ErrorHandler.ts::errorHandlerMiddleware`) has no ZodError branch, so
     an uncaught ZodError would 500, not 400.
  3. `requireOrgAccess` imports from `../../middleware/rbac.middleware.js`
     (NOT `orgAccess.middleware.js` as the design doc guessed).
  4. Middleware order confirmed: `denyMutations` → `apiAuthRateLimiter` →
     `verifyToken` → `requireOrgAccess()` → `demoContextMiddleware`.
  5. Response envelope: `LegacyArchiveMeta`/`legacyMeta()` helper/
     `handleLegacyRouteError()` — all local to the route file (not
     exported/shared from elsewhere), so OKR-E008 re-declares its own copies
     (same as ROI's file does), not an import.
  6. Counter: `resultsVnextLegacyArchiveHitsTotal` (KPI) /
     `resultsVnextRoiLegacyArchiveHitsTotal` (ROI) — both in
     `metricsService.ts`, `.inc({ source_table: ... })` called once per
     successful (non-404) response, inside the try block after the DB call.

### 1.5 `roiLegacyArchive.routes.ts` (landed, 555 lines, currently UNTRACKED
per `git status`, i.e. present on disk but not yet committed — still real,
readable code, just not yet in a commit) — confirms the same 6 deviations
apply identically. Additional ROI-specific facts useful as OKR pattern:
  - 4-bucket `RoiLegacyOriginDomain` type + `LEGACY_LABELS: Record<routeKey,
    {originDomain, label}>` object, keyed by the **kebab-case route
    segment** (not the raw table name) — `legacyMeta(routeKey, sourceTable,
    ...)` takes both separately. OKR-E008 should follow this exact
    `routeKey`-keyed-labels shape (cleaner than KPI-E007's original
    per-table-literal-args shape) since it is the more recent, presumably
    preferred convention.
  - `RoiLegacyOriginDomain` type and the repository's list/get function
    names are exported from `roiLegacyArchiveRepository.ts` and imported
    directly into the route file — same expected shape for OKR.


### 1.6 `kpiPerspectivesRepository.ts` (629 lines) — the perspectives precedent

Two-part structure:
- **§A `listMyKpis`**: ONE SQL string, `UNION ALL` of 6 branches (attention
  items: update_due governed/heuristic, explanation_or_plan, corrective
  action, manager_decision_waiting, upcoming_review, other), each branch
  independently joined to `rvn_visible_resources` via one shared
  `buildVisibilityScopedCte({userId, organizationId, resourceType:'kpi'})`
  call (single CTE, referenced by every branch).
- **§B `listOrganizationKpiAttention`**: an ORCHESTRATOR (`Promise.all`) over
  7 INDEPENDENT metric queries, each calling its OWN
  `buildScopedKpisBase(managerId, organizationId)` helper, which builds a
  `chain_members` CTE (`rvn_platform_management_chain_closure`,
  `ancestor_user_id = $4` UNION `$4` itself) THEN a `scoped_kpis` CTE that
  INNER JOINs `rvn_visible_resources` (visibility layer) AND `chain_members`
  (management-chain layer) — **two independent layers, both required**,
  never one substituting for the other (T3 non-leak: filter before
  aggregate, no shared "trusted" intermediate).
- One deliberate exception: `listMissingOwnership` bypasses
  `chain_members`/`scoped_kpis` entirely (NULL owner can never match a
  chain member) — reads raw `rvn_kpi_definitions` + its own fresh
  visibility CTE only. Documented as an accepted limitation, not a bug.
- Every `vr.resource_id = <col>` join has an explicit `::text` cast — a
  program-wide bug class fixed in EXECUTION_LEDGER.md §24; the file's own
  header calls this out as mandatory to preserve.

### 1.7 `roiOrgPerspectiveRepository.ts` (366 lines) — ROI's adaptation

Confirms the pattern generalizes cleanly to a domain with fewer independent
metrics:
- `buildScopedRoiCasesBase(managerId, organizationId, statuses =
  ROI_TRACKING_ACTIVE_STATUSES)` — same two-layer `chain_members` +
  `scoped_cases` shape, but ALSO takes a `statuses` filter baked into the
  shared base (since ROI, unlike KPI, has exactly one/two callers per base,
  not seven) — `listOrganizationRoiBenefitsRealization` uses the default
  active-statuses; `listOrganizationRoiPirOutcomes` passes its own
  `['post_investment_review','closed']` set explicitly.
- No `Promise.all` orchestrator needed — ROI's two exported functions each
  do ONE query (with `LEFT JOIN LATERAL` for related snapshot data),
  aggregating totals in JS after the round trip, not a second SQL pass.
- Explicit file-header claim of AC-05 compliance: "Reads ONLY
  `rvn_roi_cases`/`rvn_roi_approval_snapshots`/`rvn_roi_actual_snapshots`
  [...] — never a legacy table" — this is the exact shape OKR-E008's own
  perspectives must claim and prove for `rvn_okr_*`/`okr_vnext_*` tables
  vs. the legacy `okr_objectives`/`okr_key_results`/etc.

## 2. OKR legacy inventory — re-verification (direct grep, in progress)


### 2.1 EXECUTION_LEDGER.md §3.4 (verbatim key facts, OKR AS-IS)

Quoting/paraphrasing §3.4 (`docs/product/results-vnext/EXECUTION_LEDGER.md`
lines 160-198): 4 legacy tables already live on demo/prod
(`914_okr_management.sql` + RES-009 follow-up): `okr_cycles` (quarterly
cycle, optionally dept/team-scoped), `okr_objectives` (has `parent_id`
cascade rollup), `okr_key_results` (has `kpi_id`+`kpi_definition_version_id`
FK), `okr_check_ins` (deterministic `seq` tie-breaker). **No `okr_sets`/
`okr_programs`** — migration 914's own header comment says the authors
deliberately flattened "one Set per dept×cycle" into
`okr_cycles.dept_id/team_id`, with an explicit comment that a dedicated
`okr_sets` table is a documented follow-up — this is exactly what OKR-E002
(D08, Materialized Set) builds as new vNext schema, not an extension of the
legacy tables.

API: `server/src/routes/resultsStrategic.routes.ts` (`/:projectId/okr/*`,
ledger says "12 endpoints" — **re-verified by direct grep, see §2.2 below:
the real count is 13 OKR-prefixed routes + 1 combined `/:projectId/strategic`
route = 14 total; a small, non-blocking inventory correction**), service
`okrService.ts` (845 lines — ledger said 846, off by one, trivial). All
write endpoints sit behind `requireProjectCapability(..., {shadow:true})` —
shadow-only, nothing actually blocked unless `CAPABILITY_ENFORCE=enforce`.

UI: no dedicated `/results/okr` hub — OKR is folded into `ResultsHub.tsx`
("pair 3" KPI/ROI/OKR) and `StrategicLayerPanel.tsx` (BSC+BDN+OKR together
in one file), behind two SHARED flags (`strategicLayer`, `threePairs`), not
a dedicated OKR flag. `KpiOkrView.tsx` is a dead redirect to `/results`.

**4 existing D09 violations to isolate** (§3.4's own list, re-verified in
§2.2/§2.3 below):
1. Schema: `okr_key_results.kpi_id` FK→`initiative_kpis`,
   `kpi_definition_version_id` FK→`kpi_definition_versions` — hard FKs, even
   though neither drives scoring anymore.
2. Service: `getSuggestedValueForKeyResult` reads `kpi_time_series` directly;
   `okrService.ts` imports `kpiDefinitionService.js` — cross-domain import.
3. UI: `OkrKeyResultModal.tsx`'s "Related KPI" dropdown via
   `V8ResultsApi.getKpiCatalog()`.
4. Not even screen separation — OKR/KPI/ROI live in one file/module today.

**Good news** (§3.4's own framing): scoring is already manual-only (git
history: `bfadffdd4a` introduced KPI auto-score, `aa26ba4067` reverted it,
`0ce5488184` documented it in the migration itself as
"superseded to informational-only") — the D09 direction at the SCORING
LOGIC level is already in the repo; only schema/service/UI still carry the
cross-domain coupling that needs isolating (not deleting — legacy stays
live).

### 2.2 Direct re-grep — confirms §3.4, with 3 corrections

1. **Route count**: `resultsStrategic.routes.ts` has 14
   `router.get/post/patch/delete(...)` calls total, not "12": `GET
   /:projectId/strategic` (combined BSC+OKR, not OKR-only), `GET
   /:projectId/okr`, `GET/POST /:projectId/okr/cycles`, `POST
   /:projectId/okr/cycles/:cycleId/close`, `POST
   /:projectId/okr/objectives`, `PATCH/DELETE
   /:projectId/okr/objectives/:id`, `POST
   /:projectId/okr/objectives/:id/key-results`, `PATCH/DELETE
   /:projectId/okr/key-results/:id`, `GET
   /:projectId/okr/key-results/:id/check-ins`, `GET
   /:projectId/okr/key-results/:id/suggested-value`, `POST
   /:projectId/okr/key-results/:id/check-in`. 13 are OKR-prefixed; the 14th
   (`/:projectId/strategic`) is the combined BSC+OKR read the UI half of
   §3.4 already flags as tangled. Minor, does not change scope.
2. **`okrService.ts` line count**: 845, not 846 (off-by-one, cosmetic).
3. **`okr_key_results.kpi_definition_version_id` origin**: NOT in
   `914_okr_management.sql` itself (which only adds `kpi_id` + its FK to
   `initiative_kpis`) — it's a SEPARATE, later migration:
   `server/migrations/20260803_res009_okr_key_result_definition_version.sql`,
   adding `kpi_definition_version_id TEXT REFERENCES
   kpi_definition_versions(id) ON DELETE SET NULL`. Both FKs are real and
   both are D09 violations (initiative_kpis AND kpi_definition_versions),
   confirming the task prompt's framing exactly — just noting the two FKs
   land in two different migration files, not one, in case a future reader
   greps only `914_*`.

Confirmed accurate, no correction needed: `okrService.ts` imports
`getCurrentDefinitionVersionId` from `./kpiDefinitionService.js` (line 18) —
the literal cross-domain import. `getSuggestedValueForKeyResult` (lines
789-834) reads `kpi_time_series` directly (`SELECT value, period_start,
source FROM kpi_time_series WHERE kpi_id = ? AND organization_id = ? ORDER
BY period_start DESC, created_at DESC LIMIT 1`) — confirmed READ-ONLY, and
the function's own doc comment states it is called ONLY from the
suggested-value endpoint (`GET
/:projectId/okr/key-results/:id/suggested-value`), never from a write path
(`createCheckIn`/`updateKeyResult`/`recomputeKeyResultScore`) — a KPI
measurement landing never silently changes a KR's `current`/`score`
(D7/Piotr 2026-07-12 already enforces this at the service level; OKR-E004
(OKR-F-012) is what fixes this properly for vNext, not this epic).

`OkrKeyResultModal.tsx` (line 11): `import { V8ResultsApi } from
'@/services/api/v8/results'`; line 66: `const res = await
V8ResultsApi.getKpiCatalog()`; line 161: label
`results.okr.linkedKpi` = `"Related KPI (reference only, optional)"` —
confirmed, matches §3.4 exactly.

All 4 legacy tables (`okr_cycles`, `okr_objectives`, `okr_key_results`,
`okr_check_ins`) carry `organization_id TEXT NOT NULL` directly (confirmed
in `914_okr_management.sql` DDL, lines 41-101) — same simple single-column
tenant scoping ROI-E008's 7 tables have, no join-through-two-tables case
(unlike KPI-E007's `v8_kpi_definitions`/`tp_kpi_definitions` org-column
uncertainty).

`resultsStrategic.routes.ts`'s own `ensureOkrTables()` (lazy-DDL, lines
53+) independently re-declares `okr_objectives`/`okr_key_results` — the
same "self-provisioned, not through the real migration system" pattern
KPI-E006's design doc flagged for `teresa_proposals`/`teresa_audit_log`.
Not this epic's problem to fix (legacy stays running, untouched) but worth
naming for the Legacy archive repository: query the tables as they exist at
runtime, do not assume `914_okr_management.sql` alone is authoritative for
the full live column set (RES-009's later migration already proves the
schema grew past 914 once).


### 2.3 OKR-E001/E002 cross-check — vNext side (design-only, NOT landed)

**CRITICAL, program-wide-first finding**: `find server/src/services/resultsVnext/okr` on this
worktree returns "No such file or directory" — **zero OKR vNext code exists
anywhere**, not even OKR-E001/E002 despite both having FROZEN design docs
(`git log` for `server/src/services/resultsVnext/okr/` returns nothing).
This is structurally different from every prior "epic 8" precedent:
KPI-E006 was built against fully-landed KPI-E001-E005; ROI-E008 was built
against fully-landed ROI-E001-E007. **OKR-E008 (this document) is being
designed against ZERO landed OKR-domain code — only frozen/draft DESIGN
DOCS for E001 (frozen), E002 (frozen), E003-E007 (draft-only, unreliable,
per the task's own framing).** See §D Open Questions — this is the single
biggest risk to this design and to the whole OKR-E008 implementation
sequencing.

OKR-E001 (`docs/product/results-vnext/OKR_E001_DESIGN.md`) confirms, in its
own §0 "AS-IS legacy D09 violation" and §3 "Legacy collision check":
archive routing is explicitly named as "OKR-E008's job, matching
KPI-E007/ROI-E008's pattern" — this design (§3 below) is the fulfillment of
that forward reference. Legacy table list confirmed identical to §2.1/2.2
above: `okr_cycles`, `okr_objectives`, `okr_key_results`, `okr_check_ins`.

OKR-E002 (`docs/product/results-vnext/OKR_E002_DESIGN.md`) §5/§6 — **directly
relevant reconciliation for HALF B**:
- `listOkrSets` query params already declared: `{ perspective?, cycle?,
  scope?, status?, attention? }` — **but `perspective` has no defined
  semantics anywhere in the E002 doc** (no enum of values, no behavior
  described) — it is a bare reserved param name, same "reserve the slot,
  zero enforcing code" discipline as E002's own `recommit_status` columns
  (D17). It is NOT wired to do anything.
- `GET /okr/company` already speced as a route: "a thin wrapper filtering
  `scope_type='company'` over the same CTE-scoped [`listOkrSets`]
  function" — explicitly justified as the literal mechanism for
  F-004-AC-02 ("company view is a projection, not a separate model").
- **Reconciliation decision (this document, Decision D-OKR8-4 below)**:
  OKR-F-028's ledger AC cell literally names THREE distinct routes (`GET
  .../okr/my`, `/team-health`, `/company`), not a query-param-driven single
  route. The already-declared `perspective=` param on `GET /sets` is kept
  reserved-and-unused (matching E002's own precedent for unused columns);
  it is NOT the mechanism OKR-E008 builds against. `GET /okr/company` is
  REUSED AS-IS from E002 (not rebuilt) — OKR-E008 adds the parity contract
  test over it, plus two genuinely NEW routes (`/okr/my`, `/okr/team-health`)
  in a new `okrPerspectivesRepository.ts`, mirroring KPI/ROI's perspectives
  file split from the Set CRUD repository (`okrSetRepository.ts`, E002).

Every OKR-E003-E007 command/route name cited in HALF A below is taken
**verbatim from EPIC_LEDGER_LIVE.md's own Command/query/API cells** (§0
above — the actual governing table), not from the unreliable
scratchpad-only E003-E007 drafts (E007's own draft is 22 lines, barely
started; none of E003-E007 are frozen). Every such reference is flagged
DEPENDENCY-NOT-LANDED and must be re-verified once those epics actually
ship code.

---

## 3. HALF A — Teresa (OKR-F-025, OKR-F-026, OKR-F-027)

### 3.1 Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| D-OKR8-1 | How many advisor modes? | **Five**, one per named route in the ledger's own Command/query/API cells, not one per AC: `objective_draft` + `objective_quality_review` (both under OKR-F-025's two named routes `POST .../advisor/draft` / `POST .../advisor/quality-review`), `check_in_assist` + `manager_brief` (OKR-F-026's two named routes `POST .../advisor/check-in` / `POST .../advisor/manager-brief`), `reflection_synthesis` (OKR-F-027's one route `POST .../advisor/reflection`). | The task's own instruction: "count what the OKR ACs/plan actually name — do not invent speculative modes." KPI collapsed draft+quality-review into ONE mode because its ledger cell named a single combined interaction; OKR's ledger cell instead names **two separate POST routes** under F-025 (`/advisor/draft` and `/advisor/quality-review`) and **two separate POST routes** under F-026 (`/advisor/check-in` and `/advisor/manager-brief`) — five distinct, literally-named surfaces, not three (one per AC) and not one (ROI's case, where the plan named exactly one generation call). Collapsing these into 3 modes to match KPI's count, or into 1 to match ROI's, would both be pattern-matching the wrong precedent instead of reading this domain's own AC table. |
| D-OKR8-2 | Does `objective_draft` also create Key Results in the same call? | **No — Objective only.** The AC's requirement text is literally "Objective → Teresa suggestion → accept/reject → draft saved" (singular, Objective-scoped) — no KR-bundling is named. Key Results are a human follow-on action via the normal `POST .../objectives/:id/key-results` endpoint (OKR-E003), same as any other Objective a human creates directly. | Avoids inventing a multi-entity write-fan-out (Objective + 1-3 KRs in one Teresa-approved action) the AC text never asks for — same discipline ROI-E008 D4 used to keep `pir_lessons_draft` narrowly scoped to the two lessons columns, nothing wider. |
| D-OKR8-3 | Does `objective_quality_review` write anything to `okr_vnext_objectives`? | **No — read+narrate only**, `real_entity: false` in the response, same shape as KPI-E006's Mode 2 (`check_in_manager_brief`). Reviews an EXISTING, already-created Objective (human- or Teresa-drafted) and returns quality commentary (purpose/actionability questions, ambition-alignment note, duplicate-risk against other visible Objectives in the same Set) as narrative output only. | KPI's own `quality_review.*` sub-object is never persisted to any `rvn_kpi_definitions` column either — it exists only in the response/audit envelope. OKR's ledger names `POST .../advisor/quality-review` as a route distinct from `/advisor/draft`, consistent with "review an existing thing," not "create." A write here would also risk silently mutating an Objective's content outside the human's own edit path — exactly what OKR-F-025's own prohibition text warns against ("Teresa nigdy nie wymyśla current value/progress/confidence/blocker/przyczyny/intencji"). |
| D-OKR8-4 | Reconcile `perspective=` param / `/okr/company` (E002) vs. OKR-F-028's 3 named routes | **Keep `perspective=` reserved-unused** (E002's own "reserve the slot" pattern); **reuse `/okr/company` as-is** from E002; **build `/okr/my` and `/okr/team-health` as new routes**. See §2.3 above. | Direct reading of governing AC cell; avoids both under-building (ignoring the 3 named routes) and over-building (wiring the unused `perspective` param with invented semantics no AC describes). |
| D-OKR8-5 | `check_in_assist` — write path or advisory-only? | **Writes**, targeting OKR-E004's check-in command (ledger cell: `GET/POST .../key-results/:id/check-ins`) — Teresa prefills a proposed check-in (confidence/value/note) for a specific KR, human approves, the SAME command a human check-in uses executes it (`actorEffectiveRole:'teresa_initiated'`, `createdBy`/`checkedBy`=the real human), exactly like KPI's `draft_quality_review` create path and ROI's `pir_lessons_draft`. Teresa never invents `current`/`score` itself — it may only *suggest* a value, and only by citing an already-authorized source (never a synthesized number), per OKR-F-025's prohibition text, which reads domain-wide, not AC-025-scoped only. | The ledger's own OKR-F-012 (OKR-E004, "izolujący AC") already establishes the discipline that a *suggested* check-in value must come from a typed optional reference, never a structural read of `kpi_time_series` — Teresa's `check_in_assist` must honor that exact same discipline: it may reference OKR-E004's own (not-yet-landed) suggested-value mechanism, never read KPI tables itself. |
| D-OKR8-6 | `manager_brief` — write or read-only? | **Read-only**, `real_entity: false`, full P08 envelope (audit-over-convenience, matching KPI Mode 2 / ROI's D5/D12 "no carve-out"). Cites OKR-E006's `GET .../okr/attention` (Manager attention read model, OKR-F-020) as its ONLY data source — never a raw query Teresa builds itself. | Direct requirement-text match: "restricted data filtrowana PRZED retrieval, nie redagowana po" — the only way to guarantee that is to have Teresa call the SAME already-visibility-filtered read model a human manager would see, never assemble its own query. |
| D-OKR8-7 | `reflection_synthesis` — write shape? | **Two-gate structure, mirrors ROI-E008 exactly**: Teresa writes ONLY to new `teresa_draft_reflection_payload`/`teresa_draft_generated_at` columns (never `okr_vnext_reflections`' authoritative fields), regeneration blocked once a human `teresa_draft_disposition` is recorded, the human's own `POST .../sets/:id/final-score` / `POST .../objectives/:id/reflection` remains the ONLY path that ever writes the authoritative reflection content. | Requirement text is explicit: "proponowany patch wymagający jawnej akceptacji; brak autonomicznego submit/approval/scoring/carry-forward" — structurally identical to ROI-E006/E008's already-proven lessons-draft pattern; reusing a working mechanism beats inventing a new one. |
| D-OKR8-8 | Who owns the disposition-recording command (`recordOkrReflectionTeresaDraftDisposition`)? | **Designed here (OKR-E008) since OKR-F-027 is what names the requirement**, but flagged as a candidate to actually land inside OKR-E007's own command file (`okrReflectionCommands.ts`) at implementation time if E007 has not yet shipped — **open question, see §D**, not silently resolved. | Unlike ROI, where ROI-E006 AC-06 *already* named and built the disposition gate before ROI-E008 existed, **no OKR-E007 AC names a Teresa disposition mechanism at all** (re-read OKR-F-021..024 verbatim in §0 — none mention it). OKR-E008 is the first place this requirement is written down; whether the implementation PR lands in an "E007.1" patch or inside E008 itself is a sequencing call for whoever schedules the work, not a design fact this document can settle unilaterally. |
| D-OKR8-9 | `undoProposal` for `target_module='okr'`? | **Block**, same `P08_UNDO_NOT_SUPPORTED` shape as `kpi`/`roi`. | Five heterogeneous modes (create/review/check-in/brief/reflection-draft) make one safe, uniform undo semantics harder to define correctly than for KPI's 3 or ROI's 1 — same conservative default, stated explicitly rather than half-building a partial undo for only some modes. |
| D-OKR8-10 | Add `'okr'` to the `HandoffTargetModule` union type itself? | **Yes — required**, unlike `kpi`/`roi` which were pre-reserved. See §1.1's CRITICAL FINDING. | No alternative — the type union gates every other piece of this wiring; without it `P08_HANDOFF_TARGETS.okr` and `P08_HANDOFF_TARGET_MODULES`'s `'okr'` entry cannot type-check. |

### 3.2 New types (`teresaCopilotCanon.ts`, appended after `ResultsRoiHandoffContext`, before `P08_HANDOFF_TARGETS`)

```ts
// ────────────────────────────────────────────────────────────────
// OKR-E008 — Results/OKR advisor handoff (five governed modes, D-OKR8-1)
// ────────────────────────────────────────────────────────────────

export type ResultsOkrAdvisorMode =
  | 'objective_draft'          // OKR-F-025, POST .../advisor/draft
  | 'objective_quality_review' // OKR-F-025, POST .../advisor/quality-review
  | 'check_in_assist'          // OKR-F-026, POST .../advisor/check-in
  | 'manager_brief'            // OKR-F-026, POST .../advisor/manager-brief
  | 'reflection_synthesis';    // OKR-F-027, POST .../advisor/reflection

export interface ResultsOkrEvidenceBreakdown {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

export interface OkrObjectiveDraftPayload {
  proposed: {
    setId: string;
    title: string;
    description: string | null;
    ambitionType: 'committed' | 'aspirational' | 'standard'; // OKR-F-007
    ownerUserId: string | null;
  };
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
  // Deliberately NO key_results array here (D-OKR8-2) — Objective-only.
}

export interface OkrObjectiveQualityReviewPayload {
  objective_id: string;
  quality_review: {
    purpose_question: string;
    actionability_question: string;
    ambition_alignment_note: string | null;
    duplicate_risk: { candidate_objective_ids: string[]; note: string | null };
  };
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
  // No `proposed` block (D-OKR8-3) — narrative-only, real_entity:false.
}

export interface OkrCheckInAssistPayload {
  key_result_id: string;
  proposed_confidence: 'green' | 'amber' | 'red' | null;
  proposed_value: number | null; // metric-type KR only; must cite evidence_breakdown, never fabricated
  note: string;
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

export interface OkrManagerBriefPayload {
  scope: 'my_sets' | 'team' | 'organization';
  cited_set_ids: string[];
  narrative: string;
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

export interface OkrReflectionSynthesisPayload {
  objective_id: string; // OKRReflection is Objective-scoped per OKR-F-021
  draft_reflection_text: string; // what worked / what didn't / why / lesson / change
  proposed_disposition_hint: 'carry_forward' | 'close_as_is' | null; // advisory only, never auto-applied
  evidence_breakdown: ResultsOkrEvidenceBreakdown;
}

export interface ResultsOkrHandoffContext {
  advisor_mode: ResultsOkrAdvisorMode;
  target_resource: {
    resource_type: 'okr_set' | 'okr_objective' | 'okr_key_result';
    resource_id: string | null; // null ONLY for objective_draft's create path
  };
  expected_version: number | null; // null legal ONLY on objective_draft's create path
  objective_draft?: OkrObjectiveDraftPayload;
  objective_quality_review?: OkrObjectiveQualityReviewPayload;
  check_in_assist?: OkrCheckInAssistPayload;
  manager_brief?: OkrManagerBriefPayload;
  reflection_synthesis?: OkrReflectionSynthesisPayload;
}
```

### 3.3 `P08_HANDOFF_TARGETS` entry (append after `roi:`)

```ts
okr: {
  module: 'OKR' as const,
  contract_ref: 'OKR-E008',
  description:
    'Governed OKR advisor: Objective drafting + quality-review, check-in ' +
    'assistance (visibility-scoped), manager brief (cites OKR-E006 attention ' +
    'read model only), reflection/next-cycle synthesis drafting. Teresa never ' +
    'creates/submits/approves/rejects/scores/carries-forward a Set, never ' +
    'invents current value/progress/confidence/blocker/cause/intent — see ' +
    'P08_OKR_FORBIDDEN_VERBS.',
  required_common_payload: true,
  required_extra_fields: ['okr_handoff_context', 'evidence_pointers'] as const,
},
```

### 3.4 `HandoffTargetModule` union — add `'okr'` (D-OKR8-10, the one real deviation from the KPI/ROI precedent)

```ts
export type HandoffTargetModule =
  | 'radar'
  | 'initiatives'
  | 'calendar'
  | 'notebook'
  | 'interview'
  | 'excele'
  | 'ideas'
  | 'results'
  | 'kpi'
  | 'roi'
  | 'okr'  // OKR-E008 — NEW slot, was never pre-reserved (unlike 'kpi'/'roi')
  | 'execution'
  | 'finance'
  | 'meeting'
  | 'outputs'
  | 'documents'
  | 'tables'
  | 'presentations';
```

### 3.5 `P08_HANDOFF_TARGET_MODULES` — append only

```ts
export const P08_HANDOFF_TARGET_MODULES: HandoffTargetModule[] = [
  'radar', 'initiatives', 'calendar', 'notebook', 'interview', 'excele',
  'ideas', 'documents', 'presentations',
  'kpi', // KPI-E006, appended — existing 9 entries untouched
  'roi', // ROI-E008, appended — existing 10 entries untouched
  'okr', // OKR-E008, appended — existing 11 entries untouched
];
```

### 3.6 `P08_OKR_FORBIDDEN_VERBS` — CANNOT be finalized today (blocker, stated plainly)

Unlike KPI-E006 (grepped against landed `kpi*Commands.ts`) and ROI-E008
(re-grepped against landed `roi*Commands.ts`, ~20 files), **there is no
`server/src/services/resultsVnext/okr/*Commands.ts` to grep yet** — zero
files exist (§2.3). The forbidden-verbs documentation array and the
import-whitelist enforcement it documents cannot be written with real
names until OKR-E001-E007 land. Placeholder shape to fill in at
implementation time, once those command files exist:

```ts
export const P08_OKR_FORBIDDEN_VERBS = [
  // okrProgramCommands.ts / okrCycleCommands.ts (OKR-E001)
  // -- re-grep at implementation time --
  // okrSetCommands.ts / okrSetMaterialChangeCommands.ts (OKR-E002)
  'createOkrSet', 'updateOkrSetDraft', 'narrowOkrSetVisibility',
  'submitOkrSetForApproval', 'approveOkrSet', 'requestChangesOnOkrSet',
  'activateOkrSet', 'cancelOkrSet', 'recordOkrSetMaterialChange',
  // ^ these 9 ARE real, taken verbatim from OKR-E002's own §7 file list
  //   (the only OKR command names that exist in any FROZEN design doc
  //   today) — everything below is a placeholder pending E003-E007 landing.
  // okrObjectiveCommands.ts / okrKeyResultCommands.ts (OKR-E003, UNBUILT)
  // okrCheckInCommands.ts (OKR-E004, UNBUILT)
  // okrAlignmentCommands.ts (OKR-E005, UNBUILT)
  // okrSupportCommands.ts / okrDecisionCommands.ts (OKR-E006, UNBUILT)
  // okrReflectionCommands.ts / okrCarryForwardCommands.ts (OKR-E007, UNBUILT)
  //
  // MANDATORY at implementation time (this epic cannot skip this, unlike
  // ROI-E008 D16's "re-confirm one line reference" — this is a full,
  // currently-impossible-to-complete re-derivation):
  //   grep -nE "^export (async )?function [a-zA-Z]+" \
  //     server/src/services/resultsVnext/okr/*Commands.ts
  //   and append every export found, EXCLUDING this epic's own new
  //   Teresa-facing writes (createOkrObjective's Teresa call path reuses
  //   the SAME human command, not a Teresa-only alias — so nothing here
  //   should need excluding, unlike ROI's one `recordRoiPirTeresaLessonsDraft`
  //   exception).
] as const;
```

**Teresa's actual whitelist** (the real enforcement, same pattern as KPI/ROI)
— names below use OKR-E002's own confirmed function names for the one mode
that could theoretically reuse an E002 export directly (none of the 5 modes
actually do — every mode's target is an E003/E004/E006/E007 command, all
unbuilt), so this whitelist is provisional pending those epics:

```ts
import { createOkrObjective } from '../resultsVnext/okr/okrObjectiveCommands.js'; // OKR-E003, UNBUILT — objective_draft
import { getOkrSet } from '../resultsVnext/okr/okrSetRepository.js';              // OKR-E002 — read, resolve set context
import { getOkrObjective } from '../resultsVnext/okr/okrObjectiveRepository.js';  // OKR-E003, UNBUILT — objective_quality_review target read
import { recordOkrCheckIn } from '../resultsVnext/okr/okrCheckInCommands.js';     // OKR-E004, UNBUILT — check_in_assist
import { listOkrAttention } from '../resultsVnext/okr/okrAttentionRepository.js'; // OKR-E006, UNBUILT — manager_brief citation source
import { recordOkrReflectionTeresaDraft } from '../resultsVnext/okr/okrReflectionCommands.js'; // OKR-E007 (or E008-owned, D-OKR8-8) — reflection_synthesis
```

### 3.7 Dispatcher + handlers (shape only — real bodies need E003/E004/E006/E007's real signatures)

`performHandoff`'s switch gets one more case, same one-liner shape as `kpi`/`roi`:

```ts
case 'okr':
  return handleResultsOkrHandoff(proposalId, organizationId, userId, handoffContext, targetPayload);
```

```ts
async function handleResultsOkrHandoff(
  proposalId: string, organizationId: string, userId: string,
  context: TeresaHandoffContext, payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const okrContext = payload.okr_handoff_context as ResultsOkrHandoffContext | undefined;
  if (!okrContext?.advisor_mode) {
    throw new TeresaCopilotError('okr_handoff_context.advisor_mode missing', 'P08_OKR_INVALID_PAYLOAD');
  }
  switch (okrContext.advisor_mode) {
    case 'objective_draft':
      return handleOkrObjectiveDraft(proposalId, organizationId, userId, context, okrContext);
    case 'objective_quality_review':
      return handleOkrObjectiveQualityReview(proposalId, organizationId, userId, context, okrContext);
    case 'check_in_assist':
      return handleOkrCheckInAssist(proposalId, organizationId, userId, context, okrContext);
    case 'manager_brief':
      return handleOkrManagerBrief(proposalId, organizationId, userId, context, okrContext);
    case 'reflection_synthesis':
      return handleOkrReflectionSynthesis(proposalId, organizationId, userId, context, okrContext);
    default: {
      const _exhaustive: never = okrContext.advisor_mode;
      throw new TeresaCopilotError(`Unknown OKR advisor mode: ${String(_exhaustive)}`, 'P08_OKR_UNKNOWN_MODE');
    }
  }
}
```

Each `handleOkr*` function follows the EXACT shape already proven twice
(§1.2's verified notes): CAS via `expected_version`, `actorEffectiveRole:
'teresa_initiated'`, `idempotencyKey: proposalId`, `correlationId:
context.runtime_binding?.conversation_id ?? undefined`, re-throw
`AtomicWriteConflictError` as-is, `as unknown as Record<string, unknown>`
cast wherever a typed payload interface feeds a `Record<string,unknown>`
command field (the real `server/tsconfig.json` strictness fact from §1.2),
and a `recordTeresaOkrHandoffResult(proposalId, organizationId, resultRef)`
helper (`target_module='okr'`, otherwise byte-identical to the kpi/roi
helpers) after every successful write. `objective_quality_review` and
`manager_brief` skip the write call entirely (`real_entity: false`),
matching KPI Mode 2's `handleKpiCheckInManagerBrief` shape exactly (re-run
the visibility check AT EXECUTION TIME against `cited_set_ids`/
`candidate_objective_ids`, not trusting the payload assembled minutes
earlier in chat — literal AC-026 "restricted data filtered before
retrieval").

### 3.8 `undoProposal` block (D-OKR8-9)

Inserted in the SAME position as the `kpi`/`roi` blocks (§1.2) — above the
generic `if (row.target_module !== 'excele')` check, third in the sequence:

```ts
if (row.target_module === 'okr') {
  throw new TeresaCopilotError(
    'Undo is not supported for OKR handoffs (five heterogeneous modes — ' +
    'no single safe reversal; discard an unwanted reflection draft via the ' +
    'disposition command instead, once built — see D-OKR8-8).',
    'P08_UNDO_NOT_SUPPORTED',
    409
  );
}
```

### 3.9 New migration — reflection Teresa-draft columns (D-OKR8-7/D-OKR8-8)

Additive only, targets a table this epic does NOT itself create
(`okr_vnext_reflections`, OKR-E007) — **this migration file can only be
written and run AFTER OKR-E007's own migration lands**; sequencing note,
not a design gap:

```sql
-- server/migrations/<8-digit-date>_rvn_okr_reflection_teresa_draft.sql
-- Run AFTER OKR-E007's own okr_vnext_reflections migration.
ALTER TABLE okr_vnext_reflections
  ADD COLUMN IF NOT EXISTS teresa_draft_reflection_payload JSONB NULL,
  ADD COLUMN IF NOT EXISTS teresa_draft_generated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS teresa_draft_disposition TEXT NULL
    CHECK (teresa_draft_disposition IN ('accepted','rejected') OR teresa_draft_disposition IS NULL);
-- Extend whatever "protect frozen fields" trigger OKR-E007 defines (mirror
-- of rvn_roi_pir_protect_frozen, ROI-E008 D8) via CREATE OR REPLACE
-- FUNCTION only, once that trigger's real name is known.
```


---

## 4. HALF B — Perspectives (OKR-F-028)

### 4.1 Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| D-OKR8-11 | Which perspectives are required? | **Three, literally named**: `/okr/my`, `/okr/team-health`, `/okr/company` — matching the ledger's own Command/query/API cell exactly. No `/okr/attention` here (that is OKR-E006's own route, OKR-F-020, already built by that epic — OKR-E008 does not duplicate it). | Governing table's own cell lists exactly these three; nothing more, nothing less. |
| D-OKR8-12 | `/okr/my` scope — Set-level only, or reach into Objective/KR ownership? | **Set-level only for this epic**: `owner_user_id = caller` OR `reviewer_user_id = caller` on `okr_vnext_sets` (both columns exist today, OKR-E002 schema). No Objective/KR-level ownership join. | OKR-E003 (Objective/KR ownership) is unlanded (§2.3) — joining against a schema that doesn't exist yet would be fabricated. Scoping to what OKR-E002's REAL, frozen schema already provides is honest, narrow, and extends cleanly once E003 lands (a later, explicitly-scoped follow-up, not a silent gap). |
| D-OKR8-13 | `/okr/team-health` — reuse KPI's `chain_members`/`scoped_*` two-layer shape? | **Yes, verbatim pattern** (`buildScopedOkrSetsBase`), mirroring `kpiPerspectivesRepository.ts`'s `buildScopedKpisBase` / `roiOrgPerspectiveRepository.ts`'s `buildScopedRoiCasesBase` exactly: `rvn_platform_management_chain_closure` for `chain_members`, INNER JOIN `rvn_visible_resources` (resource_type='okr_set') for the visibility layer, INNER JOIN `chain_members` on `owner_user_id` for the chain layer — both layers required, never one substituting for the other (T3). | Proven pattern, twice. No reason to invent a third shape for a third domain. |
| D-OKR8-14 | `/okr/team-health`'s attention/health metrics — what can it honestly report today? | **Only what OKR-E002's real schema populates**: counts by `status`, by `scope_type`. `attention_state`/`last_checkin_at`/`next_checkin_due_at` columns exist on `okr_vnext_sets` (OKR-E002 DDL) but are explicitly "Reserved for OKR-E003/E004 rollups — NOT populated, NOT read, by any E002 command" (E002's own DDL comment). Surface them in the response shape now (so the frontend contract is stable), but they will read `NULL`/`'none'` for every Set until OKR-E004 lands — state this plainly in the endpoint's own doc comment, never backfill a fabricated value. | Matches this program's repeated "reserve now, avoid ALTER later" discipline while refusing to fabricate data a later epic is responsible for producing. An honest `null`/`'none'` beats a synthesized health score. |
| D-OKR8-15 | Parity proof mechanism (F-028's literal ask)? | New contract test `tests/resultsVnext/okr/okrPerspectivesParity.realdb.test.ts`: create one Set visible to a manager via all three lenses (owner → `/okr/my`; in their management chain → `/okr/team-health`; `scope_type='company'` → `/okr/company`) and assert byte-identical `set_id`/`current_version` returned by each of the three functions for that Set. | Literal, direct proof of "zwracają te same Set IDs i wersje... dowód że to widoki, nie kopie" — same style as KPI-E007's `kpiIdentityAcrossSurfaces.realdb.test.ts` (parity/identity proof pattern already established in this program, reused here rather than invented). |

### 4.2 New repository (`server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts`)

Mirrors `kpiPerspectivesRepository.ts`'s file-level shape: shared
`withReadClient`/`queryRows` helpers, `buildVisibilityScopedCte` for
`resourceType: 'okr_set'`, every `vr.resource_id = <col>::text` cast
mandatory (same program-wide bug class, EXECUTION_LEDGER §24).

```ts
export interface ListMyOkrSetsParams {
  userId: string;
  organizationId: string;
  limit?: number;
  offset?: number;
}

/** D-OKR8-12: Set-level ownership only (owner_user_id OR reviewer_user_id),
 * scoped through the standard okr_set visibility CTE. Extends cleanly once
 * OKR-E003 lands Objective/KR-level ownership (a later, explicit addition
 * — not silently assumed here). */
export async function listMyOkrSets(params: ListMyOkrSetsParams): Promise<OkrSetSummary[]> {
  const { userId, organizationId, limit = 100, offset = 0 } = params;
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'okr_set' });
  const sql = `${cte.sql}
SELECT s.set_id, s.current_version, s.title, s.status, s.scope_type, s.scope_id,
       s.owner_user_id, s.reviewer_user_id, s.attention_state,
       s.last_checkin_at, s.next_checkin_due_at
  FROM okr_vnext_sets s
  INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'okr_set' AND vr.resource_id = s.set_id::text
 WHERE s.organization_id = $1
   AND (s.owner_user_id = $3 OR s.reviewer_user_id = $3)
 ORDER BY s.updated_at DESC
 LIMIT $${cte.values.length + 1} OFFSET $${cte.values.length + 2}`;
  // $3 = userId, already present in cte.values per buildVisibilityScopedCte's own convention.
  const rows = await withReadClient((client) =>
    queryRows<OkrSetSummaryRow>(client, sql, [...cte.values, limit, offset])
  );
  return rows.map(toOkrSetSummary);
}

/** D-OKR8-13: two-layer chain_members + scoped_sets, verbatim pattern
 * source: kpiPerspectivesRepository.ts::buildScopedKpisBase /
 * roiOrgPerspectiveRepository.ts::buildScopedRoiCasesBase. */
export async function buildScopedOkrSetsBase(
  managerId: string,
  organizationId: string
): Promise<{ sql: string; values: unknown[] }> {
  const cte = await buildVisibilityScopedCte({ userId: managerId, organizationId, resourceType: 'okr_set' });
  const values: unknown[] = [...cte.values, managerId];
  const sql = `${cte.sql},
chain_members AS (
  SELECT descendant_user_id AS user_id
    FROM rvn_platform_management_chain_closure
   WHERE organization_id = $1 AND ancestor_user_id = $4
  UNION
  SELECT $4
),
scoped_sets AS (
  SELECT s.*
    FROM okr_vnext_sets s
    INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'okr_set' AND vr.resource_id = s.set_id::text
    INNER JOIN chain_members cm ON cm.user_id = s.owner_user_id
   WHERE s.organization_id = $1
)`;
  return { sql, values };
}

export interface OrganizationOkrTeamHealth {
  countsByStatus: Array<{ status: string; count: number }>;
  countsByScopeType: Array<{ scopeType: string; count: number }>;
  // D-OKR8-14: honest passthrough — will read null/'none' for every row
  // until OKR-E004 populates these columns. NOT fabricated here.
  attentionBreakdown: Array<{ attentionState: string; count: number }>;
}

export async function listOrganizationOkrTeamHealth(params: {
  managerId: string; organizationId: string;
}): Promise<OrganizationOkrTeamHealth> {
  const { managerId, organizationId } = params;
  const base = await buildScopedOkrSetsBase(managerId, organizationId);
  const [byStatus, byScope, byAttention] = await Promise.all([
    withReadClient((client) => queryRows<{ status: string; count: string }>(
      client, `${base.sql} SELECT status, COUNT(*)::int AS count FROM scoped_sets GROUP BY status`, base.values)),
    withReadClient((client) => queryRows<{ scope_type: string; count: string }>(
      client, `${base.sql} SELECT scope_type, COUNT(*)::int AS count FROM scoped_sets GROUP BY scope_type`, base.values)),
    withReadClient((client) => queryRows<{ attention_state: string; count: string }>(
      client, `${base.sql} SELECT attention_state, COUNT(*)::int AS count FROM scoped_sets GROUP BY attention_state`, base.values)),
  ]);
  return {
    countsByStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    countsByScopeType: byScope.map((r) => ({ scopeType: r.scope_type, count: Number(r.count) })),
    attentionBreakdown: byAttention.map((r) => ({ attentionState: r.attention_state, count: Number(r.count) })),
  };
}

/** D-OKR8-4: reuses OKR-E002's own listOkrSets, filtered — NOT a new query,
 * literal "projection, not a copy" proof. If listOkrSets is not exported in
 * a directly-filterable shape by the time this lands, add a thin
 * `scopeType: 'company'` parameter to it rather than duplicating its SQL
 * here — same as OKR-E002's own design already promised. */
export async function listCompanyOkrSets(params: {
  userId: string; organizationId: string;
}): Promise<OkrSetSummary[]> {
  // Delegates to okrSetRepository.ts::listOkrSets({ ...params, scopeType: 'company' })
  // — implementation deferred to that file (OKR-E002), not duplicated here.
  throw new Error('delegates to okrSetRepository.listOkrSets — see D-OKR8-4');
}
```

### 4.3 Routes (`server/src/routes/resultsVnext/okr.routes.ts`, extended — same file OKR-E002 already owns)

```
GET /api/vnext/results/okr/my            -- listMyOkrSets
GET /api/vnext/results/okr/team-health   -- listOrganizationOkrTeamHealth
GET /api/vnext/results/okr/company       -- ALREADY BUILT by OKR-E002, reused as-is
```

Mount-order note: `/my`/`/team-health`/`/company` are literal path segments
under `/okr`, not params — same non-issue KPI-E007 §8 already worked
through, but keep them registered before any future `/okr/:something`
dynamic segment for consistency.

---

## 5. HALF C — Legacy (OKR-F-029, the isolating AC)

### 5.1 Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| D-OKR8-16 | Legacy table inventory — 4 tables, confirmed? | **Yes, confirmed by direct re-grep** (§2.1/§2.2): `okr_cycles`, `okr_objectives`, `okr_key_results`, `okr_check_ins`, all from `server/migrations/914_okr_management.sql` (+ `okr_key_results.kpi_definition_version_id` from a SEPARATE later migration, `20260803_res009_okr_key_result_definition_version.sql` — both FKs real, both D09 violations, landing in two different files). | Direct grep, not inherited — same discipline KPI-E007/ROI-E008 both applied to their own inventories, both of which found real corrections. OKR's own inventory needed one (the two-migration-file split), stated in §2.2. |
| D-OKR8-17 | Origin-domain labeling — 1 bucket (KPI-E007 style) or multi-bucket (ROI-E008 style)? | **Single bucket, `okr_legacy_live`** — all 4 tables genuinely belong to ONE owning surface (`resultsStrategic.routes.ts`'s `/:projectId/okr/*`, `okrService.ts`), unlike ROI's 3 genuinely-separate live systems. | Matches ROI-E008 D14's own reasoning in reverse: multi-bucket is warranted only when tables truly come from separate systems; here all 4 come from the same 914 migration + one RES-009 follow-up, same route file, same service. A single, accurate label beats inventing false distinctions. |
| D-OKR8-18 | Is this legacy system dead or live? | **Live** — `resultsStrategic.routes.ts` exposes real write endpoints (`requireProjectCapability(..., {shadow:true})`-gated but real; shadow mode = logged, not blocked, unless `CAPABILITY_ENFORCE=enforce`). Label text says "live, external to Results vNext," matching ROI's phrasing convention, NOT KPI's "archive — read-only" phrasing (which was accurate for KPI's genuinely-dead `kpis`/`kpi_definitions` tables but would be misleading here). | Direct verification (§2.1/§2.2) — this is not a dead table nobody writes to; a maintainer reading "archive — read-only" would wrongly conclude no one uses this system anymore. |
| D-OKR8-19 | Extra: label the two D09-violating columns on `okr-key-results` specifically? | **Yes — new, OKR-specific addition**: a fixed `warnings` array in the `okr-key-results` list/get response noting `kpi_id`/`kpi_definition_version_id` are legacy-only cross-references, informational since 2026-07-12 (D7/Piotr), never used for scoring, and that `okr_vnext_*` carries no equivalent FK. | Neither KPI-E007 nor ROI-E008 needed this — neither of THEIR legacy tables carried a live FK pointed at another domain's scoring logic. OKR's `okr_key_results.kpi_id`/`kpi_definition_version_id` are exactly that, and the archive response would otherwise silently reproduce the FK values (via `SELECT *`) with no context, risking a future reader assuming they still drive OKR scoring. This directly operationalizes OKR-F-029's "labels/isolates" language in a way generic to this domain only. |
| D-OKR8-20 | The literal "ZERO FK" proof (OKR-F-029's Schema cell) — how? | **New static test**, not present in KPI-E007/ROI-E008 (neither needed it — no INBOUND cross-domain FK existed in their legacy inventories): `grep -RE "REFERENCES\s+(okr_key_results|initiative_kpis|kpi_definition_versions|kpi_time_series)"` across every `server/migrations/*rvn_okr*.sql` / `*okr_vnext*.sql` file — assert zero matches. Plus a second grep across `server/src/services/resultsVnext/okr/*.ts` for the literal strings `kpiDefinitionService`/`kpi_time_series` — assert zero matches (the exact violation `okrService.ts` itself has, structurally forbidden from recurring in vNext). | Genuinely new proof shape this epic needs that its two siblings didn't — OKR is the first domain in this program where the INBOUND legacy FK direction (another domain's legacy table pointing at OKR-adjacent data, or here, OKR's own legacy table pointing OUT at KPI) is the isolation risk, not just "vNext reads its own legacy tables." |

### 5.2 GET-only legacy archive router

New file `server/src/routes/resultsVnext/okrLegacyArchive.routes.ts`,
reusing `denyMutations` **verbatim, unchanged** — middleware order and
import paths copied from the two REAL landed files (§1.4/§1.5), not their
design docs' pseudocode:

```ts
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js'; // NOT orgAccess.middleware.js
import { denyMutations } from '../../middleware/readOnlyGuard.middleware.js';
import { validateParams, validateQuery } from '../../middleware/validation.middleware.js';

const router = Router();
router.use(denyMutations);          // FIRST — before auth, per both landed files
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);
```

9 endpoints (1 index + 4 tables × list/get):

```
GET /api/vnext/results/okr/legacy                        -- index (4 rows, fixed order)
GET /api/vnext/results/okr/legacy/cycles[/:legacyId]
GET /api/vnext/results/okr/legacy/objectives[/:legacyId]
GET /api/vnext/results/okr/legacy/key-results[/:legacyId]
GET /api/vnext/results/okr/legacy/check-ins[/:legacyId]
```

**Labeling (D-OKR8-17)**:

```ts
type OkrLegacyOriginDomain = 'okr_legacy_live';

const LEGACY_LABELS: Record<string, { originDomain: OkrLegacyOriginDomain; label: string }> = {
  cycles:      { originDomain: 'okr_legacy_live', label: "Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext" },
  objectives:  { originDomain: 'okr_legacy_live', label: "Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext" },
  'key-results': { originDomain: 'okr_legacy_live', label: "Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext" },
  'check-ins': { originDomain: 'okr_legacy_live', label: "Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext" },
};
```

`legacyMeta(routeKey, sourceTable, organizationId, total?, limit?, offset?)`
— same helper shape as the landed ROI file (§1.5), keyed by kebab-case
route segment separately from the raw SQL table name.

**D-OKR8-19's warnings array** — added ONLY to `key-results`'s list/get
response, alongside the standard `{ data, meta }` envelope:

```ts
router.get('/key-results', validateQuery(ListOkrLegacyQuerySchema), async (req, res) => {
  // ... standard list handler shape (see §1.4/§1.5) ...
  res.json({
    data: rows,
    meta: legacyMeta('key-results', 'okr_key_results', organizationId, total, limit, offset),
    warnings: [
      'kpi_id and kpi_definition_version_id are legacy-only cross-references to ' +
      'initiative_kpis / kpi_definition_versions. Informational only since ' +
      '2026-07-12 (D7, migration 914 header) — never used for scoring. ' +
      'okr_vnext_* carries no equivalent FK (D09).',
    ],
  });
});
```

### 5.3 Repository (`server/src/services/resultsVnext/okr/okrLegacyArchiveRepository.ts`)

Same shape as the two landed precedents — zero imports from any
`*Commands.ts` file, hardcoded table name per function (never
interpolated from a runtime argument), `organization_id` always the first
bound param. All 4 tables have `organization_id TEXT NOT NULL` directly
(§2.2) — simplest case of the three domains, no join-through, no schema
ambiguity (unlike KPI's `v8_kpi_definitions`/`tp_kpi_definitions`).

```ts
export async function listLegacyOkrCycles(organizationId: string, limit: number, offset: number) {
  const client = await acquirePgClient();
  try {
    const { rows } = await client.query(
      `SELECT * FROM okr_cycles WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]);
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM okr_cycles WHERE organization_id = $1`, [organizationId]);
    return { rows, total: countRows[0]?.total ?? 0 };
  } finally { client.release(); }
}
export async function getLegacyOkrCycle(organizationId: string, legacyId: string) {
  const client = await acquirePgClient();
  try {
    const { rows } = await client.query(
      `SELECT * FROM okr_cycles WHERE organization_id = $1 AND id = $2`, [organizationId, legacyId]);
    return rows[0] ?? null;
  } finally { client.release(); }
}
// listLegacyOkrObjectives/getLegacyOkrObjective — identical shape, table `okr_objectives`.
// listLegacyOkrKeyResults/getLegacyOkrKeyResult — identical shape, table `okr_key_results`
//   (SELECT * deliberately includes kpi_id/kpi_definition_version_id — D-OKR8-19's
//   warnings array is added at the ROUTE layer, not hidden here at the repo layer).
// listLegacyOkrCheckIns/getLegacyOkrCheckIn — identical shape, table `okr_check_ins`.

export async function getOkrLegacyArchiveIndex(organizationId: string) {
  const client = await acquirePgClient();
  try {
    const tables = [
      { routeKey: 'cycles', sourceTable: 'okr_cycles' },
      { routeKey: 'objectives', sourceTable: 'okr_objectives' },
      { routeKey: 'key-results', sourceTable: 'okr_key_results' },
      { routeKey: 'check-ins', sourceTable: 'okr_check_ins' },
    ] as const;
    const results = [];
    for (const t of tables) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS count FROM ${t.sourceTable} WHERE organization_id = $1`, [organizationId]);
      results.push({ ...t, originDomain: 'okr_legacy_live' as const, count: rows[0]?.count ?? 0 });
    }
    return results;
  } finally { client.release(); }
}
```

### 5.4 Validators (`server/src/validators/resultsVnextOkrLegacy.validators.ts`)

Same shape as KPI/ROI's — `ListOkrLegacyQuerySchema` (limit/offset, mirrors
`ListKpisQuerySchema`), `OkrLegacyIdParamsSchema` (`legacyId: z.string().min(1).max(200)`,
permissive — legacy OKR PKs are `TEXT PRIMARY KEY DEFAULT
gen_random_uuid()::text`, so UUID-shaped in practice but not worth a
UUID-format constraint given the other 3 domains' precedent of staying
permissive here).

### 5.5 Contract tests

**`tests/resultsVnext/okr/legacyIsolation.realdb.test.ts`** — same 6-step
skeleton as KPI-E007/ROI-E008 (seed control Set via whatever vNext
read-models exist at implementation time, poison all 4 legacy tables with
same-org lookalike rows, assert `okrSetRepository`/`okrPerspectivesRepository`
never surface poisoned rows, assert control Set DOES appear (non-vacuous
positive), static `readFileSync`+regex on those two files for zero
`\b(okr_cycles|okr_objectives|okr_key_results|okr_check_ins)\b` matches
(word-boundary, does not match `okr_vnext_*`), cleanup in `finally`.

**`tests/resultsVnext/okr/okrLegacyArchive.routes.test.ts`** — supertest,
POST/PUT/PATCH/DELETE against all 9 route paths → assert 405 +
`LEGACY_ARCHIVE_READ_ONLY` (36 assertions), plus static
`readFileSync`+regex for zero `router.(post|put|patch|delete)(`.

**`tests/resultsVnext/okr/okrD09ZeroFkIsolation.test.ts`** (D-OKR8-20, NEW
shape, no KPI/ROI equivalent) — two static-only assertions, no DB needed:
1. `grep`-equivalent over every `server/migrations/*rvn_okr*.sql` /
   `*okr_vnext*.sql` file for `REFERENCES\s+(okr_key_results|initiative_kpis|
   kpi_definition_versions|kpi_time_series)` — assert zero matches.
2. `grep`-equivalent over every `server/src/services/resultsVnext/okr/*.ts`
   file for the literal strings `kpiDefinitionService`/`kpi_time_series` —
   assert zero matches.

**`tests/resultsVnext/okr/okrPerspectivesParity.realdb.test.ts`** (D-OKR8-15,
described in §4.1).

### 5.6 Monitoring

One new counter, same shape as the two precedents:

```ts
export const resultsVnextOkrLegacyArchiveHitsTotal = new Counter({
  name: 'results_vnext_okr_legacy_archive_hits_total',
  help: 'Requests served by the OKR legacy archive read-only adapter, by source table',
  labelNames: ['source_table'],
});
```

### 5.7 Gateway mount

```ts
import resultsVnextOkrLegacyArchiveRoutes from './routes/resultsVnext/okrLegacyArchive.routes.js';
app.use('/api/vnext/results/okr/legacy', resultsVnextOkrLegacyArchiveRoutes);
app.use('/api/vnext/results/okr', resultsVnextOkrRoutes); // existing (OKR-E001/E002), must stay AFTER /legacy
```


---

## 6. (D) File list

**New:**
- `server/src/services/resultsVnext/okr/okrPerspectivesRepository.ts` (§4.2)
- `server/src/routes/resultsVnext/okrLegacyArchive.routes.ts` (§5.2)
- `server/src/services/resultsVnext/okr/okrLegacyArchiveRepository.ts` (§5.3)
- `server/src/validators/resultsVnextOkrLegacy.validators.ts` (§5.4)
- `server/migrations/<date>_rvn_okr_reflection_teresa_draft.sql` (§3.9, run AFTER OKR-E007's own migration)
- `tests/resultsVnext/teresa-okr-forbidden-verbs.test.ts` (§3.6, BLOCKED pending E001-E007 landing — see §D-1)
- `tests/resultsVnext/okr/teresaObjectiveDraftQualityReview.realdb.test.ts` (BLOCKED pending E003)
- `tests/resultsVnext/okr/teresaCheckInAssist.realdb.test.ts` (BLOCKED pending E004)
- `tests/resultsVnext/okr/teresaManagerBrief.realdb.test.ts` (BLOCKED pending E006)
- `tests/resultsVnext/okr/teresaReflectionSynthesis.realdb.test.ts` (BLOCKED pending E007, D-OKR8-7/8)
- `tests/resultsVnext/okr/legacyIsolation.realdb.test.ts` (§5.5)
- `tests/resultsVnext/okr/okrLegacyArchive.routes.test.ts` (§5.5)
- `tests/resultsVnext/okr/okrD09ZeroFkIsolation.test.ts` (§5.5, buildable TODAY — static-only, no dependency on E003-E007)
- `tests/resultsVnext/okr/okrPerspectivesParity.realdb.test.ts` (§4.1, needs at minimum OKR-E002 landed)
- `tests/v8/teresa-okr-handoff.test.ts` (unit, 5 modes, BLOCKED pending E003/E004/E006/E007)

**Changed:**
- `server/src/services/v8/teresaCopilotCanon.ts` — new types (§3.2), `HandoffTargetModule` union gets `'okr'` (§3.4, the one real deviation from kpi/roi), `P08_HANDOFF_TARGETS.okr` (§3.3), `P08_HANDOFF_TARGET_MODULES` append (§3.5), `P08_OKR_FORBIDDEN_VERBS` (§3.6, placeholder-only until E003-E007 land)
- `server/src/services/v8/teresaCopilotService.ts` — imports (§3.6, placeholder), `case 'okr':` in `performHandoff` (§3.7), `if (row.target_module === 'okr')` block in `undoProposal` (§3.8), 5 `handleOkr*` functions + `recordTeresaOkrHandoffResult` (§3.7)
- `server/src/routes/resultsVnext/okr.routes.ts` — `/my`, `/team-health` new routes (§4.3); `/company` already exists (OKR-E002), untouched
- `server/src/services/resultsVnext/okr/okrSetRepository.ts` (OKR-E002) — MAY need a `scopeType` filter param added to `listOkrSets` per D-OKR8-4's delegation note, if E002's landed shape doesn't already support it
- `server/src/Gateway.ts` — import + mount, `/api/vnext/results/okr/legacy` (§5.7)
- `server/src/services/metricsService.ts` — one new counter (§5.6)
- `docs/product/results-vnext/EXECUTION_LEDGER.md` — closure entry + explicit note that OKR-E008's Half A (Teresa) could only be DESIGNED, not built, until E003/E004/E006/E007 land; "8/8 OKR epics designed" is NOT the same claim as ROI's "8/8 built"
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` — OKR-F-025..029 rows — do NOT mark IMPLEMENTED for Half A's 5 modes until their real target commands exist; §5 (Legacy) and the `okrD09ZeroFkIsolation` static test ARE buildable today and could move to IMPLEMENTED independently

**Read-only reference (do not modify):** `readOnlyGuard.middleware.ts`,
`kpiLegacyArchive.routes.ts`/`roiLegacyArchive.routes.ts` (pattern source,
including real deviations from their own design docs — §1.4/§1.5),
`kpiPerspectivesRepository.ts`/`roiOrgPerspectiveRepository.ts` (pattern
source — §1.6/§1.7), `914_okr_management.sql`,
`20260803_res009_okr_key_result_definition_version.sql`, `okrService.ts`,
`resultsStrategic.routes.ts` (legacy, confirmed still live, NOT modified by
this epic per the task's own instruction), `OkrKeyResultModal.tsx`,
`OKR_E001_DESIGN.md`, `OKR_E002_DESIGN.md`.

---

## 7. (E) Open questions — genuine ambiguity, not guessed

1. **[BLOCKING, program-level]** Zero OKR vNext code exists today
   (`server/src/services/resultsVnext/okr/` doesn't exist — §2.3). This
   design's HALF A is necessarily prospective: every target command name
   for `objective_draft`/`objective_quality_review`/`check_in_assist`/
   `manager_brief`/`reflection_synthesis` is taken from the ledger's own AC
   cells, not from verified running code (unlike KPI-E006/ROI-E008, both
   built against fully-landed prerequisite epics). **The Integration Owner
   must decide the actual build sequencing**: does OKR-E008's Half A get
   implemented epic-by-epic as E003/E004/E006/E007 each land (5 small PRs,
   one per mode, each unblocked independently), or does the whole OKR
   domain wait and land Half A in one combined pass at the very end? This
   design supports either sequencing (each mode's dependency is named
   explicitly) but does not choose between them — that is a scheduling
   decision, not a design one.
2. Should Half C (Legacy) and Half B (Perspectives, partially) actually be
   PULLED FORWARD and implemented now, ahead of Half A? Unlike Half A,
   Half B's `/okr/my`/`/okr/team-health` only depend on OKR-E002 (already
   frozen) and Half C depends on nothing but the always-live legacy tables
   — both are buildable TODAY, unlike Half A's 5 modes. Splitting OKR-E008
   into "E008a: Legacy+Perspectives (buildable now)" and "E008b: Teresa
   (blocked on E003/E004/E006/E007)" would let 2 of 3 halves close
   immediately. Flagging this as a real option, not deciding it — the
   ledger currently treats OKR-E008 as one epic with one Status cell per
   AC, and splitting it changes that bookkeeping.
3. **D-OKR8-8's ownership question, restated**: should
   `recordOkrReflectionTeresaDraft`/its disposition counterpart actually be
   specified and landed as part of OKR-E007's own PR (since no OKR-E007 AC
   names a Teresa draft mechanism today, unlike ROI-E006's AC-06 which
   pre-built it for ROI-E008)? If yes, OKR-E007's own (currently 22-line,
   barely-started) draft needs a new AC-level requirement added before it
   freezes — a scope change to THAT epic's design, which this document
   cannot authorize unilaterally.
4. **`objective_draft`'s target `POST .../sets/:id/objectives`** — the
   ledger's OKR-F-025 AC text says the vertical slice is "Objective → Teresa
   suggestion → accept/reject → draft saved," but does NOT specify whether
   the Set must already be in `status='draft'`/`'active'` for Teresa to add
   an Objective to it, or whether Teresa can target ANY Set the human can
   see (subject to whatever guard OKR-E003's own `createOkrObjective`
   enforces). This is genuinely OKR-E003's call to make when it lands, not
   something this document should pre-decide by guessing E003's own status
   guard.
5. **`check_in_assist`'s `proposed_value`** — D-OKR8-5 requires it be cited
   from "an already-authorized source," but OKR-E004's own suggested-value
   mechanism (parallel to legacy's `getSuggestedValueForKeyResult`, which
   OKR-F-012 explicitly requires be reworked into "a typed optional
   reference, NOT a structural read") does not exist yet in any frozen
   design. Whether Teresa's `check_in_assist` calls that same typed
   reference, or has no numeric-suggestion capability at all until E004
   defines one, is an E004 design question this document flags but cannot
   resolve — a real risk that `proposed_value` ships as a Teresa-authored
   guess unless E004's own mechanism is wired in first.
6. **`manager_brief`'s `scope: 'organization'`** — OKR-F-026's Roles cell
   lists only "KR Owner, Manager," not an org-wide role; whether
   `scope:'organization'` should even be a legal value for OKR (unlike
   KPI's `check_in_manager_brief`, whose ledger precedent DID name an
   org-wide manager view) is unconfirmed against any OKR-specific AC text.
   Kept in the type union for symmetry with KPI's payload shape, but its
   authorization boundary needs an explicit call before this ships.
7. **`/okr/team-health`'s relationship to OKR-E006's `/okr/attention`**
   (OKR-F-020, Manager attention read model) — are these two DIFFERENT
   views (team-health = aggregate health stats; attention = actionable
   worklist) or should OKR-E008 just alias `/okr/team-health` to a filtered
   view of E006's `/okr/attention`? This document treats them as distinct
   (team-health = new, aggregate; attention = E006's own, worklist-shaped)
   but the ledger doesn't explicitly rule out consolidation — worth a
   product-level check before both ship separately.

---

**Status: COMPLETE.** All required reading done (source AC table quoted
verbatim §0; KPI_E006/ROI_E008/KPI_E007 precedents read in full; landed
code for `teresaCopilotCanon.ts`/`teresaCopilotService.ts`/
`readOnlyGuard.middleware.ts`/both legacy archive routers/both perspectives
repositories verified directly; OKR legacy inventory re-verified by direct
grep with 3 minor corrections logged in §2.2; OKR-E001/E002 design docs
read in full; EXECUTION_LEDGER §3.4/§3.6 quoted). Biggest finding requiring
Integration Owner attention before freeze: **zero OKR vNext code exists
today**, making Half A (Teresa) necessarily prospective — see §7 item 1.
