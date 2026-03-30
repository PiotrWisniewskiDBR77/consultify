# Final Implementation Contract — Raporty (Position 21/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; dedicated plan pending extraction)

## 1. Executive summary
- **Intent**: Gamma‑like raporty: template → “zrób raport o … używając template …”.
- **Primary users**: konsultanci/PMO tworzący raporty dla klienta/management.
- **Success metric**: raport jako trwały dokument-artefakt z template-first create, reopen/continue, review/export i traceability.

## 2. Scope
### 2.1 In-scope
- Raporty jako user-facing pozycja odrębna od ogólnego `Documents` (kontrakt zachowania).
- Template-first generation wpięta w artifact family (run→artifact→library).

### 2.2 Out-of-scope / non-goals
- Pełny „reports builder” (to osobna pozycja/ambicja w rodzinie builder).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
- Related: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Raporty są kontraktem “template-first report artifact” opartym o wspólną rodzinę `Documents` + artifact family (`WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` + `WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **KIMI (deep research → long-form report deliverable)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/deep-research.html` (deep research: “breaks down… searches extensively… delivers professional long-form reports”).
  - `Softs/KIMI/Docs/www.kimi.com/en/docs.html` (Docs agent posture: praca na dokumencie jako deliverable).
- **Perplexity (web search + tools + model fallback for availability)**:
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/search/quickstart.html` (Search API: ranked results, domain filtering, content extraction).
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/agent-api/tools.html` (tools: web search / URL fetch / function calling posture).
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/agent-api/model-fallback.html` (model fallback chain: availability + failover posture).
- **Gamma (template-driven generation as a bounded API posture)**:
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/create-from-template.html` (Create from template: template-first generation).
- **PromptingGuide (structure/prompt discipline as an input contract)**:
  - `Softs/0 Prompty/Promptguide.zip :: Promptguide/www.promptingguide.ai/prompts.en.html` (prompt patterns; structured prompting posture).
  - `Softs/0 Prompty/Promptguide.zip :: Promptguide/www.promptingguide.ai/research/rag.en.html` (RAG posture: retrieval + faithfulness risks).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “report as a governed deliverable artifact”, nie “pełny report-builder suite”.**

- **Template-first creation (Gamma + contract intent)**:
  - Raport startuje z template (app template / user template) i ma przewidywalny rezultat.
- **Research + sourced claims posture (KIMI deep research + Perplexity search)**:
  - Jeśli raport zawiera twierdzenia “z internetu”: musi mieć evidence pointers (źródła, linki) i jawne granice (co nie jest zweryfikowane).
  - Web/search jest narzędziem w run planie, nie “magicznie w tle”.
- **Durable identity + reopen/continue (Documents family)**:
  - Raport po wygenerowaniu jest trwałym artefaktem: reopen/continue, wersje, review/export truth.
- **Availability/degraded modes (model fallback posture)**:
  - Przy braku narzędzi/limitach: raport nie “udaje”, tylko pokazuje degraded state i daje fallback (draft bez web).
- **No silent scope merge (Raporty ≠ Wordy)**:
  - Raporty pozostają osobną pozycją produktową (template-driven report lane), nawet jeśli runtime jest współdzielony z `Documents`.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` + `WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per contract) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Template-first UX | template → generate | (wymagane w intencie) | Dopiąć template selection + parameters jako jawny krok przed run | P0 |
| Sourced evidence | sources/citations | (nieudowodnione jako domknięte) | Raport ma evidence pointers i jawne confidence/limits dla części “research” | P0 |
| Continuation & review | reopen/continue + review | shared via Documents | Ujednolicić review/export grammar specyficzną dla raportów (bez builder parity) | P1 |
| Degraded states | failover posture | (niezdefiniowane) | Zdefiniować fallback: no-web / rate-limited / missing sources → bezpieczny draft | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Template-first flow działa; raport jest reopenable; review/export mają ślady; raport jest w Outputs Library.
- Jeśli raport używa web/search: ma sources/evidence pointers (albo jawne ograniczenie).
- Raport nie miesza approval(run) z review(artifact).

### 5.2 Tests
- Integracyjne: template select → plan → approve(run) → report artifact → library → reopen/continue → export → audit.
- Regression: no-web / tool error → raport pokazuje degraded state i daje bezpieczny fallback.
- Contract tests: report artifact payload zawiera template id + sources ledger + export ledger (w deklarowanym zakresie).

### 5.3 Staging proof checklist
- Demo: 2 template’y raportu → wygeneruj → reopen/continue → export; oba w library.
- Demo: report z web sources + report bez web (fallback) → różnice są jawne i nie overclaim.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Wave2 SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P21-A — Report template-first canon + sources posture (scope approval)
- **Goal**: raport jako template-first deliverable z evidence pointers (bounded), bez “doc suite parity”.
- **Inputs required**: template selection + parameters; sources/citations posture; degraded rules (no-web).
- **Acceptance**: scope zatwierdzony; non-goals jawne; approve(run) ≠ review(artifact) spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze template-first flow (select→params→plan→approve) and required template metadata.
  - Freeze sources/citations posture and no-web degraded rules (no overclaim).
  - Freeze convergence with Outputs Library (19) + trust-state (18).
- **DoD**:
  - Approved(scope): template-first + sources posture are explicit and testable.

#### P21-B — Template→plan→approve→artifact→library→continue closure
- **Goal**: E2E flow + reopen/continue + export audit.
- **Acceptance**: no-web fallback jest uczciwy; sources są jawne (albo ograniczenie).
- **Evidence**: integracyjne testy + staging demo 2 template’ów.
- **Tasks**:
  - Implement E2E flow for 2 templates: generate→library→reopen/continue→export (bounded).
  - Implement no-web fallback path with explicit degraded state.
  - Add integration/regression tests (5.2) and run staging demos (5.3).
- **DoD**:
  - Templates produce durable artifacts; sources are visible or explicitly absent; exports audited.

#### P21-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P21-A/B/C.
  - Validate rollback: disable web/search; preserve safe draft generation.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw template-first, potem rozszerzenia sources/degraded (P1) i polish.

### 8.3 Rollback plan
- Wyłącz web/search; zachowaj draft generation; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: raport overclaim bez źródeł.
- Ryzyko: no-web/tool errors bez jawnego degraded.
- Decyzje: minimalny zakres exportów i ich audyt.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P21-A |  |  |  |  |  |
| P21-B |  |  |  |  |  |
| P21-C |  |  |  |  |  |

