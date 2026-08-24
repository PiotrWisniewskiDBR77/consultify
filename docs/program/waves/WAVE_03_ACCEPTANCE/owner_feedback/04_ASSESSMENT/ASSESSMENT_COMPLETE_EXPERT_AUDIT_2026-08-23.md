# Assessment — two-round skeptical expert audit

> Date: 2026-08-23  
> Inputs: `OWNER_FEEDBACK_REGISTER.md` (`ASM-OWN-001`–`028`),
> `ASSESSMENT_OWNER_REVIEW_SUMMARY_2026-08-23.md`, workshop packet, level-card
> skeptical review, QBank/book/source donor evidence  
> Reviewers: senior consulting, principal UX/product design, assessment and
> survey methodology  
> Status: `INCOMPLETE / 7.9–8.1 OF 10 COVERAGE / NO IMPLEMENTATION ACCEPTANCE`

## 1. Executive verdict

The owner review now describes the desired product, core jobs and principal
screens unusually well. Evidence-first intake, AS-IS/TO-BE separation,
Interview–Matrix–Report lineage, staged approvals, expert report interpretation,
reusable method adapters, comments, advisory AI and revision-bound PDF are a
strong target architecture.

All three reviewers independently returned `INCOMPLETE`, however. Two sensible
implementation teams could still produce materially different products because
active requirements contain contradictions and several domain/state contracts
remain undefined. Current coverage:

| Review lens | Current coverage | Conditional target after corrections |
| --- | ---: | ---: |
| Consulting/product operating model | 8.1/10 | 9.3/10 |
| UX, information architecture and state coverage | 8.1/10 | 9.2–9.3/10 |
| Measurement methodology and data traceability | 7.9/10 | 9.3/10 |

`CONDITIONALLY_COMPLETE` is available after the contracts below are reconciled
and made testable. `COMPLETE` additionally requires implementation, runtime and
browser readback, RealPG, PDF proof, second-method proof and Piotr's explicit
acceptance.

## 2. Blocking contradictions

1. **Interview AS-IS versus donor Target** — the final model places TO-BE only
   in Matrix, while the donor card exposes `Target` in Interview. Resolution
   recommended by all reviewers: reuse donor mechanics but remove Target from
   Interview. `Achieved` is an AS-IS claim until evidence/assessor validation;
   `Skip` is a reason-coded workflow state.
2. **Seven axis chapters versus eight report dimensions** — must be resolved by
   a versioned mapping/canon change before Report/PDF implementation.
3. **Two approval levels versus three enumerated gates** — choose the final
   hierarchy and define roles, separation of duties and invalidation.
4. **One canonical Report identity** — in-session Report, shared Reports
   register and legacy/frozen Output must not become competing objects.
5. **Matrix `Set AS-IS` versus evidence governance** — it can only invoke the
   same governed correction command and validation/reapproval path as Interview.
6. **Paid/demo exploration versus persistence** — the user must know the data
   boundary before working; upgrade/discard/read-only and expiry behavior remain
   explicit decisions.
7. **Historic navigation criteria versus current shell** — old two/four-mode
   acceptance criteria must be marked superseded so they cannot remain active
   tests alongside `Interview | Matrix | Report`.
8. **Global Save versus local/autosave behavior** — define the exact dirty,
   persist, conflict, exit and recovery model.

## 3. Closed list of contracts required before implementation

### C1. Versioned method definition

Define stable IDs, hierarchy, localized content/QBank version, item/answer
types, scales/direction, applicability, evidence rubric, judgment/confidence,
aggregation, target rules, Matrix/report capabilities, approvals and entitlement
hooks. Every Process pins an immutable method snapshot/hash. Define upgrade,
migration, reassessment, removed-item and unsupported-adapter behavior.

### C2. Scope, applicability and denominators

Persist organization/site/business-unit scope, population and reference period.
Keep `answered`, `assessed`, `evidence-validated`, `approved` and `applicable`
denominators distinct. `Skip` never changes applicability; `N/A` requires reason
and approval.

### C3. Claim, evidence, judgment, confidence and scoring

Formally define respondent claim → evidence qualification → assessor judgment →
approved AS-IS. Evidence retains source/authority, period, population/scope,
directness, provenance/integrity, verification, expiry/staleness and conflict.
Define per-method adequacy, missing/conflicting/partial states, confidence
derivation, non-contiguous handling, aggregation, weights, rounding and
uncertainty propagation. QBank prompts cannot be counted as score items.

### C4. Process/session lifecycle

Create one state machine covering create/failure, draft/in-progress, submit,
review, AS-IS approval, Matrix approval, report generation/review/approval,
publish/freeze, reopen, supersede, archive/abandon, duplicate and retention.
For every state specify modes, actions, roles, Save, AI, comments, PDF and
downstream eligibility.

### C5. Revisions, Save and concurrency

Define immutable revision IDs/hash, revision granularity, autosave/global Save,
dirty state, optimistic locking, two-editor conflicts, retry/offline policy,
draft recovery, save/discard/stay protection, restore-as-new-revision, atomic
cross-object writes and cold-login readback.

### C6. Governance and approval graph

Finalize three gates/two groups, labels and permission matrix. Decide
self-approval, separation of duties, quorum, delegation, expiry, revoke,
request-changes, concurrent approval and exception/waiver register. Upstream
edits deterministically mark exact downstream revisions stale and needing
reapproval.

### C7. Canonical Report and downstream lineage

Use one Report object/revision across session and Reports register. Define
generation/edit/regeneration, per-axis partial results, diff, approval,
publication, stale/superseded and exact upstream pins. Define eligibility,
revision lineage and invalidation for Assessment → Insight → Report → Initiative.
An accepted recommendation, not an AI proposal, becomes eligible for Initiative.

### C8. PDF job lifecycle

Define queued/generating/ready/partial/failed/expired, cancel, retry,
re-download, authorization, retention and secure link behavior. Pin the exact
report revision, support draft watermark and accessible/non-color rendering,
and prevent silent chapter omission or double charging.

### C9. Entitlement, seats and report-credit ledger

Define authoritative entitlement source/snapshot; seat assignment races;
trial/demo start, upgrade, discard and expiry; past-due/grace/read/export
policy; billing outage; atomic credit reservation/consume/release/refund and
idempotency. Recommended consumption event: successful creation of a new
canonical Report revision, not preview, retry or re-export. Loss of entitlement
must not destroy or hide the customer's historical data/audit.

### C10. Evidence and attachment security

Define tenant ACL, allowed sizes/types, malware scanning, signed access,
integrity, PII/redaction, provider/data-residency constraints, retention/delete
and legal hold. Define external URL snapshot/link rot, revoked/stale evidence
and how reports/citations fail closed when a source is unavailable.

### C11. Comments

Define anchors for Interview/Matrix/Report/evidence, permissions, author/time,
mentions, notifications/unread, edit/delete, resolve/reopen, moderation,
approval blocking, revision migration, stale/orphan anchors, retention and
export visibility. Separate factual respondent note, assessor rationale and
collaboration comment in the schema.

### C12. AI run and proposal lifecycle

Define authorized data scope/consent and tenant isolation; attachment prompt-
injection defense; queued/running/partial/failed/cancelled; pinned input/method,
model/prompt/tool versions and cost; citations; proposal expiry/staleness;
diff/apply conflicts; individual/bulk accept/edit/reject; retry and provider/
credit failure. AI cannot create evidence, score, write silently or approve.

### C13. Entry, empty, error and recovery matrix

Specify loading, not found, forbidden, entitlement expired, method mismatch,
migration required, frozen/read-only, archived, offline/server unavailable,
partial loading, save conflict, stale revision, rejected evidence, partial report,
AI/PDF/billing failure and recovery. A single `Assessment not found` error is
not an acceptable taxonomy.

### C14. Responsive and accessibility matrices

Define wide desktop, 1280×720, tablet landscape/portrait and mobile behavior for
shell, navigation, cards, Matrix, Report, Settings, Preview and Processes.
Define semantic tabs/toolbars/status, keyboard/focus, live regions, Matrix
grid/table plus mobile list alternative, non-color encoding, zoom, reduced
motion, error summary and accessible/tagged PDF reading order.

### C15. Cross-method and comparison contract

Prove another structurally different method through the same shell, including a
different hierarchy/scale and no Matrix or different target semantics. Default
cross-method result is `NOT_COMPARABLE`; comparison requires an explicit,
versioned equivalence mapping plus compatible scope, scale and evidence policy.

## 4. Minimum proof pack

1. Method schema validation, integrity and immutable snapshot/hash fixtures.
2. Golden DRD scoring fixtures: complete/partial/N-A/Skip/missing/conflicting/
   stale/rejected evidence and high-level outlier with lower gaps.
3. Structurally different second method proving no DRD hard-code and explicit
   `NOT_COMPARABLE` behavior.
4. Full Library → Process → Interview → Matrix → approvals → Report → PDF →
   Insight/Initiative lineage after refresh and cold login.
5. Save, crash recovery, offline/retry/idempotency and concurrent edit conflict.
6. Permission/approval adversarial matrix including self-approval, quorum,
   delegation, stale revision and upstream invalidation.
7. Evidence ACL/malware/redaction/broken URL/revocation/retention test pack.
8. AI adversarial evaluation for unsupported claims, missing citations, prompt
   injection, stale snapshots, target overreach and forbidden writes.
9. Golden one-axis/full PDF output, seven/eight mapping, no missing area,
   pagination/fonts/accessibility and immutable revision linkage.
10. Entitlement ledger: demo/upgrade/discard, expiry, seat race, exactly-once
    credit consumption, failure/refund/retry/re-export.
11. Lifecycle transition/property tests including freeze, reopen, restore,
    supersede, archive and retention.
12. Assessor calibration/double-rating sample with an agreed reliability
    threshold before claiming cross-assessor reliability.

## 5. Final boundary

The owner intent and target experience are captured. The module is not yet
fully specified for implementation. Complete C1–C15, map them to the proof pack
and remove contradictory active acceptance criteria. At that point the
documentation may be marked `CONDITIONALLY_COMPLETE`; it still must not be
called implemented, verified, accepted or released without the corresponding
evidence and owner gate.
