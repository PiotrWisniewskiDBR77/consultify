# P15 — Plan i Obciążenie: dokończenie do działania (DEC-421 → dowóz)

> Paczka programu naprawczego · autor: Fable (nadzorca), pomiar: Opus 07.09 19:40 na `/private/tmp/wt-fable-inicjatywy`
> (HEAD `41535b667f`) + własne API 4150 na kopii bazy `consultify_fable` + UI 3160.
> Szablon: `00_SZABLON_PACZKI.md`. Moduł `05_INITIATIVES` ZAMROŻONY → każdy commit z markerem
> **`[ODMROZENIE 05_INITIATIVES DEC-421]`** (P11 nadal obowiązuje jako spec; ta paczka ją DOKAŃCZA, nie zmienia).
> Słowa właściciela 07.09 wieczór: „te narzędzia mają działać (…) teraz nie widzę żadnego działania".
> Dowody pomiaru: `evidence/plan-obciazenie-analiza/` (24 zrzuty), meldunek Opusa w rejestrze (wiersz P15-POMIAR).

## 1. Cel dla użytkownika

PMO klika „Nowy plan", wskazuje 5 zatwierdzonych inicjatyw i 12 tygodni, generator pokazuje proponowaną kolejność
z uzasadnieniem ZANIM ją zatwierdzi, po publikacji „Nowa analiza" liczy arkusz okres × rola z realnej podaży ludzi,
pokazuje, że jedna rola jest przeciążona, „Pracuj z AI" daje trzy warianty, a wybranie „Przesuń kolejność" tworzy
nową wersję planu. Kryterium P11 §7 słowo w słowo.

## 2. Zakres

| Powierzchnia | Plik | Stan zmierzony 07.09 |
|---|---|---|
| Inicjatywy → Plan (lista) | `PlanScenarioSurface.tsx` (lista działa) | Portfel = literał, Konflikty = stała 0, Autor = zawsze „Nieznane" |
| Karta `plan` | `src/components/standard/cards/PlanCard.tsx` + warsztat w `PlanScenarioSurface.tsx:983-2233` (nieosiągalny) | Zakres = wszystkie 72 inicjatywy modułu; Kolejność tylko-do-odczytu; Obciążenie ról = tekst z seedu; generator ignoruje wybór i horyzont; propozycja niewidoczna przed „Zatwierdź"; „Zapisano" na sztywno |
| Inicjatywy → Obciążenie (lista) | `CapacityScenarioSurface.tsx` | lista działa; „Plan źródłowy" = literał |
| Karta `capacity_analysis` | `CapacityAnalysisCard.tsx` + `CapacityOptionsPanel` w `CapacityScenarioSurface.tsx:1227` (nieosiągalny) | arkusz bez wymiaru roli, brak pól do wpisania popytu/podaży, „Propozycje zmian" = stałe zdanie mimo 200 z doradcy |
| Domena | `server/src/domain/initiatives-execution/{planScenario,capacityScenario,planSolver,capacityOptionsAdvisor,planAnalysisProposal}.ts`, `postgresMaterialCommandUnitOfWork.ts`, `postgresInitiativeReader.ts` | solver i doradca DZIAŁAJĄ (201/200 na żywo); zapis drugiego planu = **500** (UNIQUE `ie_aggregate_relations`) |
| Dane | `initiatives` (72) vs `ie_aggregate_state/initiative` (5, seed P11) | dwa rozłączne magazyny, brak mostu |

Ekranów: 2 zakładki + 2 karty N. Modułów zamrożonych: 05_INITIATIVES.

## 3. Przyczyna źródłowa (plik:linia, zmierzone na HEAD 41535b667f)

1. **Nie da się założyć drugiego planu.** `postgresMaterialCommandUnitOfWork.ts` wstawia relację
   `PLAN_SCENARIO_PORTFOLIO:<wersja>` do `ie_aggregate_relations` z UNIQUE `(organization_id, relation_type, target)`
   — `relation_type` niesie numer WERSJI, nie tożsamość planu. Drugi plan v1 na tę samą wersję portfela → `23505` → HTTP 500
   `INITIATIVES_EXECUTION_RUNTIME_FAILED` bez przyczyny na ekranie (zrzuty `30/31/32-formularz-nowy-plan`). To samo dla
   `PORTFOLIO_SCENARIO_MEMBER:<wersja>:<inicjatywa>`.
2. **Generator nie przekazuje wyboru.** `PlanCard.tsx:38` `onGenerate={(input) => onAnalyze(input.mode)}` — 72 zaznaczenia
   i horyzont z modala są wyrzucane; solver dostaje zawsze okna z seedu.
3. **Propozycja niewidoczna.** Krok 5 generatora renderuje „Zatwierdź/Odrzuć" bez treści propozycji; po ACCEPT zmiany żyją
   w stanie Reacta; `saveState: 'saved'` na sztywno (`PlanCard.tsx:38`).
4. **Warsztat planu jest martwym kodem.** `PlanScenarioSurface.tsx:983` wcześniejszy `return` odcina ~745 linii
   (edytor okien, przesuwanie, zapis, diff, historia, przegląd propozycji). Analogicznie `CapacityScenarioSurface.tsx:855`
   odcina `CapacityOptionsPanel` (`:1227`).
5. **Zakres inicjatyw = cały moduł.** `PlanCard.tsx:30` renderuje prop `initiatives` (backlog z `InitiativesHub.tsx:332`),
   nie `scenario.windows`.
6. **Obciążenie ról to tekst.** `windows[].constraintSnapshot[].detail` — zdanie wpisane w seedzie
   (`sourceRef: "P11-DEC-421-owner-decision"`), zero arytmetyki.
7. **Brak wymiaru roli w mocy.** `capacityScenario.periods[].demand/.supply` to skalary na okres;
   `planSolver.ts:54-71`, `capacityOptionsAdvisor.ts:38-43` porównują okres do okresu. „Arkusz okres × rola" nie istnieje
   w modelu. Skutek: 12 luk przy 5 zaplanowanych tygodniach.
8. **Tryb „wg obciążenia ról" cicho degraduje.** `initiativesExecutionRuntime.routes.ts:3534-3539` szuka analizy o
   `planRef.scenarioVersion === plan.scenarioVersion`; brak → tryb zależności bez słowa dla użytkownika.
9. **Lista kłamie w trzech kolumnach.** `postgresInitiativeReader.ts:1238` `conflicts: 0` (stała); `:1239` autor = UUID
   → resolver `businessDisplayLabel.ts:47` podstawia „Nieznane"; „Portfel źródłowy" = literał (`businessDisplayLabel.ts:13`).
10. **Dwa magazyny inicjatyw bez mostu.** 72 wiersze `initiatives` (moduł, listy, łańcuch statusów) vs 5 agregatów
    `ie_aggregate_state/initiative` (seed). Plan/portfel widzi tylko te 5; generator pokazuje 72.

## 4. Projekt rozwiązania

### 4.0 Decyzje architektoniczne (CTO; właściciel może zmienić jednym zdaniem — patrz §12)

- **D1 Most = inicjatywy modułu są źródłem planu.** Okno planu wskazuje `initiatives.id` (nie agregat `ie/initiative`).
  Kwalifikują się inicjatywy w statusie **Zatwierdzona** (domyślnie) oraz **Do zatwierdzenia** jako „warunkowe" (chip).
  Scenariusz portfela przestaje być wymogiem: przy „Nowy plan" system zakłada portfel roboczy automatycznie
  („Portfel: zatwierdzone inicjatywy, stan z <data>"). Zależności: z `initiative_dependencies`/`tasks.dependencies`
  jeśli są, inaczej brak (solver działa i bez nich). Zero migracji danych seedowych — 5 agregatów zostaje jako historia.
- **D2 Podaż ludzi z produktu, nie z ręki.** Podaż per rola per okres liczona z tego samego źródła, które działa
  w Realizacja → Zasoby (`GET /api/execution-control/capacity/resource-plan`, 15 wierszy popyt/podaż per osoba, edytowalne
  przez „Zaplanuj dostępność"). Rola osoby = rola projektowa z Zespołu (`project_members.project_role`), w braku — „Bez roli".
  Ręczna korekta podaży w arkuszu dozwolona i oznaczona („ręcznie").
- **D3 Popyt z planu, nie z seedu.** Popyt roli w okresie = suma `required_capacity_fte` inicjatyw, których okno obejmuje
  okres, rozłożona po rolach z `competencies_required`/przypisań zespołu; brak danych = jawne „Nieznane" (nie 0).
- **D4 Klucz relacji z tożsamością.** `relation_type` = stała nazwa relacji; wersja i tożsamość źródła w kolumnach
  `source_id`/`source_version`; UNIQUE na `(organization_id, relation_type, source_id, target)`. Migracja addytywna
  (nowy indeks + przepisanie istniejących ~20 wierszy), stara kolumna zostaje.
- **D5 Nic nie wchodzi do planu bez pokazania.** Propozycja solvera (kolejność, okna, konflikty, uzasadnienie per
  inicjatywa) renderuje się w kroku 4 generatora i w sekcji „Zależności i konflikty"; „Zatwierdź" = `UPDATE` okien +
  jawny stan zapisu (`Zapisano hh:mm` z odpowiedzi serwera, nigdy na sztywno).
- Zakazy: bez nowych flag; ekrany tylko `Standard*`/karty N; brak `.catch(() => {})`; teksty pl+en; `primary-*` tylko dla
  akcji destrukcyjnych.

### 4.1 Plan — co się zmienia

1. Lista: kolumny Portfel (nazwa portfela roboczego + wersja), Konflikty (liczba z ostatniej propozycji, z readera),
   Autor (imię i nazwisko z `users` po `updated_by`).
2. Generator: krok 1 Źródło = „Zatwierdzone inicjatywy (N)" z przełącznikiem „+ do zatwierdzenia"; krok 2 Wybór =
   checkboksy TYLKO kwalifikujących się inicjatyw (nazwy, status po polsku); krok 3 Parametry = start, liczba okresów,
   jednostka, tryb; krok 4 Generuj = `UPDATE` (okna z wyboru, okresy z parametrów) → `analysis-proposals` → **propozycja
   na ekranie** (tabela: inicjatywa · okno od–do · uzasadnienie · konflikt); krok 5 Zatwierdź = `review ACCEPT` +
   `UPDATE` okien z propozycji; Odrzuć = plan bez zmian.
3. Karta: „Zakres inicjatyw" = okna planu z „Dodaj inicjatywę / Usuń"; „Kolejność i okna" = edycja daty docelowej
   (przywrócony edytor z martwego kodu, przeniesiony PRZED `return`); „Zależności i konflikty" widoczna zawsze
   („Brak konfliktów" zamiast ukrycia); „Obciążenie ról" = wynik z powiązanej opublikowanej analizy (arkusz okres × rola),
   w braku — „Nieznane — brak opublikowanej analizy obciążenia" (P11 §4.2 pkt 5).
4. Tryb „wg obciążenia ról" bez powiązanej analizy = komunikat po polsku i blokada wyboru trybu, nie cicha degradacja.
5. Błąd domeny → czytelny komunikat (kod reguły → i18n), 500 tylko dla realnych awarii.

### 4.2 Obciążenie — co się zmienia

1. Model: `periods[].roles[{ roleId, roleLabel, demand, supply, supplySource: 'RESOURCE_PLAN'|'MANUAL'|'UNKNOWN' }]`;
   skalary na okres zostają jako suma (zgodność wstecz dla solvera i doradcy), doradca liczy lukę per rola.
2. „Nowa analiza" = wybór opublikowanego planu (domyślnie ostatni) → serwer liczy popyt (D3) i podaż (D2) → analiza
   powstaje WYPEŁNIONA, nie pusta.
3. Karta: „Arkusz obciążenia" = okres × rola (popyt / podaż / luka, źródło podaży), ręczna korekta podaży;
   „Luki i presja" = per rola; „Propozycje zmian" = `CapacityOptionsPanel` (3 warianty z doradcy, wybór, wpływ);
   wybór „Przesuń kolejność" = nowa propozycja analizy planu z przesunięciem → plan v+1 do zatwierdzenia w karcie planu.
4. Lista: „Plan źródłowy" = nazwa planu + wersja.

## 5. Kroki wykonania (kolejność wymuszona zależnościami)

| # | Krok | Pliki | Kto | Rozmiar | Zależy od |
|---|---|---|---|---|---|
| K0 | POMIAR: rola osoby w resource-plan (skąd `role`), `initiative_dependencies` istnieje?, ile inicjatyw ma `required_capacity_fte` > 0 na stagingu (odczyt) | zapytania SQL + `capacityModelService.ts`, `workloadCapacityService.ts` | Sonnet | S | — |
| K1 | D4 klucz relacji + migracja addytywna `2026xxxx_ie_relations_identity.sql` + 500 → komunikat reguły | `postgresMaterialCommandUnitOfWork.ts`, `initiativesExecutionRuntime.routes.ts`, `server/migrations/` | Opus | M | — |
| K2 | D1 most: okna planu na `initiatives.id`, portfel roboczy automatyczny, kwalifikacja statusów, zależności z modułu | `planScenario.ts`, `postgresInitiativeReader.ts`, trasy plan-scenarios, `PlanCard.tsx` krok 1–2 | Opus | L | K1 |
| K3 | Generator end-to-end (D5): wybór+parametry → UPDATE → propozycja na ekranie → Zatwierdź/Odrzuć → jawny zapis; warsztat karty przywrócony (zakres, daty docelowe, konflikty) | `PlanCard.tsx`, `PlanScenarioSurface.tsx` (przeniesienie kodu sprzed `return`), `src/services/initiatives/runtimeApi.ts` | Opus | L | K2 |
| K4 | Lista planów: portfel, konflikty, autor (reader + i18n) | `postgresInitiativeReader.ts:1230-1245`, `businessDisplayLabel.ts` | Sonnet | S | K2 |
| K5 | D2/D3 moc per rola: model + wyliczanie popytu z planu i podaży z resource-plan; „Nowa analiza" wypełniona; doradca per rola | `capacityScenario.ts`, `capacityOptionsAdvisor.ts`, `planSolver.ts` (suma per okres bez zmian), nowa komenda `capacity-scenarios/:id/compute` | Opus | L | K2 |
| K6 | Karta analizy: arkusz okres × rola z korektą ręczną, luki per rola, `CapacityOptionsPanel` podpięty, wybór wariantu → propozycja planu | `CapacityAnalysisCard.tsx`, `CapacityScenarioSurface.tsx` (kod sprzed `return`) | Opus | M | K5 |
| K7 | Plan → „Obciążenie ról" z powiązanej analizy; tryb „wg obciążenia ról" bez cichej degradacji | `PlanCard.tsx`, trasa analysis-proposals | Sonnet | M | K5, K3 |
| K8 | Dowód na ekranie (skrypt Playwright pełnego łańcucha §6) + pl/en + rejestr | `scripts/dev/plan-obciazenie/dowod-plan.mjs`, `evidence/plan-obciazenie/` | Sonnet | M | K3–K7 |

Równolegle: K1 ∥ K0; po K2: K3 ∥ K4 ∥ K5; po K5: K6 ∥ K7. Wszystkie kroki dotykają `05_INITIATIVES` (marker DEC-421).

## 6. Testy

- Jednostkowe (każdy z mutacją → RED): (a) generator przekazuje wybór i horyzont do `UPDATE` (mutacja: przekaż tylko tryb);
  (b) propozycja renderuje się przed „Zatwierdź" (mutacja: usuń tabelę propozycji); (c) `saveState` z odpowiedzi serwera
  (mutacja: stała); (d) drugi plan na tej samej wersji portfela → 201 (mutacja: przywróć stary klucz → 23505);
  (e) luka liczona per rola (mutacja: sumuj role); (f) podaż z resource-plan (mutacja: `supply=1`); (g) `CapacityOptionsPanel`
  renderuje 3 warianty z odpowiedzi (mutacja: literał); (h) tryb „wg obciążenia ról" bez analizy → 400 `CAPACITY_SCENARIO_REQUIRED`
  (mutacja: cicha degradacja); (i) reader: konflikty i autor z danych (mutacja: stałe).
- Realny PG: `planPublish.konflikt.realdb.test.ts` rozszerzony o drugi plan na tej samej wersji portfela; nowa analiza
  wypełniona z resource-plan.
- Przepływ klikany (Playwright, 1440, jasny, reload po każdym zapisie, `.png.json`): Nowy plan → 5 zatwierdzonych inicjatyw
  → 12 tygodni → Generuj → propozycja widoczna (5 wierszy z uzasadnieniem) → Zatwierdź → „Zapisano hh:mm" → Opublikuj →
  Nowa analiza → arkusz okres × rola z liczbami i źródłem podaży → luka na jednej roli → Pracuj z AI → 3 warianty →
  „Przesuń kolejność" → plan v2 w karcie planu z przesuniętą inicjatywą → reload: wszystko trwałe. Para negatywna:
  drugi plan na tym samym portfelu = 201 (nie 500); tryb „wg obciążenia ról" bez analizy = komunikat po polsku.

## 7. Kryterium odbioru właściciela

Na stagingu: klika „Nowy plan", wybiera 5 zatwierdzonych inicjatyw i 12 tygodni, widzi proponowaną kolejność
z uzasadnieniem przed zatwierdzeniem, po publikacji tworzy analizę, która sama pokazuje przeciążoną rolę w konkretnym tygodniu
z podażą wziętą z Zasobów, wybiera „Przesuń kolejność" i dostaje plan v2 — bez „bez nazwy", bez „Nieznane", bez 500.

## 8. Ryzyka i cofanie

- Migracja K1 dotyka `ie_aggregate_relations` (addytywna: nowy indeks + kolumny; stary indeks usuwany dopiero po
  potwierdzeniu na stagingu). Cofanie: `git revert` paczki, indeks stary zostaje do tego czasu.
- D1 zmienia źródło inicjatyw planu — 5 agregatów seedowych przestaje być widoczne w wyborze (zostają w planach
  historycznych). Świadome.
- D2 zależy od jakości `resource-plan` (rola osoby) — K0 mierzy; gdy ról brak, arkusz pokazuje „Bez roli" i „Nieznane",
  nie zera.
- Bez flag: każdy krok idzie na staging tylko po zielonej bramce i zrzucie, nie hurtem (reguła CLAUDE.md pkt 9).

## 9. Nakład

Opus: K1 0,5 · K2 1 · K3 1 · K5 1 · K6 0,5 = **4 osobodni**; Sonnet: K0 0,25 · K4 0,25 · K7 0,5 · K8 0,5 = **1,5**.
Krytyczna ścieżka K1 → K2 → K5 → K6 ≈ 3 dni przy zrównolegleniu K3/K4/K7.

## 10. Cel osiągnięty = samokontrola wykonawcy

- Po każdym kroku: `node_modules/.bin/esbuild <plik> --loader:.tsx=tsx`, `npx vitest run <testy kroku>`,
  `bash scripts/check-gestosc.sh <pliki>`, `bash scripts/check-triada.sh <pliki>`, `cd server && NODE_OPTIONS=--max-old-space-size=3072
  ../node_modules/.bin/tsc -p tsconfig.build.json --noEmit` = 0 linii.
- Pomiar na żywo: własne API na wolnym porcie 41xx (`DB_MANAGED_SCHEMA=off`, kopia bazy przez `pg_dump | psql`), własny vite
  3140–3199 z `VITE_API_TARGET`, skrypt z §6; progi: 0 błędów konsoli poza znanym `NetworkBuffer`, 0 napisów „Nieznane"
  w kolumnach Portfel/Autor, 0 odpowiedzi 500 na ścieżce, propozycja ≥ 5 wierszy, arkusz ≥ 1 rola z podażą ze źródła
  `RESOURCE_PLAN`.
- STOP: gdy próg wymaga decyzji właściciela (np. brak ról w Zespole) → zatrzymać się i opisać, nie obchodzić.
- Zakazy: `--no-verify`, `git stash`, `pkill`, flagi, `.catch(() => {})`, edycja bez markera, sub-agenci, dotykanie `m03`.

## 11. Wklejka dla wykonawcy

(generowana per krok z §1, §4, §5, §6, §10 + katalog roboczy `worktree` z `origin/staging`; wydaje nadzorca po decyzjach §12)

## 12. Decyzje do potwierdzenia przez właściciela (jedno zdanie każda)

| # | Pytanie | Rekomendacja CTO |
|---|---|---|
| D1 | Skąd plan bierze inicjatywy? | Z listy modułu: Zatwierdzona (domyślnie) + Do zatwierdzenia jako „warunkowe"; portfel roboczy automatyczny |
| D2 | Skąd podaż ludzi? | Z Realizacja → Zasoby (resource-plan, „Zaplanuj dostępność"), rola z Zespołu, ręczna korekta dozwolona |
| D3 | Czy Obciążenie zostaje osobnym narzędziem? | Tak (lista analiz jak w P11), a karta planu pokazuje wynik powiązanej analizy w „Obciążenie ról" |
| D4 | Czy migracja klucza relacji może iść na staging w tej paczce? | Tak, addytywnie, stary indeks do usunięcia po potwierdzeniu |
