# Chat -> Tools open implementation gates — 2026-08-23

Status: `RECONCILED / NO_UNAMBIGUOUS_UI_ONLY_FIX REMAINS`

Qualified product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`

Scope: Chat, My Work, Interview and Tools only. This document is derived from
`OWNER_NOTES_CHAT_TO_TOOLS_2026-08-23.md` and its canonical module registers.
It does not change their requirements, claim implementation, or assert owner
acceptance.

## Classification rule

- `BACKEND` — a durable domain/API, lifecycle, lineage, permission or
  persistence contract must exist before truthful UI implementation.
- `PROTOTYPE` — the register explicitly requires a clickable prototype or the
  requested replacement is too large to infer safely from prose.
- `OWNER_DECISION` — product semantics, naming, roles or information model are
  not closed.
- `RUNTIME_PROOF` — the code path requires authenticated mounted-runtime,
  provider, API/DB readback or browser qualification rather than speculative
  source changes.

The primary class below identifies the shortest first gate. Dependencies list
the later gates that remain after it.

## Chat

| ID | Primary class | Dependencies | Shortest implementation contract |
| --- | --- | --- | --- |
| `CHAT-OWN-001` | `OWNER_DECISION` | `BACKEND`, `RUNTIME_PROOF` | Specify the two supported panel orders, preference scope and default; then persist per-user preference and prove draft, scroll and focus survival after cold login. |
| `CHAT-OWN-002` | `BACKEND` | `RUNTIME_PROOF` | Select autosave or explicit Save as the sole contract; expose saved/dirty/saving/failed/retry from canonical persistence and prove equal measured headers plus cold readback. |
| `CHAT-OWN-003` | `BACKEND` | `RUNTIME_PROOF`, `OWNER_DECISION` | Prove create/name/switch/reopen branch lineage and tenant ownership; if the contract does not exist, obtain an explicit decision to remove the control. |
| `CHAT-OWN-004` | `OWNER_DECISION` | `BACKEND`, `RUNTIME_PROOF` | Define signal producer, schema, freshness, consumer and owner action; otherwise authorize removal of the trigger. |
| `CHAT-OWN-008` | `BACKEND` | `RUNTIME_PROOF` | Bind proposal, decision, execution, durable receipt, rejection and failure to permission-aware idempotent commands; reopen the created target after cold login. |
| `CHAT-OWN-013` | `PROTOTYPE` | `BACKEND`, `OWNER_DECISION`, `RUNTIME_PROOF` | Approve private/organization history IA and move/visibility semantics; then implement RBAC-backed folder operations and cold readback. |
| `CHAT-OWN-014` | `OWNER_DECISION` | `BACKEND`, `RUNTIME_PROOF` | Freeze the destination, prompt/command schema and permission for every output selector, topic starter and capability deep link; then prove return-to-chat context. |
| `CHAT-OWN-015` | `RUNTIME_PROOF` | `BACKEND` | On an authorized runtime, prove microphone permission, transcription review/send and TTS start/pause/stop/error across navigation without cross-user state leakage. |
| `CHAT-OWN-016` | `RUNTIME_PROOF` | `BACKEND` | Run authorized provider send/stream/cancel/retry/recovery and cold reopen; prove no false answer or artifact and separate user-safe errors from correlated admin diagnostics. |
| `CHAT-OWN-017` | `RUNTIME_PROOF` | `BACKEND` | Execute the complete Canvas action matrix against canonical services, including durable write/readback, conflicts, stale/foreign denial, recovery and cold reopen. |

`CHAT-OWN-005`, `006`, `007`, `009`, `010`, `011` and `012` have bounded
static/component implementations on the qualified lineage. They remain owner
retest items, not open source-edit requests. The safe topic-starter slice of
`CHAT-OWN-014` is also present; its remaining output/deep-link semantics stay
gated above.

## Interview

| ID | Primary class | Dependencies | Shortest implementation contract |
| --- | --- | --- | --- |
| `INT-MENU-OWN-001` / `REC-INT-002` | `OWNER_DECISION` | `BACKEND`, `RUNTIME_PROOF` | Close the role x lifecycle-state x object-type action matrix; expose only server-supported actions from one registry and prove right-click/kebab parity, denial and readback. |
| `INT-PREV-OWN-001` / `REC-INT-003` | `RUNTIME_PROOF` | — | Mount each object type with representative data and prove the canonical summary/relations/next-action anatomy, one Open path, footer placement and honest empty sections. |
| `INT-QCARD-OWN-001` / `REC-INT-004` | `PROTOTYPE` | `RUNTIME_PROOF` | Freeze and replay the owner-supplied earlier workspace; approve responsive list/canvas/progress/Save/Next states before replacing the current question surface. |
| `INT-APPROVAL-OWN-001` / `REC-INT-005` | `BACKEND` | `OWNER_DECISION`, `RUNTIME_PROOF` | Define reviewer roles and implement submitted -> accepted/returned with actor, timestamp, reason, version, answer/comment preservation and downstream eligibility gates. |
| `INT-ASSIGN-OWN-001` / `REC-INT-006` | `RUNTIME_PROOF` | `BACKEND` | Trace the template request with owner tenant/status filters, prove eligible rows at API level and repair the actual filter/query cause before touching selector visuals. |
| `INT-CREATOR-OWN-001` / `REC-INT-007` | `PROTOTYPE` | `OWNER_DECISION`, `BACKEND`, `RUNTIME_PROOF` | Obtain owner approval for clickable Assign/Insight/Initiative creators sharing one shell; only then bind canonical create APIs, recovery and persisted Back/Next state. |
| `REC-INT-008` | `RUNTIME_PROOF` | `BACKEND` | Execute functional, persistence, keyboard/a11y, responsive and failure-recovery gates on the frozen candidate; this is evidence work, not a standalone UI feature. |
| `REC-INT-009` | `PROTOTYPE` | `OWNER_DECISION` | Record an explicit owner prototype verdict before treating the creator shell as a reusable platform standard. |

`REC-INT-001` and `INT-TPL-ED-OWN-001` are retained baselines, not open
implementation requests.

## Tools

| ID | Primary class | Dependencies | Shortest implementation contract |
| --- | --- | --- | --- |
| `TLS-OUTPUT-OWN-001` | `OWNER_DECISION` | `BACKEND`, `RUNTIME_PROOF` | Resolve the navigation-stage versus domain-class model with `TLS-CHAIN-OWN-001`; then define approved Session -> versioned Insight eligibility and lineage APIs. |
| `TLS-REPORT-OWN-001` | `BACKEND` | `PROTOTYPE`, `RUNTIME_PROOF` | Specify and mount the canonical document-generation service for Word/PowerPoint/Excel, template/no-template authoring and immutable multi-source lineage before building the registry UI. |
| `TLS-INIT-OWN-001` | `PROTOTYPE` | `BACKEND`, `RUNTIME_PROOF` | Approve the shared Initiative Creator, then provide a Tools source adapter accepting only eligible approved sessions, insights and reports with pinned versions. |
| `TLS-PREV-CONTENT-OWN-001` | `PROTOTYPE` | `BACKEND`, `RUNTIME_PROOF` | Approve the cross-app object descriptor contract; bind substantive summary, status, provenance, risks and next action to canonical versioned data without redesigning the accepted graphics. |
| `TLS-MENU-OWN-001` / `TLS-MENU-POLICY-OWN-001` | `OWNER_DECISION` | `BACKEND`, `RUNTIME_PROOF` | Close the domain action matrix after the platform registry contract; prove handler, capability, lifecycle, denial, async receipt, telemetry and right-click/kebab parity for every retained action. |
| `TLS-SWOT-OWN-001` | `PROTOTYPE` | `OWNER_DECISION`, `BACKEND`, `RUNTIME_PROOF` | Approve the compact end-to-end tool-session prototype and method mapping; then implement remaining stages without regressing the already-bounded Input & Exploration simplification. |
| `TLS-REC-OWN-001` | `OWNER_DECISION` | `PROTOTYPE`, `BACKEND`, `RUNTIME_PROOF` | Freeze the recommendation content mapping and deduplication against Synthesis; approve the stage prototype, then preserve question -> evidence -> recommendation lineage. |
| `TLS-READY-OWN-001` | `OWNER_DECISION` | `BACKEND`, `RUNTIME_PROOF` | Select the final completion-screen name and lifecycle actions; then expose server-derived completeness, evidence coverage, blockers and explainable readiness without downstream generators. |
| `TLS-CHAIN-OWN-001` | `OWNER_DECISION` | `BACKEND`, `PROTOTYPE` | Reconcile the five navigation stages with four distinct result classes and assign each class its catalog, lifecycle, owner, approval and lineage contract. |

`TLS-OWN-INTAKE-001`, `TLS-TBL-OWN-001`, `TLS-DETAIL-OWN-001` and
`TLS-PREV-OWN-001` are preserved baselines. The Tool Detail header and bounded
Dynamic SWOT Input & Exploration corrections are already present.

## My Work

`MYWORK-DEC-OWN-001` has no remaining source-edit contract: Decisions mounts
the canonical `DecisionsPanelContent` without the retired technical queue
stack. Owner retest and mounted-runtime verification remain program gates, not
new UI implementation.

## Environment gates retained from the same denominator

| ID | Primary class | Dependencies | Shortest implementation contract |
| --- | --- | --- | --- |
| `ENV-STAGING-OWN-001` | `RUNTIME_PROOF` | `OWNER_DECISION` | Verify the exact owner-facing hostname, deployed service, code SHA, database target and server-side safety without changing data or infrastructure. |
| `ENV-AUTH-OWN-002` | `RUNTIME_PROOF` | `BACKEND` | Prove owner identity, tenant and authorization at browser, API and database readback layers; retain the literal mismatch if any layer disagrees. |

## Coding conclusion

No item above can be completed truthfully by an isolated frontend edit on this
SHA. Coding before its primary gate would either invent product semantics,
fabricate an unsupported action, bypass a persistence contract or mistake a
source assertion for runtime evidence. Therefore this pass intentionally makes
no product-code changes and does not mark any item `FIXED`, `DONE` or
`OWNER_ACCEPTED`.
