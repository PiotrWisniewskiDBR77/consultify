# Interview — Consulting Creator Guidelines

Status: `OWNER_DIRECTION_CAPTURED / EXPERT_BRIEF_REVIEWED_BY_TWO_SKEPTICS / PROTOTYPE_GATE_REQUIRED / NO_IMPLEMENTATION_YET`

Scope: `Assign Interview`, `AI Insight Creator`, `AI Initiative Wizard`.

The three surfaces form one professional consulting workflow:

`collect approved material → derive evidence-backed insight → propose governed initiative`

They must share one design and navigation system, but not pretend to be the
same process. Assign is a short transactional form; Insight and Initiative are
multi-step creators.

## 1. Canonical binding — no new shell

These guidelines are a UX requirements profile of the existing platform family,
not authorization to create a fourth wizard system.

- Normative behavior: `UI-CREATE-01 — Create and Generator Wizard`, contract
  `2.1`, including durable draft/resume, idempotency, partial failure, retry of
  failed items only, recovery and telemetry.
- Modal implementation boundary for these three creators: extend and adopt
  `src/components/shared/WizardModal`; its source explicitly names Survey,
  Insight and Initiative as consumers. Assign uses its compact transactional
  variant; Insight and Initiative use its stepped creator variant.
- `ToolWizardShell` remains the canonical route-backed/full-workspace shell for
  consulting tools. It is not copied into these dialogs and is not replaced by
  this profile.
- Product language may call the result a “Consulting Creator”, but that name is
  configuration and content, not a separate component or SSOT.
- Any missing capability is added to the canonical family/component through a
  versioned contract. Local forks and bespoke modal chrome are forbidden.

## 2. Shared creator geometry

- Shared header, content viewport, footer, typography, controls, states and
  responsive rules.
- Desktop baseline: `min(1040px, calc(100vw - 64px))` ×
  `min(840px, calc(100vh - 48px))`; documented compact Assign variant
  `760–840px`; minimum usable height about `680px`.
- One outer border and radius `16px`; no decorative frames inside frames.
- Exactly one vertically scrolling region. Header/navigation and footer remain
  visible. No horizontal scroll at supported breakpoints or 200% zoom.
- Form content is centred, maximum approximately `880px`, on a 12-column grid.
  Two-column fields are allowed only when each keeps at least `280px`.
- Changing steps must not move or resize the dialog.

## 3. Component and visual tokens

- Spacing rhythm: `4 / 8 / 12 / 16 / 24 / 32px`.
- Inputs, selects and buttons: `40px`; important fields may use `48px`;
  text areas `96–128px`.
- Choice cards: equal height per group, minimum `56px`.
- Creator title `18/24`, body `14/20`, label `13/18`, helper minimum `12/16`.
  Density must not be solved primarily through smaller text.
- One active-state accent. Selection uses one dominant treatment; keyboard
  focus remains a separate visible ring.
- Separate sections through spacing, headings or subtle backgrounds, not
  repeated borders.

## 4. Navigation model

### Assign

No artificial stepper. Use one screen with three sections:

1. **What:** searchable template, recent suggestions and explicit eligibility.
2. **Who:** people/team without duplicates and with assignment count.
3. **Conditions:** due date and priority; notes, anonymity and rare options
   belong under `Additional options`.

The common case — template, people, due date — must be completable without
searching for hidden content. Before Assign, show a compact summary.

### Insight

1. **Outcome:** title and primary output; optional outputs are subordinate.
2. **Approved sources:** sessions/people first; dates, role and department are
   additional filters; always show selected and eligible counts.
3. **Analysis brief:** leading question/hypothesis dominates; Advanced is
   collapsed and summarizes active settings.
4. **Scope check:** outcome, approved evidence, filters and AI boundary are
   visible before `Run insight`.

### Initiative

1. **Insights:** recommend and select approved source insights; show type,
   findings count, date and evidence lineage.
2. **Intent:** AI proposes problem, solution, scope and KPI; user confirms or
   edits. Prefer one section-level `Fill suggestions` action over four equal
   micro-actions.
3. **Candidates:** compare proposals, similarities and possible duplicates.
4. **Governance:** shortlist, owner, priority, risk and approval gate.
5. **Result:** exact objects/statuses to be created and preserved
   `Interview → Insight → Initiative` lineage.

## 5. Consulting-product language and trust

- Every step answers one visible business question.
- Labels and CTAs name outcomes rather than technology: `Choose approved
  sources`, `Generate candidates`, `Send for approval`, `Assign`.
- A live `Current scope / What will be created` summary is a collapsed,
  single-line strip/chip with a bounded height; it expands on request and may
  not become another permanently open card. It contains:
  - Assign: template, recipients, due date, approver, privacy;
  - Insight: output, approved-source count/status, date/person scope,
    hypothesis, organization knowledge;
  - Initiative: source insights, problem, project, horizon, priorities and
    proposal count.
- Unapproved material must never enter analysis silently. Explain every
  exclusion and show source status.
- Before an AI operation, state its contract, for example: `6 approved
  sessions and 1 document will be analysed`.
- Preserve owner, time, version, parameters and lineage on every output.

## 6. Basic and advanced use

- Basic Assign: template, people, due date.
- Basic Insight: output and approved sources; system proposes scope/hypothesis.
- Basic Initiative: insights; system proposes intent, project/area, priorities
  and count.
- Expert settings use one collapsed `Advanced · N changes` section. They remain
  accessible but may not displace the main decision from the initial viewport.
- Auto-filled data is labelled as an editable AI proposal, never as accepted
  truth.

Each step has at most one primary business decision open at once and one
primary action. The implementation specification must identify every field as
`basic`, `suggested-with-confirmation`, or `advanced`; hiding fields merely to
reduce density is forbidden.

## 7. First-viewport, scroll, progress and validation

Before implementation, each screen receives a versioned `first viewport`
contract. At `1440×900` it must show the step name and business question, all
fields of the basic path, a textual `Step N of M`/section-completeness signal,
an explicit indication of further content and the primary CTA with its effect.
The exact field inventory is accepted in the clickable prototype; dimensions
alone are not evidence of hierarchy.

- Only content scrolls. Always expose a scrollbar or explicit continuation
  affordance when more content exists; remove it at the end.
- On step change, move focus to the step heading and return content to top.
  Preserve all prior selections on Back/Next.
- Insight/Initiative stepper states: future, current, complete, needs correction.
  Completed steps may be revisited; inaccessible future steps explain why.
- Disabled CTA always has a visible reason. Validation occurs after interaction
  or transition attempt, focuses the first error and summarizes off-screen
  errors above the footer.
- Closing a dirty creator requires save-draft or loss confirmation.
- Mobile uses a full-screen creator. A reduced modal is not an accepted mobile
  variant.

## 8. Liquid Glass constraints

Liquid Glass is a controlled language for depth, not decorative blur:

- translucency only for shell header/navigation/footer;
- form content remains nearly opaque;
- maximum three depth layers: overlay, shell, active element;
- no stacked translucent cards;
- contrast: text `4.5:1`, UI/focus `3:1`;
- opaque fallback for reduced transparency/high contrast/weak devices;
- reduced-motion mode removes scale and slide; animations `150–220ms`;
- blur must not degrade scroll or interaction performance.

The opaque baseline must pass every usability, accessibility and performance
gate first. Glass is optional polish and may not carry information or repair a
weak hierarchy. It is accepted only if it does not worsen completion time,
contrast or reference-device scroll performance.

## 9. State, persistence and integration contracts

- **Loading:** no layout shift; local indication identifies the affected field
  or section; primary action remains in place.
- **AI error:** preserve input; distinguish provider, permission, validation and
  server/network failures; offer Retry, manual continuation and details.
- **Empty:** distinguish no data from no eligible data and provide a recovery
  action. A blank selector is forbidden.
- **Success:** confirm what was created and present the next workflow action
  before closing.

The shared contract must also cover `editing → validating → saving → running →
partial/success/error → resume`, versioned durable drafts, refresh/cold resume,
version conflict, session expiry, permission or eligibility changes, offline,
timeout, cancellation, stale data, double-submit protection and idempotent final
mutation. AI output remains a proposal until explicit accept; partial success
shows successes and failures separately and retries failed items only.

Adapters must expose paginated/searchable data, eligibility with exclusion
reasons, capabilities, typed errors, async job progress/cancel/retry, audit and
lineage metadata, and step-level telemetry without coupling the shell to an
Interview domain response shape.

## 10. Acceptance-v1 gates

1. Before product migration, the owner accepts a clickable prototype of Assign,
   all Insight steps and all five Initiative steps, including the full state
   matrix. Initiative steps 3–5 currently remain `EVIDENCE_MISSING`.
2. All three creators adopt the canonical `WizardModal` contract and shared
   primitives; no parallel shell or local chrome fork is introduced.
3. The accepted first-viewport contract passes on `1440×900`; the complete
   matrix includes `1280×720`, `1920×1080`, tablet, full-screen mobile and 200%
   zoom, with no nested/horizontal scroll, hidden CTA or undisclosed required
   section.
4. Stress fixtures include at least 50 templates, 100 people, 30 insights, 10
   candidates, long PL/EN labels and five simultaneous validation errors.
5. Approved patterns exist for empty, loading, disabled-with-reason, validation,
   AI partial failure, timeout, offline, permission loss, eligibility change,
   version conflict, cancellation, success and resume.
6. Back/Next, AI retry, transient network loss and refresh preserve all input;
   repeated submit after timeout creates one final object and cold readback
   restores the same versioned draft/operation state.
7. Full keyboard path, focus trap/return, screen-reader step announcements,
   reduced motion/transparency, high contrast, light and dark themes pass.
8. `5/5` representative users complete each of the three journeys without
   facilitator instruction, with at most one recoverable mistake per journey,
   zero lost data and zero missed mandatory decisions.
9. Before starting, `5/5` can state what will be created, from which approved
   evidence, who approves it and what happens next.
10. Component-contract, state-machine, integration, persistence, visual,
    accessibility and performance tests pass; the pilot is feature-flagged and
    has a rollback path before reuse outside Interview.
11. Owner acceptance is recorded separately for Assign, Insight and Initiative
    on the same exact candidate SHA. One flow cannot stand in for another.

## 11. Governance and migration boundary

- Standard owner: Product Design + Frontend Platform; product owner acceptance
  remains separate.
- Freeze a versioned Creator Platform Contract and changelog before migration.
- Inventory all wizard consumers and publish the modal-versus-workspace rule.
- Pilot sequentially: Assign → Insight → Initiative. Do not migrate the next
  creator until the previous pilot passes its contract and rollback check.
- Only after all three pass may the pattern be promoted for other modules.
- The two-sceptic review and disposition are recorded in
  `CREATOR_SKEPTICAL_REVIEW.md`.
