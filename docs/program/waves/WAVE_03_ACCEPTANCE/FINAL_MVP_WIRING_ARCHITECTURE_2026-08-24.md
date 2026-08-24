# Final MVP wiring architecture — 2026-08-24

Status: `ACTIVE SSOT / ARCHITECTURE BEFORE WIRING`

This document is the single routing and data-wiring contract for the final MVP integration. It does not replace the 16 module acceptance registers or their 21 gates. It tells the integrator which product surface, data contract and verification lane each register governs.

## Why this gate exists

The repository contains valid newer tools, older hubs, owner-review profiles, UI-only sample data and retained database fixtures at the same time. A route or feature flag can therefore expose an obsolete surface even when the correct implementation and backend already exist. The `/results` legacy fallback was a current example: the canonical KPI/OKR/ROI registries existed, but the root route could still render the older three-pairs cockpit.

No further module may be wired by selecting whichever screen happens to render. Wiring must follow this contract.

## Non-negotiable rules

1. **One canonical entry per product purpose.** Every module has one starting route and one owner-facing component family. Historical/showcase implementations may remain in source temporarily, but cannot be reachable from canonical navigation.
2. **Flags refine capability, never product identity.** A query parameter or environment flag may enable a safe owner-review dataset or an approved capability. It may not choose between an old and a new product.
3. **One explicit data adapter.** The canonical component consumes its declared API family. UI sample data is allowed only as a visibly identified visual-review profile and is never persistence evidence.
4. **Seeds are the durable asset.** Synthetic owner-review records are reconstructible. The guarded seed, schema/migrations, fixture receipt and deterministic readback are protected; individual local records are not the source of truth.
5. **No cross-fixture database mixing.** A module qualification database proves one module. It cannot be presented as integrated-MVP evidence.
6. **Integration is rebuilt, not copied.** After isolated qualification, one fresh local final-integration database is created from an explicit integration seed manifest. Records are not copied ad hoc between retained module databases.
7. **A mounted page is not a connected module.** Connection requires fixture receipt, authenticated API read, correct UI projection, a harmless save where applicable, refresh, cold restart and API/SQL readback.
8. **Exact identity is recorded.** Every proof records branch, full SHA, dirty fingerprint, frontend/backend ports, database name, fixture ID and screenshot manifest.
9. **Production and Railway remain untouched.** This architecture governs local Wave 3 qualification and final local integration until a separate release authorization is given.

## Three data planes

| Plane | Purpose | Allowed data | Acceptance meaning |
|---|---|---|---|
| A — isolated module qualification | Prove one module against its own guarded fixture | One `consultify_w3_<module>_owner_*` database and its FINAL receipt | Technical module evidence only |
| B — final MVP integration | Prove cross-module identity, handoffs and readback on one exact candidate | One fresh `consultify_w3_runtime_*` database created from a versioned integration manifest | Candidate integration evidence; still not owner acceptance or release |
| C — visual sample profile | Populate a UI for layout review before durable wiring | Deterministic client sample selected explicitly and labelled | Screenshot/design evidence only; never DB or persistence proof |

## Canonical module map

The `Data contract` column names the guarded owner fixture already admitted by `scripts/dev/start-wave3-owner-runtime.mjs`. `Surface decision` is the cutover rule to verify before data attachment.

| ID | Module | Canonical entry | Canonical product surface | Data contract | Surface decision / current risk |
|---:|---|---|---|---|---|
| 01 | Organization | `/organization` | Organization profile, readiness and operating context | `W3-ORGANIZATION-OWNER-v1` | Reject login fallback or disconnected readiness as success |
| 02 | Interview | `/interview`; public `/interview/respond/:token` | Manager registry/workspace plus isolated respondent journey | `W3-INTERVIEW-OWNER-v1` | Keep manager and public-token authorization paths distinct |
| 03 | Tools | `/discovery-tools` | Tool library and the canonical Dynamic SWOT workflow | `W3-TOOLS-OWNER-v1` | Other catalog entries remain truthful `COMING_SOON`; no duplicate tool shell |
| 04 | Assessment | `/assessment` | Library → Processes → DRD Interview → Matrix → Report | `W3-ASSESSMENT-OWNER-v1` | Remove canonical-session/output debug surfaces from owner flow; reuse one DRD implementation |
| 05 | Initiatives | `/initiatives` plus canonical initiative deep link | Initiative registry/card; Plan and Capacity analyses | `W3-INITIATIVES-OWNER-v1` | Candidates/Portfolio are not separate Menu-2 products; legacy/showcase profiles cannot define lifecycle truth |
| 06 | Execution | `/execution`; `/execution/:caseId` | Realizations, Work, Resources, Steering and Reports bound to initiative/case identity | `W3-EXECUTION-OWNER-v1` | Never restore the unavailable/V8 placeholder or a second execution cockpit |
| 07 | My Work / Agent | `/my-work` | Canonical inbox/triage and governed Agent materialization | `W3-MY-WORK-OWNER-v1` | Preserve restricted human-requested materialization; no autonomous substitute |
| 08 | Meetings | `/meeting` with stable meeting deep link | Meeting registry/workspace and governed minutes decision | `W3-MEETINGS-OWNER-v1` | Recording/transcription/provider features stay honestly unavailable unless separately activated |
| 09 | Results | `/results` → `/results/kpi`; siblings `/results/okr`, `/results/roi` | Persistent Menu 2 `KPI / OKR / ROI`, each with its own registry and full card | `W3-RESULTS-OWNER-v1` | Old `ResultsHub` three-pairs cockpit is legacy and must be unreachable; `My/Org/Scorecards` are KPI-internal only |
| 10 | Finance | `/finance` | Canonical Statement, Analysis, Baseline, Prediction and Valuation registries/cards | `W3-FINANCE-OWNER-v1` | Reject simplified or historical finance shells; one artifact identity across levels and cards |
| 11 | Materials | `/document-studio`; `/presentations`; `/excele` | Common registry plus native Document, Presentation and Workbook cards | `W3-MATERIALS-OWNER-v1` | Fix missing Document/Sheet registry projection; do not substitute presentation-only showcase data |
| 12 | Audits | `/audit-programs` | Internal audit library, programs/sessions, evidence, findings, reports and initiatives | `W3-AUDITS-OWNER-v1` | Canonical kernel is `/api/audits/*`; named external standards remain OFF pending rights decision |
| 13 | Chat | `/chat`; `/chat/:conversationId` | Conversation workspace with governed snapshots/proposals/decisions | `W3-CHAT-OWNER-v1` | Provider-free fixture must remain truthful; no fake live-provider success |
| 14 | Admin | `/admin`; separate `/superadmin/system` | Tenant IAM and distinct platform control plane | `W3-ADMIN-OWNER-v1` | Never allow superadmin identity to imply tenant membership or collapse both control planes |
| 15 | Settings | `/settings` (owner start `/settings/profile`) | Personal profile, preferences, security/privacy and export controls | `W3-SETTINGS-OWNER-v1` | Destructive deletion, OAuth and MFA activation remain approved-out unless separately authorized |
| 16 | Partner | `/partner` | Partner owner operations journey | `W3-PARTNER-OWNER-v1` | Decide and implement direct operational landing; long marketing page is not owner-workflow proof |

## Required connection chain per module

Each module repeats exactly this short chain. Failure stops that module; it does not trigger a substitute screen.

1. **Route cutover:** canonical route resolves to the declared component family with no legacy fallback.
2. **Fixture ownership:** guarded seed creates a fresh isolated local database and a FINAL secret-free receipt bound to a durable marker.
3. **API identity:** login establishes the named owner persona and canonical list/detail endpoints return the expected fixture identities.
4. **UI projection:** table counts, labels, statuses, preview and full-card identity match the API objects.
5. **Harmless mutation:** where the module permits it, perform one reversible or fixture-safe save and capture the receipt/version.
6. **Warm readback:** refresh and verify the same identity and saved value.
7. **Cold readback:** restart the exact-SHA runtime without reseeding and verify UI plus API/SQL state.
8. **Evidence:** capture current screenshots for the module's 21 gates and record limitations. Technical proof never becomes `OWNER_ACCEPTED` automatically.

## Wiring order

### Stage 0 — route and component cutover

- Inventory canonical route → component mappings for all 16 modules.
- Remove or quarantine canonical legacy fallbacks, starting with proven regressions.
- Keep historical routes only when a documented migration or archive journey requires them.
- Result root cutover checkpoint: commit `8df1cd413d`; tests `7/7 PASS`; runtime proof still pending.

### Stage 1 — isolated data qualification

Run the guarded owner fixtures independently. Priority is based on observed regression and downstream dependency:

1. Results, Finance, Assessment and Materials.
2. Initiatives and Execution together at the contract boundary, but still on isolated qualification databases.
3. Organization, My Work/Agent, Meetings, Audits and Partner.
4. Interview, Tools, Chat, Admin and Settings (retain their existing evidence; replay only what changed).

### Stage 2 — integration manifest

Create one versioned manifest containing stable cross-module identities and explicit edges:

- Organization and users are shared roots.
- Assessment/Tools/Interview outputs may propose Initiatives but cannot silently register them.
- Approved Initiative identity is preserved into Execution case/work/resource/steering/report objects.
- Execution Actuals flow immutably to Results.
- Results Actuals may be referenced by Finance; Finance proposals never overwrite Results Actuals.
- Meetings, Chat, My Work and Audits may create governed proposals/decisions/tasks through declared adapters only.
- Materials exports reference source artifact/version and do not become a second business-data store.

The integration seed is composed from owned seed builders or exported deterministic definitions, not from database dumps of unrelated fixtures.

### Stage 3 — exact candidate integration runtime

- Freeze one SHA and dirty fingerprint.
- Create a new `consultify_w3_runtime_*` database.
- Apply all migrations once, seed the integration manifest once, then start one frontend/backend pair.
- Record process cwd, ports, database identity and fixture hash before browser work.

### Stage 4 — 16 × 21 replay

- Run each module acceptance file G00–G20 against the same candidate.
- Capture current screenshots, API evidence and readback receipts.
- Three expert reviews may classify findings, but cannot change technical or owner status without evidence.
- Any failed gate returns to the module register as a bounded defect. It does not reopen architecture or generate another implementation.

## Immediate implementation queue

| Order | Task | Completion evidence |
|---:|---|---|
| 1 | Verify all 16 canonical route/component mappings and list every reachable legacy fallback | Machine-readable route audit plus focused route tests |
| 2 | Qualify Results fixture on a fresh local isolated DB after the root cutover | FINAL fixture receipt, API list/detail, current table/preview/full-card screenshots, cold readback |
| 3 | Repeat qualification for Finance, Assessment and Materials | Same closed chain; no shared DB claims |
| 4 | Build and validate the cross-module integration manifest | Schema validation, deterministic counts/IDs/edges and fresh-seed replay |
| 5 | Start one exact candidate integration runtime and perform the full replay | Runtime ledger plus 16 module evidence manifests |

## Current truth

- All 16 module registers and all 21 gate rows per module exist.
- All 16 guarded owner fixture families are admitted by the local owner-runtime allowlist.
- Retained database audit on 2026-08-24 found all `16/16` databases with `831`
  successful migrations. Exact manifest-to-SQL-marker identity passed for
  `15/16`. Materials is `BLOCKED_MARKER_MISMATCH`: its FINAL manifest nonce
  does not match the current `W3-MATERIALS-OWNER-v1` database marker. The
  Materials database must not be adopted until it is freshly reconstructed or
  a new valid FINAL receipt is produced by the guarded seed.
- This proves reconstructibility capability and preserves fifteen immediately
  adoptable isolated fixtures; it does not prove that the current visible
  runtime is connected correctly.
- `/results` had a confirmed legacy fallback regression. Source is checkpointed at `8df1cd413d` with focused tests passing, but the visible runtime has not been changed or claimed fixed.
- No production, Railway or customer data was changed.
