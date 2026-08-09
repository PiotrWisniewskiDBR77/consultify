# Case Workspace — History, Value, Reuse and Plays

> Status: Target Model 1.0
> Owner: Product + Engineering + PMO
> Scope: durable Case history, value realization, evidence reuse and governed Play lifecycle

## 1. One durable history

History is not a transcript, a technical log or a shelf of generated files. It is the immutable record of what was proposed, approved, executed, validated, accepted and measured.

One event stream supports three projections:

- **Business timeline** — milestones, Findings, Recommendations, Decisions, Initiatives, deliverables and owner-visible exceptions.
- **Audit timeline** — actor, timestamp, object/version, before/after, policy, approval, correlation ID, error, retry and compensation.
- **Value timeline** — baseline, target, forecast, actual, attribution, benefit owner, measurement window and sustainability checks.

The projections may differ in presentation but must not create competing truth.

## 2. Result and value semantics

The canonical chain is:

`Observation -> Hypothesis -> Finding -> Recommendation -> Decision -> Initiative -> Outcome -> Benefit/Sustainability`

Promotion requires:

- Finding: source-backed evidence and stated limitations;
- Recommendation: linked Findings, alternatives, risk and rationale;
- Decision: accountable human owner and exact decision record;
- Initiative: owner, scope, resources and acceptance criteria;
- KPI/ROI: baseline, target, formula, source, period, owner and attribution rule;
- Outcome: current source readback against the agreed baseline;
- Sustainability: measurement after the contracted elapsed window.

A deliverable is not an outcome. A target is not actual performance. Forecast ROI is not realized value. A generated Word, PowerPoint or spreadsheet is a representation of accepted Case knowledge, not independent proof.

## 3. Closure types

The Case contract selects one closure type:

- `DELIVERY_COMPLETED` — accepted deliverable or decision-ready package;
- `DECISION_COMPLETED` — a valid human Decision, including a decision not to act;
- `IMPLEMENTATION_COMPLETED` — approved change applied with operational readback and handover;
- `OUTCOME_VALIDATED` — measured outcome accepted by the metric/business owner;
- `COMPLETED_PARTIAL` — formally accepted named subset with explicit remaining scope;
- `FAILED` or `CANCELLED` — terminal outcome with preserved evidence and recovery record.

For long measurement windows, Monitoring may be a separate linked Case. The delivery/implementation Case can close after its own contract passes; the Monitoring Case owns cadence, source freshness, benefit attribution and later outcome validation. The split must be approved in the original closure contract and must not be used to hide an unmet outcome promise.

Required wording while monitoring remains open:

`DELIVERY ACCEPTANCE PASS / OUTCOME ACCEPTANCE PENDING`

## 4. History states and immutable records

Accepted Decisions, approvals, published plan versions and closure records are immutable. Corrections create successor versions or compensating events. A closed Case is not silently reopened or rewritten; continued work creates a linked phase, Run, successor Case or Monitoring Case.

History must retain:

- Case contract and all published plan versions;
- Runs, step attempts, retries and recovery checkpoints;
- proposals and exact approval state;
- evidence manifests and source versions;
- Findings, Recommendations and Decisions;
- linked Initiatives, KPI and ROI records;
- accepted deliverables and artifact manifests;
- QA/challenger outcomes;
- deviations from plan;
- time, cost and resource actuals;
- closure and value-validation records.

## 5. Reuse modes

Reuse never means untracked copy/paste.

- `REFERENCE` — link to the current canonical object where shared ownership is valid.
- `SNAPSHOT` — pin the exact accepted version used by a Decision or Case.
- `FORK_WITH_LINEAGE` — create a separately editable successor while preserving origin.
- `TEMPLATE_EXTRACTION` — remove client-specific data and retain a reusable method or structure.

Before reuse, the system evaluates:

- relevance to the new purpose;
- freshness and supersession;
- exact version;
- tenant/project access;
- rights and provenance;
- assumptions and source context;
- data classification;
- conflict with newer evidence.

Allowed outcomes are literal:

- `CURRENT`;
- `STALE_REVIEW_REQUIRED`;
- `SUPERSEDED`;
- `RIGHTS_UNKNOWN`;
- `RESTRICTED`;
- `NOT_APPLICABLE`;
- `EVIDENCE_MISSING`.

An archived Result never automatically becomes current Evidence. `UNKNOWN` provenance is not confirmed prohibition, but it blocks shared publication or promotion until resolved.

## 6. Play semantics

A Play is a reusable, versioned method or process definition. It is not a Case, Run, agent persona, Skill or Work Package.

- **Case** owns a business engagement and its outcome contract.
- **Play** defines a reusable approach.
- **Run** executes only an exact published `CasePlanVersion`. Instantiating a
  Play first materializes a CasePlanVersion that references the source Play
  version.
- **Skill/capability** performs a bounded operation through an owning module.
- **Work Package** is a responsibility and result unit inside a Case.

Instantiating a Play creates a Case plan or plan fragment linked to the exact Play version. Editing the instance does not mutate the source Play.

## 7. Play authoring and publication

Every authorized user may create and test a **private Play draft**. Private drafts are visible only within their permitted private/workspace scope and may not be presented as organization-approved methodology.

Shared publication requires an authorized publisher or review. The same publication-quality gate verifies:

- owner and intended audience;
- business purpose and applicability;
- capability contracts and module ownership;
- input/output schemas;
- autonomy ceilings and approvals;
- evidence and QA requirements;
- waits, external work, timeouts and failure paths;
- tenant/data boundaries;
- cost/resource envelope;
- test evidence from a non-production or controlled Case;
- version, changelog and rollback/deprecation plan.

Lifecycle:

`PRIVATE_DRAFT -> VALIDATED -> TESTED -> PUBLICATION_GATE (AUTHORIZED_PUBLISHER | SHARED_REVIEW) -> PUBLISHED_VERSION -> DEPRECATED -> RETIRED`

Only a published immutable version may be advertised in a shared catalog as approved. New material edits create a new reviewable version. Existing Cases remain pinned to their selected version unless explicitly migrated.

## 8. Reuse and learning controls

Consultify may learn from historical duration, blockers, rework causes, cost, evidence gaps, human-attention points and forecast-versus-actual variance. It may recommend a Play or plan change from those patterns.

It must not infer that:

- frequent means correct;
- previously approved means currently authorized;
- historic client evidence is reusable across tenant boundaries;
- a successful deliverable proves outcome;
- an old benchmark remains current;
- an agent's prior assertion is verified evidence.

Learned recommendations remain proposals until governed publication or Case approval.

## 9. Partial, unknown and missing evidence

- `PARTIAL` must name the accepted portion and every remaining item.
- `UNKNOWN` must remain unresolved until a valid source establishes the fact.
- `EVIDENCE_MISSING` blocks the relevant Finding, publication, closure or outcome claim.

History must preserve these states rather than smoothing them into narrative summaries. A later resolution appends evidence and changes the current projection; it does not rewrite the historical fact that evidence was missing at the earlier decision point.

## 10. Runtime and realDB acceptance

History, value and reuse pass only when one candidate SHA demonstrates against real database state:

- Case events survive process restart and are read back in order;
- plan, Play, artifact and approval versions remain linked;
- retry/replay does not duplicate events, artifacts or value entries;
- access controls prevent cross-tenant/project reuse;
- archived Results are rejected or flagged when stale, restricted or superseded;
- Play instance changes do not mutate the published source version;
- private Play drafts are not visible in shared catalog/search;
- shared Play publication cannot bypass review;
- monitoring readback distinguishes forecast, target and actual;
- closed Case records remain immutable and successor lineage is navigable.

Generated-file volume, in-memory tests, mock persistence or UI screenshots without database readback do not satisfy this gate.
