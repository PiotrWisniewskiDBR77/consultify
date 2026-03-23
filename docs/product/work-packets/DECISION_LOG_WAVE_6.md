# V8 Program — Wave 6 Decision Log

> Status: Closed
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 6 escalation items from packets WP-W6-OUT-01, WP-W6-OUT-02, WP-W6-OUT-03, WP-W6-OUT-04

---

## Reports & Presentations operating model

### Decision W6-1 — Presentation AI governance

- Do not create a separate parallel governance doc.
- Extend the shared output AI governance layer, or extend the existing report AI governance doc to a shared `reports + presentations` runtime.
- Rule: `one shared output AI governance truth, with presentation-specific extensions where needed`.

### Decision W6-2 — Shared vs separate Prompt OS presets

- Separate presets for reports and presentations.
- May share generator/runtime assets, but must have independent presets and independent eval gates.
- Reason: different quality targets, format constraints, publish/review semantics.
- Rule: `shared substrate, separate presets`.

### Decision W6-3 — System template families

- Wave 6 defines exactly three canonical paired-output template families:
  - `Executive Steering Pack`
  - `Transformation Status Pack`
  - `Diagnostic / Assessment Pack`
- Each family supports: report form, presentation form, governed mapping between them.

### Decision W6-4 — Recurring automation scope

- Recurring automation extends to presentations, but in bounded form.
- Recurring reports = full first-class support.
- Recurring presentations = generated from approved recurring report or approved recurring output program, not fully freeform first.
- Rule: `presentations are included, but with stricter governance than reports`.

---

## Results & ROI continuity

### Decision W6-5 — KPI-Finance reconciliation ownership

- Results owns KPI truth and reconciliation workflow trigger.
- Finance owns finance interpretation, finance model truth, and CFO review semantics.
- Reconciliation is a shared cross-module process; primary runtime anchor starts in Results.
- Rule: `Results starts reconciliation, Finance resolves finance-side meaning`.

### Decision W6-6 — Standalone mode governance triggers

- Standalone KPI/ROI governance events are in scope for Wave 6.
- Must not depend only on initiative-linked flows.
- Results dual-mode logic honored in event and review design.

### Decision W6-7 — Executive review pack ownership

- `ExecutiveReviewPack` is Results-native.
- Reports consumes it as a structured snapshot source.
- Reports does not become the source-of-truth owner of executive review semantics.

---

## Finance integration & promotion

### Decision W6-8 — Finance → initiative promotion gates

- Promotion requires both permission gate and artifact-quality gate.
- Minimum gate families: actor authority, source artifact confidence/quality, provenance and stale-state preservation, review path for high-impact.
- Rule: `no finance-to-initiative promotion on permission alone`.

### Decision W6-9 — Unreconciled delta escalation

- Unreconciled initiative-finance deltas escalate into CFO governance after configurable threshold.
- Thresholding by: magnitude, duration, repeated recurrence, materiality relative to initiative economics.
- Product rule approved; exact thresholds come later.

### Decision W6-10 — Cloud-linked source refresh after promotion

- Auto-flag the promoted artifact too, not only the underlying model.
- Do not auto-mutate the promoted artifact.
- Promoted artifact shows stale / source-updated warning with re-review path.
- Rule: `source refresh propagates staleness visibility upward`.

---

## Shared publish & review semantics

### Decision W6-11 — Finance locked state

- Finance locked state extends the shared lifecycle, not a completely separate universe.
- Finance may have stricter module-specific lock semantics, but they map into the shared publish/review contract.
- Rule: `shared lifecycle, finance-specific restrictions`.

### Decision W6-12 — Coordinated publish for paired outputs

- Report+presentation pairs support coordinated publish.
- Also remain independently publishable when needed.
- Coordinated publish is a supported mode, not the only mode.
- Rule: `independent by capability, coordinated by workflow`.

### Decision W6-13 — Output recall

- Output recall is a required capability.
- Permission: only authorized owners/reviewers/publish-governance roles.
- Recall must be explicit, auditable, and stateful.
- Recall does not erase lineage.
- Recalled output moves into a visible post-publish controlled state, not silently disappears.

---

## Wave 6 closure

Wave 6 is formally closed as of 2026-03-23 with 4 completed packets and 13 binding decisions.

---

## Related packets

- `WP-W6-OUT-01_REPORTS_PRESENTATIONS_OPERATING_MODEL.md`
- `WP-W6-OUT-02_RESULTS_ROI_CONTINUITY.md`
- `WP-W6-OUT-03_FINANCE_INTEGRATION_PROMOTION.md`
- `WP-W6-OUT-04_PUBLISH_REVIEW_SEMANTICS.md`
