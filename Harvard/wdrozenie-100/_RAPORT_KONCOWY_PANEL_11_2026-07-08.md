# Raport końcowy — panel 3-specjalistów, 11 narzędzi Tools (2026-07-08)

**Wynik: 11/11 DONE (średnia ≥5,5/6).** Harness A regresyjny: **12/12 PASS** (zweryfikowane niezależnie, `npx tsx src/config/__toolsEngineHarnessA.mts` na żywym HEAD worktree). Worktree czysty, zero push/deploy/zapisu do bazy demo przez cały proces.

## Tabela finalna

| Narzędzie | Runda | A | B | C | Średnia | Rund do DONE |
|---|---|---|---|---|---|---|
| vsm-builder | 2 | 5,5 | 5,5 | 5,5 | 5,5 | 2 |
| constraint-control | 2 | 5,5 | 5,5 | 6 | 5,67 | 2 |
| control-tower | 2 | 6 | 6 | 5 | 5,67 | 2 |
| automation-pipeline | 2 | 5,5 | 5,5 | 6 | 5,67 | 2 |
| robotics-feasibility | 2 | 5,5 | 5,5 | 5,5 | 5,5 | 2 |
| logistics-automation | 2 | 5,5 | 5,5 | 5,5 | 5,5 | 2 |
| integration-diagnostic | 2 | 5,5 | 5,5 | 6 | 5,67 | 2 |
| data-inventory | 2 | 5,5 | 5,5 | 6 | 5,67 | 2 |
| decision-engine | 2 | 5,5 | 5,5 | 5,5 | 5,5 | 2 |
| digital-value-pool | 2 | 5,5 | 6 | 5,5 | 5,67 | 2 |
| legacy-analyzer | 2 | 6 | 5,5 | 6 | 5,83 | 2 |

Wszystkie 11 domknęły się w **jednej rundzie naprawy** (runda 1 = panel diagnostyczny, runda 2 = fix + self-re-panel sceptyczny). Żadne nie utknęło poniżej progu.

## Metodyka zastosowana

1. **Model do zadania dopasowany do trudności**: A (Merytoryka) i B (Ścieżka pracy z klientem) — opus, zadania oceny doktryny/UX wymagające osądu domenowego. C (Prezentacja/code-review-proxy) — haiku, zadanie mechaniczne (grep crimson, kompletność etykiet PL/EN, spójność struktury). Fix-workerzy — opus (naprawa kodu + samodzielny re-panel sceptyczny).
2. **Weryfikacja realnego runtime, nie tylko "harness przeszedł"** — każdy fix-agent budował skrypty probe odpalające `synthesize*Plan`/silnik na żywo i drukujące liczby, zanim uznał naprawę za potwierdzoną (zgodnie ze złotą regułą projektu).
3. **Higiena współdzielonego worktree**: 7-10 agentów commitowało równolegle w tym samym worktree `consultify-wt/tools-assessment-dbr77`. Kolizje na wspólnym pliku `src/hooks/discovery/toolAi/promptRegistry.ts` (edytowanym przez ~7 agentów naprawiających różne narzędzia) rozwiązywane przez świeży odczyt przed edycją; 2 udokumentowane przypadki, gdzie zmiana jednego agenta trafiła pod commit innego (nie utracona, tylko błędna atrybucja — zweryfikowane że kod jest na gałęzi i harness go widzi).

## Odkrycie systemowe #1 — audyt 11 dokumentów doktryny

Równolegle z panelem code-review przeprowadzono niezależny audyt 11 dokumentów `_TOOLS_DOKTRYNA/*.md` (bez porównania z kodem) pod kątem: kompletność / poprawność metodyczna / kodowalność. Wynik: **11/11 WYMAGA UZUPEŁNIEŃ** — poprawność metodyczna wzorowa (5-6/6) wszędzie, ale kodowalność systemowo słaba (2-3/6): brak drabiny pogłębiającej, brak wzorów agregacji/progów, brak formalnego schematu danych, insighty jako przykłady zamiast predykatów. Szczegóły: `_AUDYT_DOKTRYN_11_NARZEDZI_2026-07-08.md`. To osobny, nieukończony wątek — dokumenty doktryny pozostają dobrym briefem dla warstwy LLM, ale wymagałyby osobnej fali pracy, gdyby miały służyć jako w pełni deterministyczna specyfikacja inżynierska.

## Odkrycie systemowe #2 — drabina pogłębiająca martwa w runtime (9 z 11 narzędzi)

Każdy silnik ma dobrze napisaną `deepeningLadder.ts` (progresja pytań surface→evidence→quantification→risk-capability), ale jej jedyny konsument (`build{Tool}DeepenPrompt`) nie miał ŻADNEGO callera w `promptRegistry.ts` — podpięte było tylko dla A3/SOP. Odkryto dodatkowo, że **sam wzorzec A3/SOP jest martwy dla narzędzi operacyjnych** (leży po early-return bloku `OPERATIONAL_TOOL_TYPES`) — pierwszy agent (logistics-automation) to wykrył i znalazł działające obejście (wpięcie w osiągalny blok operacyjny), a kolejnych 8 agentów powtórzyło ten sam wzorzec niezależnie, każdy weryfikując runtime. Efekt uboczny: `{TOOL}_PROPOSAL_BANK` (100-230 linii partnerskiej treści na narzędzie) było wszędzie martwym kodem — teraz podpięte.

## Odkrycie systemowe #3 — silnik głodzony przez authoring AI (decision-engine, digital-value-pool)

Głębsza przyczyna wspólna dla obu: warstwa AI-authoring (generyczny generator kroków operacyjnych) nie emitowała pól strukturalnych, które silnik realnie czyta (`scores`, `low/base/high`, flagi bramki, `benchmarkShare`, `captureRate` itd.) — `parseItems`/adapter obcinały wszystko poza sztywnym, wąskim schematem `OperationalItem`. Skutek w żywej sesji: kluczowe mechanizmy (tornado/robustness w decision-engine, `valueAtStake` w digital-value-pool) zawsze zwracały wartości domyślne/zerowe, niezależnie od jakości silnika. Naprawiono rozszerzeniem schematu + dedykowanym promptem sekcyjnym instruującym AI co emitować.

## Co zostało (nie blokuje DONE, do ew. rundy 3 jeśli Piotr zdecyduje)

- `const VALID` zahardkodowane w auto-sekwencji kilku narzędzi (rodzinny smell, część już naprawiona: automation-pipeline, constraint-control, vsm-builder).
- Kilka drobnych heurystyk oznaczonych jako "rozsądne, ale doktryna nie precyzuje" (np. capture-rate default 0,4 w digital-value-pool, next-support-window 18mies. w legacy-analyzer) — kandydaci do formalizacji, gdyby doktryna została uzupełniona (patrz odkrycie #1).
- `errorRisk`/podobne miary liczone na obu osiach impact+risk w automation-pipeline — obronne, warte odciążenia.
- Realny UI/wizualny odbiór (kroki, kolory, dark/light) — **NIE zrobiony w tej fali** (to była ocena silnika/kodu, nie realny UI). Zgodnie z regułą projektu: odbiór wizualny = Piotr osobno, na zrzutach.

## Zero deploy

Cała praca w worktree `consultify-wt/tools-assessment-dbr77`, branch `feat/tools-assessment-dbr77`, baza `origin/Londyn`. Zero push, zero deploy, zero zapisu do bazy demo. Decyzja o promocji na demo — osobna, wymaga akceptacji Piotra na zrzutach zgodnie z `consultify-promocja-demo`.
