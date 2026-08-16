# TLS-CATALOG-001 — Truthful Tool Catalog Inventory

Lane: A · Worktree: `consultify-closure-claude-a` · Branch: `codex/closure-claude-a-method-evidence`
Owner decision this task is bounded by (frozen, restated in the closure brief):
**"Tools MVP is Dynamic SWOT. Every other tool requires a separate packet, provenance and
rights, and must be hidden or explicitly marked UNAVAILABLE."**

This document is the factual position: every tool type the product declares anywhere, in
which registry, with what declared availability, whether real implementing code exists, and
whether it is actually launchable today. All counts below were re-derived directly from the
files, not assumed — reproduction commands are given so the lead (or anyone) can re-run them.

---

## 1. The four catalog sources

| # | File | Role | In-lease for Lane A? |
|---|------|------|----------------------|
| 1 | `server/src/services/KnownToolsService.ts` (`ACTIVE_KNOWN_TOOL_TYPES`, :206-229) | **The real runtime gate.** `isKnownToolActive()` (:801-806) decides `GET /known-tools`'s `isActive` and `ToolController.createToolSession`'s 409. | **OUT** (explicitly confirmed out-of-lease by the lead; verified read-only) |
| 2 | `src/toolPacks/registry.ts` (+ `contract.ts`, `validator.ts`, `packs/*`) | Content/rights/runtime-readiness governance layer. Zero non-test importers in `src/` (verified below) — gates nothing a user sees. | **IN** |
| 3 | `src/config/agentManifests/discoveryToolsRegistry.ts` (+ server mirror `discoveryAgentManifestCatalog.ts`) | Read-only metadata registry for Teresa's future agent/tool picker. Explicitly documented as "non-executing" — no function-calling wiring. | **IN** |
| 4 | `src/toolCatalog/strategy/catalog.ts` | `STRATEGY_TOOL_DOCS` — a doc-lookup map, currently `{}`. | **IN** |

**Consumer proof (dead-code claim in the brief, re-verified):**

```
grep -rln "toolPacks/registry\|listToolPacks\|getToolPack\b" src tests server \
  | grep -v "src/toolPacks/"
# -> src/components/standard/StandardArtifactShell.types.ts   (comment only, no import)
# -> src/components/Initiatives/sections/index.ts              (false-positive match, no import)
# -> src/components/standard/StandardArtifactShell.tsx         (comment only, no import)
# -> src/components/standard/cardContract.types.ts             (comment only, no import)
# -> tests/integration/tools-archetype-promote-characterization.realdb.test.ts (comment only)
```

None of these are real imports (`grep -n "toolPacks" <file>` on each shows only prose comments
referencing the path). **Confirmed: `src/toolPacks/registry.ts` has zero non-test code
importers.** It is fully test-exercised (41/41 tests pass, see §4) but gates nothing at
runtime.

```
grep -rln "discoveryToolsRegistry\|DISCOVERY_TOOL_AGENT_MANIFESTS" src tests server
# -> src/config/agentManifests/discoveryToolsRegistry.ts   (definition)
# -> tests/unit/discovery/discoveryAgentManifestCatalog.test.ts (drift-guard test)
# -> tests/unit/discovery/agentManifestRegistry.test.ts    (test)
# -> tests/acceptance/h32-19tools.e2e.test.ts              (test)
# -> server/src/services/ai/agentRuntime/discoveryAgentManifestCatalog.ts (server SUMMARY mirror)
```
`discoveryAgentManifestCatalog.ts`'s own header states it exists "for Teresa's backend ... to
answer 'what discovery-tool agents exist'" and explicitly: *"Do not wire this into
function-calling / tool-use without a real execution target ... (see HP-4, not yet built)."*
**Confirmed non-executing** — it does not gate session start either.

```
grep -rln "STRATEGY_TOOL_DOCS\|hasStrategyToolDoc\|loadStrategyToolDocMarkdown\|listStrategyToolSlugs" src tests server
# -> src/components/Discovery/DiscoveryToolsHub.tsx        (listStrategyToolSlugs, line 792)
# -> src/components/DiscoveryTools/GenericToolDocumentView.tsx (hasStrategyToolDoc/loadStrategyToolDocMarkdown, lines 62/68)
# -> src/toolCatalog/strategy/catalog.ts                    (definition)
```
Both consumers are real UI imports, but `STRATEGY_TOOL_DOCS = {}` (line 1) means
`hasStrategyToolDoc()` always returns `false` and `listStrategyToolSlugs()` always returns
`[]` — **both branches are permanently dead** (confirmed by reading the map literal, not
inferred).

---

## 2. Full 31-tool inventory

All four sources agree on the same 31 canonical tool-type slugs (cross-checked; no slug exists
in one list and not the others). Columns:

- **Gate (KnownToolsService)** — `ACTIVE` if in `ACTIVE_KNOWN_TOOL_TYPES` (real gate, launchable), else `COMING_SOON` (409 on session start).
- **toolPacks/registry.ts** — `contentStatus` / `runtimeStatus`. All 31 are `runtimeStatus != RUNTIME_ACTIVE` (0/31, see §4).
- **discoveryToolsRegistry** — `built` (has `src/config/<dir>`) or `planned` (no config dir).
- **Real engine code** — same `src/config/<dir>` existence check (independently re-verified with `find src/config -maxdepth 1 -type d`).
- **Launchable today** — what a real user hitting `POST /api/tools` actually gets (verified for 2 representative rows against real Postgres in §5; the rest follow the same code path deterministically from `ACTIVE_KNOWN_TOOL_TYPES` membership).

| Tool type | Gate (real) | toolPacks/registry.ts | discoveryToolsRegistry | Real engine (`src/config/<dir>`) | Launchable today |
|---|---|---|---|---|---|
| dynamic-swot | **ACTIVE** | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`swot`) | **YES — the one owner-approved tool** |
| market-forces | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`porter`) | YES (not owner-approved) |
| value-chain | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`valuechain`) | YES (not owner-approved) |
| capability-mapper | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`capabilitymapper`) | YES (not owner-approved) |
| ambition-decomposer | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`ambitiondecomposer`) | YES (not owner-approved) |
| focus-tradeoff | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`focustradeoffs`) | YES (not owner-approved) |
| narrative-engine | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`narrativeengine`) | YES (not owner-approved) |
| growth-paths | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`ansoff`) | YES (not owner-approved) |
| portfolio-priority | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`portfolio`) | YES (not owner-approved) |
| risk-uncertainty | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`riskuncertainty`) | YES (not owner-approved) |
| process-automation | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`processautomation`) | YES (not owner-approved) |
| sop-builder | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`sopbuilder`) | YES (not owner-approved) |
| a3-problem-solving | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`a3problemsolving`) | YES (not owner-approved) |
| smed-planner | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`smedplanner`) | YES (not owner-approved) |
| dms-builder | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`dmsbuilder`) | YES (not owner-approved) |
| inventory-autopilot | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`inventoryautopilot`) | YES (not owner-approved) |
| ai-discovery | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`aidiscovery`) | YES (not owner-approved) |
| pain-explorer | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`painexplorer`) | YES (not owner-approved) |
| rpa-scanner | ACTIVE | PACK_COMPLETE / RUNTIME_PENDING | built | yes (`rpascanner`) | YES (not owner-approved) |
| vsm-builder | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 (verified §5) |
| constraint-control | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| decision-engine | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| control-tower | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| automation-pipeline | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| robotics-feasibility | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| logistics-automation | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| integration-diagnostic | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| digital-value-pool | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| legacy-analyzer | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| data-inventory | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |
| pain-to-solution | COMING_SOON | EVIDENCE_MISSING / COMING_SOON | planned | no | no — 409 |

**Totals: 31 declared · 19 launchable today · 1 owner-approved · 18 launchable-but-unapproved · 12 correctly hidden.**

Reproduction:
```
grep -n "ACTIVE_KNOWN_TOOL_TYPES = new Set" -A 25 server/src/services/KnownToolsService.ts
grep -c "toolType: '" server/src/services/KnownToolsService.ts   # -> 31 (SQLITE_KNOWN_TOOLS_SEED)
node -e "console.log(new Set([...19 authored, ...12 no-evidence]).size)"  # -> 31, no dupes
```

---

## 3. Disagreements between registries (the finding)

1. **The core disagreement — governance vs. reality.** `toolPacks/registry.ts` (governance
   layer, in-lease, fully honest — see §4) says **0 of 31 tools are `RUNTIME_ACTIVE`**;
   `dynamic-swot` itself is only `RUNTIME_PENDING`, meaning even the one owner-approved tool
   has not cleared this layer's own DoD bar. Meanwhile the REAL gate
   (`ACTIVE_KNOWN_TOOL_TYPES`, out-of-lease) has **19 tools fully launchable**. The governance
   layer's careful, tested, owner-mandated discipline ("nothing ships without full DoD and
   manual acceptance") is being **entirely bypassed by the real runtime gate**, which has zero
   awareness that `toolPacks/registry.ts` exists. This is not a UI cosmetic gap — it means the
   product's actual behavior (18 extra tools launchable) has never been checked against the
   one governance mechanism built specifically to prevent that.
2. **Which 19 have "a real engine" — the three sources actually agree with each other, just
   not with the owner's MVP decision.** `ACTIVE_KNOWN_TOOL_TYPES` (19), `toolPacks/registry.ts`'s
   `AUTHORED_PACKS`/`ENGINE_BACKED` (19), and `discoveryToolsRegistry.ts`'s `BUILT_TOOL_IDS`
   (19) name the **exact same 19 tool-type slugs**. So "does real code exist" is consistently
   answered across the codebase — the divergence is entirely about whether "has an engine"
   should imply "is launchable," which is precisely the question the owner's MVP decision
   already answered (no, not without its own packet/provenance/rights), and which nothing in
   code currently enforces except the untested-in-practice governance layer.
3. **The DB `is_active` column is dead weight, verified on live data (not the seed constant).**
   Querying the live `tools` table on the dedicated Postgres instance for this lane:
   `SELECT tool_type, is_active, is_coming_soon FROM tools` returns **`is_active = 1` for every
   single row**, `vsm-builder` (a "coming soon" tool) included. `isKnownToolActive()` is
   `Boolean(rowIsActive) && ACTIVE_KNOWN_TOOL_TYPES.has(toolType)` — since the DB flag is
   always true in practice, **`ACTIVE_KNOWN_TOOL_TYPES` is the entire gate**, not a
   belt-and-suspenders pairing with the DB flag as the column name would suggest. This was
   re-verified directly against Postgres in the test suite added in §5 (`confirms the live
   'tools' row for the negative-control tool has is_active=1`), not assumed from the seed
   constant.
4. **`strategy/catalog.ts` is empty, making two real UI code paths permanently dead**
   (`DiscoveryToolsHub.tsx:792`, `GenericToolDocumentView.tsx:62/68` — see §1). Not a
   registry-vs-registry disagreement, but a fourth "catalog" that currently declares zero
   tools while two components import it expecting content.

---

## 4. What was made truthful in-lease (vs. what remains only detectable)

### In-lease files, lease-check result for every file considered

```
jq -e --arg f "<path>" '.files | index($f)' docs/cleanup/agents/generated/CLAUDE_LANE_A_PATH_LEASE.json
```

| File | Lease JSON | Considered for | Outcome |
|---|---|---|---|
| `server/src/services/KnownToolsService.ts` | OUT | The real gate (`ACTIVE_KNOWN_TOOL_TYPES`) | **Not edited** — explicitly confirmed out-of-lease by the lead; read-only import in tests. |
| `server/src/controllers/ToolController.ts` | **IN** (per JSON) | Session-start 409 branch | **Not edited** — the lead's brief explicitly lists this as "OWNED BY OTHER AGENTS — do not touch," overriding the JSON. Flagged as a lease-JSON/brief discrepancy below. Read-only import in the new real-DB test. |
| `server/src/routes/tools.routes.ts` | OUT | Route wiring | Not edited; not needed (tested by mounting the controller directly, matching this repo's existing `*.realdb.test.ts` convention). |
| `server/src/Gateway.ts` | OUT | Full app mount | Not needed. |
| `src/routes/AppRoutes.tsx` | OUT | UI routing | Not needed. |
| `src/toolPacks/registry.ts`, `contract.ts`, `validator.ts`, `packs/*`, `readiness/*` | **IN** | Governance honesty for Dynamic SWOT | **Read and verified already honest — no edit made** (see below). |
| `src/config/agentManifests/discoveryToolsRegistry.ts` | **IN** | Client tool-picker registry | Read-only; already internally honest (19 built / 12 planned, grep-verified per its own header) — no edit needed for this task's scope. |
| `src/toolCatalog/strategy/catalog.ts` | **IN** | Empty doc-map | Read-only; out of this task's scope to populate (would require real doc content this task has no provenance for) — left as-is, its emptiness is now documented in §1/§3 instead of silently discovered. |
| `server/src/services/toolCatalog/**` (new) | N/A (new dir) | New governed-truth module + tests | **Created** — matches the lead's explicit allow-list and the lane verifier's `allowedNewRoots.a` regex `services\/(?:...\|tool)[^/]*\/` (confirmed: `toolCatalog/` matches `tool[^/]*\/`). |
| `docs/program/evidence/closure/a/TLS-CATALOG-001/**` (new) | Reserved evidence namespace | This document | **Created**. |

**Lease-JSON discrepancy found:** `docs/cleanup/agents/generated/CLAUDE_LANE_A_PATH_LEASE.json`
lists `server/src/controllers/ToolController.ts` as an in-lease tracked path (719-file
manifest, `authorityHead: c40a9ba58e28ccc78bdef8d1f61f64db60e088eb`), but the task brief
explicitly names it "OWNED BY OTHER AGENTS." Treated the brief as authoritative and did not
edit it (used it read-only only, exactly as several pre-existing `*.realdb.test.ts` files in
this repo already do). **Reporting this discrepancy for the lead to reconcile the manifest.**

### `src/toolPacks/registry.ts` — already honest, verified, no edit needed

Read the full file plus `contract.ts` and `validator.ts`. Findings:
- `TOOL_PACKS` is 31 entries: 19 `PACK_COMPLETE` (the engine-backed set) + 12
  `EVIDENCE_MISSING` (the no-evidence set). **Zero entries have `runtimeStatus:
  'RUNTIME_ACTIVE'`** — `dynamic-swot` itself is `RUNTIME_PENDING`.
- `validateToolPack()`'s publication gate (`validator.ts:274-302`) refuses `RUNTIME_ACTIVE`
  unless `contentComplete` AND `evaluateRuntimeReadiness()` reports every gate `PASS` against
  a fresh candidate SHA — i.e. structurally impossible to silently promote a pack by just
  flipping a field, without also fabricating a full readiness manifest that would itself fail
  validation.
- This is already covered by an existing, in-lease, passing test suite. Ran it read-only to
  confirm the baseline before making any decision about this file (no edits made):
  ```
  npx vitest run src/toolPacks/__tests__/registry.test.ts src/toolPacks/__tests__/validator.test.ts --retry=0
  # Test Files  2 passed (2)
  #      Tests  41 passed (41)
  ```
  Notably `registry.test.ts` already contains `'żadne narzędzie nie jest jeszcze
  RUNTIME_ACTIVE'` (line 42) — this is the exact "ensure no pack is silently promoted"
  assertion the closure brief asked for, and it already exists and already passes.

**Conclusion: no code change was made to `registry.ts`/`validator.ts`/`contract.ts` because
they are already honest for Dynamic SWOT and already refuse silent promotion.** The dishonesty
in this program lives entirely in the out-of-lease `KnownToolsService.ts`, which has zero
awareness this governance layer exists.

### What remains only DETECTABLE, not fixed

The real gate (`ACTIVE_KNOWN_TOOL_TYPES`) itself could not be reduced to `{dynamic-swot}` in
this lane — it is out of lease. What this packet delivers instead is a **contract test that
makes the violation impossible to miss**: see §5's red-by-design test. The fix itself is the
integrator change request in §6.

---

## 5. Tests added and run

All new files live under `server/src/services/toolCatalog/` (new lane-A root, matches the
lead's explicit allow-list and the `allowedNewRoots.a` verifier regex).

### 5.1 `approvedMvpToolTypes.ts` (new, not a test)
Single machine-readable statement of the owner's frozen MVP decision:
`APPROVED_MVP_TOOL_TYPES = new Set(['dynamic-swot'])`. No production callers — exists purely
so the contract test below has something authoritative to compare the real gate against.

### 5.2 Governance test — **GREEN, the sole committed governance test (revised 2026-08-16)**
`server/src/services/toolCatalog/__tests__/mvpGateGovernance.documentingCurrentBehavior.test.ts`

An earlier version of this packet also committed a **red-by-design** companion
(`mvpGateGovernance.redByDesign.test.ts`) that asserted `ACTIVE_KNOWN_TOOL_TYPES` deep-equals
`APPROVED_MVP_TOOL_TYPES` and was expected to fail until the fix in §6 landed. **Lead review
reversed that decision and the file has been DELETED.** Reasoning (lead's, preserved here):
this branch merges through an integrator across three lanes (A, then C, then B); a
permanently-failing test in the shared tree makes every downstream run red and
indistinguishable from a real regression a later lane introduces, converting a precise,
documented policy gap into ambient noise. The precise statement of the violation, the exact
expected end state, and what must change now live exclusively in §6 below, where they are
unambiguous and cannot rot into noise.

The green test is now the **sole** committed governance artifact, and it was strengthened
(per the reversal) to pin the real gate by **exact set membership, not just size** — a
size-only assertion (`size === 19`) would let a swap (one tool type removed, a different one
added, size unchanged) slip through silently. It now lists all 19 current members by name and
asserts the live `ACTIVE_KNOWN_TOOL_TYPES` equals that pinned list exactly; the moment anyone
edits the real gate — including the eventual TLS-CATALOG-001 fix itself — this test goes red
and must be updated in the same commit, deliberately. This is the ratchet: it converts a
one-time inventory finding into a durable guard against silent future drift, without ever
blocking an unrelated lane's merge with a permanent failure.

Command and literal result:
```
npx vitest run server/src/services/toolCatalog/__tests__/mvpGateGovernance.documentingCurrentBehavior.test.ts --retry=0
```
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

Failure message the strengthened assertion produces if the pinned set and the live gate ever
diverge (verified by exercising the delta-description helper in isolation — see the test
file's `describeSetDelta()` — against a synthetic swap of one tool type for another with the
same set size):
```
ACTIVE_KNOWN_TOOL_TYPES (server/src/services/KnownToolsService.ts:206-229) changed: added to
the gate (not previously pinned): <new-tool>; removed from the gate (previously pinned, now
gone): <old-tool>.
This test intentionally pins EXACT membership (not size) so a swap can't slip through
silently. If this change was deliberate, update the pinned list in THIS file in the same
commit. If it widens the gate beyond the owner-approved MVP set, it also needs owner sign-off,
a packet, provenance and rights record per the frozen MVP decision — see
docs/program/evidence/closure/a/TLS-CATALOG-001/CATALOG_INVENTORY.md §6 (the integrator change
request, target end state: exactly {'dynamic-swot'}).
```

### 5.4 Real-Postgres controller proof
`server/src/services/toolCatalog/__tests__/mvpGateRealPostgres.controller.pg.test.ts`

Mounts the real, unedited `ToolController.createToolSession` / `getToolSession` /
`listToolSessions` handlers in an in-process Express app (same pattern as this repo's existing
`tests/integration/*.realdb.test.ts` files) and drives them with `supertest` against the
dedicated real Postgres instance for this lane (1557 tables, 703/703 migrations).

Command:
```
RUN_DB_TESTS=1 MOCK_DB=false CI=true DB_TYPE=postgres NODE_ENV=test \
  DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:34912/consultinity \
  npx vitest run \
  server/src/services/toolCatalog/__tests__/mvpGateRealPostgres.controller.pg.test.ts --retry=0
```
Literal result:
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```
Five tests, each proving a distinct claim on the live database:
1. **POSITIVE CONTROL** — `dynamic-swot` session creation returns HTTP 200 / `status: 'DRAFT'`,
   and a fresh `SELECT` confirms the `tool_sessions` row exists with the right `tool_type`,
   `organization_id`, `status`.
2. Confirms, directly against the live `tools` table, that the negative-control tool
   (`vsm-builder`) has `is_active = 1` — the DB flag evidence for §3 finding 3.
3. **NEGATIVE CONTROL** — `vsm-builder` session creation returns exactly
   `409 { error: 'This tool is inactive and cannot start a session yet' }`, and a `SELECT
   COUNT(*)` before/after proves zero `tool_sessions` rows were created for the attempt (both
   counts are `0`).
4. **TENANT NEGATIVE** — a session created under org A returns 404 on
   `GET /api/tools/:id` and is absent from `GET /api/tools`'s `items` array when queried as a
   different org B, while org A can read/list it normally.
5. **COLD READBACK** — after creation via the app, a brand-new, independent `pg.Client`
   connection reads the row back and it matches exactly (`id`, `organization_id`, `tool_type`,
   `name`, `status: 'DRAFT'`, `version: 1`), proving real Postgres persistence rather than
   in-process state.

All test-created rows are cleaned up in `afterAll` (`DELETE FROM tool_sessions WHERE
organization_id IN (...)`), verified post-run: `SELECT count(*) FROM tool_sessions WHERE
organization_id LIKE 'tls-catalog-001-%'` → `0`.

### 5.5 Combined literal totals for this packet's new tests

| File | Tests | Pass | Fail |
|---|---|---|---|
| `mvpGateGovernance.documentingCurrentBehavior.test.ts` | 5 | 5 | 0 |
| `mvpGateRealPostgres.controller.pg.test.ts` | 5 | 5 | 0 |
| **Total** | **10** | **10** | **0** |

No `skipped`/`todo` tests. No existing test was modified, weakened, or deleted. The suite is
fully green — the only intentionally-failing test this packet ever produced
(`mvpGateGovernance.redByDesign.test.ts`) has been deleted per lead review; its content was
moved into §6, not lost.

---

## 6. Integrator Change Request — TLS-CATALOG-001-FIX-01

### 6.0 The violation, stated precisely

This subsection is the content that was previously enforced by a now-deleted red-by-design
test (`mvpGateGovernance.redByDesign.test.ts` — removed 2026-08-16 per lead review; see §5.2
for why). It is restated here in full so the policy gap remains unambiguous and actionable
without depending on a permanently-failing test in the shared tree.

**The violation:** `ACTIVE_KNOWN_TOOL_TYPES` (`server/src/services/KnownToolsService.ts:206-
229`, the real runtime gate — confirmed in §3/§5.4 to be the *only* signal that matters,
since the `tools.is_active` DB column is `1` for every row) currently has **19 entries**. The
owner's frozen MVP decision authorizes exactly **1**: `dynamic-swot`. The other 18 —
`market-forces`, `value-chain`, `capability-mapper`, `ambition-decomposer`, `focus-tradeoff`,
`narrative-engine`, `growth-paths`, `portfolio-priority`, `risk-uncertainty`,
`process-automation`, `sop-builder`, `a3-problem-solving`, `smed-planner`, `dms-builder`,
`inventory-autopilot`, `ai-discovery`, `pain-explorer`, `rpa-scanner` — are launchable today
(`POST /api/tools` returns `200`) with no owner-approved packet, provenance, or rights record
for any of them, directly contradicting: *"Tools MVP is Dynamic SWOT. Every other tool
requires a separate packet, provenance and rights, and must be hidden or explicitly marked
UNAVAILABLE."*

**Exact expected end state:** `ACTIVE_KNOWN_TOOL_TYPES` must equal `new Set(['dynamic-swot'])`
— exactly one entry, no more, no fewer. This is machine-readably pinned in
`server/src/services/toolCatalog/approvedMvpToolTypes.ts` (`APPROVED_MVP_TOOL_TYPES`, in-lease,
already committed) so any future check can compare against it programmatically instead of
re-deriving it from prose.

**What must change:** the code edit in §6.1 below, PLUS every consumer test enumerated further
down in this section ("Consumer test to run after the change" / "Blast radius") that
hard-codes the current 19-entry assumption — those tests do not update themselves and will go
red the instant the gate shrinks unless updated in the same change.

### 6.1 The code change

**File:** `server/src/services/KnownToolsService.ts`
**Lines:** 206-229

**Current (verbatim):**
```ts
export const ACTIVE_KNOWN_TOOL_TYPES = new Set<string>([
  // 11 fully-worked strategic + automation
  'dynamic-swot',
  'market-forces',
  'value-chain',
  'capability-mapper',
  'ambition-decomposer',
  'focus-tradeoff',
  'narrative-engine',
  'growth-paths',
  'portfolio-priority',
  'risk-uncertainty',
  'process-automation',
  // 5 operational with real domain step UIs
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  // 3 digital with Wave 1 GenericDomainStep flows
  'ai-discovery',
  'pain-explorer',
  'rpa-scanner',
]);
```

**Proposed replacement (verbatim):**
```ts
export const ACTIVE_KNOWN_TOOL_TYPES = new Set<string>([
  // MVP freeze (owner decision, CLAUDE.md / TLS-CATALOG-001): exactly one tool
  // is approved for runtime. Every other tool type needs its own packet,
  // provenance and rights record before it can be added back here — see
  // server/src/services/toolCatalog/approvedMvpToolTypes.ts (the governed
  // truth this Set must match) and
  // docs/program/evidence/closure/a/TLS-CATALOG-001/CATALOG_INVENTORY.md.
  'dynamic-swot',
]);
```

**Reason:** This 19-entry Set is the entire real gate for tool-session launchability (the
`tools.is_active` DB column is always `1` in practice — see §3 finding 3 — so it contributes
nothing). It currently lets 18 tool types launch that have no owner-approved packet,
provenance, or rights record, directly contradicting the frozen MVP decision. Reducing it to
`{'dynamic-swot'}` is the single change that makes the real gate match the owner's decision.
The committed governance test,
`server/src/services/toolCatalog/__tests__/mvpGateGovernance.documentingCurrentBehavior.test.ts`
(§5.2), pins the CURRENT 19-entry membership by name and will go red the moment this edit
lands — at that point update its pinned list (and the four consumer tests below) in the SAME
change, deliberately, so the suite lands green with the new, correct state rather than red.

**Consumer test to run after the change (must go from 19→1 cleanly, this packet does NOT
touch these — they are out of lease):**
- `server/src/services/__tests__/knownToolsCatalog.smoke.test.ts` — asserts
  `ACTIVE_KNOWN_TOOL_TYPES.size === 19` and the exact 19-item SHIP list — **will need
  rewriting to assert `size === 1` and `has('dynamic-swot')` only**, or it goes red.
- `tests/components/Discovery/DiscoveryToolsHub.inactiveTools.test.tsx` — asserts
  `ACTIVE_KNOWN_TOOL_TYPES.size === 19` (line 68) and treats the 18 newly-to-be-deactivated
  tool types as active controls; its `REAL_INACTIVE_TOOL_SLUGS` list (12 entries) would need
  to grow to 30, and `REAL_ACTIVE_TOOL_SLUG` would stay `'dynamic-swot'` (already correct) —
  **needs rewriting, not just a number bump**, since its `it.each` list is hand-enumerated.
- `tests/acceptance/h32-19tools.e2e.test.ts` — per its own name and header comment, exercises
  session CREATE/SAVE/RELOAD for all 19 currently-active tool types — **18 of its 19 cases
  will start failing** (409 instead of 200) the moment the gate shrinks; this test needs a
  scope decision from the owner (retire the 18 non-SWOT cases, or move them behind an explicit
  "future re-activation" marker) before this change can land in CI cleanly.
- `tests/acceptance/h31-swot-flow.e2e.test.ts` — only exercises `dynamic-swot`; grepped for
  `ACTIVE_KNOWN_TOOL_TYPES` only in a comment — **should be unaffected**, but re-run to
  confirm.

**Blast radius — UI surfaces (grepped, not guessed):**
- `src/components/Discovery/DiscoveryToolsHub.tsx` — the Library grid/list for all "Consulting
  Tools." Every one of the 18 tools currently reads `isActive: true` from `Api.getKnownTools()`
  and renders a working "Open"/"Start" action (confirmed via the `knownTools` state read at
  DiscoveryToolsHub.tsx:1226/2931/3628/4805). After the fix, these 18 flip to the same
  "Coming soon" / inactive-forbidden treatment the file already renders correctly for the
  current 12 (RV-028, `handleOpenKnownTool`'s `isActive === false` branch at ~line 3628, and
  the library-row disabled state) — **this is the intended effect, not a regression**, but it
  is a large, visible UI change across every session in the Library grid, every existing
  in-progress session's `ToolDocumentView` entry point (`doc.type === 'tool'` branch, line
  ~3611), and the Tools Hub summary (`getToolsHub`, mixes `listKnownTools()` with the
  organization's existing sessions).
- Any **existing `tool_sessions` rows** for the 18 tool types (created before this change, by
  real users/demo data) will still be readable/editable via `GET`/`PUT` (those handlers do not
  re-check `ACTIVE_KNOWN_TOOL_TYPES` — only `createToolSession` and the
  `hasDedicatedToolDocumentView` UI gate at DiscoveryToolsHub.tsx:~3611 do), but **new**
  sessions of those types can no longer be started. Confirm with the owner whether existing
  in-flight sessions for the 18 should be frozen/migrated or left readable — out of this
  packet's scope to decide.
- `server/src/services/ai/agentRuntime/discoveryAgentManifestCatalog.ts` / Teresa's tool-picker
  metadata is **unaffected** (explicitly non-executing, confirmed §1) — no blast radius there.
- `src/toolPacks/registry.ts` is **unaffected** (already 0 `RUNTIME_ACTIVE`, zero real
  importers) — no blast radius there either; this change brings the real gate INTO alignment
  with that layer's existing discipline, not further out of it.

---

## 7. Findings that corrected or sharpened the brief's premise

- **Confirmed, not corrected:** the "four competing catalog sources / 19-wide real gate"
  framing in the brief is accurate. Independently re-derived the same 19/12 split, the same
  zero-importer claim for `toolPacks/registry.ts`, and the same non-executing status for
  `discoveryToolsRegistry.ts`.
- **New finding, not in the original brief:** the `tools.is_active` DB column is not merely
  theoretically redundant — on the LIVE database for this lane it is `1` for every single row,
  including all 12 "coming soon" tools. The brief's framing ("19 tools wide, not 1") is correct
  about the *effective* gate, but it's worth stating plainly that the DB-level flag offers zero
  additional protection today; anyone reading `tools.is_active` directly (a report query, a
  future admin panel, a migration) would be misled into thinking all 31 tools are "active."
  This raises the stakes of the `ACTIVE_KNOWN_TOOL_TYPES` fix — it is not one signal among two,
  it is the only signal.
- **New finding:** `toolPacks/registry.ts` is not just an inert, disconnected layer — it is
  already **more conservative than the owner's MVP decision requires** (it withholds
  `RUNTIME_ACTIVE` even from `dynamic-swot` itself, pending full DoD). The real problem is not
  that this governance layer is wrong or needs strengthening; it's that the real runtime gate
  doesn't consult it at all. The fix in §6 does not need to touch this layer.
- **Lease-JSON discrepancy** (see §4): the generated lease manifest lists
  `server/src/controllers/ToolController.ts` as in-lease, contradicting the brief's explicit
  "OWNED BY OTHER AGENTS" instruction. Followed the brief; flagging the manifest for the lead
  to reconcile so a future agent isn't misled by the JSON alone.
