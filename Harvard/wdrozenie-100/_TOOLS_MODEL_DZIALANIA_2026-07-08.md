# Model działania narzędzi Tools — specyfikacja (2026-07-08)

**Cel dokumentu:** precyzyjnie opisać JAK działają narzędzia konsultingowe Consultify — od otwarcia sesji do wygenerowanego insightu — oraz jak 11 nowo zbudowanych silników wpina się w istniejący runtime. To SSOT operacyjny (uzupełnia doktryny per-narzędzie w `_TOOLS_DOKTRYNA/`).

## 0. Zasada nadrzędna (dlaczego te narzędzia istnieją)
Narzędzie NIE jest formularzem ani generatorem treści. Jest **ustrukturyzowanym sposobem myślenia**, który zamienia surową sytuację klienta w **autentyczne OBSERWACJE** i **INSIGHTY** — a insight jest w Consultify **głównym nośnikiem transformacji** (zasila inicjatywy, podsumowania, rezultaty). Każde ogniwo runtime jest podporządkowane jednemu pytaniu: **„co z tego WYNIKA dla tej organizacji?"** — nie „jakie dane zebraliśmy".

## 1. Przepływ end-to-end (7 ogniw)
```
[1] Wybór narzędzia (/discovery-tools)
      → tworzy tool_session (org, tool_type, status=DRAFT)
[2] Sesja prowadzona DRABINĄ POGŁĘBIEŃ (deepeningLadder)
      → narzędzie zadaje pytania warstwami (surface→dowód→dekompozycja),
        rozgałęzia wg odpowiedzi; NIE ankieta, lecz wywiad partnera
[3] Wypełnianie sekcji + AI-SUGESTIE (useToolAI.requestSuggestions)
      → operationalTool/promptRegistry proponuje 3-6 konkretnych pozycji per sekcja
        (nigdy nie nadpisuje po cichu — propose, użytkownik akceptuje)
[4] SILNIK DETERMINISTYCZNY (config/{tool}/{tool}Engine.ts)
      → z sekcji liczy TWARDE metryki metodyki (np. PCE, constraint, payback,
        value-at-stake, TIME-quadrant) — bez LLM, powtarzalnie
[5] KONKLUZJA INSIGHT-FIRST (conclusionPrompts.build{Tool}ConclusionPrompt)
      → prompt ugruntowany w wyjściu silnika → LLM (/ai/chat/stream, premium tier)
        produkuje: werdykt → dowód → CO TO ZNACZY → inicjatywa
[6] OBSERWACJE + INSIGHTY (summary/conclusions w tool_session)
      → zapisane jako konkluzje kandydackie; widoczne, oceniane
[7] TRANSFORMACJA: insight → inicjatywa (GenerateInitiativesModal),
        → Presentation Studio (source pack), → podsumowania organizacji
```

## 2. Architektura (gdzie co żyje)
| Warstwa | Plik/moduł | Rola |
|---|---|---|
| Rejestr narzędzi | `src/store/useToolStore.ts` (30 ToolType) | typy, stan sesji, sekcje, steps |
| Treść metodyki | `src/config/{tool}/deepeningLadder.ts` | drabina pytań + bank propozycji PL/EN |
| Silnik domenowy | `src/config/{tool}/{tool}Engine.ts` | deterministyczne metryki + `to{Tool}Session(sections)` adapter |
| Konkluzja | `src/config/{tool}/conclusionPrompts.ts` | `build{Tool}ConclusionPrompt(session, isPolish)` insight-first |
| Runtime AI | `src/hooks/discovery/useToolAI.ts` | dispatcher: suggestions / fullSession / summary / rethink |
| Rejestr promptów | `src/hooks/discovery/toolAi/promptRegistry.ts` | routing toolType→prompt (suggestion + grounded conclusion) |
| Handler operacyjny | `src/hooks/discovery/toolAi/operationalTool.ts` | generyczny build sesji/summary dla narzędzi operacyjnych |
| LLM | `/ai/chat/stream` (ten sam endpoint co Teresa) | premium→budget fallback tier |
| Wyjście | `GenerateInitiativesModal`, `presentationGeneratorService` (tool_session jako source) | insight→inicjatywa/deck |

## 3. Trzy klasy narzędzi (parytet silnika)
- **Strategiczne PEŁNE (10):** dedykowany handler w `toolAi/` (dynamicSwot, marketForces…) + bogaty per-step suggestion + faza correlations/synthesis. Najgłębsze.
- **Operacyjne PEŁNE (9 + 11 nowych = 20):** wspólny `operationalTool.ts` (suggestion generyczny) ALE własny `config/{tool}/` (drabina + silnik + grounded conclusion) + członkostwo w `OPERATIONAL_AI_TOOLS` (daje `generateFullSession` + `rethinkCard`). **Tu wpinamy 11 nowych.**
- **Szkielet (0 po tym programie):** brak config → tylko generyczny prompt. Cel programu: zero szkieletów.

## 4. Wpięcie 11 nowych silników (central wiring — sesja główna)
Per narzędzie, 3 punkty (poza `config/{tool}/`):
1. `promptRegistry.ts` — import `{ build{Tool}ConclusionPrompt, to{Tool}Session } from '@/config/{tool}'` + branch w `getToolSummaryPrompt`: `if (toolType==='{tool-type}') return build{Tool}ConclusionPrompt(to{Tool}Session(op?.sections), isPolish)`.
2. `useToolAI.ts` — dodać `'{tool-type}'` do `OPERATIONAL_AI_TOOLS` (Draft Session + Rethink).
3. (Suggestion działa generycznie przez `OPERATIONAL_TOOL_TYPES` — bez per-tool pracy.)

## 5. Silnik → insight per narzędzie (co liczy, co z tego wynika)
| Narzędzie | Silnik liczy (deterministycznie) | Insight (co WYNIKA) |
|---|---|---|
| vsm-builder | PCE, prawdziwe wąskie gardło (kolejki), 7 muda | „80% lead time w N krokach; ukryta fabryka przeróbek = Y FTE-dni" |
| constraint-control | constraint (przepustowość vs popyt), T/I/OE | „godzina na constraincie = godzina systemu; usprawnienie poza nim = iluzja" |
| decision-engine | 6 ogniw DQ, wrażliwość (co przełącza) | „prawdziwy trade-off X vs Y; rekomendacja odwraca się przy Z" |
| control-tower | dojrzałość, detection lag, martwe pola | „łańcuch ślepy w punkcie X; zakłócenie wykrywane za późno o Y dni" |
| automation-pipeline | dobór tech (RPA/IDP/AI), effort×impact | „proces X = kandydat #1; automatyzujemy chaos → napraw najpierw" |
| robotics-feasibility | bramka techniczna+ekonomiczna, payback | „payback Y mies przy 2 zmianach; zmienność → hybryda" |
| logistics-automation | 5 stref, re-slotting, sezonowość, payback | „58% czasu pickerów = chodzenie; automatyzacja bez re-slottingu = utrwalenie" |
| integration-diagnostic | topologia n(n-1)/2, re-keying 1-10-100 | „N mostków = M FTE-h/mies; system X = kruchy hub" |
| digital-value-pool | value-at-stake impact×feasibility, 80/20 | „80% wartości w funkcji X; use-case Y = pilot bez skali" |
| legacy-analyzer | macierz TIME, dług %budżetu IT, bus factor | „system X: migruj przed końcem wsparcia; 30% budżetu w app do wygaszenia" |
| data-inventory | jakość 8 wymiarów DAMA, governance, dark data | „domena X: jakość 40% = blokada AI; 60% dark data bez właściciela" |

## 6. Kontrakt jakości (gate insightu)
Każda konkluzja MUSI: (a) być answer-first (werdykt na górze), (b) opierać liczby na wyjściu silnika (nie fabrykować), (c) zawierać ogniwo „co to znaczy dla TEJ organizacji", (d) kończyć się wykonalną inicjatywą z właścicielem. To ten sam standard, który panel sceptyków BCG egzekwuje na projekcie DBR77.
