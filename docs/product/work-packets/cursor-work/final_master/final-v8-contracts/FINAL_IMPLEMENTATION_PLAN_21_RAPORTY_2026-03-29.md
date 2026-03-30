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

