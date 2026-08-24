# Assessment exact-candidate 43730 — independent technical/integration review

> Date: 2026-08-23  
> Candidate inspected: `43730f86f8a74943c36a58b9ff07aa680a42aa3e`  
> Mode: read-only source/document/PNG audit  
> Status: `INCOMPLETE / NOT_ACCEPTED / RELEASE_BLOCKED`

## 1. Scope and evidence boundary

Reviewed:

- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`;
- `docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md`;
- `docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/ASSESSMENT_WORKSHOP_PACKET.md`;
- `docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/ASSESSMENT_COMPLETE_EXPERT_AUDIT_2026-08-23.md`;
- current Method Core contracts, routes, services, migrations and focused tests;
- `ASM-EVD-010_ACTIVE_WORKSPACE_OVERLOAD.png`, `ASM-EVD-011_PRIOR_MATRIX_WORKSPACE.png` and `ASM-EVD-014_PRIOR_MATRIX_EDITING.png`.

This review does not replay runtime `43730`, execute RealPG, inspect generated PDF, or constitute owner acceptance. Existing `PASS` statements tied to `3d61730`, `d268800`, `97422d` or a dirty WIP are historical/adjacent evidence and do not transfer automatically to `43730`.

## 2. Executive verdict

Method Core is a credible persistence kernel, not yet the complete Assessment product contract. It already provides a pinned method pack, tenant-scoped sessions, explicit roles, optimistic concurrency, append-only idempotent events, distinct-approver freeze, immutable hashed Output, report/presentation snapshots, supersession and local Initiative Proposal Drafts. These are reusable assets.

The owner target, however, requires one governed chain:

`Method snapshot -> Process -> Interview claims/evidence/judgment -> approved AS-IS -> Matrix/TO-BE -> approved Matrix -> canonical Report revision -> approved/published Report/PDF -> accepted Insight/recommendation -> Initiative promotion`.

That chain is not represented end-to-end by the current contracts. The largest gaps are the method-definition schema, three-gate revision governance, canonical Insight/Report identity, PDF lifecycle, subscription/report-credit ledger, evidence security, comments, and registered-Initiative handoff.

## 3. Atomic findings

### `ASM-TECH-43730-001` — Method Pack cannot express the owner truth model

- **Evidence:** `server/src/method-core/contracts/methodPack.ts` defines manifest, units, levels, questions, sources, scoring fixtures and four adapter functions. It has no scope/population/reference-period contract, item/answer type schema, applicability/N-A/Skip rules, evidence rubric, confidence/judgment model, target rules, Matrix capability, report chapter mapping, approval policy or entitlement hooks.
- **Contract violation:** owner audit C1-C3, C6-C7 and C15 require these to be versioned method-owned semantics rather than DRD UI assumptions.
- **Impact:** two adapters may compile while interpreting answers, denominators, target and report eligibility differently; a second method cannot prove genuine reuse.
- **Priority:** `P0`.
- **Testable closure gate:** extend and version the public/server mirror; schema-validate immutable snapshots; compile DRD and one structurally different method; golden tests prove N/A vs Skip, evidence states, scoring/rounding, target capability and `NOT_COMPARABLE`; contract-mirror drift remains zero.

### `ASM-TECH-43730-002` — Session aggregate is too thin for a canonical Process

- **Evidence:** `MethodSession` carries ids, module, pinned pack, state/domainStage, mode, owner, timestamps, integer version and revision pointer. It lacks document title, organization/site/business-unit scope, assessed population, reference period, locale, method snapshot hash, retention state and process-level approval/readiness references.
- **Contract violation:** owner product model requires a started method to create a durable, identifiable Process whose scope and denominators remain stable across Interview, Matrix and Report.
- **Impact:** list identity and report context must be reconstructed from UI or unrelated rows; scope drift cannot be detected reliably.
- **Priority:** `P0`.
- **Testable closure gate:** Process aggregate/read model persists those fields, pins the exact method content hash, supports CAS updates and cold-login readback; Output/Report/PDF repeat the same scope and reference period.

### `ASM-TECH-43730-003` — Current approval model proves one freeze, not the owner approval graph

- **Evidence:** `METHOD_SESSION_STATES` has one `in_review -> frozen` transition; `TRANSITION_AUTHORITY` assigns freeze to `approver`; `method_approvals` binds a decision to the current session version. No distinct AS-IS, Matrix and Report approval objects/states, quorum/delegation/expiry/waiver graph or deterministic downstream invalidation contract is visible.
- **Contract violation:** owner target enumerates approved AS-IS/evidence, approved target/Matrix and approved Report, each revision-bound with upstream invalidation.
- **Impact:** a single session freeze can be mistaken for approval of all downstream artifacts; later Interview changes cannot precisely stale only affected Matrix/Report/PDF revisions.
- **Priority:** `P0`.
- **Testable closure gate:** explicit approval subjects and immutable revision hashes; role/separation matrix; stale cascade tests; self-approval, revoked role, delegation expiry, concurrent decision and request-changes negatives; zero downstream eligibility on stale approval.

### `ASM-TECH-43730-004` — `Output`, `Insight` and `Report` identities remain unresolved

- **Evidence:** HTTP exposes `/outputs`, `/reports`, `/presentations` and `/initiative-drafts`; report snapshots are arbitrary structured `content: unknown` linked to Output. There is no Method Core `Insight` aggregate despite the owner renaming the top-level surface to Insights, and no proof that the in-session Report and shared Reports register are the same canonical revision.
- **Contract violation:** owner C7 requires one Report identity/revision and explicit Assessment -> Insight -> Report -> Initiative lineage.
- **Impact:** competing objects and duplicated generation paths can disagree, be approved separately or silently lose lineage.
- **Priority:** `P0`.
- **Testable closure gate:** publish a canonical artifact graph with stable IDs and exact revision/hash pins; the same Report opens in-session and from registry; Insight is either a defined first-class aggregate or explicitly mapped to immutable findings/recommendations; cold readback proves no duplicate identity.

### `ASM-TECH-43730-005` — Report creation is a synchronous snapshot write, not a governed report/PDF lifecycle

- **Evidence:** `POST /outputs/:id/report` accepts structured content and creates `method_report_snapshots`; states are only `current|superseded|source_updated`. No queued/generating/partial/failed/expired job, chapter completeness, PDF revision, approval/publication, secure download, retry/cancel or accessibility receipt is present in Method Core.
- **Contract violation:** owner C8 and report spec require seven ordered chapters, revision-bound deterministic export, failure honesty and no silent omission.
- **Impact:** arbitrary caller content can become a current report; failed/partial generation and re-export cannot be governed or audited.
- **Priority:** `P0`.
- **Testable closure gate:** idempotent report/PDF job state machine; input pins; chapter manifest and completeness hash; golden one-axis/full PDF visual/text/accessibility checks; failure/retry/cancel/expiry tests; re-export of one revision is byte/content-equivalent under the defined renderer policy.

### `ASM-TECH-43730-006` — Subscription and report-credit enforcement is absent from Method Core writes

- **Evidence:** Method Pack stores licence notice/usage restriction and a demo bypass flag, but report creation routes/services show no authoritative entitlement snapshot, seat check, report-credit reservation/consume/release/refund ledger or billing-outage behavior.
- **Contract violation:** owner C9 requires paid/demo persistence boundaries and exactly-once report metering.
- **Impact:** unauthorized persistence/report generation or double charging cannot be ruled out; demo bypass can become product policy by accident.
- **Priority:** `P0`.
- **Testable closure gate:** server-side entitlement decision before session persistence and report generation; transactional credit ledger keyed by report revision/idempotency key; trial expiry, upgrade/discard, seat race, provider outage, generation failure/refund, retry and free re-export tests.

### `ASM-TECH-43730-007` — Initiative integration stops at a local proposal draft

- **Evidence:** `MethodInitiativeDraftService` explicitly has no registration method and no `initiative_id`; it validates only title and at least one finding, then persists `kpiProposal`, dependencies, risks and evidence links as JSON/unknown structures.
- **Contract violation:** owner requires an accepted recommendation—not an unreviewed AI proposal—to become eligible for a governed Initiative with source lineage.
- **Impact:** the end-to-end Assessment value path is incomplete; untyped proposal content can drift from Initiatives contracts and exactly-once promotion is unproven.
- **Priority:** `P0`.
- **Testable closure gate:** typed accepted-recommendation state; explicit human promotion command owned jointly with Initiatives; transactional/idempotent link receipt; revision and approval guards; duplicate, stale, foreign-tenant, revoked-role and partial-failure tests; cold readback from both modules.

### `ASM-TECH-43730-008` — Evidence model does not yet satisfy attachment/security governance

- **Evidence:** method events/evidence support provenance and strengths, but the reviewed Method Core contract does not expose the full owner-required ACL, malware scan, signed access, PII/redaction, residency, external-link snapshot/rot, retention/legal-hold and evidence-expiry policy.
- **Contract violation:** owner C10 and C3.
- **Impact:** a technically attached file may be treated as durable evidence without proving safety, authority, period, population or continued availability.
- **Priority:** `P0 security/governance`.
- **Testable closure gate:** evidence object and upload pipeline with tenant ACL and scan state; forbidden download negatives; revoked/broken/stale source propagation into scoring/report readiness; retention/legal-hold tests; report citation fails closed when evidence is unavailable.

### `ASM-TECH-43730-009` — Audit lineage is strong but not transactionally complete across the whole freeze chain

- **Evidence:** event append is idempotent and Output hashing is deterministic. Route comments describe self-healing if freeze completed before Output creation; reports/drafts are superseded in loops after reads. This is recovery logic, not proof of one atomic session approval -> snapshot -> Output -> downstream supersession transaction/outbox.
- **Contract violation:** owner requires exact lineage and no false completed state under partial failure.
- **Impact:** crashes can leave frozen-without-output or partly superseded downstream sets; self-heal may repair one gap while audit ordering/side effects remain ambiguous.
- **Priority:** `P1`, promoted to `P0` for release.
- **Testable closure gate:** transactional boundary or durable outbox/saga with explicit intermediate states; failure injection after each write; restart convergence to exactly one Output and complete supersession; operator correlation trace and zero orphan rows.

### `ASM-TECH-43730-010` — Current UI donor is not a valid adapter proof

- **Evidence:** `ASM-EVD-010` shows repeated question cards, duplicated axis navigation, permanent Teresa panel and technical session metadata. Historical Matrix PNGs show useful AS-IS/TO-BE mechanics but a DRD-specific 7-level grid, dark legacy shell and direct maturity selection. The owner target removes Split/Workspace, uses `Interview | Matrix | Report`, and keeps Interview AS-IS separate from Matrix TO-BE.
- **Contract violation:** a known-good UI may be adapted mechanically, but cannot define domain truth or universal method behavior.
- **Impact:** reusing the donor wholesale would reintroduce target-in-Interview ambiguity, DRD hard-coding and unsupported direct scoring writes.
- **Priority:** `P1`.
- **Testable closure gate:** adapter maps canonical Process/read models into shared shell; interaction tests prove Interview writes claims/evidence only, Matrix writes separate TO-BE through governed commands, no permanent Teresa panel, and second method can omit Matrix without dead UI.

### `ASM-TECH-43730-011` — Failure taxonomy is still narrower than the product lifecycle

- **Evidence:** routes distinguish common 400/403/404/409 boundaries and UI has recovery states, but no unified contract covers entitlement expired, method mismatch/migration, partial report, stale approval, offline queue, billing/provider failure, attachment rejection and PDF expiry.
- **Contract violation:** owner C13.
- **Impact:** users may receive generic not-found/disabled behavior and cannot determine whether to retry, request access, upgrade, resolve conflict or abandon.
- **Priority:** `P1`.
- **Testable closure gate:** typed error/problem codes with recoverability and safe UI mapping; contract/component/E2E matrix for every C13 state; no failed request renders zero or completed state.

### `ASM-TECH-43730-012` — Exact-candidate evidence is not current enough to close the gate

- **Evidence:** checkout HEAD is `43730f86...`, while MODULE_ACCEPTANCE cites adopted runtime `3d61730...`, source candidate `d268800...`, fixture `97422d...` and current WIP at base `ca9ef...`; the worktree is dirty. No frozen `43730` runtime/DB/browser/manifest/PDF replay was supplied in the reviewed packet.
- **Contract violation:** G18-G20 and exact-candidate acceptance discipline.
- **Impact:** source findings and prior green tests cannot establish runtime or persistence truth for `43730`.
- **Priority:** `P0 acceptance governance`.
- **Testable closure gate:** freeze candidate and dirty fingerprint; exact client/server SHA and migration ledger; deterministic fixture receipt; automated suites, RealPG, denied personas, browser console/network, cold login, report/PDF and full owner replay all reference the same candidate and environment.

## 4. G00-G20 independent assessment

| Gate | Independent state on `43730` | Reason |
|---|---|---|
| G00 | `PARTIAL` | Scope exists, but active acceptance criteria conflict with the newer owner target and C1-C15 remain open. |
| G01 | `EVIDENCE_MISSING` | No exact `43730` client/server/runtime/DB/migration packet; cited adopted runtime is older. |
| G02 | `PARTIAL` | Existing freeze journey is mapped; final Interview/Matrix/Report/Insight/Initiative and entitlement/PDF flows are not. |
| G03 | `PARTIAL` | Session roles and distinct approver exist; final three-gate, comments, report/PDF, entitlement and promotion permission matrix does not. |
| G04 | `PARTIAL` | Strong deterministic DRD fixture exists historically; no exact `43730`, final-contract, second-method, billing/PDF/security fixture pack. |
| G05 | `EVIDENCE_MISSING` | Historical/current-WIP tests do not establish a frozen `43730` functional preflight and cold readback. |
| G06 | `PARTIAL` | PNG and earlier browser evidence exist; final UI, PL/EN, tablet, themes, a11y, PDF and error matrix are open. |
| G07 | `READY_FOR_GUIDED_REPLAY` | Operator card exists; not a pass or owner decision. |
| G08 | `PASS_INTAKE` | Owner observations were captured; this does not accept implementation. |
| G09 | `IN_PROGRESS` | Target journey discussed, not replayed end to end. |
| G10 | `PARTIAL` | Some alternate states observed; full permission/error/entitlement/revision states open. |
| G11 | `PASS_INTAKE` | Atomic register/evidence index exists. |
| G12 | `NOT_STARTED` | No owner reconciliation/confirmation. |
| G13 | `INCOMPLETE` | Expert audit explicitly leaves C1-C15; 7.9-8.1/10 coverage. |
| G14 | `PARTIAL_WIP` | Bounded Library/Preview work cannot stand for full Method Core redesign. |
| G15 | `EVIDENCE_MISSING_FOR_43730` | Reported tests/build are not an exact frozen-candidate acceptance pack. |
| G16 | `NOT_STARTED` | No complete before/after packet. |
| G17 | `NOT_STARTED` | No owner retest decisions. |
| G18 | `NOT_STARTED` | No exact-SHA owner acceptance/checkpoint. |
| G19 | `NOT_STARTED` | Later-change regression obligations unresolved. |
| G20 | `NOT_STARTED` | No final 16/16 exact-candidate replay. |

## 5. Recommended closure order

1. Reconcile owner C1-C15 and retire/supersede contradictory active criteria.
2. Freeze the versioned Method Definition + Process + artifact graph.
3. Implement three approval subjects and deterministic staleness propagation.
4. Define one Report/Insight identity and typed Initiative promotion seam.
5. Add entitlement/credit, PDF job and evidence-security contracts.
6. Prove DRD plus a structurally different second method.
7. Freeze a clean candidate and execute exact-runtime/RealPG/failure-injection/browser/PDF/owner gates.

Final decision: `NO-GO FOR IMPLEMENTATION ACCEPTANCE`. The kernel is reusable and worth preserving, but the exact candidate is not yet a complete or accepted implementation of the owner-defined Assessment product.
