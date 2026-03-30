# Final Implementation Contract — Superadmin (Position 33/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Dopasować UI/UX; pełne zarządzanie dzierżawcą + Virtual Workers (Anna/Teresa) + governance; role.
- **Primary users**: platform operatorzy (cross-tenant).
- **Success metric**: jeden widoczny platform control plane z zamontowanymi gałęziami (tenant/user ops, AI ops, connector ops) i bez mieszania z tenant admin.

## 2. Scope
### 2.1 In-scope
- Root control plane + mounted branches wg planu.
- Cross-tenant ops: tenant/user visibility + AI/connector platform ops.

### 2.2 Out-of-scope / non-goals
- Zastąpienie tenant Admin.
- Full enterprise observability parity.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md`
- SSOT: `docs/product/SUPERADMIN_V8_SSOT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md`
- SSOT: `docs/product/SUPERADMIN_V8_SSOT.md`
- Boundaries (must stay explicit):
  - `Organization` (30), `Admin` (32), `Settings` (31)

### 4.2 Local Softs evidence (concrete artifacts)
- **OpenAI (operator-grade approvals and security posture for agents/tools)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/agent-approvals-security.html` (approvals/security posture).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/security.html` (security posture adjacency).
- **Linear (security posture adjacency for “who can do what” controls)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/security.html` (security posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “platform control plane z mounted branches i emergency controls”, nie “ukryty zestaw linków”.**

- **Mounted branches are visible from root (Wave2)**:
  - Root pokazuje gałęzie (tenant/user ops, AI ops, connector ops, governance) i prowadzi do nich przewidywalnie.
- **Cross-tenant approvals/guardrails (OpenAI approvals posture)**:
  - Wrażliwe akcje mają approvals i jawne guardrails; operator widzi co jest “dangerous”.
- **Separation of concerns (Wave2 boundaries)**:
  - Superadmin ≠ tenant Admin; nie ma mieszania prawdy i ról.
- **Operator trust posture (security adjacency)**:
  - Uprawnienia i skutki akcji są czytelne; error/degraded states nie udają sukcesu.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Root control plane closure | visible root | “root not fully mounted” | Dopiąć root + mounted branches jako jeden control plane | P0 |
| Cross-tenant intervention | approvals + safety | “operator trust partial” | Zdefiniować approvals/guardrails + emergency posture | P0 |
| Domain convergence | one operator truth | “fragmented” | Ujednolicić tenant/user + AI/connector towers bez scope blur | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Root + branches są odkrywalne; cross-tenant operations są spójne; boundaries z Organization/Admin/Settings są jawne.
- Wrażliwe akcje są gated (approvals/confirmations) i mają audyt.
- AI/connector ops są wpięte jako jawne gałęzie (bez “ukrytych ścieżek”).

### 5.2 Tests
- Integracyjne: operator navigates root→branch→action; permissions gate; audit event captured.
- Regression: denied / partial failure → czytelny degraded state; brak silent success.
- Contract tests: cross-tenant actions require elevated role; approvals recorded.

### 5.3 Staging proof checklist
- Demo: root walk-through + 2 branches (AI ops + tenant/user search) + jedna gated akcja z audit.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Superadmin SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P33-A — Root control plane canon + guardrails (scope approval)
- **Goal**: root + mounted branches jako jeden control plane; cross-tenant ops z guardrails/approvals.
- **Inputs required**: permissions model + approvals posture; audit baseline; emergency/degraded rules.
- **Acceptance**: scope zatwierdzony; boundaries z Organization/Admin/Settings jawne; no “hidden paths”.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze mounted branches list (P0) and their boundaries vs tenant-level admin.
  - Freeze guardrails: approvals/confirmations + emergency/degraded posture.
  - Freeze audit requirements for all sensitive actions (no silent success).
- **DoD**:
  - Approved(scope): control plane boundaries and guardrails are explicit and enforceable.

#### P33-B — Cross-tenant actions + audit closure
- **Goal**: gated akcje działają; partial failure jest czytelny; audit jest kompletny.
- **Acceptance**: operator wykonuje min. 1 gated akcję z potwierdzeniem; AI/connector ops są wpięte jako jawne gałęzie.
- **Evidence**: integracyjne testy + staging demo root walk-through.
- **Tasks**:
  - Implement 1+ gated cross-tenant actions with confirmations and explicit partial-failure handling.
  - Implement root walk-through navigation + AI/connector branches (bounded).
  - Add integration/regression tests and run staging demo (5.3).
- **DoD**:
  - Cross-tenant operations are safe, audytowalne, and have clear degraded states.

#### P33-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P33-A/B/C.
  - Validate rollback: disable gated actions; preserve read-only visibility.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw read-only visibility + navigation, potem gated actions (P0) i rozszerzenia (P1).

### 8.3 Rollback plan
- Wyłącz gated actions; zachowaj visibility; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: operator ma za dużo mocy bez guardrails (incydenty).
- Ryzyko: scope blur (Admin vs Superadmin).
- Decyzje: minimalny zestaw cross-tenant akcji P0 i ich approvals.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P33-A |  |  |  |  |  |
| P33-B |  |  |  |  |  |
| P33-C |  |  |  |  |  |

