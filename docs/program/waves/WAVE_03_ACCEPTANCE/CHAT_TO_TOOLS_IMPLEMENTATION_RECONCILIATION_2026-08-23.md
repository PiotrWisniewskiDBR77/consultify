# Chat → Tools implementation reconciliation — 2026-08-23

Status: `RECONCILED / BOUNDED_IMPLEMENTATION_PARTIAL / OWNER_RETEST_REQUIRED`

Scope is limited to Chat, My Work, Interview and Tools. Assessment is excluded.
This ledger does not assert deployment or owner acceptance.

## Classification rules

- `KEEP`: owner-approved baseline or an already-present implementation that must not be rebuilt.
- `FIX`: an unambiguous bounded correction that can be implemented without inventing product policy.
- `REBUILD`: a larger replacement requested by the owner, permitted only after its explicit prototype/backend gate.
- `BLOCKED`: missing owner decision, runtime/backend proof, permissions matrix or prototype approval.

## Atomic ledger

| ID                       | Class   | Reconciled disposition                                                                     |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------ |
| CHAT-OWN-001             | BLOCKED | Panel-order semantics and persistence are not specified.                                   |
| CHAT-OWN-002             | FIX     | Normalize header and truthful save state; requires focused Chat pass.                      |
| CHAT-OWN-003             | BLOCKED | Prove branching capability or obtain removal decision.                                     |
| CHAT-OWN-004             | BLOCKED | Product role of Important signals requires owner decision.                                 |
| CHAT-OWN-005             | FIX     | Simplify/audit Canvas command bar without removing mounted actions.                        |
| CHAT-OWN-006             | FIX     | Direct Rich/DOC/MD control; no duplicate view menu.                                        |
| CHAT-OWN-007             | FIX     | Viewport containment, focus and theme behavior.                                            |
| CHAT-OWN-008             | BLOCKED | Proposal/execution durable lifecycle depends on backend and permissions.                   |
| CHAT-OWN-009             | FIX     | One stable response-action container.                                                      |
| CHAT-OWN-010             | FIX     | Normalize conversation-header controls.                                                    |
| CHAT-OWN-011             | FIX     | Personalized start with safe name-free fallback.                                           |
| CHAT-OWN-012             | FIX     | Restrained pulse with OS and application reduced-motion gates.                             |
| CHAT-OWN-013             | REBUILD | History IA is a larger information-architecture replacement.                               |
| CHAT-OWN-014             | BLOCKED | Exact semantics for every start control are incomplete.                                    |
| CHAT-OWN-015             | BLOCKED | Voice-mode application coverage requires runtime/provider proof.                           |
| CHAT-OWN-016             | BLOCKED | Live-provider and safe-error closure requires authenticated runtime.                       |
| CHAT-OWN-017             | BLOCKED | Functional qualification requires exact runtime and cold readback.                         |
| INT-MENU-OWN-001         | BLOCKED | Role/state action matrix is not closed; backend-supported actions only.                    |
| INT-PREV-OWN-001         | FIX     | Canonical preview footer/anatomy is unambiguous.                                           |
| INT-QCARD-OWN-001        | REBUILD | Restore prior workspace, subject to frozen-candidate replay.                               |
| INT-APPROVAL-OWN-001     | BLOCKED | Approval lifecycle requires backend, audit and persistence work.                           |
| INT-ASSIGN-OWN-001       | BLOCKED | Root cause requires tenant/status/API readback.                                            |
| INT-TPL-ED-OWN-001       | KEEP    | Preserve useful template editor; discoverability debt is separate.                         |
| INT-CREATOR-OWN-001      | REBUILD | Three creators remain behind clickable-prototype gate.                                     |
| REC-INT-001              | KEEP    | Preserve six table shapes and upper navigation.                                            |
| REC-INT-002              | BLOCKED | Same dependency as INT-MENU-OWN-001.                                                       |
| REC-INT-003              | FIX     | Duplicate of INT-PREV-OWN-001; one implementation track.                                   |
| REC-INT-004              | REBUILD | Duplicate of INT-QCARD-OWN-001.                                                            |
| REC-INT-005              | BLOCKED | Duplicate of INT-APPROVAL-OWN-001.                                                         |
| REC-INT-006              | BLOCKED | Duplicate of INT-ASSIGN-OWN-001.                                                           |
| REC-INT-007              | REBUILD | Duplicate of INT-CREATOR-OWN-001.                                                          |
| REC-INT-008              | BLOCKED | Verification gate, not a standalone UI fix.                                                |
| REC-INT-009              | BLOCKED | Owner prototype approval is explicitly outstanding.                                        |
| TLS-OWN-INTAKE-001       | KEEP    | Preserve complete review/evidence denominator.                                             |
| TLS-TBL-OWN-001          | KEEP    | Preserve Library/Sessions table baseline.                                                  |
| TLS-DETAIL-OWN-001       | KEEP    | Preserve accepted Tool Detail light/dark hierarchy.                                        |
| TLS-OUTPUT-OWN-001       | REBUILD | Semantic model depends on approval lifecycle and canonical data classes.                   |
| TLS-REPORT-OWN-001       | BLOCKED | Real document generation/lineage backend is not verified.                                  |
| TLS-INIT-OWN-001         | BLOCKED | Depends on canonical Initiative creator and approved sources.                              |
| TLS-PREV-OWN-001         | KEEP    | Preserve accepted graphical Preview layer.                                                 |
| TLS-PREV-CONTENT-OWN-001 | FIX     | Content contract is clear; no graphical redesign.                                          |
| TLS-MENU-OWN-001         | BLOCKED | Role/state action matrix and supported backend actions are incomplete.                     |
| TLS-MENU-POLICY-OWN-001  | BLOCKED | Duplicate governance dependency of TLS-MENU-OWN-001.                                       |
| TLS-SWOT-OWN-001         | FIX     | Bounded Input & Exploration simplification implemented partially in this candidate.        |
| TLS-REC-OWN-001          | FIX     | Separate Recommendations stage is clear; content deduplication still needs method mapping. |
| TLS-READY-OWN-001        | BLOCKED | Final label needs owner decision; lifecycle backend also required.                         |
| TLS-CHAIN-OWN-001        | BLOCKED | Conflicts with consolidated TOOL-03 wording: four classes versus five-stage chain.         |
| MYWORK-DEC-OWN-001       | KEEP    | Already present: canonical DecisionsPanelContent mounts without retired queue stack.       |
| ENV-STAGING-OWN-001      | BLOCKED | Infrastructure mutation is out of scope; staging target not verified.                      |
| ENV-AUTH-OWN-002         | BLOCKED | Authenticated owner/backend identity readback is not proven.                               |

## Duplicates, conflicts and dependencies

- `REC-INT-002..007` duplicate the corresponding Interview owner observations and must share one implementation/evidence track.
- Tools menu items depend on the cross-module action registry and the still-open role/state permissions matrix.
- `TLS-CHAIN-OWN-001` says four result classes while TOOL-03 presents a five-stage module chain; implementation must preserve the distinction between navigation stages and domain object classes, then obtain owner confirmation.
- Creator rebuilds depend on the explicitly required clickable-prototype approval and cannot be promoted to a reusable platform standard yet.
- Approval, Insights, Reports, Initiatives and governed Chat actions depend on authenticated backend lifecycle, lineage, idempotency and cold readback.

## Implemented or already present in this candidate

- `MYWORK-DEC-OWN-001`: canonical Decisions table is the primary Decisions content; the retired technical queue stack is not mounted.
- `TOOL-02` derived header requirements: Tool Detail already uses `Knowledge/Wiedza`, `Analyze/Analizuj`, equal control dimensions and one filled primary action.
- `TLS-SWOT-OWN-001` bounded subset: removed duplicate desktop stream selector, removed four page-level counters, removed repeated Accepted/Attempts badges, suppressed the empty accepted-points card and changed manual entry to an explicit action.

## Owner decisions still required

1. Chat branching and Important-signals product roles.
2. Complete role/state/action permissions matrix.
3. Ninth Dynamic SWOT synthesis category.
4. Final completion-screen name.
5. Resolution of Tools five-stage navigation versus four result classes.
6. Approval of the three-creator clickable prototype before reusable implementation.

## Verification and ownership boundary

- Targeted candidate tests: `3/3 PASS` — two SWOT owner-feedback contract checks and the existing My Work Decisions contract check.
- Candidate production build: `PASS`; `git diff --check`: `PASS`.
- Dependencies came from a temporary, reversible symlink to the verified main-checkout runtime at `/Users/piotrwisniewski/Developer/Consultify/node_modules`; the symlink was removed after verification. This is local technical evidence, not production or owner-acceptance evidence.
- `src/components/Discovery/DiscoveryToolsHub.tsx` was subsequently repaired in the shared main checkout by the bounded four-module implementation agent. The change restores the canonical persisted Preview Details builders for Tools outputs/reports/initiatives while preserving existing body, footer, routing and Open actions.
- The former three-error typecheck observation is superseded. Post-repair verification on the shared main checkout: Tools Preview T17–T19 `242/242 PASS`, Chat + My Work owner-feedback `15/15 PASS`, full `npm run type-check` exit `0`, target ESLint `0 errors` (inherited warnings remain), and `git diff --check` PASS. These are technical results only; owner acceptance, runtime readback and release remain open.

## Final four-module completeness pass

The bounded implementation agent re-read the complete Chat, My Work,
Interview and Tools ledger against the shared checkout at
`ca9ef20646584f4b41bd5732eda3eca993ba0b73`. It made no additional edits and
preserved concurrent Assessment, Finance and documentation WIP.

- `12/12` focused files and `274/274` tests passed.
- Full root typecheck passed.
- `git diff --check` passed.
- The Interview smoke suite emitted its intentionally exercised `503`
  capability diagnostic; this is negative-control stderr, not an unexpected
  application failure.

No further unambiguous UI-only fix remains in these four modules. The remaining
work is deliberately not promoted to `DONE`: Chat panel-order persistence,
branching, Important signals, history IA and voice/provider/cold-readback;
Interview role/state menus, canonical Preview footer implementation proof,
prior-workspace replay, submitted-to-accepted/returned lifecycle, template
selector root cause and the three creators prototype; Tools canonical Insights
domain/API, Report/Initiative lineage backend, complete menus,
recommendations-to-method mapping, ninth synthesis category, completion label
and the five-stage versus four-result-class decision. Each item retains its
recorded backend, prototype, runtime or owner-decision gate.

Exact `12/12` focused denominator:

1. `src/components/AIChat/__tests__/WorkCanvasDocumentPanel.ownerFeedback.test.ts`
2. `src/components/AIChat/__tests__/MessageRenderer.responseActions.ownerFeedback.test.ts`
3. `src/components/AIChat/__tests__/chatHeaderControls.ownerFeedback.test.ts`
4. `src/components/AIChat/__tests__/chatStartControls.ownerFeedback.test.ts`
5. `src/components/AIChat/__tests__/teresaWelcome.ownerFeedback.test.ts`
6. `src/components/AIChat/__tests__/EnhancedChatInput.idlePulse.ownerFeedback.test.ts`
7. `src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts`
8. `src/components/Discovery/__tests__/DiscoveryToolsHub.outputPreviewDetails.t17.test.tsx`
9. `src/components/Discovery/__tests__/DiscoveryToolsHub.reportPreviewDetails.t18.test.tsx`
10. `src/components/Discovery/__tests__/DiscoveryToolsHub.initiativePreviewDetails.t19.test.tsx`
11. `src/components/Interview/__tests__/InterviewHub.smoke.test.tsx`
12. `src/components/Interview/__tests__/InterviewWorkspace.progress.test.ts`

Literal command: `npx vitest run <the 12 paths above> --maxWorkers=1
--maxConcurrency=2 --reporter=dot`.
