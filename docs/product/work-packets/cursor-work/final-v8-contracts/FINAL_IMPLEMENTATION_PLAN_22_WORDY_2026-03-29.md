# Final Implementation Contract — Wordy (Position 22/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: missing input (KIMI reference required) + missing dedicated plan

## 1. Executive summary
- **Intent**: 100% KIMI: split-screen chat↔word; generuj/edytuj; zapis do Outputs opcjonalny; zero zgadywania bez referencji KIMI.
- **Primary users**: użytkownicy pracujący w trybie chat+document.
- **Success metric**: dokładne zachowanie KIMI split-screen (akcje, stany, skróty, model edycji) odwzorowane na podstawie referencji, nie interpretacji.

## 2. Scope
### 2.1 In-scope
- Split-screen chat↔word jako pierwszoplanowy model pracy.
- Generacja i edycja dokumentu jako artefaktu z traceability (jeśli zapis do Outputs) lub jako sesji (jeśli „opcjonalny zapis”).

### 2.2 Out-of-scope / non-goals
- Zgadywanie zachowania KIMI lub „robimy podobnie”.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Related (shared) plans:
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: `KIMI` — **missing input**: brak zlinkowanego pakietu referencyjnego opisującego „100% KIMI style”.
- **Secondary**: brak jawnie zdistylowanego benchmarku „AI word editor split-screen” w repo (**missing input**).

## 5. Evidence plan (DoD)
- Evidence wymagane: referencje KIMI + nagrany staging proof „split-screen workflow end-to-end” + testy dla kluczowych akcji i persistence.

