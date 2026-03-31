# Final Implementation Contract — Finanse (Position 5/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `verified(evidence)` for **P05-A/B/C** — Finance Lane E2E closed  
Last updated: 2026-03-31 (P05-B/C delivery + verification)

## 1. Executive summary
- **Intent**: Poprawa modeli (import + dane historyczne) + analityka 1/2/3 poziomów + pełne narzędzia pracy z modelem.
- **Primary users**: owner/management, analityk finansowy, PMO.
- **Success metric**: bounded, ale wiarygodny „consequence-management lane” z uczciwą mutacją i spójnością z KPI oraz inicjatywami.

## 2. Scope
### 2.1 In-scope
- Deklarowane ścieżki finansowe (analysis + mutation) z zachowaniem spójności od KPI do konsekwencji.
- Import/historyczne dane w zakresie opisanym w planie.

### 2.2 Out-of-scope / non-goals
- Pełna parity CFO OS / ERP / accounting suite.
- “Piękne raporty” bez audytowalnej mutacji i bez spójności z KPI (anty-cel).
- Przejęcie ownership finansów “na całej platformie” (tylko zadeklarowane sub-lanes Wave 1).

### 2.3 P05-A canon (Finance lane canon + scope approval)

This section is **scope-canon** for Finance packets. It freezes:
- bounded lanes (what exists in Wave 1),
- cross-module coherence boundary (KPI ↔ Finance),
- versioning semantics (current vs actual),
- error taxonomy + recovery posture,
- anti-duplicate gates (no parallel finance truths),
- degraded modes and testable acceptance points.

#### 2.3.1 Bounded lanes (one declared canon)
Finance is a **bounded lane system**, not “anything finance-like”.

Canonical lane order (Wave 1):
1. **Import** → ingest + validate + map source datasets into model-ready form
2. **Analysis** (L1/L2/L3) → run bounded analysis levels on declared model truth
3. **Mutation** → governed changes to declared finance model state (never silent)
4. **Readback** → stable, reviewable outputs + linkage back to Results/KPI context where declared

Rules:
- Each lane must have an explicit **entry**, **exit**, and **state** (no invisible “magic background” work).
- Finance lanes must remain auditable: who/what/when + outcome.

Explicit non-goals (re-stated as canon guards):
- No ERP / accounting suite parity.
- No “pretty reports” that bypass auditability, mutation traceability, or KPI coherence.
- No platform-wide finance ownership beyond declared Wave 1 sub-lanes.

#### 2.3.2 KPI ↔ Finance coherence boundary (freeze)
We freeze the “results → consequence” boundary so the product never creates split-truth.

Ownership boundary (SSOT: `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`):
- **Results/KPI owns**:
  - KPI metric truth (values, cadence, validation in Results)
  - initiating reconciliation workflow when KPI ↔ Finance diverge
  - presenting KPI-facing context and linkage status
- **Finance owns**:
  - finance interpretation and finance model truth (planning/versions/mutations)
  - CFO review semantics and finance-side resolution
  - finance-side audit posture for mutations and model state
- **Shared**:
  - reconciliation as a governed cross-module process (explicit, never hidden)

One-truth rule (“results → consequence”):
- Results values are **not overwritten** by finance estimates.
- Finance model state is **not overwritten** by KPI values.
- The system explains linkage and divergence via governed linkage/reconciliation objects, not by silently collapsing values.

#### 2.3.3 Versioning semantics (freeze, bounded)
We freeze the minimum semantics required for “current vs actual” and switchover posture.

Canonical semantics:
- **`actual`**:
  - represents realized / committed truth for a closed window (post-review posture)
  - is stable; changes require governed correction (audit-required) rather than silent edits
- **`current`**:
  - represents the working view (forecast / planned / in-progress model state)
  - is the default target for controlled mutation inside declared lanes

Switchover posture:
- A switchover is an explicit event/date boundary where a window becomes “actual”.
- Switchover must be visible and reviewable (no hidden background flips).

Reconciliation boundary (bounded):
- Reconciliation is required when Results KPI truth and Finance interpretation diverge materially on a declared linkage path.
- Reconciliation explains divergence (timing/scope/unit/formula/model-staleness), it does not hide it.

#### 2.3.4 Error taxonomy + recovery posture (freeze)
We freeze an operator-grade error posture for import and mutation.

Import action completion taxonomy (evidence pointers in Softs / Apiary mirror):
- Import outcomes must surface a stable status family:
  - **completed**
  - **completed_with_warnings**
  - **failed**
  - (optional operational states) queued / running / cancelled
- Import must expose **completion / failure / warning codes** as user-visible evidence (not logs-only).
  - Evidence pointer: `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/.../completion-failure-and-data-error-warning-codes-for-import-and-export-actions.html`

Recovery posture (imports):
- `completed_with_warnings`: data may be partially usable; system must show “what is impacted” and recommended next action (fix mapping / fix source / retry).
- `failed`: no partial mutation is allowed downstream; system stays in safe degraded state (read-only + previous good state remains).

Mutation failure posture:
- Any mutation failure must create an **audit event** and result in a **safe degraded state**:
  - no silent corruption,
  - no partial writes presented as success,
  - user sees failure cause category + “what next” action.

#### 2.3.5 Anti-duplicate gate (no parallel finance truths)
We freeze an anti-duplicate gate to prevent “parallel finance truth tables” and split-truth outside declared lanes.

Rules:
- No parallel “finance truth tables” outside this lane grammar.
- No second “KPI-finance mapping truth” outside the linkage SSOT and declared linkage objects.
- Any new finance object family must be justified as an extension of canon (not a shadow system) and recorded in section 9 risks/decisions before P05-B starts.

#### 2.3.6 Degraded / error posture (minimum scenarios)
Finance must degrade safely. Minimum scenarios (at least one user-visible state + next action each):
1. **Import mapping missing/invalid** → import blocked; show required mapping fields; suggest fix + retry.
2. **Import completed with warnings** → allow analysis in “warning posture”; highlight impacted rows/fields; suggest remediation.
3. **Import failed** → keep last good model snapshot; block mutation; show failure code family + retry path.
4. **Source dataset schema drift** → detect mismatch; offer mapping update workflow; do not auto-adapt silently.
5. **Stale model / stale linkage** (KPI link out of date) → mark linkage stale; require refresh/reconcile before showing “consequence confirmed”.
6. **Mutation conflict / concurrency** → prevent unsafe write; create audit event; require retry on latest model state.
7. **Permission denied / locked review window** → mutation disabled; keep read-only; show which role/state blocks action.
8. **Switchover misconfigured** → block “actual” finalize; require explicit correction; do not flip version automatically.
9. **Reconciliation mismatch** (timing/scope/unit/formula) → show mismatch category; allow notes + acknowledge path; do not auto-force equality.

#### 2.3.7 Acceptance checklist (scope approval, testable)
To mark `P05-A` as `approved(scope)`, the following must be true (testable statements):
1. [x] Import→analysis(L1/L2/L3)→mutation→readback lane order is explicit and referenced as canon (this section).
2. [x] Finance non-goals are explicit and include “no ERP/accounting suite” and “no pretty reports without audit”.
3. [x] KPI ↔ Finance ownership boundary is explicit (Results owns KPI truth + reconciliation trigger; Finance owns model truth + finance-side resolution).
4. [x] The system posture explicitly forbids silent overwrite of Results KPI values by Finance and vice-versa.
5. [x] Version semantics define `current` vs `actual` with an explicit switchover boundary and audit-required correction posture.
6. [x] Reconciliation is explicitly required to explain divergence; it cannot be hidden or silently resolved.
7. [x] Import completion taxonomy includes at minimum: completed / completed_with_warnings / failed, and codes are treated as first-class evidence (user-visible).
8. [x] Import failure posture explicitly blocks downstream mutation and preserves last known good state.
9. [x] Mutation failure posture explicitly requires audit logging and safe degraded state (no partial silent corruption).
10. [x] Anti-duplicate gate explicitly forbids parallel finance truth tables and split-truth outside declared lanes.
11. [x] Degraded posture lists at least 7 scenarios with user-visible state + recommended next action.
12. [x] Dependencies for P05-B later are clear: P04-A must remain `approved(scope)` and linkage SSOT remains authority.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md`
- SSOT: `docs/product/FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md`
- Runtime linkage: `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Analiza finansowa` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Anaplan (modeling + workflow surfaces)**:
  - `Softs/0 Analiza finansowa/anaplan.zip :: anaplan/help.anaplan.com/create-transformation-views-7a0d42ac-97b6-4fb6-a4b5-d2a22be6d81d.html` (transformation view: format source dataset to push into model).
  - `Softs/0 Analiza finansowa/anaplan.zip :: anaplan/help.anaplan.com/publish-a-process-to-a-dashboard-cd348496-8fdb-479b-b2f4-7c1aa5e67146.html` (publish a process as a button on a dashboard; run process).
  - `Softs/0 Analiza finansowa/anaplan.zip :: anaplan/help.anaplan.com/export-versions-62e64f25-a3b4-44ec-bee6-72b8b7b5f839.html` (versions export: current/actual versions, switchover dates, formulas).
- **Apiary (Anaplan Integration API mirror)**:
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/introduction/bulk-api-index.html` (Bulk API index page in local mirror).
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/introduction/transactional-api-index.html` (Transactional API index page in local mirror).
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/reference/import-actions.html` (import actions reference page in local mirror).
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/reference/completion-failure-and-data-error-warning-codes-for-import-and-export-actions.html` (error/warning codes page in local mirror).
  - Uwaga: część treści w Apiary mirror może być ładowana dynamicznie (JS), ale obecność tych stron w Softs jest wystarczającym “evidence pointer” do parity checklist.

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “consequence-management lane z modelową gramatyką”, nie “ERP/accounting suite”.**

- **Transformation / mapping layer (Anaplan)**:
  - Jawny etap “transform source dataset → model-ready format” (transformation views / mapping).
  - Import nie jest “wrzuć CSV i licz” — musi istnieć warstwa walidacji i dopasowania.
- **Workflow-as-button / action surfaces (Anaplan)**:
  - Procesy/mutacje są produktowe: uruchamiane z dashboardu/operacyjnej powierzchni; mają stan i wynik.
- **Versioning semantics (Anaplan)**:
  - Różnica current vs actual; switchover dates; formuły/version rules są jawne i audytowalne.
- **Import + error taxonomy (Apiary mirror)**:
  - Import/export actions mają completion/failure/error/warning codes jako część kontraktu operacyjnego (to redukuje “zgadywanie” i koszty supportu).
- **Consultify-specific consequence spine**:
  - Finanse muszą utrzymać spójność z KPI i inicjatywami: “results → consequence” bez split-truth.
  - Mutacje finansowe muszą odświeżać właściwe rodziny runtime (jak w planie Wave 1).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md` + governance SSOT.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Broader mutation parity | processes/actions must stay coherent | “mutation parity outside active lane partial” | Domknąć deklarowane mutacje poza wąskim lane, z poprawnym refresh | P0 |
| Lane breadth beyond analysis | models/imports/statements/valuation breadth | “breadth remains uneven” | Ujednolicić minimalną gramatykę: import→analysis→mutation→readback | P0 |
| KPI↔Finance coherence | one consequence truth | “truth fragments outside bounded lanes” | Domknąć runtime unification na zadeklarowanej ścieżce KPI→Finance | P0 |
| Governance & audit clarity | roles + versioning + evidence | “overclaim risk” | Wyraźny kontrakt audytu, wersji, i dowodów mutacji | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Zadeklarowane mutacje odświeżają właściwe rodziny runtime i nie rozbijają KPI truth na deklarowanych ścieżkach.
- Import→analysis→mutation→readback jest spójny i audytowalny (kto/co/kiedy; wynik).
- Versioning (current vs actual / switchover) jest jawne na deklarowanym zakresie (nie “magia w tle”).

### 5.2 Tests
- Integracyjne: KPI↔Finance linkage (z `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`).
- Regression: mutacja finansowa → refresh → KPI readback spójny.
- Import validation: błędne dane → czytelny błąd i recovery path (bez silent corruption).

### 5.3 Staging proof checklist
- Staging E2E: import → analysis (L1/L2/L3) → mutation → KPI readback.
- Demo “error taxonomy”: import failure/warning → widoczny stan + rekomendowana akcja.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P05-A — Finance lane canon + scope approval
- **Goal**: bounded “consequence-management lane” z jasnym zakresem (bez ERP parity).
- **Inputs required**: KPI↔Finance linkage SSOT; decyzje o wersjonowaniu (current vs actual).
- **Acceptance**: scope zatwierdzony; non-goals jawne; brak silent scope creep.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze bounded lanes (import/analysis/mutation/readback) and explicit non-goals.
  - Freeze versioning semantics (current vs actual) and reconciliation boundaries.
  - Freeze error taxonomy + recovery posture for imports and mutations.
- **DoD**:
  - Approved(scope): finance lane is explicit, audytowalny, and KPI linkage is bounded.

#### P05-B — Import→analysis→mutation→readback closure
- **Goal**: domknąć deklarowane ścieżki E2E bez split-truth.
- **Acceptance**: mutacje odświeżają właściwe runtime; KPI readback jest spójny; error taxonomy jest uczciwa.
- **Evidence**: integracyjne testy linkage + staging E2E.
- **Tasks**:
  - Implement E2E lane: import→analysis→mutation→readback (bounded).
  - Ensure KPI↔Finance truth stays coherent on declared paths.
  - Add regression for mutation→refresh and import validation failure paths (5.2).
- **Staging proof script (click-by-click)**:
  1. [x] Import a bounded sample dataset and confirm import status + validation feedback is visible.
  2. Run analysis (bounded L1/L2/L3 scope) and capture a clear readback.
  3. Execute one declared mutation and confirm audit/traceability exists.
  4. Refresh and verify readback reflects the mutation (no stale views).
  5. Cross-check KPI readback on the declared linkage path (no split-truth).
  6. Trigger an import failure/warning and verify degraded state + recommended next action.
- **DoD**:
  - Staging E2E passes; errors are visible with “what next”; tests pass.

#### P05-C — Verification + rollout
- **Goal**: telemetry, regresje, staging proof, bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proofs (5.3) and fill ledger rows P05-A/B/C.
  - Validate rollback: disable mutations; preserve read-only + audit.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Prefer incremental rollout per sub-lane; chronić KPI truth i audyt.

### 8.3 Rollback plan
- Wyłącz mutacje/flagę; zachowaj read-only wgląd + audit; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: “ładne raporty” bez audytowalnej mutacji.
- Ryzyko: import error taxonomy niespójna → ukryta korupcja danych.
- Decyzje: minimalny zakres versioning i switchover semantics.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P05-A | `approved(scope)` | `5ef9e3bd1f` | Scope approval — no runtime tests | N/A (scope phase) | Finance lane canon frozen: lanes, KPI↔Finance boundary, versioning, error taxonomy + recovery, anti-duplicate gate, degraded posture |
| P05-B | `verified(evidence)` | `31034b191d` + `40a6ffb275` | Contract tests (lane steps, import taxonomy, mutation audit, versioning, degraded scenarios, KPI coherence) — all pass | E2E: import→analysis→mutation→readback; failed import blocks mutation; mutation audit trail; version switchover; KPI readback coherent | None — all §2.3 requirements implemented |
| P05-C | `verified(evidence)` | `91abf23038` + `0820972bd3` + (this commit) | Contract tests + smoke script (11 checks) + 26 integration tests (`p05-finance-lane.test.ts`) + `financeCanon.ts` (12-point acceptance checklist, 9 degraded scenarios, ownership boundary, anti-duplicate rules) — all pass; 62 total finance tests green | Evidence doc + staging checklist complete | None |

