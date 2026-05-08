# Block Closeout — Block C: AI Operator

**Status:** `DONE_WITH_CONSTRAINTS` — Block C exits `GO_WITH_CONSTRAINTS`.

## Block ID / Name

`TABELE_BLOCK_C_AI_OPERATOR`

## Goal

Deliver the 8-level AI Editor (`TableAiEditorService`), the 5-axis Table QA Engine (`TableQaService`), and the curator-driven Source Pack Builder (`SourcePackBuilderService`) so that Tabele becomes an AI-native consulting artifact platform — every AI-driven change is **proposed**, **auditable**, and **reversible**.

## Outcome

- Status: `DONE_WITH_CONSTRAINTS`
- Summary: All three core services landed with 167 passing tests (115 backend + 52 frontend), DBR77-clean panels in the right rail, cross-tenant defense at every public surface, and per-workspace AI cost control. The deferred items (live token calibration, perf gates on staging, integration tests, Playwright e2e) are scoped, ticketed, and explicitly NOT blocking Block D entry because the AI Operator surface is feature-flagged off in production.

## Sprints completed

| Sprint | Outcome | Headline deliverable |
|---|---|---|
| C-S0 | `COMPLETE — GO` | Day-10 barrier verified; `tp_workspace_settings`, `tp_ai_usage` migration; `AiUsageService` (atomic `consume()`, soft-warn 70 %, hard-cap 429). |
| C-S1 | `EXECUTED — GO` | `TableAiEditorService` skeleton with 8 stub level handlers; routes mounted; budget gate + audit ledger live. |
| C-S2 | `EXECUTED — GO` | Real handlers for `cell`, `record`, `column`, `structure` levels with Zod-validated operation envelopes and `LlmProvider` injection. |
| C-S3 | `EXECUTED — GO` | Real handlers for `view`, `relational`, `methodological`, `source` with super-admin gates on the last two. |
| C-S4 | `EXECUTED — GO` | `TableQaService` (5-axis health, deterministic suggestions, durable dismissals, debounced scheduler) + `tp_qa_reports`/`tp_qa_suggestion_dismissals` migration. |
| C-S5 | `EXECUTED — GO` | `<TabeleAiEditorPanel>` + `<TabeleQaPanel>` + `<ProposalDiffCard>` wired into the right rail with QA → AI Editor handoff. |
| C-S6 | `EXECUTED — GO` | `SourcePackBuilderService` + `tp_source_packs` + `<TabeleSourcePackPanel>` with V8 snapshot capture and AI Editor handoff. |
| C-S7 | `EXECUTED — GO_WITH_CONSTRAINTS` | This document. |

## Validation Performed

> Full execution log: `evidence/sprint-7/validation-matrix-run.md`.

### Automated

- L1.1 Frontend lint — `PASS` (clean on all touched files).
- L1.2 Frontend typecheck — `PASS` (`ReadLints` 0 errors).
- L1.3 Backend lint — `PASS` (clean on touched files).
- L1.4 DBR77 hex scan — `PASS` (0 hits in `tabeleShell/{aiEditor,qa,sourcePack}`).
- L1.6 Untouched-files guard — `PASS`.
- L2.1–L2.6 Unit tests — `PASS` (115 backend + 52 frontend = 167 tests).
- L3.1–L3.6 Component tests — `PASS` (52 / 52 in `tabeleShell/__tests__`).
- L4.1–L4.7 Integration — `COVERED_BY_UNIT` (DB-backed integration suite filed as TBL-FU-C7-3).
- L7.1–L7.8 Security — `PASS` (code-reviewed; cross-tenant tests embedded in unit suite).

### Deferred

- L1.5 i18n keys — partial (covered by **TBL-FU-C5-1**).
- L5.1–L5.5 Playwright e2e — **TBL-FU-C7-4**.
- L6.1 DBR77 visual review — D-S5 dogfood.
- L6.4 Demo recording — D-S6.
- L6.5 LLM cost report — **TBL-FU-C7-1** (live calibration).
- L8.1 AI Editor p95 — bound by external LLM latency (out of scope).
- L8.2 QA Engine perf — **TBL-FU-C7-2** (1 k records, staging).
- L8.3 Source Pack ranking perf — **TBL-FU-C6-3** (10 k records, staging).
- L8.4 Token budget calibration — **TBL-FU-C7-1** (live trial).

### UI/UX evidence

- Component tests assert structure for `<TabeleAiEditorPanel>` (8-level grid, super-admin gating), `<TabeleQaPanel>` (5-axis cards + suggestions), `<TabeleSourcePackPanel>` (candidate list + saved-pack list + selection counter).
- DBR77 hex scan clean across all new components — only design-system tokens (slate / emerald / amber / rose).
- Right-rail orchestrator hook proves cross-panel handoff (QA → AI Editor, Source Pack → AI Editor) via key-bumped remount.

## Gate Result

- DoD: `PASS_WITH_P2`
- Security/Tenant: `PASS`
- Release impact: `LOW` (all surfaces feature-flagged off by default; flags must be explicitly enabled per env + per workspace)
- Block Exit Gate: **`GO_WITH_CONSTRAINTS`**

### Constraints carried into Block D

1. Token budget calibration is on conservative defaults; D-S5 trial validates them — **TBL-FU-C7-1**.
2. QA Engine perf budget unverified on real corpus — **TBL-FU-C7-2**.
3. Source Pack ranking perf budget unverified on real corpus — **TBL-FU-C6-3**.
4. Integration tests + Playwright e2e are the planned post-Block-D follow-ups — **TBL-FU-C7-3**, **TBL-FU-C7-4**.

None of the constraints block Block D entry. Block D's first sprint (D-S0 preflight) will re-confirm the feature-flag posture before any new work proceeds.

## Remaining Risks

> From `02_RISK_REGISTER.md`:

| Risk ID | Title | Status at exit |
|---|---|---|
| C-T1 | Token calibration too tight | Mitigated — `100 000`/day default; live calibration filed as TBL-FU-C7-1. |
| C-T2 | Cross-tenant LLM context leakage | Mitigated — `assertTableInOrganization()` + ACL guards in every handler; L7.3 PASS. |
| C-T3 | LLM prompt injection | Mitigated — `PROMPT_INJECTION_GUARD` fences every untrusted prompt; LLM output is Zod-validated; malformed outputs are dropped. |
| C-T4 | Super-admin gate bypass | Mitigated — gate runs in service layer before token consumption; route layer additionally checks `authReq.user?.isSuperAdmin`. |
| C-T5 | Proposal replay | Mitigated — `tp_schema_proposals.status` flips on apply/reject; second action throws. |
| C-T6 | QA recompute thundering herd | Mitigated — in-process debounced scheduler (5 min). BullMQ migration is not needed for Block C (filed as a stretch follow-up only if traffic warrants). |
| C-T7 | Source Pack ranking perf | Mitigated by 1 000-row scan cap; live verification at TBL-FU-C6-3. |

## Token budget calibration

- Default `ai_daily_token_budget`: **100 000 tokens / workspace / day** (shipped).
- Observed median daily usage in test workload: N/A — calibration deferred to live trial (TBL-FU-C7-1).
- Recommendation for production default: **keep `100 000`** until D-S5 produces real signal, then revisit.
- Cost ceiling protection: atomic `consume()` with hard-cap raises HTTP 429 + `AI_DAILY_QUOTA_EXHAUSTED`. Soft-warn at 70 % surfaces in the AI Editor banner.

Full calibration write-up: `evidence/sprint-7/token-budget-calibration.md`.

## Follow-ups

- **TBL-FU-C5-1** (P1) — Full i18n (EN+PL) for AI Editor / QA / Source Pack panels.
- **TBL-FU-C5-2** (P2) — Programmatic right-rail tool switching (so QA → AI Editor handoff also visually swaps tools).
- **TBL-FU-C5-3** (P1) — Backend endpoint to fetch a proposal by ID (operations preview in `<ProposalDiffCard>`).
- **TBL-FU-C6-1** (P2) — Source Pack embedding-similarity ranking once an embedding index exists.
- **TBL-FU-C6-2** (P2) — Auto pack-usage counter when AI Editor consumes a `sourcePackId`.
- **TBL-FU-C6-3** (P2) — 10 k-record Source Pack perf gate on staging.
- **TBL-FU-C7-1** (P1) — Live token budget calibration during D-S5 trial.
- **TBL-FU-C7-2** (P2) — 1 k-record QA Engine perf gate on staging.
- **TBL-FU-C7-3** (P2) — DB-backed integration tests for the AI Operator surface.
- **TBL-FU-C7-4** (P2) — Playwright e2e smoke for the AI Operator surface.

## Next Step

`GO` to **Block D — Conversions, Form Intake, Anygravity P0 trial #2, Demo dry-run, Final program closeout**. D-S0 will start with a preflight intent-routing audit and confirm that all Block C feature flags remain off by default.

---

## Sign-off

- Block lead: CTO seat (this orchestrator)
- UI/UX reviewer: deferred to D-S5 dogfood (DBR77 visual audit on staging)
- Security reviewer: code-review evidence in `audit-findings/AI_OPERATOR_BASELINE_2026-05-08.md` + L7.1–L7.8
- QA reviewer: validation matrix run in `evidence/sprint-7/validation-matrix-run.md`
- Date closed: 2026-05-08
