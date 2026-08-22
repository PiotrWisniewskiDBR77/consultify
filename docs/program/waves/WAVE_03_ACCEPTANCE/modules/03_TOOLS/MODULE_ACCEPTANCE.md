# Wave 3 — Tools acceptance

ID: `TLS`
Routes: `/discovery-tools`
Current gate: `TECHNICAL_BROWSER_COMPLETE / OWNER_QUALITY_REVIEW_IN_PROGRESS / LIVE_REGISTER_OPEN / NO_REMEDIATION_AUTHORIZED`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: open Dynamic SWOT, complete meaningful input, inspect
analysis, create/promote an output and cold-reopen exact lineage.

Required boundaries: wrong tool/tenant, rejected proposal, stale lineage,
provider unavailable without false success and owner header at 1440/768.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Wave 3 scope is Dynamic SWOT on `/discovery-tools`; other catalog entries remain `COMING_SOON`. Task links: `TLS-BVP-001`, `TLS-CATALOG-001`, `TLS-UI-CANON-001`; all three exact-current evidence packets report `DONE_CURRENT_SHA`. Mobile and production AI-provider behavior are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Exact adopted runtime on product/client/server `3d61730fd8ad18d19cf9967cb5513697659003cc`: server `:3980`, client `:3981`, retained DB `consultify_w3_tools_owner_browser_20260822`, `817` migrations. Health/ready/frontend `200`, exact SHA/client marker, SQL ledger and `W3-TOOLS-OWNER-v1` durable marker passed; auth/test bypasses were OFF. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Create/resume Dynamic SWOT → capture items and evidence → tensions → conclusions/recommended move → review/approve → immutable nonempty output → downstream promotion → cold reopen exact lineage. Boundaries cover tenant, role, stale writes, rejected proposals, wrong-tool lineage and provider failure without false success. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant owner/ADMIN and legitimate session participant. Denied: inactive member, foreign tenant, wrong tool/session and stale writer. The mounted fixture binds stable OWNER `w3.tools.owner@local.test`; the wider denied matrix remains policy/RealPG-backed and was not manually browser-replayed in full. |
| G04 | Reproducible realistic and boundary fixtures | `PASS` | Technical fixtures create active memberships and clean by organization identity; tested-prefix residue is `0`. Local-only idempotent owner seed creates a guided `70%` journey and an approved `100%` cold-readback example without touching Piotr's existing session or overwriting review progress. |
| G05 | Functional preflight and cold readback | `PASS_WITH_TEST_WARNING` | Existing `123/123` technical replay and `23/23` persistence/CAS lane remain green. The exact adopted browser authenticated the owner and cold-read both stable Dynamic SWOT fixtures: guided `wave3-tools-owner-guided-v1` and approved `wave3-tools-owner-approved-v1`, including their history/comments and exact server-backed session reads. No Tools HTTP 4xx/5xx was recorded in that sweep. React `act(...)` warnings remain test-quality debt; this does not resolve Piotr's captured Wave 3 UX/visual concern. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS_TECHNICAL / OWNER_QUALITY_DEBT_OPEN` | Desktop entry and stable guided/approved deep links cold-reopened on the exact runtime; the guided and approved states were distinct and server-backed. Technical HTTP replay was clean for Tools. The write-once fixture receipt remains `deepLinkVerified:false`; this later exact-runtime evidence is recorded here instead of rewriting that receipt. PL/EN, tablet, themes and full a11y/console coverage were not exhaustively repeated. Mobile is non-gating, and `W3-TLS-CX-001` remains explicitly open for Piotr's visual/CX review; therefore this is not `OWNER_ACCEPTED`. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 4. Owner decisions remain pending. |
| G08 | First-impression review | `PARTIAL_BASELINE_APPROVED / INFORMATION_ARCHITECTURE_FINDINGS_OPEN` | Owner accepted the Library and Sessions table/menu/preview baseline. Outputs and Reports are semantically conflated: owner requires Outputs to become tool-derived Insights from approved Sessions, while Reports must become generated Word/PowerPoint/Excel documents. Findings and evidence: `TOOLS_OWNER_REVIEW_REGISTER.md`, `TLS-TBL-EVD-001..004`. No product remediation is authorized during intake. |
| G09 | Guided CX journey review | `IN_PROGRESS_WITH_ARCHITECTURE_DECISIONS` | Review sequence is Library → detail/preview → start/resume → Dynamic SWOT workspace → review/finalize → output/promotion. Owner has already fixed the downstream information architecture: approved Sessions → tool Insights; Sessions/Insights → generated Reports; eligible approved Sessions/Insights/Reports → the same canonical Initiative Creator used by Interview, with a Tools-specific context adapter and preserved lineage. Exact findings: `TOOLS_OWNER_REVIEW_REGISTER.md`. |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `CAPTURE_COMPLETE_FOR_THIS_ROUND / FINAL_REPORT_WRITTEN` | Atomic evidence and owner decisions are preserved in `TOOLS_OWNER_REVIEW_REGISTER.md`; the consolidated checkpoint is `TOOLS_OWNER_REVIEW_FINAL_REPORT_2026-08-22.md`; the full Dynamic SWOT and cross-tool contract is `rejestr/3-DO-ODBIORU/SWOT-003-finalny-model-pracy-dynamic-swot.md`. Screenshots prove visible composition only; handler, permission and persistence correctness remain pending. |
| G12 | Owner register reconciled and confirmed | `OWNER_RECONCILIATION_PENDING` | The complete round report is ready for Piotr to confirm or correct. It is not owner acceptance of the module. |
| G13 | Solution and impact analysis | `RECOMMENDATION_COMPLETE / IMPLEMENTATION_NOT_AUTHORIZED` | The final recommendation covers Preview Content, menu governance, the Dynamic SWOT session, shared creator shell, approval/send-back, `Outputs → Insights → Reports → Initiatives`, and the platform blueprint for every consulting tool. Exact contract: `TOOLS_OWNER_REVIEW_FINAL_REPORT_2026-08-22.md` plus `SWOT-003-finalny-model-pracy-dynamic-swot.md`. Technical decomposition starts only after owner reconciliation and authorization. |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `NOT_STARTED` | — |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | — |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| _prepare before G07_ | `/discovery-tools` | _pending_ | Start session → input → analysis → output → reopen lineage | Mobile; production AI provider | Consulting workflow, graphics, hierarchy, AI trust, actionable output |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `TLS-TECH-01` | technical matrix | Catalog, tenant/role, CAS, immutable output and lineage boundaries | Local real PostgreSQL; unique fixtures; cleanup by exact organization/session identity | SQL/API/component assertions and tested-prefix residue query | allowed/denied matrix in G03 | `123/123 PASS` | source candidate `fbf400a8e3`; residue `0` |
| `TLS-OWNER-01` | owner-review fixture | Credible end-to-end Dynamic SWOT consulting journey | guarded retained DB `consultify_w3_tools_owner_browser_20260822`; FINAL manifest and durable marker | PostgreSQL plus mounted UI cold reopen | local owner in current organization | `TECHNICAL_BROWSER_COMPLETE / OWNER_REVIEW_PENDING` | guided: `80%`, 5 items, 1 tension; approved: `100%`, 5 items, 2 tensions, 1 move; both stable IDs cold-reopened after the fixture was aligned with the current five-phase mission/output model |

Owner fixture identifiers:

- guided session: `wave3-tools-owner-guided-v1`
- approved session: `wave3-tools-owner-approved-v1`

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `TLS-PF-001` | The catalog real-PG fixture sent authenticated headers but created no active organization memberships, so current authorization correctly rejected it. The fixture now seeds active ADMIN memberships in both isolated organizations. | Initial catalog replay stopped on `ORG_MEMBERSHIP_REVOKED`; corrected replay `6/6 PASS`; commit `fbf400a8e3`. | `FIXED_VERIFIED` |
| `TLS-PF-002` | The BVP teardown selected generated target rows by a session-ID prefix that their UUID identifiers did not contain, leaving two test lineage rows. Cleanup now scopes them by the exact fixture organizations. | Initial residue `2`; corrected BVP replay `11/11 PASS`; tested-prefix residue `0`; commit `fbf400a8e3`. | `FIXED_VERIFIED` |
| `TLS-PF-003` | Focused component tests pass but repeatedly emit React updates-not-wrapped-in-`act(...)` warnings. | Component/output replay `9/9` files, `78/78 PASS` with warning output. | `OPEN_NONBLOCKING_TEST_QUALITY` |
| `TLS-PF-004` | The frontend persistence adapter documentation and types still described optimistic concurrency as absent/optional after the server had already made it mandatory, risking saves without an authoritative expected version. | Adapter types now require numeric versions on create/GET/update; the sync hook re-reads a missing version before PUT and advances it only from the successful server receipt. Focused adapter/hook replay `2/2` files, `23/23 PASS`. | `FIXED_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `W3-TLS-CX-001` | `2026-08-21` | „akceptuję jak jest — jest źle, ale zrobimy to w przejściu w fali 3” | `CUSTOMER_JOURNEY / VISUAL_DESIGN` | Full Dynamic SWOT journey | Wave 2 bounded header gate accepted; broader UX remains unspecified and unsatisfactory to Piotr. | Use the guided Wave 3 review to split the broad concern into exact testable visual and workflow findings without losing the original statement. | High risk of an unusable or visually weak consulting journey despite technical correctness. | Wave 2 P4 manifest and screenshot | `a36d9d51edc87bb63e7211754e22106d02d2d3d0` | `P2` | `CAPTURED / OWNER_SPECIFICATION_REQUIRED` | — | — | — |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `TLS-PF-001` | Historical fixture predated active-membership enforcement. | Seed two isolated organizations, user and active ADMIN memberships; clean the identity graph. | `fbf400a8e3` | catalog real-PG `6/6 PASS` |
| `TLS-PF-002` | Teardown assumed generated UUIDs inherited a human-readable prefix. | Delete fixture links by exact organization identity. | `fbf400a8e3` | BVP `11/11 PASS`; residue `0` |
| `TLS-OWNER-01` | The existing local session contained no meaningful inputs and could not support a credible owner round. | Add a guarded, non-overwriting local seed for guided and approved consulting states. | `dcbc89fde0` | PostgreSQL readback: 2 sessions; guided `5/1/0`, approved `5/2/1` items/tensions/moves |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Wave 2 bounded acceptance does not replace Wave 3 Tools review.
Evidence manifest: —
