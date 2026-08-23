# Wave 3 — Assessment acceptance

ID: `ASM`
Routes: `/assessment`
Current gate: `OWNER_REVIEW_IN_PROGRESS / BOUNDED_REMEDIATION_PARTIAL / OWNER_RETEST_REQUIRED`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: start a method session, complete meaningful assessment input,
inspect the output and promote a governed initiative batch.

Required boundaries: missing rights/version, stale session, foreign tenant,
failed promotion, duplicate promotion and no false completed state.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope is the five-surface Assessment hub plus canonical DRD Method Core journey. Task links: `ASM-BVP-001`, `ASM-METHOD-CATALOG-001`, `ASM-UI-CANON-001`; all three exact-current packets report `DONE_CURRENT_SHA`. Non-DRD activation, mobile and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Exact adopted runtime on product/client/server `3d61730fd8ad18d19cf9967cb5513697659003cc`: server `:3976`, client `:3977`, retained DB `consultify_w3_assessment_owner_browser_20260822`, `817` migrations. Health/ready/frontend `200`, exact SHA/client marker, SQL ledger and `W3-ASSESSMENT-OWNER-v1` durable marker passed; auth/test bypasses were OFF. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Library → DRD Method Core session → evidence/events → review → distinct-approver freeze → immutable Output/Report/Presentation → exactly-one initiative batch → cold reopen. Server governance exposes DRD only and fails closed for SIRI/ADMA/CMMI/LEAN/unknown types. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: session owner/editor, distinct approver and same-tenant artifact reader. Denied: owner without approver role at freeze, foreign tenant, stale CAS writer and every non-DRD creation request. The mounted fixture binds stable OWNER/editor, distinct ADMIN approver, same-tenant MEMBER reader, revoked ADMIN and foreign OWNER personas; browser replay used the allowed owner path while denied boundaries remain fixture/RealPG-backed. |
| G04 | Reproducible realistic and boundary fixtures | `PASS_OWNER_FIXTURE_READY` | Fixture checkpoint `97422dc99b`. Hardened `server/scripts/seed-wave3-assessment-owner-review.ts` accepts only exact local `consultify_w3_assessment_owner_*` databases, requires literal `YES`, and persists a new absolute manifest once via `wx`/`0600`; reset drops the whole DB and preserves evidence. Two fresh 817-migration cycles produced byte-identical logical manifests (`2013` bytes excluding generated IDs), passed cold readback, secret scan and catalog absence. Stable OWNER/editor, distinct ADMIN approver, same-tenant MEMBER reader, revoked ADMIN and foreign OWNER cover allowed/denied paths. Production Method Core HTTP routes create a six-event active DRD journey and a separate distinct-approver frozen alternate with exactly one approval, snapshot, immutable Output and governed Initiative Draft. Stale freeze, owner self-approval, reader mutation and foreign read fail closed; same-key freeze replay returns the same Output. Source gates are unchanged; an exact local browser mount was completed later, production remained untouched and owner acceptance is still pending. |
| G05 | Functional preflight and cold readback | `PASS_CURRENT_WIP` | Historical canonical lanes remain green. On the current local WIP at base HEAD `ca9ef20646584f4b41bd5732eda3eca993ba0b73`, the complete Assessment component catalog passes `27/27` files and `274/274` tests; root typecheck and the established 8 GB production build pass. The current runtime reports matching client/server SHA, database ready and migration chain complete with pending `0`. This technical result does not close the owner redesign or release gates. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS_WITH_REMAINING_OWNER_SCOPE` | Desktop Assessment entry, active journey, frozen alternate and governed Output deep links were technically replayed on the exact adopted runtime. The active OWNER surface exposed its edit/save controls; the frozen surface rendered server-confirmed immutable Output `b8b5d19d-43a1-4e2d-b306-6c35d9ca7227`, its two findings and the governed Initiative Proposal Draft, with reopen explicitly disabled. Browser console had zero errors/warnings after the canonical cold opens; owned HTTP evidence had zero V8/legacy `my-role` calls and zero `404`s. The write-once fixture receipt remains `verified:false`; this later exact-runtime evidence is recorded here instead of rewriting that receipt. PL/EN, tablet, themes, full a11y and Piotr's CX review remain for the owner round; mobile stays non-gating. Not owner accepted. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 5. Owner decisions remain pending. |
| G08 | First-impression review | `PASS_INTAKE` | Piotr reviewed Library, Processes, the rejected frozen surface and the active DRD workspace on `2026-08-23`; first-impression findings are preserved in the dedicated owner register. |
| G09 | Guided CX journey review | `IN_PROGRESS` | Main hub and DRD workspace were traversed through Library, Processes, Outputs/Reports/Initiatives and the active session. The four-mode target still requires the planned owner workshop and cannot be marked accepted. |
| G10 | Alternate-state owner review | `PARTIAL` | Library availability states, approved/draft Processes and active/frozen DRD surfaces were observed. Full empty/error/permission/theme/responsive owner review remains open. |
| G11 | Every owner observation/screenshot durably registered | `PASS_INTAKE` | Dedicated register `../../owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md` preserves `ASM-OWN-001`–`ASM-OWN-009`; its evidence index retains 14 copied and hashed images. |
| G12 | Owner register reconciled and confirmed | `NOT_STARTED` | — |
| G13 | Solution and impact analysis | `DRAFT_READY_FOR_WORKSHOP` | `../../owner_feedback/04_ASSESSMENT/ASSESSMENT_WORKSHOP_PACKET.md` defines the hybrid target: retain the lighter visual language, rebuild Interview, add Split/Matrix/Report around one Method Core truth model. Owner decisions remain open. |
| G14 | Remediation with finding-to-commit traceability | `BOUNDED_WIP_PARTIAL` | Pure Library and full-height Processes Preview are implemented in the preserved WIP; canonical Preview Details/Menu 3 contracts and Method Core Outputs tests were restored. No commit or acceptance is claimed. |
| G15 | Integrator self-QA and impacted regression | `PASS_FOR_CURRENT_BOUNDED_WIP` | Full Assessment component suite `274/274 PASS`; root typecheck PASS; production build PASS with `NODE_OPTIONS=--max-old-space-size=8192`; local Library/methodology Preview/Processes Preview smoke PASS; `git diff --check` PASS. |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `NOT_STARTED` | — |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | — |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| Verify that DRD work remains understandable before and after independent approval | `/assessment` | deterministic OWNER active journey plus distinct ADMIN-approver frozen alternate; MEMBER/revoked/foreign boundaries | Open six-event guided session → inspect progress/evidence → open independently frozen Output → inspect governed Initiative Draft → integrator replays stale/role/tenant/idempotency boundaries | Non-DRD activation, mobile, production | Method clarity, progress, scoring graphics, insight quality, approval separation and promotion confidence |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `ASM-TECH-01` | technical matrix | DRD bootstrap, catalog governance, freeze, immutable outputs, CAS, tenant and exactly-one batch | Local real PostgreSQL; unique per-run identities with teardown | real HTTP/SQL plus component/runtime assertions | allowed/denied matrix in G03 | `75/75 PASS` | source candidate `d268800dcc`; residue `0` |
| `ASM-OWNER-01` | owner-review fixture | Credible guided DRD plus frozen/Output/Initiative Draft journey | retained exact-prefix DB `consultify_w3_assessment_owner_browser_20260822`; FINAL write-once manifest; production HTTP routes; whole-DB reset contract | HTTP/SQL plus mounted UI cold readback | OWNER/editor, distinct approver, reader plus revoked/foreign negatives | `TECHNICAL_BROWSER_COMPLETE` | active `6` events; frozen `1/1/1/1`; active/frozen sessions, immutable Output and governed Initiative Draft cold-opened; post-fix V8/legacy `my-role` calls `0`, HTTP `404` `0` |

Owner fixture route:

- `/assessment/drd/0f088ee3-2f44-4037-8524-5da5f722aedd`

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `ASM-PF-001` | Three historical component tests still expected the retired legacy DRD writer even though mounted DRD routes are canonically owned by Method Core. They therefore rendered the canonical recovery view and failed before their legacy assertions. The obsolete suite was replaced with a regression proving Method Core mounts before legacy loading and calls neither legacy reader nor writer; save/readback, stale conflict and no-false-success remain covered by the canonical runtime suites. | Initial canonical replay: `3` stale-test failures; corrected canonical route/runtime replay `5/5`, `30/30 PASS`; root typecheck PASS; commit `d268800dcc`. | `FIXED_VERIFIED` |
| `ASM-PF-002` | Method Pack registration has no public HTTP authoring endpoint; the Library is read-only and bootstraps the governed DRD pack through the server registry. | Current real-PG vertical slice `20/20 PASS`; test reports the missing authoring endpoint explicitly. | `OPEN_NONBLOCKING_ARCHITECTURE` |
| `ASM-PF-003` | There is no dedicated pre-freeze live-matrix HTTP endpoint; the client derives the matrix from persisted events using the same pure function used by freeze. | Current real-PG vertical slice `20/20 PASS`; immutable frozen output and cold readback pass. | `OPEN_NONBLOCKING_ARCHITECTURE` |
| `ASM-PF-004` | The Assessment Hub listed/created DRD through legacy `/api/assessments` while the DRD editor and fixture used canonical Method Core, so a real Method Core session could exist while the module entry appeared empty. Hub DRD list/create/deep-link and outputs now use Method Core; legacy DRD and stale cached DRD are rejected, non-DRD rows remain explicitly separate, and canonical DRD remains visible with a warning if only the legacy non-DRD reader fails. | Broad relevant Assessment replay `9/9` files, `47/47 PASS`; focused Hub/modal cutover `6/6 PASS`; root typecheck PASS; no legacy DRD create fallback. | `FIXED_VERIFIED` |
| `ASM-PF-005` | The canonical DRD editor mounted Method Core but still invoked the legacy permission hook, producing V8 and legacy `my-role` compatibility traffic for a Method Core session ID. No backend alias is valid: `/api/method/sessions/:id` already returns the canonical session roles and enforces active/frozen authorization. The Method Core mount now disables the legacy hook instead of silently falling back; legacy/non-DRD callers retain their existing permission path. | Focused component/runtime `3/3` files, `16/16 PASS`: canonical mount issues no V8 or legacy permission request; active/frozen UI derives authority from the Method Core session; `401/403/404` fail closed without a workspace. Mounted Method Core role/approval RealPG `1/1` file, `23/23 PASS`. Post-fix exact adopted browser cold-opened active/frozen/Output/Initiative Draft with V8/legacy `my-role` calls `0`, HTTP `404` `0`, and console errors/warnings `0/0`. | `FIXED_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ASM-OWN-001` | `2026-08-22 21:05 Europe/Warsaw` | “It's obviously not connected to the back end. Please try to recognize that we are right now in an assessment on license like DLD and Siri. As you can see, absolutely nothing is here.” | Backend contract / licensed Assessment | `/assessment/overview?tab=library` | Licensed framework catalog renders, but lifecycle counters are `0`, `Your canonical DRD sessions` is empty and the surface reports `Request failed with 404`. The catalog is client-visible metadata and is not evidence that licensed Assessment sessions were read from the backend. | Licensed Assessment must read the canonical, tenant-scoped session register from its backend and distinguish supported/activated methods from unavailable licensed methods without presenting a false empty register. | Owner cannot review DRD/SIRI-family work or determine whether sessions exist. | `Screenshot 2026-08-22 at 21.05.13.png`; SHA-256 `8efc1823d0c6981ae6bf955d140c1605ac09b78953bbe3866e33280105b429e5` | visible marker `f3237e942304`; actual Vite checkout `1fce2f0631af9d4a1c68521ad44d53a75a9977fc` | `P0` | `CAPTURED_UNRECONCILED / BLOCKS_OWNER_REVIEW` | — | Read-only probe: `GET /api/method/outputs` through `:4119` returns Railway `API_ROUTE_NOT_FOUND` / HTTP `404`; no local Consultify backend process is mounted for this client. | `NOT_TESTED` |
| `ASM-OWN-002` | `2026-08-22 21:05 Europe/Warsaw` | Same owner observation; screenshot shows the result of opening the licensed Assessment workflow. | Runtime truth / fail-closed workspace | licensed Assessment open/deep-link | The workspace collapses to a full-screen `RECOVERY_DRAFT` state with `Request failed with 404`; no server-confirmed session is available. | Open only a server-confirmed session identity/version. On missing backend contract, keep the failure explicit and provide recovery navigation; never imply that `RECOVERY_DRAFT` is a valid Assessment result. | No licensed assessment can be executed or reviewed; local draft state cannot be accepted as source truth. | `Screenshot 2026-08-22 at 21.05.31.png`; SHA-256 `6bf86c9deb60f9c67e25493c3620f5d8e0291dd541a72890a31d7cfae3c5a67f` | visible marker `f3237e942304`; actual Vite checkout `1fce2f0631af9d4a1c68521ad44d53a75a9977fc` | `P0` | `CAPTURED_UNRECONCILED / BLOCKS_OWNER_REVIEW` | — | Source contract confirms `RECOVERY_DRAFT` is local/unconfirmed state, not server truth. | `NOT_TESTED` |
| `ASM-OWN-003` | `2026-08-22 21:05 Europe/Warsaw` | “As you can see, absolutely nothing is here.” | Downstream read / Outputs | `/assessment/overview?tab=outputs` | Outputs/Reports/Initiatives navigation renders, but Outputs fails with `Failed to load Outputs. Please try again.` and all counters remain `0`. The client calls canonical Method Core `GET /api/method/outputs`; the currently proxied Railway backend responds `404 API_ROUTE_NOT_FOUND`. | Licensed Assessment must expose the canonical lifecycle Library → Sessions/Processes → Workspace → immutable Insights/Outputs → Reports → Initiatives against one compatible backend contract, with persisted rows and cold readback. | Entire downstream Assessment chain is unavailable and zero counters are misleading while the request failed. | `Screenshot 2026-08-22 at 21.05.42.png`; SHA-256 `3253b59e086fb7fa3b89f02fe383f15dd750ba0ca8454dd391c5d8f09b3027ea` | visible marker `f3237e942304`; actual Vite checkout `1fce2f0631af9d4a1c68521ad44d53a75a9977fc` | `P0` | `CAPTURED_UNRECONCILED / BLOCKS_OWNER_REVIEW` | — | Client source uses `/api/method`; Gateway source mounts this route, but the backend reached by the current Vite proxy does not expose it. This is a client/backend release-contract mismatch, not proof that the database itself is empty. | `NOT_TESTED` |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `ASM-PF-001` | Test ownership lagged behind canonical DRD writer migration. | Retire legacy DRD save test and assert the mounted route never touches legacy read/write APIs; retain save/readback coverage in Method Core suites. | `d268800dcc` | canonical route/runtime `5/5`, `30/30 PASS`; typecheck PASS |
| `ASM-OWNER-01` | The first owner seed depended on a shared database/user and deliberately lacked the distinct-approver frozen alternate. | Replace it with an exact-prefix disposable DB fixture, stable personas, canonical HTTP active and frozen journeys, write-once manifest and whole-DB reset. | `97422dc99b` | two fresh cycles: active `6` events; distinct approval/snapshot/Output/Initiative Draft `1/1/1/1`; logical manifest identity; residue `0` |
| `ASM-PF-005` | A legacy permission hook remained mounted beside the canonical Method Core DRD workspace. | Disable that hook only for the canonical DRD mount; use the Method Core session response as the sole role/auth/state authority and retain fail-closed HTTP errors. No compatibility alias and no silent fallback were added. | working tree | component/runtime `16/16 PASS`; mounted Method Core role/approval RealPG `23/23 PASS`; exact adopted browser active/frozen/Output/draft cold readback, `my-role` `0`, HTTP `404` `0`, console errors/warnings `0/0` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
