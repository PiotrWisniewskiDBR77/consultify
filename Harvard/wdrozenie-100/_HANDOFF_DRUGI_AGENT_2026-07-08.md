# Handoff dla drugiego agenta — panel 3-specjalistów, 11 narzędzi Tools (07-08)

**Czytaj to jako pierwsze. Cel: dociągnąć 11 nowo zbudowanych silników narzędzi consultingowych do jakości ≥5,5/6 (średnia 3 niezależnych recenzentów), pracując SAMODZIELNIE przez najbliższe godziny bez przerywania, aż wszystkie 11 osiągną próg.**

## Gdzie pracujesz
Worktree: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-wt/tools-assessment-dbr77` (gałąź `feat/tools-assessment-dbr77`, baza `origin/Londyn`). **NIE main repo, NIE /private/tmp** (ten drugi ginie między sesjami — lekcja z dzisiejszej nocy, patrz `finding_ephemeral_worktree_loses_uncommitted_between_turns` w pamięci). **ZERO push, ZERO deploy, ZERO zapisu do bazy demo.**

## Co już istnieje (NIE budować od nowa)
- 11 silników: `src/config/{vsmbuilder,constraintcontrol,controltower,automationpipeline,roboticsfeasibility,logisticsautomation,integrationdiagnostic,datainventory,decisionengine,digitalvaluepool,legacyanalyzer}/` — każdy: `deepeningLadder.ts`+`{Tool}Engine.ts`+`conclusionPrompts.ts`+`index.ts`+`steps.ts`+`fixture.ts`.
- 11 doktryn: `Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/{tool}.md` — źródło prawdy metodycznej.
- Harness A (offline, deterministyczny): `src/config/__toolsEngineHarnessA.mts` → `npx tsx src/config/__toolsEngineHarnessA.mts` musi dawać **11/11 PASS** po KAŻDEJ zmianie (regresja-check, sekundy).
- Wiring: `src/store/useToolStore.ts` (TOOL_STEPS+TOOL_INITIAL_DATA), `src/hooks/discovery/toolAi/promptRegistry.ts` (grounded conclusion branch per narzędzie).
- Model działania: `Harvard/wdrozenie-100/_TOOLS_MODEL_DZIALANIA_2026-07-08.md`.
- **Wyniki panelu dotychczas**: `Harvard/wdrozenie-100/_PANEL_11_NARZEDZI_WYNIKI.md` — TABELA STANU, czytaj PRZED startem, aktualizuj PO każdej rundzie.

## Metodyka (pętla, do powtarzania per narzędzie)
1. **Panel 3 niezależnych specjalistów** (Agent tool, model opus, każdy w OSOBNYM wywołaniu, żeby nie znali swoich ocen):
   - **A — Merytoryka**: czy doktryna+silnik są prawidłowo zaimplementowane (liczby, wzory, logika wnioskowania zgodna z `_TOOLS_DOKTRYNA/{tool}.md`)? Czyta kod silnika + doktrynę + fixture.
   - **B — Ścieżka pracy z klientem**: czy drabina pytań (`deepeningLadder.ts`) + sekwencja ruchów (`buildW2MoveSequence`) dają się realnie poprowadzić jako sesja konsultingowa (progresja, konkretność, wykonalność rekomendacji)?
   - **C — Prezentacja**: proxy code-review (NIE realny UI — to zawsze osobny krok Piotra): kompletność etykiet PL/EN, brak `primary-*` (crimson!), spójność struktury z komponentem generycznym (`ToolWorkspace`/`ToolCanvas`/`OperationalSectionStep`).
   - Każdy zwraca: `OCENA: X/6` + `UZASADNIENIE` + `BRAKI` (konkretne, z odniesieniem do pliku/linii).
2. **Średnia (A+B+C)/3**. **≥5,5 → DONE.** **<5,5 → fix worker** (Agent tool, opus): naprawia KONKRETNE braki z panelu (nie generyczne "popraw jakość"), commituje NATYCHMIAST po esbuild-czystym pliku, potem **sam robi re-panel** (3 nowe krótkie sub-recenzje jako niezależny recenzent, nie obrońca własnej pracy) na poprawionym kodzie.
3. Aktualizuj `_PANEL_11_NARZEDZI_WYNIKI.md` po każdej rundzie (tabela + sekcja braków). Commit.
4. Powtarzaj aż WSZYSTKIE 11 mają status DONE (≥5,5).

## Higiena krytyczna (złamana dziś w nocy raz — nie powtarzaj)
- **Commituj PO KAŻDYM pliku, nie zbiorczo na końcu.** Środowisko potrafi się przerwać między turami — niescommitowana praca ginie fizycznie (nie tylko z gałęzi).
- Walidacja: `esbuild <plik> --loader:.ts=ts --bundle=false --outfile=/dev/null` per plik (szybkie). Harness A po każdej rundzie fixów (regresja). Pełny `tsc` tylko na końcu całej pracy (wolny, 8GB heap: `NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit`).
- Workerzy: prompt **WYKONAJ SAM, ZAKAZ delegacji/Agent tool/spawn** — inaczej robotnicy delegują zamiast pracować (zdarzyło się dziś w nocy, ~160k tokenów strata).
- `node_modules` w worktree może wymagać symlinka: `ln -s /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules <worktree>/node_modules` (do testów `npx tsx`/`esbuild`; usuń symlink na koniec sesji, nie commituj go).

## Stan na start (patrz też `_PANEL_11_NARZEDZI_WYNIKI.md` — może być świeższy)
- **automation-pipeline**: runda 1 = A5/B5/C6, średnia 5,33 <5,5. Fix był zlecony ale proces przerwany PRZED commitem — **sprawdź `git log --oneline -- src/config/automationpipeline/`**; jeśli brak commita z "runda 2"/fix po ostatnim `6e8ae3c646`, zacznij fix od zera (braki opisane w wynikach-pliku).
- **vsm-builder**: A5/B5, BRAK jeszcze C rundy 1 → dispatch C, potem fix (luki już znane: demand/takt-time martwe, 7 muda nieoperacjonalizowane).
- **constraint-control**: A5/B5, BRAK C rundy 1 → dispatch C, potem fix (policy-constraint martwy w fixture, validation zahardkodowane).
- **control-tower**: tylko C5 rundy 1 → dispatch A+B.
- **Pozostałe 7** (robotics-feasibility, logistics-automation, integration-diagnostic, data-inventory, decision-engine, digital-value-pool, legacy-analyzer): kolejka, jeszcze nietknięte panelem.

## Task list
Jest już 11-elementowa `TaskList` (użyj `TaskGet`/`TaskUpdate`) śledząca każde narzędzie — kontynuuj ją, nie twórz nowej.

## Kiedy skończysz wszystkie 11
Napisz krótki raport końcowy do `Harvard/wdrozenie-100/_RAPORT_KONCOWY_PANEL_11_2026-07-08.md`: tabela finalna wszystkich ocen, co zostało naprawione, ile rund per narzędzie, i jeśli coś utknęło poniżej 5,5 mimo prób — opisz dlaczego (nie ukrywaj, nie zawyżaj). Zero deploy — to zawsze decyzja Piotra.
