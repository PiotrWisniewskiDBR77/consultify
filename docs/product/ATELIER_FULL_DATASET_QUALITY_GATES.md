# Atelier Full Dataset - Quality Gates

Status: Quality gate framework
Use with: `ATELIER_FULL_DATASET_BUSINESS_ROLLOUT_MAP.md`

---

## 1. Purpose

This document defines objective quality gates for Atelier Full Dataset so release decisions are evidence-based and repeatable.

Every gate must return one decision:

- `GO`
- `NO_GO`

No conditional "soft pass" for production promotion.

---

## 2. Scoring Framework

Use a 0-2 score per check:

- `2` = fully satisfied
- `1` = partially satisfied
- `0` = not satisfied

Gate threshold:

- `GO` requires:
  - no critical check scored `0`,
  - gate score >= 85%,
  - no unresolved P1 risk.

---

## 3. Gate A - Narrative and Business Coherence

### A1. Transformation Thesis Consistency

- One digital transformation thesis appears consistently across:
  - interview insights,
  - program portfolio,
  - KPI/ROI logic,
  - executive artifacts.

### A2. Executive Readability

- Board-level readers can answer:
  - what is wrong,
  - what is being done,
  - who owns what,
  - what value is expected,
  - what evidence exists now.

### A3. Non-Contradictory Storyline

- No conflicting statements between seeded content and runtime artifacts.

---

## 4. Gate B - Module Completeness

### B1. Executive Overview

- Portfolio, risks, pending decisions, and value cues are present and linked.

### B2. Initiatives and PMO

- Initiatives include:
  - tasks,
  - milestones,
  - dependencies,
  - owners,
  - status progression.

### B3. Interview

- Sessions, assignments, insights, and evidence links are populated and coherent.

### B4. Results

- KPI definitions + trends + deviations + ROI assumptions/realized are available and cross-linked.

### B5. Reports and Decks

- Executive artifacts exist in runtime data model and reflect seeded business logic.

### B6. My Work

- User-level pressure loop (inbox/focus/decisions/signals) is realistically populated.

---

## 5. Gate C - Data Integrity and Determinism

### C1. Referential Integrity

- No unresolved FK chains in required dataset surfaces.

### C2. Idempotent Rebuild

- Re-running canonical seed does not produce duplicate business objects or broken links.

### C3. Identifier Coherence

- Tenant identifiers are explicit, consistent, and audit-visible across scripts and runtime.

### C4. Legacy Isolation

- Legacy/manual seed scripts do not define canonical production truth.

---

## 6. Gate D - Promotion Readiness

### D1. Dry-Run Evidence

- Promotion dry-run reports:
  - source/target org mapping,
  - expected table deltas,
  - key record counts.

### D2. Write Guardrails

- Promotion requires explicit confirmation and explicit target DB evidence.

### D3. Post-Promotion Readback

- Readback verifies:
  - counts,
  - role-based key API surfaces,
  - no critical empty states.

### D4. Rollback Preparedness

- Recovery path and snapshot references are defined before promotion.

---

## 7. Critical Risks (Automatic NO_GO)

Any of the following triggers automatic `NO_GO`:

- mixed or ambiguous org identifiers in promotion path,
- conflicting seeded narratives across core modules,
- incomplete Results layer for executive walkthrough,
- canonical seed depends on manual follow-up scripts to fill critical modules,
- production mutation without explicit confirmation controls.

---

## 8. Evidence Pack Required for Sign-Off

Each sign-off must include:

- dataset release metadata (`version`, `hash`, `anchor`, counts),
- gate scorecard with check-level scores,
- unresolved risks list (must exclude P1 for `GO`),
- promotion logs and readback summary (for production gate).

---

## 9. Decision Template

Use this exact summary format:

- Gate: `A|B|C|D`
- Score: `x/y`
- Critical failures: `none | list`
- Decision: `GO | NO_GO`
- Next action: one explicit execution step
