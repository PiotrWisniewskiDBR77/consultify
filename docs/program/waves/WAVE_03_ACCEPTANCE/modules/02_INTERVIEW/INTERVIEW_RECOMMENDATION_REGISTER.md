# Interview — closed recommendation register

Status: `INTAKE_CLOSED / CONTROLLED_IMPLEMENTATION_IN_PROGRESS / NOT_OWNER_ACCEPTED`

Owner conclusion: Interview is one of the better modules. Its business
substance should be preserved. The remaining work is a bounded set of workflow,
visibility and consistency corrections, led by professionalising Assign,
Insight and Initiative creators.

## Recommendations

| ID | Priority | Recommendation | Required result | Dependencies/evidence | Acceptance closure |
|---|---:|---|---|---|---|
| `REC-INT-001` | P0 | Extend and adopt the canonical Creator platform contract | Do not create a new shell. Align `WizardModal` with `UI-CREATE-01`; Assign uses its compact transactional profile, Insight and Initiative its stepped profile, while route-backed tools retain `ToolWizardShell`. Add the shared state, adapter, persistence, idempotency, recovery and governance contract. Business content remains intact. | `INT-CREATOR-OWN-001`; `CONSULTING_CREATOR_GUIDELINES.md`; `CREATOR_SKEPTICAL_REVIEW.md`; both creator evidence sets | Clickable prototype gate passes first; then all acceptance-v1 gates and separate owner acceptance for the three complete journeys on one SHA. Reuse elsewhere remains blocked until the pilot passes. |
| `REC-INT-002` | P0 | Restore assignable-template discoverability | Every genuinely assignable published template appears. Ineligible templates show exact reason and recovery. Exact-version pinning remains correct for system, organization and private scopes. | `INT-ASSIGN-OWN-001`; technical implementation `f3c35cecce`; Railway snapshot and owner retest still required | `TECHNICAL_PASS`: API list/create/exact-version persistence/cold DB readback passed on fresh pgvector16 (`7/7`, migrations `817/0/0`, residue `0`). Ineligible-reason UX and deployed owner acceptance remain open. |
| `REC-INT-003` | P0 | Restore the dedicated wide question workspace | Remove N-type embedding for single-question work and restore the accepted broad question rail/canvas/navigation while preserving current persistence and workflow corrections. | `INT-QCARD-OWN-001`; baseline before `809e3abe31` | Before/after visual parity, answer/save/resume/submit regression and owner retest. |
| `REC-INT-004` | P0 | Make approval a visible durable lifecycle | `assigned/in progress → submitted → approved OR sent back with reason → corrected resubmission`; only frozen approved versions enter Insight. Preserve reviewer, reason, versions and history. | `INT-APPROVAL-OWN-001`; mounted technical proof `01d1cd8057` | `TECHNICAL_PASS`: mounted exact-version lifecycle, edit lock, reason readback, three immutable answer snapshots, final approved/completed persistence and approved-only context gate passed on fresh pgvector16. Visual discoverability, persona browser replay and owner acceptance remain open. |
| `REC-INT-005` | P1 | Unify object-specific row actions | One permission/state-aware action registry per object; right-click and kebab expose the same applicable actions and truthful disabled reasons. | `INT-MENU-OWN-001`, `INT-MENU-EVD-001..008` | Action matrix, handler/API mapping, permission tests and post-refresh readback pass. |
| `REC-INT-006` | P1 | Normalize Preview action footers | Apply canonical order `AI → Relations → Actions → Co dalej`, `PreviewActionBar`, action pills, anti-duplication and object-specific action mapping. | `INT-PREV-OWN-001`; Preview canon sources | Six Preview variants pass visual, permission, action and readback parity. |
| `REC-INT-007` | P1 | Make AI-assisted Initiative fill recoverable | Section fill succeeds or returns typed actionable failure; user data survives; Retry/manual continuation/details available. | `INT-INIT-AI-OBS-001`; request/response/provider evidence pending | Success, provider unavailable, permission, validation, timeout and retry scenarios pass. |
| `REC-INT-008` | P2 | Close full Initiative creator evidence | Capture Candidates, Governance and Result in the same viewport matrix; verify recommendation, shortlist, approval gate, creation and lineage. | Current evidence covers Insights and Intent only | Like-for-like screenshots, functional persistence and owner decisions for all five steps. |
| `REC-INT-009` | P3 | Improve Template editor discoverability without redesign | Preserve the owner-approved editor. Add only bounded guidance, clearer labels/onboarding or progressive disclosure supported by evidence. | `INT-TPL-ED-OWN-001` | First-use test shows successful orientation; publish/readback and Assign availability remain separate gates. |

## Proposed implementation sequence

### Wave A — business truth and unblockers

1. `REC-INT-002`: template eligibility/readback.
2. `REC-INT-004`: approval and approved-only downstream gate.
3. `REC-INT-007`: typed AI failure and recovery.

These items establish which material may be used and prevent UX work from
masking broken lifecycle contracts.

### Wave B — shared interaction foundation

4. Freeze the versioned Creator Platform Contract and clickable prototypes for
   Assign, full Insight and all five Initiative steps; close missing evidence.
5. Extend canonical `WizardModal` and shared state/adapter primitives behind a
   feature flag; do not fork a new shell or replace `ToolWizardShell`.
6. Pilot Assign compact variant and pass rollback/readback gates.
7. Pilot Insight stepped variant, then Initiative, only after the prior pilot
   passes. Each migration retains existing handlers and receives an independent
   before/after owner retest.

No big-bang replacement and no promotion outside Interview before all three
pilots pass.

### Wave C — workspace and action consistency

8. `REC-INT-003`: question-workspace presentation rollback.
9. `REC-INT-005`: shared menu action registries.
10. `REC-INT-006`: Preview footer normalization.

### Wave D — closure and polish

11. `REC-INT-008`: full Initiative steps 3–5 evidence and lifecycle replay.
12. `REC-INT-009`: bounded Template editor discoverability improvements.
13. Full Interview regression: desktop/tablet, PL/EN, themes, keyboard/a11y,
    personas, writes/readbacks, approved-only lineage and provider failure.
14. Owner retest for every recommendation on one frozen candidate SHA.

## Non-negotiable boundaries

- Do not redesign accepted tables, upper menus, Template editor business
  content or creator business mechanics.
- Do not call a visible button proof of persistence or approval.
- Do not allow unapproved Interview material into Insight/Initiative.
- Do not solve density primarily with smaller typography.
- Do not add Liquid Glass without opaque accessibility/performance fallbacks.
- Do not close Initiative parity until steps 3–5 and durable creation lineage
  are evidenced.
- Do not implement during intake; this register is the handoff into planning.
