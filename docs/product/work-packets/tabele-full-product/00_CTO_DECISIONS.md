# CTO Decisions — Table Studio Full Product Program

**Program ID:** `TABELE_FULL_PRODUCT_PROGRAM`
**Decided by:** Cursor agent in CTO mode under explicit user delegation ("Ty jestes CTO - decyduj - wierze w ciebie", 2026-05-07).
**Date locked:** 2026-05-07
**Status:** `LOCKED` — changes require new program decision card.

---

## Q1 — Block sequencing

**Decision:** Parallel A‖B → barrier gate → C → D.

**Reasoning:**
- Block A (template catalog) and Block B (record provenance) write to disjoint surfaces. A touches `tp_base_templates` + frontend `ArtifactModuleHome`; B touches `tp_records` + new `tp_record_sources` table. Zero contention.
- Block C (AI Operator) needs both: `TableQaService` consumes provenance/confidence (B) and template metadata (A) to detect methodological drift.
- Block D (Integration & Evidence) needs A/B/C running so manual evidence and Anygravity P0 trial reflect the full product.

**Calendar impact:** Sequential sequencing would take ~6 weeks. Parallel A‖B saves ~1.5 weeks. Total program duration: ~3 weeks at 4-agent topology.

**Risk:** Two blocks running in parallel raise coordination overhead. Mitigation: separate packet folders, separate validation matrices, hard merge barrier (both must close `GO` before C starts).

---

## Q2 — DB migration approach

**Decision:** Full DB migration. New table `tp_record_sources` + new columns `tp_records.confidence_score NUMERIC(3,2)` and `tp_records.validation_status TEXT` with CHECK constraint.

**Reasoning:**
- Spec section 8 (TableRecord) defines `source_references`, `confidence_score`, `validation_status` as first-class record fields. Hiding them in `tp_records.data._meta` JSON would:
  - Block per-column filters and sorts on these values (e.g. `confidence_score < 0.6`).
  - Block cross-table reporting and indexes.
  - Force schema bypass via JSON parsing in every read path.
  - Create technical debt that will need re-migration anyway.
- The migration is online-safe: NULL-default columns + new table. No downtime.
- Foundation Block has zero schema dependency on these columns; rollback is column drop.

**Risk:** Migration on production tables. Mitigation: feature flag `featureRecordProvenanceEnabled` gates read/write of new columns; migration ships before flag flip; rollback in one line.

---

## Q3 — Template approval lifecycle

**Decision:** Hybrid. 12 templates ship as `approved` immediately; 18 templates ship as `draft` awaiting promotion.

**12 immediate `approved` templates:**
1. Initiative Register
2. Risk Register (tabele variant — distinct from existing excele Risk Register)
3. Action Plan
4. Stakeholder Map
5. Decision Log
6. Issue Log
7. MEDDPICC Qualification Sheet
8. ICP Fit Score Sheet
9. Mutual Action Plan
10. Sales Pipeline Table
11. KPI Matrix
12. Implementation Tracker

**18 `draft` templates** (system-owned, super-admin promotion required):
Project Backlog, Interview Tracker, Workshop Output Table, Digital Transformation Roadmap, AI Use Case Register, Automation Opportunity Register, Business Case Table, Vendor Comparison Table, Research Source Table, SOP Register, Change Management Tracker, Training Plan Table, Governance Register, Audit Findings Table, Requirements Table, Feature Prioritization Table, ROI Calculation Table, Client Discovery Table.

**Reasoning:**
- 12 best-of covers the high-frequency consulting workflows. Time-to-value is critical for Tabele lane adoption.
- 18 draft templates cover edge cases. Owner promotion (single super-admin gesture) maintains template quality discipline.
- Avoids "30 unvetted templates" anti-pattern that floods the picker with low-quality options.

**Risk:** User pushback on which 12 are `approved`. Mitigation: list above is documented and a single config change can re-promote.

---

## Q4 — AI Editor token budget

**Decision:** Soft-warn at 70 % daily quota + hard cap at 100 %.

**Quota:** 100 000 tokens per workspace per day (configurable per plan in `tp_workspace_settings.ai_daily_token_budget`).

**Behavior:**
- 0 – 70 %: silent, telemetry only.
- 70 – 99 %: UI banner "AI quota at X % — Y tokens remaining today" + audit log entry.
- 100 %+: endpoints return `429` with body `{error, code: 'AI_DAILY_QUOTA_EXHAUSTED', resetsAt}`. UI shows hard banner.
- Reset: midnight UTC.

**Reasoning:**
- Hard block without warning is hostile UX.
- Soft-warn alone allows runaway costs.
- Combined approach matches industry practice (OpenAI, Anthropic billing UX).
- Configurable per plan keeps enterprise customers unblocked when they need higher limits.

**Risk:** Quota too low for power users. Mitigation: telemetry in Block C measures real usage; quota will be calibrated per Sprint 6 of Block C with real data.

---

## Q5 — Anygravity P0 trial timing

**Decision:** Two trials. Trial #1 in Block A after Sprint 2 (template seeder lands). Trial #2 in Block D as final program gate.

**Trial #1 scope:** Smoke `/tabele` lane against staging with 30 templates seeded. Validate: tenant scoping, template visibility per role, draft/approved filter, no cross-tenant template leak.

**Trial #2 scope:** End-to-end product walkthrough. Validate: full AI editor flow, QA Engine reports, source provenance UI, table → report flow, form-as-intake, sustained 50 k record table.

**Reasoning:**
- Early signal in Block A catches integration problems before they compound across A‖B parallel execution.
- Late signal in Block D acts as final go-live gate.
- One-off late trial would push integration risk to the worst possible moment.

**Risk:** Two trials cost more agent time. Acceptable trade-off given P0 catch-rate.

---

## Locked invariants (carry-over from Foundation Block)

- DBR77 Tech Sexy 2027 monochrome palette; semantic accents only.
- Tabele lane accent stays `sky`. New per-feature accents disallowed.
- AI buttons live ONLY in `KimiWorkspaceShell` header right-slot (Menu 3 placement). **As of 2026-05-08 (MELS):** within executive modules this slot maps onto the `ExecutiveModuleShell` right rail; the rule's intent (no AI buttons in canvas) is preserved.
- Word-canvas preview is sectioned, scrollable, document-style — never a bare grid.
- Builder deep-link uses `/my-work/sheets/:workspaceId/tables/:tableId` in a NEW tab.
- Every backend endpoint resolves `tenant_id` from auth context. Cross-tenant returns 403.
- Every AI mutation goes through proposal → approval → execution → audit.

---

## Q6 — Module Executive Layout Standard (added 2026-05-08)

**Decision:** Adopt the DeckBuilder layout pattern as a cross-module standard (`MELS`). Tabele lane converges within the current program (EPIC-T16 in Block A). Wordy and Prezentacje converge in a separate follow-up program.

**Standard:** `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md`.

**Reasoning:**
- User explicitly selected DeckBuilder's three-zone layout + top-bar functional chips as the canonical pattern after reviewing reference screenshots on 2026-05-08.
- Tabele Foundation Block uses `KimiWorkspaceShell` which lacks left-rail outline + right-rail tools; Wordy still ships a Menu 2 horizontal toolbar. Both diverge from the chosen reference.
- Extracting `ExecutiveModuleShell` as a shared component (sibling to `KimiWorkspaceShell`) lets us migrate one module at a time without coordination overhead.
- Doing all three modules in this program would explode scope (separate Wordy + Prezentacje work packets each with their own QA + i18n). Tabele-only keeps current program calendar intact (~2.5 days added inside existing S4/S5 sub-streams).

**Sequencing:**
- Now (Block A, S4–S6): Tabele lane adoption — EPIC-T16.
- After current program closes `GO`: open follow-up program `executive-layout-unification` covering Wordy migration + Prezentacje hardening (formal collapse toggle on left rail per user-flagged gap).

**Risk:** Refactoring `TabeleView` mid-program could regress Foundation Block flows. Mitigation: A-S4 exit gate requires Foundation Block E2E specs to remain green against the refactored view; visual review by UX in S6.

---

## Q7 — A-S0 Q1: Auto-promote 3 legacy featured templates (decided 2026-05-08)

**Decision:** YES. The legacy templates (`CRM Pipeline`, `Project Tracker`, `HR Onboarding`) currently flagged `is_featured=true` in `tp_base_templates` are promoted to `status='approved'` in the same migration that adds the lifecycle columns.

**Reasoning:**
- They are already production-visible via `is_featured`; "promotion" makes the lifecycle invariant true without changing user-visible behavior.
- Final post-migration count becomes 12 new approved + 3 promoted legacy = **15 approved**, 18 new draft = **15 draft** (3 of the 18 listed in Q3 are reclassified to keep totals balanced — see Block A audit findings).
- Avoids creating a hidden middle state where legacy templates are featured-but-not-approved.

**Risk:** A future audit may judge the legacy templates' schemas non-compliant. Mitigation: super-admin can demote in one endpoint call once new lifecycle endpoints ship.

---

## Q8 — B-S0 Q1: Index creation strategy on `tp_records` (decided 2026-05-08)

**Decision:** Non-CONCURRENTLY in a single migration file, accepting the ≤ 90 s lock window during deploy.

**Reasoning:**
- Deploy is scheduled in low-traffic window; expected real lock time is significantly below the 90 s worst-case estimate captured in `block-B-record-provenance/evidence/sprint-0/migration-rehearsal.md`.
- Splitting into a `CONCURRENTLY` follow-up migration adds operational complexity (two PRs, two deploys) for an estimated saved 60 s of acquired-row contention.
- If staging telemetry shows real lock > 30 s, we revisit and split into a separate `CONCURRENTLY` migration as a follow-up; this is documented as B-FU1 in Block B risk register.

**Risk:** Production lock spikes beyond estimate. Mitigation: deploy in defined low-traffic window; pg-monitoring alert on `tp_records` lock duration triggers immediate rollback path.

---

## Sign-off

- Decided: 2026-05-07 (CTO mode under user delegation). Q6 / Q7 / Q8 added 2026-05-08 under same delegation ("Ty jetes CTO wiec decyduj").
- Reviewer (UI/UX): pending block kick-off.
- Reviewer (Security): pending block kick-off.
- Reviewer (QA): pending Sprint 6 of each block.
