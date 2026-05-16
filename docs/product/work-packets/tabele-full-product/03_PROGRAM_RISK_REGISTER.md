# Program Risk Register — Table Studio Full Product Program

**Program ID:** `TABELE_FULL_PRODUCT_PROGRAM`
**Status:** `LOCKED`
**Severity scale:** P0 (block program) > P1 (must fix before barrier) > P2 (allowed with mitigation) > P3 (note only)

This register covers cross-block program-level risks. Block-level risks live in each block's own `02_RISK_REGISTER.md`.

---

## Program-level risks (PR)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| PR1 | Parallel execution of A and B causes merge conflicts on `ArtifactModuleHome.tsx` (template card grid vs lifecycle filter chip) | Medium | Medium | P1 | Coordinate via daily orchestrator merge; B touches GridView only, not ArtifactModuleHome; if conflict arises, A merges first | Orchestrator |
| PR2 | Block C starts before B finishes confidence algorithm; AI Editor calibration is wrong | Low | High | P0 | Hard barrier gate at Day 10. C's S0 cannot start before B's S7 closes GO | Orchestrator |
| PR3 | Anygravity P0 trial #1 reveals tenancy bugs in template seeder; cascade effect on B running in parallel | Medium | High | P1 | Trial #1 runs after A's S2; if FAIL, A pauses while B continues; A relaunches after fix | Orchestrator |
| PR4 | DB migration on `tp_records` blocks production for >30 s on multi-million row workspaces | Low | Critical | P0 | Migration uses `ALTER TABLE ... ADD COLUMN ... DEFAULT NULL` (no rewrite); rehearsal on staging snapshot in B's S0 | Agent C |
| PR5 | AI Editor token budget too low → user complaints; too high → cost incident | Medium | Medium | P1 | C's S0 uses telemetry from existing AI components to set baseline; quota is configurable per plan; calibration in C's S6 with real data | Agent A |
| PR6 | Two consecutive block closeouts ship constraints, forcing chain `GO_WITH_CONSTRAINTS` accumulation | Medium | Medium | P1 | Hard rule: any constraint at block exit is filed as P1 follow-up before next block starts; no "deferred constraints stack" allowed | Orchestrator |
| PR7 | Out-of-scope creep: user requests new template mid-block | Medium | Medium | P2 | Scope-lock per packet; new template = new sprint card or new packet, never inline | Orchestrator |
| PR8 | Foundation Block regression during program execution (someone touches Tabele lane outside this program) | Low | High | P1 | CI gate: Foundation Block focused tests run on every PR in this program; failure = revert | Agent D |
| PR9 | LLM provider rate limit hits during Block C (8-level AI editor uses many model calls) | Medium | Medium | P2 | Use existing LLM provider abstraction with retries; multi-provider fallback already in place per `services/llm` | Agent A |
| PR10 | i18n key sprawl across 30 templates × 2 locales × multiple lifecycle states | Medium | Low | P2 | Centralize template strings in `BUILTIN_TEMPLATES` map; locale tests in L1; defaultValue on every t() | Agent C |
| PR11 | Audit trail explodes in size with provenance + AI editor + QA reports | Low | Medium | P2 | `AuditRetentionJob` already exists; add new event types to its retention policy | Agent A |
| PR12 | Storybook / docs drift across 4 blocks: SoT files updated by block C contradicts block A | Low | Medium | P2 | Each block's S7 (closeout) updates SoT atomically; orchestrator reviews delta | Orchestrator |
| PR13 | Barrier gate slips; user pressure to skip and start C anyway | Medium | High | P1 | Hard rule documented in `00_CTO_DECISIONS.md` Q1: barrier is non-negotiable; only escalate to user with explicit risk write-up | Orchestrator |

---

## Cross-block compatibility risks (XB)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| XB1 | Block A's new field type `source_reference` conflicts with Block B's `tp_record_sources` semantics | Medium | High | P1 | XB1 mitigation card written into A's S3 and B's S2 specs; field_type points to source_id, source_id lives in tp_record_sources | Agent A |
| XB2 | Block A's `template.field_schema` doesn't carry `source_required` flag → Block C QA Engine can't detect missing-source records per template | Medium | Medium | P1 | A's S2 schema includes `field.source_required: boolean`; documented in EPIC-T5 | Agent A |
| XB3 | Block C's `TableQaService` requires Block A's `template.governance_rules`; A doesn't define them | Medium | Medium | P1 | A's S1 (lifecycle backend) ships with `governance_rules` JSON column on templates; minimal schema documented in EPIC-T6 | Agent A |
| XB4 | Block D's table → deck flow expects Block C's QA report to attach as deck appendix | Low | Low | P3 | D's S1 reads QA report if present, gracefully omits if absent | Agent A |

---

## Open / hot risks (live)

(Empty until execution begins. Each block sprint card opens with "Pre-sprint risk check" referencing this register and adds new entries as they arise.)

---

## Severity protocol

- **P0 fired:** Orchestrator stops the active sprint, escalates to user with a STOP card. No work continues until user approves resolution path.
- **P1 fired:** Active sprint completes, then a hotfix card is opened before the block's exit gate.
- **P2 fired:** Recorded in the realized-risks section of the affected sprint; mitigation noted in closeout.
- **P3 fired:** Noted in closeout only.

---

## Linkage

- Foundation Block risk register: `DRD/consultify/docs/product/work-packets/table-studio-foundation/02_RISK_REGISTER.md` (closed; reference for risk taxonomy).
- Per-block risk registers: `block-X-*/02_RISK_REGISTER.md`.
- Sprint cards reference this register by ID (e.g. `PR4`, `XB1`).
