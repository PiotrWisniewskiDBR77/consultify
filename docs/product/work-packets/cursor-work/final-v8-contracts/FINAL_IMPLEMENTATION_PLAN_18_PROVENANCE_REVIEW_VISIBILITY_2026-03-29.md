# Final Implementation Contract — Provenance / review / visibility (Position 18/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Pełne traceability myśli i kontekstu (trust grammar artefaktów).
- **Primary users**: konsumenci artefaktów, reviewerzy, operatorzy.
- **Success metric**: każdy artefakt odpowiada: skąd, jaki run, jaki stage, kto widzi, kto review’uje, co exportowano — spójnie na wszystkich powierzchniach.

## 2. Scope
### 2.1 In-scope
- Trust grammar: source/run/version lineage; review + validation; visibility + access; export trace.
- Konsystencja sygnałów w `Outputs Library` i preview/open.

### 2.2 Out-of-scope / non-goals
- Global redesign całego permissions systemu.
- Zlanie run approval z artifact review.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md`
- Module card: `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PROVENANCE_REVIEW_VISIBILITY.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu definiuje benchmark jako: **enterprise lineage, review, and visibility systems** (audytowalna prawda artefaktów) (`WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Claude (citations as verifiable evidence pointers)**:
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/cookbook/misc-using-citations.html` (citations: answer→źródła; affordance do weryfikacji).
- **LangSmith (traces/observability as an audit surface)**:
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/share-trace.html` (share trace: trace jako artefakt do wglądu).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/observability.html` (observability: śledzenie runów i zachowania agentów).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/administration-overview.html` (administration: governance posture dla wglądu).
- **OpenAI (agent/tool posture → audyt i approvals)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/agents.html` (Agents resources: agent runs jako “first-class”).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/tools.html` (Tools: tool calls jako część kontraktu).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/agent-approvals-security.html` (approvals/security: zasady bezpiecznego wykonywania).
- **Palantir Foundry (lineage as interactive workspace)**:
  - `Softs/Palantir/www.palantir.com/docs/foundry/workflow-lineage.html` (Workflow Lineage overview: “graph of provenance”, debugging/maintenance; access controls).
  - `Softs/Palantir/www.palantir.com/docs/foundry/data-lineage/explore-lineage.html` (Data Lineage: end-to-end view; eksploracja lineage).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “artefakt ma audytowalną prawdę na każdej powierzchni”, nie “pełny enterprise IAM redesign”.**

- **Evidence pointers (Claude citations posture)**:
  - “Dlaczego tak mówimy” ma mieć wskazania źródeł (albo jawne ograniczenie), nie tylko badge “AI”.
- **Run traceability (LangSmith traces posture)**:
  - Każdy artefakt ma link do runu: inputs → tool calls → outputs → errors/warnings.
- **Approval separation (OpenAI approvals posture + Wave2 doctrine)**:
  - Approval(run) jest osobną osią od review(artifact); UI i data model nie mogą ich zlewać.
- **Lineage as explorable graph (Palantir lineage)**:
  - Użytkownik może “prześledzić pochodzenie” (provenance) i zrozumieć zależności; nie tylko statyczny “created by”.
- **Visibility/export truth**:
  - Kto widzi, co można exportować, i co zostało wyeksportowane jest częścią trust grammar (z audytem).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` + `WAVE2_GAP_BACKLOG_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Exposure consistency | same truth everywhere | “exposure uneven across surfaces” | Ujednolicić trust-state w Library + Preview + Export surfaces | P0 |
| Stage clarity | validation vs review clear | “stages not packaged clearly enough” | Domknąć stage language i badges (validation/review/ready) | P0 |
| Traceability depth | run→tool→output visible | “grammar risks lagging doctrine” | Pokazać run lineage + tool calls + evidence pointers jako first-class | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Trust-state jest widoczny i niesprzeczny (library + preview + export history + access); stage separation jest jasna.
- Każdy artefakt ma: source + run id + stage + owner/reviewer + visibility/export posture (spójne).
- Approval(run) ≠ review(artifact): brak konfliktów i “podwójnej prawdy”.

### 5.2 Tests
- Integracyjne: ArtifactRun → Outputs Library → Preview → Export → Audit readback.
- Regression: zmiana stage (validated/reviewed) → wszystkie surfaces aktualizują się spójnie.
- Contract tests: trust payload schema (source/run/stage/visibility/export ledger) jest stabilny.

### 5.3 Staging proof checklist
- Demo: artefakt pochodzący z runu ma lineage widoczne i klikalne; citations/evidence pointers tam gdzie dotyczy.
- Demo: export eventy są widoczne (kto/kiedy/co) i nie łamią visibility.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Wave2 SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P18-A — Trust-state canon + exposure consistency (scope approval)
- **Goal**: jedna gramatyka trust-state/stage/visibility spójna w library/preview/export.
- **Inputs required**: schema payload (source/run/stage/visibility/export ledger); stage language.
- **Acceptance**: scope zatwierdzony; approve(run) ≠ review(artifact) jest nienaruszalne.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze trust payload schema (source/run/stage/visibility/export ledger) and mapping to UI badges.
  - Freeze stage language (validation/review/ready) and exposure rules across surfaces.
  - Freeze approval(run) vs review(artifact) invariants.
- **DoD**:
  - Approved(scope): trust-state is consistent by design; stage separation is explicit and testable.

#### P18-B — End-to-end traceability closure
- **Goal**: run→tool→output traceability jako first-class + spójny export audit.
- **Acceptance**: lineage jest klikalne; export event nie łamie visibility; stage separation jest jasna.
- **Evidence**: integracyjne testy + staging demo lineage+export.
- **Tasks**:
  - Implement click-through lineage (run→tool calls→output) as first-class.
  - Implement export audit that respects visibility; add integration/regression tests (5.2).
  - Run staging demos (5.3) and capture evidence.
- **DoD**:
  - Lineage is visible and consistent; exports are audytowalne and do not bypass visibility.

#### P18-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Fill ledger rows P18-A/B/C with commits, test runs, staging proofs.
  - Validate rollback: disable new badges/exports; preserve read-only lineage.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw payload+badges (read surfaces), potem rozszerzenia traceability depth (P1).

### 8.3 Rollback plan
- Wyłącz nowe badges/exports; zachowaj read-only lineage; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: sprzeczna prawda trust-state w różnych surfaces.
- Ryzyko: export omija visibility (compliance issue).
- Decyzje: minimalny zestaw stages i ich mapping do UI.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P18-A |  |  |  |  |  |
| P18-B |  |  |  |  |  |
| P18-C |  |  |  |  |  |

