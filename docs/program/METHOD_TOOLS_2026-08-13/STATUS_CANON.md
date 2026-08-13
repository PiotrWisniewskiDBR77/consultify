# STATUS_CANON — Discovery Tools canonical status mapping (Stream F3)

Worktree: `codex/final-f3-status` @ base `fb6dfedd42`. DB: local Postgres 15
(`cfy-f3-status`, port 56601), migrated fresh with
`server/scripts/migrate.postgres.ts` (NODE_ENV=test, no `--safe`).

## 0. Confirmed defect (as given)

Rows whose DB status is `approved` or `GENERATED` rendered as **"Draft"** in
Discovery Tools list views. Root cause: several ad-hoc
`Record<string, ItemStatus>` maps in
`src/components/Discovery/DiscoveryToolsHub.tsx` each hand-listed a SUBSET of
the real backend vocabulary and fell back to `'DRAFT'` for anything outside
that subset — different subsets in different places, so the same raw status
could be "fine" in one map and silently "Draft" in another.

## 1. Vocabularies in play (inventory, with citations)

### 1a. `tool_sessions.status` — actual DB shape

Live schema check on the fresh Postgres instance (`\d tool_sessions`,
`pg_constraint`): **no CHECK constraint** — `status` is free `TEXT DEFAULT
'DRAFT'` (`server/migrations/942_ideas_collaboration_tool_sessions.sql:77`).
`SELECT DISTINCT status FROM tool_sessions` on the freshly-migrated DB
returned **0 rows** — the demo seed (`server/migrations/500_comprehensive_demo_data.sql`,
SQLite `INSERT OR IGNORE` syntax) is not part of the Postgres migration
runner's file list, so there is no seed data to sample from live. Falling
back to code-level evidence (what the backend actually WRITES) instead:

`server/src/controllers/ToolController.ts`:
- `normalizeStatus()` (line 89-93): `(status || 'DRAFT').trim().replace(/^['"]|['"]$/g, '').toUpperCase()` — reads are always uppercased, but does **not** validate against a fixed vocabulary (garbage in, uppercased garbage out).
- Writes observed: `'REVIEW'` (line 1459), `'APPROVED'` (line 1561), `'DRAFT'` (reopen, line 1650), `'FAILED'` (line 1883), `'GENERATED'` (line 1910, and again at 2441 inside `promoteToOutput`), `'IN_PROGRESS'` (line 2633).
- `getPromotionBlockers`/`requireDoD` (lines 183, 328) and every route guard compare against `normalizeStatus(session.status)` for `'REVIEW'`, `'DRAFT'`, `'IN_PROGRESS'`, `'FINALIZED'` (line 1418) — so `FINALIZED` is a legitimate reachable value even though no `UPDATE ... SET status = 'FINALIZED'` was found in this controller (likely set via a different path or historically renamed from `COMPLETED`).

Frontend's own canonical enum, `src/store/useToolStore.ts:73-74`:
```
export type CanonicalToolSessionStatus =
  'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'FINALIZED' | 'FAILED' | 'APPROVED' | 'GENERATED';
```
`normalizeCanonicalStatus()` (`useToolStore.ts:2805-2821`) maps a legacy
`'COMPLETED'` alias to `'FINALIZED'`, and — like every ad-hoc map found below
— falls back to `'DRAFT'` for anything else. This function drives the
in-memory tool-workspace runtime state machine (lock/save gates), a
**different code path from the list views** this stream's brief scopes to;
flagged here, not touched (see §4).

Demo seed evidence (illustrative, not live-loaded) — real
values in the wild are uppercase: `server/migrations/500_comprehensive_demo_data.sql:217-224`
uses `'COMPLETED'`, `'IN_PROGRESS'`, `'DRAFT'`.

### 1b. `tool_outputs.status` — actual DB shape

Live schema check: `status TEXT NOT NULL DEFAULT 'draft'` (no CHECK
constraint either), **plus** a load-bearing partial unique index:
`uq_tool_outputs_active_snapshot_per_session UNIQUE (tool_session_id) WHERE
status <> 'superseded'` — proof that `'superseded'` is a real, structurally
significant value, not a hypothetical one.

Type contract, `src/toolOutputs/types.ts:15`:
```
export type ToolOutputStatus = 'draft' | 'in_review' | 'approved' | 'superseded';
```
(lowercase — different casing convention from `tool_sessions.status`).
Doc comment at `types.ts:12`: *"Po `approved` rekord jest tylko do odczytu"*
(read-only after approval) — reinforces why mislabeling `approved` as
`Draft` is a trust bug: a user could believe a frozen record is still
editable.

### 1c. Frontend ad-hoc maps found (the bug's actual mechanism)

All in `src/components/Discovery/DiscoveryToolsHub.tsx` (pre-fix line
numbers, this stream's starting point):

| Map | Lines (pre-fix) | Covered | Missing → fell to `'DRAFT'` |
|---|---|---|---|
| `mapStatusToUppercase` | 138-156 | draft, in_review, pending_review, approved, completed, done, blocked, cancelled, archived, proposed, planned, in_progress, executing, review | `generated`, `finalized`, `failed` |
| `transformToolSession`'s local `statusMap` | 887-893 | DRAFT, REVIEW, APPROVED, GENERATED, COMPLETED | `IN_PROGRESS`, `FINALIZED`, `FAILED` — **the confirmed defect's session-list mechanism**: an in-progress or failed tool session rendered as Draft |
| `transformAssessmentSession`'s local `statusMap` | 924-935 | DRAFT, IN_PROGRESS, EXECUTING, REVIEW, IN_REVIEW, PENDING_REVIEW, APPROVED, GENERATED, COMPLETED, DONE | `FINALIZED`, `FAILED` |
| `mapOutputStatus` | 1077-1098 | DRAFT, GENERATING, IN_PROGRESS, PENDING_APPROVAL, IN_REVIEW, REVIEW, APPROVED, FINAL, COMPLETED, DONE, UTILIZED, REJECTED, ARCHIVED, CANCELLED, FAILED, ERROR | **`GENERATED`, `SUPERSEDED`** — the confirmed defect's outputs-list mechanism: an approved-then-superseded report/deck, or one stamped `GENERATED`, silently fell to Draft |

`mapStatusToUppercase` feeds **Initiatives** rows only (a genuinely separate
11-status lifecycle, `src/components/shared/ModuleHub/types.ts:102-118`
`ItemStatus`) — real gap, but out of this stream's scope (§4), not touched.

The three others feed the **Sessions / Discovery / Reports & Presentations**
list rows this stream owns, and are now rewired (§2-3).

### 1d. Where the (already-collapsed) status was rendered

`src/components/shared/ModuleHub/FilterableTable.tsx:954-955` — the default
cell renderer when a `'status'` column declares no `render`:
```
column.id === 'status' ? <EntityStatusChip status={row.status} /> : ...
```
None of the four `'status'` columns in `DiscoveryToolsHub.tsx`
(`discoveryColumns`, `sessionsColumns`, `outputsColumns`, plus
`initiativeColumns` out of scope) declared a `render`, so they all fell
through to this default — which only ever saw the ALREADY-COLLAPSED
`ItemStatus` from the ad-hoc maps above. `EntityStatusChip` itself
(`src/components/ui/primitives/chips/EntityStatusChip.tsx`) is fine — it
humanizes unrecognized text instead of defaulting to Draft — but by the time
a row reached it, `GENERATED`/`FAILED`/`SUPERSEDED` had already been
lossily turned into the literal string `'DRAFT'` upstream. Confirms the bug
lived in the ad-hoc maps, not in the rendering primitive.

`src/components/DiscoveryTools/ToolSessionPreviewV3.tsx:29-43`
(`toolStatusLabel()`) — the **preview pane** already had `approved` and
`generated` in its map and does not exhibit the bug; left untouched.

`src/components/DiscoveryTools/KnownToolDetailView.tsx:417-419` (pre-fix) —
a related-but-distinct bug in the same family: `sessionStats.items` carries
raw `tool_sessions.status` (uppercase) but was filtered with
`.filter((s) => s.status === 'completed')` (lowercase) — the "Sessions
completed" counter on a tool's library card always read "0 / N" regardless
of how many sessions actually finished. Fixed in §3.

## 2. Canonical mapper

New file: `src/domain/toolStatus.ts`. Single source of truth for
`tool_sessions.status` and `tool_outputs.status` (and the wider
output-lifecycle aliases used by assessment reports / report-builder
reports / decks). Domain enum:

```
type ToolStatusDomain =
  | 'draft' | 'in_progress' | 'in_review' | 'approved' | 'generated'
  | 'finalized' | 'superseded' | 'failed' | 'unknown';
```

`resolveToolStatus(raw)` → `{ raw, domain, isUnknown, labelPl, labelEn }`.
Normalizes case (`tool_sessions` UPPERCASE, `tool_outputs` lowercase both
resolve the same way) and aliases legacy/synonym spellings (`COMPLETED`/
`DONE`/`FINAL`/`UTILIZED` → `finalized`; `IN_REVIEW`/`PENDING_REVIEW`/
`PENDING_APPROVAL` → `in_review`; `EXECUTING`/`GENERATING` → `in_progress`;
`REJECTED`/`ERROR`/`CANCELLED` → `failed`; `ARCHIVED` → `superseded`).

Unknown raw input → `domain: 'unknown'`, `labelPl: "nieznany status: <raw>"`,
`labelEn: "unknown status: <raw>"` — **never** silently `'draft'`.

`toolStatusLabel(raw, lang)` is a convenience wrapper.
`KNOWN_TOOL_STATUS_RAW_VALUES` exports the full vocabulary for table-driven
tests.

## 3. Files changed

- `src/domain/toolStatus.ts` — new. The canonical mapper.
- `src/domain/__tests__/toolStatus.test.ts` — new. 63 tests: table-driven
  round-trip over every known raw value (both casings) → correct domain,
  never `unknown`; explicit-fallback tests for unrecognized/null/empty/
  whitespace input; language-selection tests.
- `src/components/Discovery/toolStatusCell.tsx` — new.
  `TOOL_STATUS_DOMAIN_TO_ITEM_STATUS` (domain → `ItemStatus`, tone/bucket
  only) + `renderToolStatusCell(rawStatus, isPolish)` (canonical mapper
  drives both the chip's dot tone AND its label text, via `EntityStatusChip`'s
  existing `label` override prop — no change to `EntityStatusChip` itself).
- `src/components/Discovery/__tests__/toolStatusCell.test.tsx` — new.
  Component test (`@testing-library/react`, jsdom): asserts the actual
  rendered DOM text for `approved` → "Approved" (not Draft), `GENERATED` →
  "Generated" (not Draft), `IN_PROGRESS`/`FAILED`/`superseded` → correct
  labels (not Draft), an unrecognized value → explicit "unknown status: …"
  text, and a real `DRAFT` still renders as "Draft" (control, to prove the
  fix doesn't over-correct).
- `src/components/Discovery/DiscoveryToolsHub.tsx` — rewired:
  - `transformToolSession` now derives `status`/`statusRaw` via
    `resolveToolStatus()` instead of its own 5-entry map.
  - `transformAssessmentSession` — same.
  - `mapOutputStatus` reduced to a one-line wrapper over the canonical
    resolver (was a 17-entry hand-rolled `Record`).
  - `DisplayItem`/`OutputItem`/the `assessmentSessions` state shape each
    gained an additive `statusRaw?: string` field (the pre-collapse backend
    value) alongside the existing `status: ItemStatus` (kept for the
    existing filter/tab-count logic elsewhere in the file, e.g.
    `discoveryItems = allSessions.filter(s => s.status === 'DRAFT' || ...)`).
  - `discoveryColumns`, `sessionsColumns`, `outputsColumns` — the `'status'`
    column now declares an explicit `render: (row) =>
    renderToolStatusCell(row?.statusRaw ?? row?.status, isPolish)` instead
    of falling through to `FilterableTable`'s default renderer.
  - `mapStatusToUppercase` (Initiatives-only) intentionally **not** touched
    — separate domain/lifecycle, out of this stream's scope (see below).
- `src/components/DiscoveryTools/KnownToolDetailView.tsx` — the "Sessions
  completed" counter now checks `resolveToolStatus(s.status).domain` against
  `finalized | generated | approved` instead of the lowercase literal
  `'completed'` that never matched the real uppercase values.

## 4. Explicitly NOT done (scope discipline)

- `useToolStore.ts:2805` `normalizeCanonicalStatus()` — drives the
  in-memory tool-WORKSPACE runtime (lock/save gates), not a list/detail
  render path, and its return type (`CanonicalToolSessionStatus`) has no
  `'UNKNOWN'` member to express an honest fallback without widening a type
  consumed by many other call sites outside this stream's scope. Flagged as
  a latent risk (same silent-DRAFT-fallback shape as the fixed bugs), not
  fixed, to avoid a wide, unreviewed blast radius in a 90-minute window.
- `mapStatusToUppercase` (Initiatives rows) — real second-priority gap
  (missing `finalized`/`failed`/`generated` keys) but Initiatives are a
  genuinely different 11-status lifecycle object, not part of the
  `tool_sessions`/`tool_outputs` vocabulary this stream owns, and editing it
  risks stepping on Initiatives-owning work this sprint.
- `server/src/controllers/ToolController.ts` — explicitly off-limits per
  sprint assignment (owned by another stream this sprint); read-only.

## 5. Tests run

```
npx vitest run src/domain/__tests__/toolStatus.test.ts
  → 63 passed (63)

npx vitest run src/components/Discovery/__tests__/toolStatusCell.test.tsx
  → 8 passed (8)

npx vitest run \
  src/components/Discovery/__tests__/DiscoveryToolsHub.reportPreviewDetails.t18.test.tsx \
  src/components/Discovery/__tests__/DiscoveryToolsHub.outputPreviewDetails.t17.test.tsx \
  src/components/Discovery/__tests__/DiscoveryToolsHub.initiativePreviewDetails.t19.test.tsx \
  src/components/ui/primitives/chips/__tests__/chips.test.tsx
  → 4 pre-existing failures, byte-for-byte identical (same assertion, same
    line, same message) with and without this stream's changes (verified via
    `git stash` / `git stash pop` against base fb6dfedd42's regex-based
    source-shape tests unrelated to status handling) — confirmed NOT a
    regression introduced by this stream.
```

`find`/`rg` cross-check against what vitest actually discovered (vitest
silently skips non-existent paths): both new test files were confirmed to
exist and were confirmed executed (test counts matched file contents, no
"0 tests" silent skip).

## 6. Not proven / residual risk

- No live `tool_sessions`/`tool_outputs` rows exist in this stream's DB
  (Postgres migration runner doesn't load the SQLite-flavored demo seed), so
  the exact original browser-observed defect could not be re-reproduced
  end-to-end against a live row in this environment — the fix is grounded in
  static analysis of every status-producing/consuming site plus targeted
  unit + component tests, not a live before/after screenshot.
- `useToolStore.ts` canonical-status fallback (§4) still silently defaults
  to `DRAFT` for genuinely unrecognized workspace state; not in scope this
  round.
- `mapStatusToUppercase` (Initiatives) still has the same class of gap;
  not in scope this round.
