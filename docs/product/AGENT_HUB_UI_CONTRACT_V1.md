# Agent Hub UI contract v1

> Status: CANONICAL_IMPLEMENTATION_CONTRACT
> Owner: Product + Engineering
> Baseline: `f3237e94230481d2bf4ad0a9c0dc10b1391191c9`
> Consolidates: Run Agent IA/UX draft, Teresa process-design draft, Agent Execution v8 SSOT and the two 2026-08-13 prototypes.

## Product promise

Agent Hub turns a business outcome into governed, reviewable work. A user and Teresa work on one durable `Transformation Case` (`Zlecenie`) and one versioned Plan. Conversation and manual editing are synchronized views of that same Plan; neither creates a parallel process definition.

Canonical lifecycle:

`understand -> plan -> propose -> preview -> approve -> apply -> audit -> learn`

The normal user interface speaks in outcomes, work, decisions and evidence. Adapter keys, UUIDs, raw enums, JSON, reconciliation and runtime diagnostics are operator-only information.

## Information architecture

### 1. Zlecenia

Business index with outcome, status, attention, owner, next action, due date and last activity. It never presents stage capability counts as progress. Primary action: `Otwórz zlecenie`.

### 2. Zlecenie workspace

Full-page workspace with outcome, owner, current stage, health and one contextual primary action. Primary navigation:

1. `Plan`
2. `Realizacja`
3. `Rezultaty`

Secondary contextual views: `Decyzje`, `Zespół`, `Historia`. Operator-only `Diagnostyka` is hidden unless the current role has diagnostic authority.

### 3. Plan

Desktop uses a Teresa workshop and live plan side by side. Mobile switches between them without losing state. The plan defaults to business cards grouped into Frame, Diagnose, Decide, Deliver and Realize; an accessible list is always available. Expert fields are opt-in.

### 4. Review

Every Teresa-originated mutation is a versioned suggestion with rationale, impact, evidence and semantic before/after. Each change can be accepted, rejected or edited. Scope, cost, recipient, permission or governance expansion requires individual approval. Applying a suggestion creates a new draft Plan version and never overwrites an approved Plan or a human edit.

### 5. Realizacja

The run cockpit shows business outcome, current work, next decision, attention queue, timeline and produced artifacts. It does not default to logs. Retry resumes the same invocation and idempotency identity.

### 6. Rezultaty

Shows outcome summary, KPI and benefits, decisions, artifacts, evidence and learning. Native artifacts open in their owning modules. Word and PowerPoint use the same approved facts digest.

## Collaboration modes

Every Case persists exactly one mode:

- `teresa_led` — Teresa prepares the Plan; the user reviews decisions and changes.
- `human_led` — the user owns the Plan; Teresa assists on request.
- `teresa_draft_human_edit` — Teresa creates the first draft; the user edits it directly.
- `human_draft_teresa_review` — the user creates the draft; Teresa proposes quality improvements.

Changing mode is audited and does not mutate the current Plan. All modes converge on review, approval, execution and evaluation.

## Business status vocabulary

Default UI uses:

- `Szkic`
- `Plan do przeglądu`
- `Plan zatwierdzony`
- `W realizacji`
- `Wymaga decyzji`
- `Zakończone`
- `Anulowane`

Technical capability evidence (`REAL`, `PARTIAL`, `PROPOSAL_ONLY`, `NOT_CONNECTED`, `NOT_IMPLEMENTED`) is not a business status. It is displayed only in operator diagnostics. A Plan may be approved while individual work remains assigned to people; this is not represented as `0/15 ready`.

## Capability truth

A runtime capability is executable only when evidence verifies all of:

1. mounted authenticated route;
2. owning service;
3. tenant-scoped owning-module write;
4. canonical readback;
5. governance and reviewer authority;
6. idempotent replay;
7. failure and recovery behavior.

The registry stores evidence references and an evaluation timestamp. A plan projects current registry truth at read time. Existing plan rows are never promoted by an unverified migration or hard-coded UI mapping.

## Teresa contract

Teresa asks only questions that materially affect outcome, scope or safety. Minor assumptions remain explicit and can be accepted together. A response can create a suggestion, but not a durable business mutation. Teresa cannot approve her own output, expand scope or recipients, hide failures or claim success without owning-module readback.

## Accessibility and responsive behavior

- Keyboard and screen-reader list alternative for every visual plan.
- Status never relies on color alone.
- Focus moves to the changed card after an accepted suggestion.
- Mobile supports review, approval, required input, pause/cancel and artifact access.
- Full graph editing may remain desktop-only, but no core decision or review is desktop-only.
- User-facing copy follows the shell language; persisted content is never translated silently.

## Acceptance

The implementation is acceptable only when:

- a user understands outcome, state, attention and next action within five seconds;
- no UUID, raw enum, adapter key or JSON appears in the normal workspace;
- Teresa and manual changes survive reload against the same Plan;
- human edits are preserved until a semantic diff is accepted;
- operator diagnostics are role-gated;
- one real PostgreSQL golden flow reaches editable native DOCX and PPTX artifacts with a shared facts digest;
- authenticated desktop, mobile and accessibility evidence is attached to the exact deployed SHA.
