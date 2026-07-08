# Asystent Assessment (SIRI/ADMA/DRD) — audyt + plan pogłębienia insightów (07-08)

**Cel (doktryna Consultify):** coach ma NIE opisywać score'ów, lecz generować **autentyczne OBSERWACJE + INSIGHTY** = „co to znaczy dla transformacji TEJ organizacji". CMMI/LEAN pominięte.

## Stan realny (audyt) — fragmentacja + martwy kod
Nie ma jednego coacha; ≥5 słabo powiązanych podsystemów:
- `src/services/assessmentCoach.ts` (697 l.) — state-machine kickoff→score→summary → **MARTWY** (0 wywołań w src/). Ma gotowe `RELATED_DIMENSIONS` (cross-dim zależności!) do reużycia.
- `src/services/assessmentEvidence.ts` (574 l.) — evidence-gate → **MARTWY**.
- `assessmentGuidanceService.ts`+`Runtime.ts` — per-pytanie why/level/canon, insight-first (filler-rejection, org-context), platformowy LLM. **Wpięty TYLKO w `DRDAssessmentEditor.tsx:1687`; SIRI/ADMA editory = ZERO AI wiring** (choć serwis je obsługuje).
- `AIAssessmentSidebar.tsx`+`useAssessmentAI.ts`→`aiAssessmentPartnerService.ts` — **DRD-only** (`DRD_AXES` hardcoded), montowany globalnie w `FullAssessmentView.tsx:314` → dla SIRI/ADMA cicho `{error:'Invalid axis ID'}`. Używa **Gemini-direct** (omija platformowy tier system → prawdopodobnie permanentny fallback na demo, patrz [[finding_demo_llm_tier_glm_flaky_2026-07-07]]).
- `assessmentInitiativeService.ts` (800 l.) — żywy, platformowy LLM, ale konsumuje surowy JSON score'ów, **NIE conclusion modele** (podwójna praca).
- `src/services/report/{siri,adma,drd}Conclusion.ts` — deterministyczny insight „co jest→co znaczy→co robić→efekt", ale WYŁĄCZNIE w raporcie (`*ReportTemplate`), nie w sesji.

**Jakość insightu per model:** in-session DRD najsilniejszy (ma guidance+sidebar), SIRI/ADMA zero. W conclusion: **ADMA>SIRI>DRD** (ADMA ma cross-dim `buildFoFRoad`; DRD ma JEDNO identyczne `whatItMeans` dla 7 osi — `drdConclusion.ts:278-280`).

## Plan 6 zmian (kolejność wg dźwigni/ryzyka)
1. **[WSPÓLNE] Zmiana 2 — wpiąć guidance w SIRI/ADMA editory** (`SIRIAssessmentEditor.tsx`, `ADMAAssessmentEditor.tsx`, wzór `DRDAssessmentEditor.tsx:1687 requestGuidance`). Serwis JUŻ obsługuje siri/adma — to okablowanie, nie nowy silnik. Najniższe ryzyko, usuwa asymetrię. **← START.**
2. **[PER-MODEL DRD/ADMA] Zmiana 5 — naprawić rozjazd kluczy** `whyThisMatters.ts:85-102` (`strategy/data/technology/people`) vs realne `ADMA_PILLARS` (`strategy/smart_products/smart_operations/smart_supply/data_driven`) → dziś cicho pada na GENERIC. Drobna, jednoznaczna naprawa.
3. **[WSPÓLNE] Zmiana 1 — initiative gen czyta conclusion model** (`assessmentInitiativeService.ts:~287 buildPrompt`): wstrzyknąć `executiveSummary.k2_meaning`+`gapCards[].whatItMeans` zamiast gołego JSON. Wymaga portu conclusion build\erów na backend (dziś front-only). Najdźwigniowsza.
4. **[PER-MODEL DRD] Zmiana 4 — zróżnicować `whatItMeans`** (`drdConclusion.ts:278-280`) + `ownerForAxis()` (wzór SIRI/ADMA) z bogatego `drdKnowledgeOverridesAxis*` (dziś tylko w guidance).
5. **[WSPÓLNE] Zmiana 3 — cross-dimension „so-what"** w `siriConclusion.ts`/`drdConclusion.ts` (wzór ADMA `buildFoFRoad`); reużyć `RELATED_DIMENSIONS` z martwego `assessmentCoach.ts:121-143`.
6. **[WSPÓLNE] Zmiana 6 — scalić Gemini-direct z platformowym LLM** (`aiAssessmentPartnerService.ts`) + rozszerzyć na SIRI/ADMA axis maps, albo tymczasowo ukryć sidebar dla SIRI/ADMA (koniec cichych błędów). Największy zakres — po 1-5.

**Higiena:** zmiany 4/6 dotykają UI/raportu → gate wizualny Piotra (zrzuty). Zmiana 2/5 = wiring/bugfix (bezpieczne). Wszystko na `feat/tools-assessment-dbr77`, esbuild+tsc, zero deploy.
