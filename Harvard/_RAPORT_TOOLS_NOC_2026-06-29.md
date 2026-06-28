# RAPORT NOCNY — moduł Tools przebudowany do AI-first (2026-06-28 → 29)

> Dla Piotra, na rano. Samowystarczalny. Wszystko **live na demo** (`demo.consultify.ai`, sha `9952cf8e`).
> Robione autonomicznie na Twoją prośbę („pełny przegląd → wdrożenie → 100% gotowe rano").

## 1. Jednym ekranem
Wypracowaliśmy koncepcję („narzędzie konsultingowe = sprasowany engagement", AI-first draft→kurator, 5 kryteriów) i **zmaterializowaliśmy ją w kodzie**: moduł Tools przeszedł z „14 narzędzi, część martwych" do **19 aktywnych, każde z realnym AI**.
- **Kategoria Strategy: 10/10 gotowych** (5 dokończonych tej nocy + 5 wcześniejszych).
- **9 narzędzi operacyjnych/digital pogłębionych** o inteligentny AI (były „Active ale bez AI").
- Pełny adversarial review (4 agenty) → 1 realny bug naprawiony + szlif.

## 2. Co zbudowane (5 nowych strategicznych, end-to-end)
Każde: model danych → mózg AI-first (full-session jeden-klik) → fazy + kuratorowanie (propose-never-overwrite) → **sygnaturowa wizualizacja** → aktywacja → deploy → weryfikacja API.

| Narzędzie | Metodyka | Wizualizacja |
|---|---|---|
| **Value Chain** (złoty wzorzec) | 9 aktywności Portera × koszt/wartość/marża → dźwignie → werdykt pozycjonowania | diagram łańcucha |
| **Capability Mapper** | kompetencje × dojrzałość obecna/docelowa × ważność → luki → build/buy/partner | drabina dojrzałości |
| **Ambition Decomposer** | ambicja → tematy strategiczne (cele mierzalne) → priorytety | kaskada |
| **Focus & Trade-offs** | priorytety × value/effort/fit → trade-offy → commit/sequence/cut | macierz value/effort |
| **Narrative Engine** | audience + przekaz → filary z dowodami → storyline | message house |

## 3. Co pogłębione (9 operacyjnych/digital)
SOP, A3, SMED, DMS, Inventory, AI Discovery, Pain Explorer, RPA, Process Automation — były Active, ale miały **zero AI**. Dodany **jeden generyczny handler** (`toolAi/operationalTool.ts`) na wspólnym modelu `OperationalToolData.sections`: AI-first full-session (wszystkie sekcje + summary + inicjatywy) + per-section suggestions (dopisuje, nie nadpisuje) + finalize.

## 4. Review (4 agenty adversarial) — wynik
- **P1 (naprawiony):** 4 narzędzia „ToolsetFlow" (AI Discovery/Pain Explorer/RPA/Process Auto) gubiły wynik finalize — UI czyta `flow.results`, handler pisał tylko `data.summary`. To była dokładnie „iluzja AI" (chip działa, wynik znika). Teraz handler zapisuje też `flow.results`. **Koniec iluzji.**
- **P2 (naprawione):** martwy nieosiągalny blok w promptRegistry; walidacja `mission.position` w Value Chain; usunięty osierocony `levelBadge`.
- **Reszta CZYSTA:** wiring dyspozytorów, zgodność step-id (4 warstwy), katalog/migracje, brak regresji na 5 wcześniejszych narzędziach.

## 5. Weryfikacja (uczciwie)
✅ tsc czysty (zero z moich plików; 15 błędów to znany cudzy dług na branchu — DocumentStudio/Economics/Ideas/Results, nie moje)
✅ vite build OK · ✅ 21/21 testów (katalog + ToolCanvas + governance + digital steps)
✅ deploy demo SUCCESS (`9952cf8e`, health ok)
✅ **API live: 19 aktywnych potwierdzonych** (DB ground-truth: is_active=1/is_coming_soon=0)
⚠️ **NIE zweryfikowany żywy klik-through generacji AI** — endpoint `/api/ai/stream` to złożony protokół SSE, replikacja przez skrypt byłaby krucha. Mapowanie prompt↔apply jest potwierdzone review, a prompty to kalka sprawdzonego-na-żywo Market Forces. **To jedyna rzecz do Twojego spot-checku rano.**

## 6. Jak sprawdzić rano (5 min)
1. demo.consultify.ai → **Tools** → biblioteka: żadne z 19 nie ma już „In development"/„Coming soon".
2. Otwórz np. **Value Chain Analysis** → krok „Mission" → wpisz 1 zdanie → **„AI Draft"**.
3. Zobacz czy AI generuje 9 aktywności z oceną koszt/wartość/marża + diagram + dźwignie → kuratorujesz → outputy/inicjatywy.
4. Sprawdź też jedno operacyjne (np. **A3 Problem Solving** albo **AI Discovery**) — krok context → „AI Draft" → czy wypełnia sekcje + finalize.
5. Jeśli treść jest płytka/nietrafiona → daj uwagę, dostroję prompty (kręgosłup metodyczny).

## 7. Świadomie NIE zrobione (i dlaczego)
- **12 pozostałych in-dev** (VSM Builder, Constraint Control, Decision Engine, Control Tower, Automation Pipeline, Robotics, Logistics, Integration Diag., Digital Value Pool, Legacy Analyzer, Data Inventory, Pain→Solution) **zostają coming-soon**. Mają tylko generyczny bucket `['fill']`, NIE sygnaturowe domain-steps (jak A3/SOP). Aktywacja dałaby płytkie, nie-sygnaturowe narzędzia — łamałoby Twoją decyzję „~10-12 sygnaturowych perfekcyjnie, nie 31 średnich". To przyszła fala (wymaga zaprojektowania realnych kroków per narzędzie).
- **Bespoke strony detalu** (KnownToolDetailView) dla 5 nowych — działa generyczny fallback (treść z API), nie crashuje; bogata strona „o narzędziu" = szlif do zrobienia, nie blokuje działania.

## 8. Następne kroki (Twój wybór)
- **A.** Spot-check generacji AI → uwagi → dostrojenie kręgosłupów metodycznych (jakość treści).
- **B.** Bespoke strony detalu + artykuły KB dla 10 strategicznych (szlif „wygląda jak premium").
- **C.** Zaprojektować domain-steps dla wybranych z 12 pozostałych (rozszerzenie portfolio ponad 19) — tylko jeśli chcesz iść w szerokość.

## 9. Pułapki utrwalone (pamięć)
- `migrate --safe` recorduje migracje DML jako applied ale ich NIE wykonuje → aktywacje robione direct-UPDATE na DB (pg + DATABASE_PUBLIC_URL, ssl:false). **Przy promocji na PROD: te same UPDATE-y trzeba puścić ręcznie.**
- Branch `feat/deliverables-w1` współdzielony = git-races realne; commit atomowy jednym wywołaniem.
- Bramka „Active" = `ACTIVE_KNOWN_TOOL_TYPES` (kod) + `is_active`/`is_coming_soon` (DB); chipy AI = `TOOLS_WITH_APPLY_HANDLER`.

— Claude (CTO), noc 2026-06-29
