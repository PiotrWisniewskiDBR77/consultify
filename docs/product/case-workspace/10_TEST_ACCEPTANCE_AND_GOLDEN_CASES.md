# Case Workspace — Test, Acceptance and Golden Cases

> Status: Target Model 1.0
> Owner: Product + Engineering + QA
> Scope: evidence contract for Case Workspace release and individual Case acceptance

## 1. Acceptance doctrine

Acceptance is evidence-based and version-bound.

`proposed != approved != executed != validated != accepted != outcome achieved`

Code presence, generated files, build success, deployment, mocks, helper tests, self-attestation or a stale SHA cannot independently prove a Case or the Case Workspace complete.

All required gates must be current for the same canonical candidate SHA, environment, schema and artifact versions.

## 2. Required evidence layers

Evidence must be classified, not blended:

1. **Documentation** — current contract and acceptance criteria.
2. **Code/schema** — implementation and migrations exist on the candidate SHA.
3. **Automated tests** — unit, contract, integration, authorization, idempotency and negative paths.
4. **Runtime/API** — mounted routes and owning services execute the real flow.
5. **RealDB** — persistence, transactionality, readback, restart and tenant isolation.
6. **Browser/UI** — user can complete critical journeys and understand states.
7. **Artifact** — native editability, render/open, manifest, checksum and lineage where applicable.
8. **Outcome** — source readback after the contracted measurement window, when required.

A lower layer cannot substitute for a named higher layer.

## 3. Product acceptance gates

### G0 — Baseline and identity

- exact branch, SHA, environment and schema are recorded;
- tenant, project, user, membership and role are known;
- dirty or mixed-owner worktree state is not represented as a release candidate.

### G1 — Product boundary

- Direct module work succeeds without Case or Teresa;
- Teresa can prepare an ephemeral draft without silently creating a Case;
- explicit confirmation of the exact summary creates exactly one durable Case;
- contract approval activates it; only an eligible `LIGHT` Case may combine confirmation, contract, plan publication and start in `Zatwierdź i rozpocznij`;
- My Work remains the canonical work surface.

### G2 — Contract and planning

- closure type, owner, scope and acceptance criteria are persisted;
- progressive plan versions are immutable after publication;
- material replanning creates diff, reason and renewed approval;
- impossible, circular or unauthorized plans fail closed.

### G3 — Autonomy and approvals

- A0-A4 hard ceilings are enforced server-side;
- exact-version approval, expiry, reject and request-changes work;
- no self-approval or chat-implied material authorization;
- step-up and dual-control policy paths are proven where configured.

### G4 — Execution integrity

- one canonical Case Run and linked step attempts exist;
- idempotency prevents duplicate mutation;
- pause, cancellation, retry, failure and restart/resume preserve state;
- correlation IDs link plan, proposal, execution, result and audit.

### G5 — Evidence and quality

- claim-to-evidence provenance is complete;
- source version, timestamp, access and limitations are visible;
- domain QA is proportionate to risk;
- required independent challenger is current;
- `PASS_WITH_LIMITATIONS`, `PARTIAL`, `UNKNOWN` and `EVIDENCE_MISSING` remain literal.

### G6 — Decisions, Initiatives and value

- formal Decisions have authorized human owners;
- Initiatives link to the exact Decision and accepted scope;
- KPI/ROI has baseline, target, formula, source, owner, window and attribution;
- forecast, target, actual and realized value remain distinct.

### G7 — History, Plays and reuse

- immutable event and audit history survives restart;
- archived reuse checks freshness, access, rights and supersession;
- all authorized users can create private Play drafts;
- shared Play publication requires an authorized publisher or review and immutable versioning;
- instantiated Play changes do not mutate the source.

### G8 — Deliverables

- official outputs derive from the accepted facts digest;
- Word, PowerPoint and spreadsheet outputs are natively editable when required;
- files open/render correctly and have manifest, checksum, version and lineage;
- outputs do not overstate evidence or outcome.

### G9 — Runtime and realDB

- E2E is executed on the named candidate SHA;
- API and browser use real owning services, not test-only substitutes;
- PostgreSQL persistence/readback is proven before and after process restart;
- tenant/project/user negative authorization paths are proven;
- canonical artifacts can be reopened from their owning modules.

### G10 — Closure and monitoring

- all required criteria match the contracted closure type;
- no required item remains partial, blocked, failed, rework or evidence-missing;
- accountable owner accepts closure;
- long-horizon monitoring is either complete or transferred to an approved linked Monitoring Case;
- `OUTCOME_VALIDATED` is used only after the required source readback and elapsed window.

## 4. Golden Case A — focused margin diagnosis

Purpose: prove the system remains light.

Flow:

`CFO intake -> financial source selection -> margin analysis -> sensitivity -> Findings -> Recommendation -> CFO review`

Must prove:

- Small/Lightweight Case path with no process theatre;
- direct Finance capability and canonical Finance artifact;
- reproducible calculations and source provenance;
- assumptions and contradictory evidence visible;
- decision-ready result without mandatory Initiative;
- valid closure after the contracted diagnosis is accepted.

Failure shields:

- no invented baseline or ROI;
- no Case expansion merely because Teresa participated;
- no document treated as proof of calculation.

## 5. Golden Case B — enterprise restructuring

Purpose: prove `TRANSFORMATION` profile with `CONTROLLED` governance and complete consulting lineage.

Flow:

`contract -> discovery/interviews -> assessments -> financial baseline -> options -> challenger -> Decision -> Initiatives -> execution -> KPI/benefits -> sustainability`

Must prove:

- multiple roles, modules and memberships;
- progressive planning and material replan;
- conflict-aware evidence;
- proportionate independent challenger;
- human Decision and exact approval version;
- Initiative ownership and execution readback;
- KPI/ROI source lineage and attribution;
- consistent DOCX/PPTX/XLS from one accepted facts digest;
- Monitoring Case split when the sustainability window exceeds delivery closure.

Failure shields:

- no self-approved recommendation;
- no target presented as actual;
- no final outcome claim before the measurement window.

## 6. Golden Case C — standalone module promoted to Case

Flow:

`standalone Assessment -> Teresa gap synthesis -> LIGHT Case -> material investment Decision -> STANDARD or TRANSFORMATION Case with CONTROLLED governance`

Must prove:

- initial Assessment works without Case;
- canonical artifact is referenced or pinned to an exact revision, not copied;
- promotion preserves owner, version and lineage;
- governance tier increases before the material action;
- earlier approvals do not authorize the expanded scope.

## 7. Golden Case D — Decision not to act

Flow:

`Interview -> evidence -> option analysis -> challenger -> Decision: no action`

Must prove:

- Case may complete successfully without Initiative;
- rationale, alternatives and evidence remain durable;
- no fictitious ROI or execution result is created;
- acceptance reflects `DECISION_COMPLETED`, not `FAILED`.

## 8. Golden Case E — failure, restart and recovery

Flow:

`partial step persistence -> process failure -> restart -> idempotent resume -> expired approval -> reapproval -> completion`

Must prove:

- realDB state survives restart;
- no duplicate event or artifact mutation;
- expired approval blocks execution;
- retry history and correlation IDs are complete;
- operator and user see the same recovery state;
- compensation/rollback record exists where relevant.

## 9. Golden Case F — private-to-shared Play

Flow:

`user creates private Play draft -> validates -> test Case -> requests shared publication -> reviewer changes/rejects/approves -> immutable published version -> Case instantiation`

Must prove:

- every authorized user can author privately;
- draft is absent from shared search/catalog;
- review evaluates governance, data, waits, failures and evidence;
- publication is versioned and audited;
- rejected/requested changes do not leak a shared version;
- instance edits do not mutate the Play.

## 10. Literal state rules

### `PARTIAL`

Use only when a named subset has passed and the remaining scope is listed with impact and owner. It blocks full acceptance unless the contract is formally narrowed and reapproved.

### `UNKNOWN`

Use when a fact is not established. It cannot be silently interpreted as zero, false, prohibited, complete or safe.

### `EVIDENCE_MISSING`

Use when a required claim or gate lacks current acceptable proof. It blocks the affected promotion, publication, Decision, closure or outcome claim.

### `BLOCKED`

Use when the critical path cannot continue and there is an explicit blocker, owner and unblock condition. Planned time-based waiting is `WAITING`, not `BLOCKED`.

## 11. Literal final acceptance rule

The terminal statement:

`FINAL ACCEPTANCE PASS`

is permitted only when all G0-G10 gates required by the agreed scope are current on one candidate SHA, every required acceptance criterion has direct evidence, required approvals bind exact current versions, runtime/browser/realDB/restart evidence passes, no required item is `PARTIAL`, `UNKNOWN`, `EVIDENCE_MISSING`, `BLOCKED`, `FAILED`, `REWORK_REQUIRED` or `PASS_WITH_LIMITATIONS`, and the accountable owner has accepted the contracted closure type. A `PASS_WITH_LIMITATIONS` result must first be resolved or converted through an explicit accountable-owner decision that identifies the limitation as immaterial, proves that no required criterion is weakened, and binds that decision to the exact candidate SHA.

If delivery passes but outcome monitoring remains:

`DELIVERY ACCEPTANCE PASS / OUTCOME ACCEPTANCE PENDING`

If a named subset is accepted:

`PARTIAL ACCEPTANCE — <accepted scope> / REMAINING — <explicit scope>`

If required proof is absent:

`EVIDENCE_MISSING — FINAL ACCEPTANCE NOT PERMITTED`

If any required gate is stale, mismatched or failed:

`FINAL ACCEPTANCE: NOT PASSED`

No alternative success wording may be used to imply final acceptance.
