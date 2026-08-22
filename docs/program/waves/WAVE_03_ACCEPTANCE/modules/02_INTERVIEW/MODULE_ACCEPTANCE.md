# Wave 3 — Interview acceptance

ID: `INT`
Routes: `/interview`, `/interview/respond/:token`
Current gate: `OWNER_INTAKE_CLOSED / RECOMMENDATION_REGISTER_READY / CREATOR_SKEPTICAL_REVIEW_COMPLETE / PROTOTYPE_GATE_REQUIRED / IMPLEMENTATION_NOT_STARTED`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: create/manage an interview and complete the isolated public
respondent path with durable response readback.

Required boundaries: expired/replayed/foreign token, respondent isolation from
organization navigation, insufficient manager role and duplicate submission.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Routes: authenticated `/interview` and isolated public `/interview/respond/:token`. Task links: `INT-BVP-001`, `INT-DELIVERY-OPS-001`, `INT-UI-CANON-001`; all three exact-current evidence packets report `DONE_CURRENT_SHA`. Mobile, production outreach and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS` | Exact corrected adopted runtime on product/client/server `3d61730fd8ad18d19cf9967cb5513697659003cc`, dirty fingerprint `950fd602e25e20defb9e3c905675d1c32bd101907a27e01079b8fa152c2c633a`: server `:3984`, client `:3985`, retained DB `consultify_w3_interview_owner_browser_20260822`, `817` migrations. Runtime manifest `/private/tmp/consultify-wave3-runtime-manifest-interview-retest-20260822.json` proves health/ready/frontend `200`, exact server/readiness SHA, client marker, SQL ledger and `W3-INTERVIEW-OWNER-v1` durable marker; auth/test bypasses were OFF. Owned runtime stopped cleanly with process groups terminated, ports free and adopted DB preserved. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Manager: create/publish/assign/invite/review. Respondent: opaque token → resume/CAS answer → submit. Downstream: approved insight → exactly one initiative candidate. Durable boundaries include token expiry/revoke, anonymity wall, tenant/role access, answer CAS, AI timeout audit, notification fallback and immutable handoff receipt. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed matrix: session owner, same-tenant ADMIN, direct assignee, team assignee and legitimate public-token respondent. Denied matrix: unrelated same-org member, inactive member, foreign-tenant ADMIN, revoked/expired token and replay/concurrent stale writer. The mounted owner fixture binds stable OWNER `w3.interview.owner@local.test` plus active and revoked public-token paths; the broader denied matrix remains RealPG-backed and was not manually replayed in full. |
| G04 | Reproducible realistic and boundary fixtures | `PASS` | Technical fixture: disposable `int_bvp_*` database with explicit immutable-cleanup opt-in, opaque 256-bit tokens, two isolated organizations and unique `intbvp001-*` identities; residue `0`, immutable trigger enabled (`O`). Owner fixture: local-only idempotent seed `seed-wave3-interview-owner-review.ts`, two coherent sessions, six realistic Polish questions/answers, active anonymous link, submitted manager-review state and revoked-link boundary. Reseeding preserves respondent answers and terminal state. |
| G05 | Functional preflight and cold readback | `PASS_WITH_PROVIDER_UNAVAILABLE` | Source lanes remain `70/70` real-PG, `34/34` component/API and `15/15` routing-seam PASS. Focused correction tests passed `47/47`; mounted RealPG passed `6/6`, including durable evaluation snapshot and independent cold-pool answer readback. On the corrected exact runtime, the authenticated owner cold-opened `wave3-int-owner-review-session-v1` with all three persisted answers plus manager detail/questions/notes/evidence/linked-items/summary reads. One automatic canonical V8 evaluation request produced the intended retryable `503 INTERVIEW_EVALUATION_UNAVAILABLE`; the runtime log contains no legacy-compatible evaluation request and no evaluation `500`, so no fabricated score or duplicate provider call occurred. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PASS_TECHNICAL_WITH_PROVIDER_UNAVAILABLE` | Corrected exact-runtime desktop replay passed the manager entry/workspace, active public respondent route and revoked-link boundary. The active public DOM rendered the three required Polish questions; the revoked route rendered “Ten link wygasł albo został cofnięty.” and the server recorded `410`. After the single canonical evaluation `503`, the manager DOM remained in the honest `Ocena AI — Brak oceny` state and the console carried the typed unavailable-capability error; no legacy retry was observed. Provider-backed scoring itself remains unavailable in this secret-free local runtime and is not claimed green. The write-once fixture receipt remains `deepLinkVerified:false`; this later exact-runtime evidence is recorded here instead of rewriting that receipt. PL/EN, tablet, themes and full a11y/console matrix remain for the owner round; mobile is non-gating. This is not owner acceptance. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 3. Owner decisions remain pending. |
| G08 | First-impression review | `PARTIAL_TABLE_SURFACES_APPROVED` | Owner reviewed the six Interview list surfaces and approved the shared table shape and upper menus. Context menus, kebab menus and correctness remain open. |
| G09 | Guided CX journey review | `OWNER_INTAKE_COMPLETE_WITH_FINDINGS` | Owner completed the current Interview review and concluded that Interview is one of the better modules. Business substance is preserved; remaining recommendations are consolidated in `INTERVIEW_RECOMMENDATION_REGISTER.md`. |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `PASS_CURRENT_INTAKE` | Owner observations are registered continuously; supplied screenshots are SHA-256-bound in `evidence/tables-owner-review-2026-08-22/INDEX.md`. |
| G12 | Owner register reconciled and confirmed | `PASS_FOR_CURRENT_INTAKE` | Current owner feedback and screenshot evidence are registered. This closes intake, not implementation or module acceptance. |
| G13 | Solution and impact analysis | `READY_FOR_PROTOTYPE_SPEC / NOT_READY_FOR_IMPLEMENTATION` | The initial three-expert brief was challenged by two independent sceptics. `CREATOR_SKEPTICAL_REVIEW.md` records the objections and SSOT resolution; `CONSULTING_CREATOR_GUIDELINES.md` now contains the revised acceptance-v1 contract. All owner findings remain mapped to `REC-INT-001..009`. Direct implementation and reuse outside Interview are blocked until the full clickable-prototype gate passes; live DB/API evidence remains explicitly pending where required. |
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
| _prepare before G07_ | `/interview` | _pending_ | Create/manage interview → open respondent link → submit → readback | Production outreach | Interview clarity, respondent trust, completion friction, result usefulness |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `INT-TECH-01` | technical matrix | Invite, respondent, manager, delivery, timeout and candidate boundaries | Fresh disposable DB `int_bvp_wave3_20260821`; unique per-run fixtures; immutable cleanup requires both opt-in and `int_bvp_*` DB prefix | independent SQL assertions and cold-pool assertions in real-PG suites | allowed/denied matrix in G03 | `70/70 PASS` | current source candidate `d3d6de5bfc` |
| `INT-OWNER-01` | owner-review fixture | Credible manager and anonymous-respondent journey | guarded loopback DB `consultify_w3_interview_owner_browser_20260822`; FINAL write-once manifest and durable marker | live public API + PostgreSQL + mounted cold UI replay | local owner + token-only anonymous respondent | `TECHNICAL_BROWSER_COMPLETE_WITH_PROVIDER_UNAVAILABLE` | 2 sessions, 6 questions, 2 distributions; corrected exact-runtime manager and active-public cold readback; revoked `410`; exactly one canonical evaluation `503`, zero compatibility retries and honest `Brak oceny` UI |

Owner fixture identifiers:

- template: `wave3-int-owner-template-v1`
- public session: `wave3-int-owner-public-session-v1`
- submitted manager-review session: `wave3-int-owner-review-session-v1`
- public distribution: `wave3-int-owner-public-distribution-v1`
- revoked distribution: `wave3-int-owner-revoked-distribution-v1`
- the local token routes are emitted by the seed at runtime and are deliberately
  not copied into this durable document

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `INT-PF-001` | The historical exactly-once test tried to delete an immutable handoff receipt and failed during teardown after all functional assertions passed. Cleanup now requires an explicit opt-in, a verified `int_bvp_*` disposable database, transaction-local replica role, zero-residue proof and enabled-trigger readback. | Initial current-SHA replay: `70/70` functional assertions with teardown failure; corrected replay on fresh PostgreSQL: `70/70 PASS`, residue `0`, trigger `O`; commit `9fcff61b7d`. | `FIXED_VERIFIED` |
| `INT-PF-002` | The shared candidate scanner referenced nonexistent `assessments.title` and `assessments.summary` columns. Its fail-soft catch hid the schema error and silently skipped Assessment candidates during an Interview scan. The query now uses canonical `name` and `description` columns. | Real-PG query error on initial replay; corrected exactly-once suite `11/11 PASS` without the missing-column error; commit `291e37340f`. | `FIXED_VERIFIED` |
| `INT-PF-003` | The authenticated hub was blanket-gated by global V8 availability even though authoring remains a supported legacy-canonical contract; V8 assignments/insights silently fell back to legacy, masking contract and tenant failures. Routing is now explicit by capability: authoring stays on its declared backend, assignments/insights are V8-only and fail visibly. Unsupported archived assignment commands remain unavailable rather than writing legacy. | Focused routing/smoke `2/2` files, `15/15 PASS`; structural search finds zero V8 `.catch()` legacy fallbacks and zero legacy assignment/insight calls in the hub; root typecheck PASS. | `FIXED_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `INT-TBL-OWN-001` | 2026-08-22 | “Kształt tabel i menu górne jest ok. Niestety, dalej już będą uwagi.” | Owner partial approval / review protocol | Interview: Inbox, Sessions, Assigned, Templates, Insights, Initiatives | Six related list surfaces use the same overall table shell and upper navigation/action layers. | Preserve the approved table shape and upper menus while reviewing the remaining menu and correctness layers separately. | Prevents unnecessary redesign of accepted shared surfaces and bounds subsequent remediation. | `INT-TBL-EVD-001..006` / index | `09950def9972` + working tree | Gate | `TABLE_SHAPE_AND_UPPER_MENUS_OWNER_APPROVED / REMAINDER_IN_REVIEW` | — | Visual baseline captured; no functional claim. | `PARTIAL_APPROVAL_RECORDED` |
| `INT-MENU-OWN-001` | 2026-08-22 | “Nie we wszystkich narzędziach menu rozwijane jest w prawidłowym kontekście; to znaczy, że menu powinno mieć więcej przycisków dopasowanych do funkcji niż obecnie ma. Niestety nie ma pełnego menu w Inbox. w assign If Initiate X” | Functional UX / action governance | Interview list row menus; confirmed Inbox, with screenshot-supported scope including Assigned and Initiatives; final transcription scope remains to be confirmed during the live pass | Menus expose sparse or inconsistent action sets. Assigned proves direct right-click/kebab divergence: the kebab contains Reassign, Send reminder and Escalate now while the context menu does not. | Define one permission- and state-aware action registry per object type; render the same applicable actions in right-click and kebab menus, with truthful disabled reasons and no invented operations. | Users cannot reliably discover or execute the lifecycle actions appropriate to the selected Interview object. | `INT-MENU-EVD-001..008` / index | `5189ac05d6` | P1 | `PARTIAL_TECHNICAL_REMEDIATION / FULL_ACTION_MATRIX_PENDING` | `5189ac05d6` | Assignment table and grid already consume the same `buildAssignmentRowSections` registry. Audit found that visible Escalate always threw a synthetic unavailable error despite an existing protected backend handler; V8 route/client wiring is restored with `INTERVIEW_ASSIGN_MANAGE`, typed error display and managed-list refresh. Focused V8/UI routing suite passes (`2` files, `58/58`), root and server typechecks pass. Reassign still routes through creation UI rather than the existing safe update contract; remaining object menus, persistence replay and owner retest remain open. | `PENDING` |
| `INT-PREV-OWN-001` | 2026-08-22 | “W kartach preview przyciski działania, które powinny być na dole, są w bardzo różnym stanie. Nie ma tu jednego formatu, więc dobrze byłoby odnieść się do opisu formatu źródeł prawdy, jak ma to wyglądać, i zastosować przyciski zgodnie z wytycznymi źródeł prawdy.” | Cross-tab standard violation / Preview actions | Interview Preview: Inbox, Sessions, Assigned, Templates, Insights, Initiatives | Footer composition and action presentation vary by tab: bespoke delay pills, single Generate insights action, no actionable footer for a closed assignment, bespoke Edit/Duplicate/Delete, a conversion strip without canonical Actions, and Initiatives actions plus overflow. | Apply the canonical six-block Preview anatomy and footer order `AI → Relations → Actions → Co dalej`; render object-specific direct actions through `PreviewActionBar` + `actionPillClass()`, `h-9 rounded-full`, two-column grid, max six; keep exactly one Open in the header and omit an empty Actions block. | Inconsistent placement and styling prevents transfer learning and makes action availability/status difficult to trust. | `INT-PREV-EVD-001..006` / index | `09950def9972` + working tree | P1 | `REQUIRED / CANON_MAPPING_AND_FUNCTIONAL_AUDIT_PENDING` | — | Canon sources identified; no implementation or handler/readback verification yet. | `PENDING` |
| `INT-QCARD-OWN-001` | 2026-08-22 | “Przy jednej z przebudów w kartach pytań w wywiadzie zaproponował system rozwiązania artefaktu N-type. (…) obecnie (…) jest n-type, który jest zupełnie bezsensowny. Trzeba to poprawić, a w zasadzie cofnąć tę zmianę, bo poprzednia wersja była dobra.” | Owner-directed rollback / major UX regression | Interview session → Questions → single-question runtime | The formerly full-width question workspace was embedded inside the generic N-mode artifact shell, producing a narrow central question card plus redundant workspace navigation and properties chrome. | Restore the previous production single-question workspace: dedicated wide runtime, left question list, broad answer area and persistent bottom navigation; preserve later data, save, review and workflow fixes. | The primary respondent/consultant workflow loses usable width, hierarchy and continuity; the core Interview experience becomes materially harder to use. | `INT-QCARD-EVD-001..002` / index | `d560464f3f` | P0 | `TECHNICAL_PASS / OWNER_RETEST_REQUIRED` | `d560464f3f` | Single-question mode now bypasses `NModeShell` and renders the wide immersive question workspace while reusing current save, submit, CAS, review, send-back and approval handlers. Presentation contract tests and full Interview UI suite pass (`18` files, `92/92`); root typecheck and production build pass (build requires the established 8 GB Node heap). Visual parity and deployed owner replay remain open. | `PENDING` |
| `INT-APPROVAL-OWN-001` | 2026-08-22 | “Nie widzę dzisiaj mechaniki zatwierdzania. (…) w momencie, kiedy akceptujemy jakiś zestaw odpowiedzi, jest on zatwierdzony i może wchodzić do dalszej pracy. Jeśli użytkownik, który został poproszony o wykonanie zadania, nie zrobi tego dobrze, zostaje odesłany. Ten proces powinien być tutaj odwzorowany, ale obecnie go nie widzę.” | Missing visible approval lifecycle / workflow gate | Interview: assigned response set, submission and manager review across Inbox, Sessions and Assigned | The reviewed surfaces do not expose a coherent, discoverable end-to-end approval loop; isolated statuses or dormant handlers do not demonstrate that a submitted answer set can be approved or returned and that only the approved version advances. | Implement and visibly represent the lifecycle `assigned/in progress → submitted for review → approved OR sent back with reason → corrected resubmission`; approval must freeze/version the accepted answer set and unlock downstream work, while send-back must return ownership, retain reviewer reason/history and prevent downstream use until later approval. | Without an explicit durable gate, unaccepted answers may be treated as usable input, assignees lack a clear correction loop, and users cannot trust which response version is authoritative. | Owner live-review statement; canonical confirmation in G02/G04/G05 and approved-only downstream scope in `InsightCreatorModal` | `09950def9972` + working tree | P0 | `REQUIRED / END_TO_END_STATE_PERMISSION_UI_PERSISTENCE_AUDIT_PENDING / IMPLEMENTATION_DEFERRED_UNTIL_REVIEW_COMPLETE` | — | Register-only intake. Existing code mentions approve/send-back and approved-only downstream selection, but visible reachability, role permissions, version freeze, persistence and cold readback have not been established in this owner pass. | `PENDING` |
| `INT-ASSIGN-OWN-001` | 2026-08-22 | “Nie wiem, czemu nie mogę teraz wybrać, który szablon ma być wykorzystany. Nie miałem tego problemu nigdy wcześniej (…) Poza tym cały generator jest w porządku.” | Functional regression / template eligibility contract; partial owner approval | Interview → Assigned/Managed → Assign Interview | Assignees load, but the required Interview Template selector has no usable suggestion. Since `84c0525d05c` (2026-08-19), `AssignInterviewModal` silently retains only records with status exactly `approved` and `hasPublishedVersion === true`; the latter is computed from an organization-scoped exact-version snapshot. A template visible as Published in the library can therefore disappear from Assign when its current version lacks that organization snapshot or its returned lifecycle value does not exactly match the client predicate. | Preserve the current generator, which the owner accepts. Reconcile library and assignment eligibility so every genuinely assignable published template is suggested; surface an explicit reason for each ineligible template instead of silently returning an empty selector. Keep exact-version pinning, but ensure system/organization/private templates resolve the correct published snapshot for the active organization. | Assignment cannot be completed even though templates visibly exist; the user receives no explanation and perceives previously working functionality as lost. | `INT-ASSIGN-EVD-001` / index; source `AssignInterviewModal.tsx:111-165`, `InterviewController.ts:5928-6034`; regression commit `84c0525d05c` | `09950def9972` + working tree | P0 | `REQUIRED / ROOT_CAUSE_FILTER_AND_SNAPSHOT_CONTRACT_IDENTIFIED / LIVE_RESPONSE_AND_DB_READBACK_PENDING / IMPLEMENTATION_DEFERRED_UNTIL_REVIEW_COMPLETE` | — | Register-only intake. Screenshot proves the empty selector and populated assignees; source proves the new strict eligibility predicate. Exact failing template record and Railway readback remain to be captured before remediation. | `PENDING` |
| `INT-TPL-ED-OWN-001` | 2026-08-22 | “Bardzo fajnie, może nie super intuicyjnie, ale naprawdę dałem radę. Jest fajnie.” | Positive owner acceptance with minor usability reservation | Interview → Templates → template editor | The owner successfully navigated the editor and positively assessed the working experience; the screen exposes metadata, library/scope, question list, Preview, Upload, Add Question, AI improvement, quality check, draft save and Publish. Initial orientation is not fully intuitive. | Preserve the current editor structure and capabilities. Treat discoverability as a bounded usability improvement opportunity (labels, guidance or onboarding) rather than justification for redesign. | Protects a working and positively received creation flow while retaining a concrete signal about first-use cognitive load. | `INT-TPL-ED-EVD-001` / index | `09950def9972` + working tree | P3 | `FUNCTIONALLY_OWNER_APPROVED / MINOR_DISCOVERABILITY_RESERVATION / NO_REDESIGN_AUTHORIZED` | — | Register-only intake; visual evidence and owner completion statement captured. Persistence, publish readback and downstream assignment remain separate correctness gates. | `PARTIAL_APPROVAL_RECORDED` |
| `INT-CREATOR-OWN-001` | 2026-08-22 | “Mamy dwie bardzo ważne karty: kartę do robienia insightów i później kartę do robienia inicjatyw. (…) muszą wyglądać tak samo. (…) merytorycznie to narzędzie jest ok, tylko niestety nie da się nim teraz zarządzać w tej postaci.” Follow-up: “Mechanika jest OK (…) wybieramy insighty i on szybciutko nam proponuje obszar, ale to musi być czytelne (…) ekran możemy zrobić większy (…) trzeba sięgnąć po technologię Liquid Glass i zarządzać tymi ekranami bardzo dobrze.” | Cross-creator UX standard / severe operability failure with functional-content approval | Interview → AI Insight Creator; downstream AI Initiative Wizard; future creator dialogs | Both creators now visibly share the same class of problem: insufficient or poorly allocated workspace, compressed stepper, inconsistent visual density, nested frames and content whose extent is difficult to perceive. Initiative evidence confirms the five-step concept and Insight → Initiative source selection, but covers only steps 1 and 2. | Adopt the expert-consensus `Creator Shell` contract below. Preserve the owner-approved business mechanics and content. Treat Liquid Glass as a controlled visual-language direction for hierarchy, depth and region separation—not as decorative blur—and require contrast, focus, reduced-transparency and performance safeguards. | Users can miss options, cannot predict remaining work, and must search the interface rather than follow it; this threatens completion of the core Interview → Insight → Initiative value chain. | `INT-CREATOR-EVD-001..005`, `INT-INIT-CREATOR-EVD-001..004` / index | `09950def9972` + working tree | P0 | `REQUIRED / THREE_EXPERT_CONSENSUS_RECORDED / INITIATIVE_STEPS_1_2_EVIDENCED / STEPS_3_5_EVIDENCE_MISSING / IMPLEMENTATION_DEFERRED_UNTIL_REVIEW_COMPLETE` | — | Register-only intake. Independent expert consensus and both creator surfaces are now evidenced. Full parity remains unproved until Initiative steps Candidates, Governance and Result are captured. | `PENDING` |
| `INT-INIT-AI-OBS-001` | 2026-08-22 | Screenshot-observed during owner review: “Failed to fill the section with AI.” | Functional observation / AI-assisted form fill | AI Initiative Wizard → Intent → Fill with AI | A section-level AI fill enters a loading state and then reports a generic failure toast; no cause, retry classification or preserved diagnostic is visible. | AI fill must either populate the requested section or return a specific, actionable and retry-safe failure state while preserving existing user input; provider unavailability must be distinguished from validation, permission and server errors. | A core acceleration mechanism appears unreliable and gives the user no recovery path or trustable explanation. | `INT-INIT-CREATOR-EVD-003` / index | `09950def9972` + working tree | P1 | `OBSERVED / OWNER_VERBAL_DECISION_NOT_YET_CAPTURED / REQUEST_RESPONSE_PROVIDER_AND_READBACK_AUDIT_PENDING / IMPLEMENTATION_DEFERRED_UNTIL_REVIEW_COMPLETE` | — | Screenshot evidence only. The ambient toast proves visible failure, not its backend cause. | `PENDING` |

### Active Interview table-review protocol

Each of the six list surfaces is reviewed against three primary dimensions:

1. **Menu** — (a) the three upper menu layers, (b) right-click context menu,
   and (c) row kebab menu.
2. **Table** — columns, hierarchy, layout, readability, sorting, filtering,
   selection and available actions.
3. **Correctness** — data, counters, statuses, dates, relationships, permissions
   and the actual behavior/readback of every exposed function.

Current owner result: table shape and upper menu layers are approved. The
right-click and kebab layer has finding `INT-MENU-OWN-001`; correctness remains
`IN_REVIEW`.

Preview action-footers are governed by `INT-PREV-OWN-001`. Normative sources:
`docs/ui-standards/TRIADA_KANON.md` for anatomy/appearance and
`docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §7/§7.3b for mechanics,
ordering, anti-duplication and button variants. Implementation SSOT:
`StandardPreview`, `PreviewActionBar`, `actionPillClass()` and
`src/contracts/tableSurface/canon.ts`. No Interview-specific descriptor exists
yet under `docs/ui-standards/03-modules/table-descriptors/`; creating the six
object-specific mappings is part of the required closure artifact.

### Expert-consensus Creator Shell contract (`INT-CREATOR-OWN-001`)

Three constructive reviews — UX/workflow, design-system/responsive UI and
product/information architecture — produced the initial brief. Two subsequent
independent sceptical reviews found it adequate for prototyping but not yet a
safe platform standard. Their binding disposition is in
`CREATOR_SKEPTICAL_REVIEW.md`; the revised normative recommendation is
`CONSULTING_CREATOR_GUIDELINES.md`. The earlier brief below remains intake
history and must not be treated as implementation authorization:

1. **One shared shell:** Insight and Initiative must use the same component,
   geometry, header, stepper, content viewport, sticky footer, spacing tokens
   and interaction states. Content may differ; mechanics may not.
2. **Desktop geometry:** baseline width `min(960px, calc(100vw - 64px))` and
   height `min(820px, calc(100vh - 48px))`; a complex creator may extend to
   approximately `1040–1120px` only through one documented shared size token.
   Minimum usable desktop layout is approximately `800 × 640px`. Below tablet,
   use a full-screen dialog. The dialog must not resize between steps.
3. **Stable regions:** header `56–64px`, stepper `64–72px`, footer `64–72px`;
   all remain visible. Exactly one middle content region scrolls vertically.
   Nested vertical scrolling is forbidden except for a deliberately bounded,
   labelled and counted very-long virtualized list.
4. **Component scale:** standard inputs/selects/buttons `40–44px`; choice cards
   `56–64px`; content padding `24px`; section gaps `20–24px`; control gaps
   `12px`; labels/body `13–14px`, helper/meta `12–13px`. Do not solve density
   primarily by reducing text below `12px`.
5. **Visual hierarchy:** one modal frame, neutral field borders and at most two
   levels of grouping. A selected item has one dominant selection treatment;
   keyboard focus remains a separate accessible ring. Remove decorative nested
   card borders.
6. **Stepper:** one clean persistent process bar. Active state uses one primary
   indicator; completed uses check/status; future remains readable. Each step
   may summarize its result (for example `2 sources`, `12 interviews`) so users
   do not need to reopen it to remember context.
7. **Progressive disclosure:** required decisions and main outcome-affecting
   choices appear first. `Advanced` is collapsed by default and summarizes
   active settings. Long option/document sets show counts and an explicit
   `Show all`/continuation affordance.
8. **No hidden continuation:** when content extends below the fold, show an
   explicit fade/message such as `More settings below`, removed at the end.
   `Next`/`Run` may not imply completeness while unseen required fields remain;
   validation scrolls and focuses the first error.
9. **Workflow semantics:** preserve state across Back/Next; reset the content
   viewport to the top on entering a new step. Final actions describe the
   outcome (`Run insight`, `Create initiative`). Before an expensive or
   irreversible operation, show a scope summary. Initiative must expose the
   selected Insight sources and their count.

Acceptance requires:

- identical shell tokens and mechanics for both creators;
- at `1440×900` and `1920×1080`, required current-step information, stepper and
  footer remain visible, with any continuation explicitly signalled;
- no two simultaneous vertical scrollbars and no horizontal scrolling at
  widths `320`, `375`, `768`, `1024` and `1440px`;
- the first primary decision is fully visible at step entry;
- consistent control/card sizes, logical keyboard order, visible focus and
  focus trapping;
- a five-person usability check in which at least `4/5` complete both creators
  without help finding more content, and every participant can identify the
  current step and primary action within five seconds;
- like-for-like screenshots or recording of every step of both creators.
  Current Initiative evidence covers Insights and Intent only; Candidates,
  Governance and Result remain `EVIDENCE_MISSING`, so full parity is not passed.
- when a glass/translucent treatment is used, text and interactive controls
  retain required contrast over every background, focus remains unmistakable,
  `prefers-reduced-transparency` (or the product-equivalent accessibility
  setting) falls back to opaque surfaces, and blur does not cause observable
  interaction or scrolling degradation.

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| `INT-ASSIGN-OWN-001` / `REC-INT-002` | The list treated an approved system template as unassignable unless a tenant-scoped publication snapshot already existed, while the assignment writer rejected every system template by requiring `organization_id = actor.organizationId`. | Keep exact-version publication mandatory. Approved product-owned system templates with questions are listable as assignable; the first governed assignment atomically freezes one immutable global `system` snapshot. Organization/private templates still require their tenant publication receipt. | `f3c35cecce` | Template list/detail, assignment writer, publication snapshot reader | Interview | unit `3/3`; startup/readiness `43/43`; fresh pgvector16 mounted delivery `7/7`; migrations `817/0/0`; residue, disabled triggers and advisory locks `0` | `TECHNICAL_PASS / OWNER_RETEST_AND_RAILWAY_READBACK_PENDING` |
| `INT-APPROVAL-OWN-001` / `REC-INT-004` | The lifecycle existed in fragments, but its mounted exact-version round trip and response contract were not covered; send-back returned raw snake-case timestamps/reason while the client contract expects camel case. | Preserve the implemented workflow and add canonical `sentBackAt`/`sentBackReason` readback. Prove answer → submit → edit lock → send back with reason → correction → resubmit → approval, final context eligibility and immutable answer-history snapshots on one database. | `01d1cd8057` | Respondent runtime, manager review actions, assignment/session API, answer history | Interview | fresh pgvector16 mounted delivery `8/8`; UI/API lifecycle regressions `68/68`; assignment `approved`, session `completed`, corrected answer persisted, history snapshots `3`; migrations `817`; residue, disabled triggers and advisory locks `0` | `TECHNICAL_PASS / VISUAL_DISCOVERABILITY_AND_OWNER_RETEST_PENDING` |

## Preflight implementation ledger

| Observation | Root cause | Resolution | Commit | Verification |
|---|---|---|---|---|
| `INT-PF-001` | Test teardown predated immutable source-receipt protection. | Strict disposable-DB/opt-in guard, transaction-local trigger bypass, residue and trigger-state proof. | `9fcff61b7d` | current fresh-PG `70/70 PASS`, residue `0`, trigger `O` |
| `INT-PF-002` | Fail-soft scanner query used two columns absent from the canonical Assessment schema. | Read canonical `name` and `description`. | `291e37340f` | exactly-once real-PG `11/11 PASS`, missing-column error absent |
| `INT-OWNER-01` | No durable realistic Wave 3 fixture existed for the guided owner round. | Add local-only non-destructive seed for manager, respondent and revoked-link states. | `d3d6de5bfc` | seed readback `2` sessions / `6` questions / `2` distributions; active API + revoked `410` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
