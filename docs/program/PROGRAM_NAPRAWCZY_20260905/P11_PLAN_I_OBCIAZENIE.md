# P11 — Plan i Obciążenie inicjatyw jako narzędzia (karty N) z generatorem

> Paczka programu naprawczego 2026-09-05 · DEC-421 · autor: Opus (nadzorca: Fable)
> Szablon: `docs/program/PROGRAM_NAPRAWCZY_20260905/00_SZABLON_PACZKI.md`
> Pomiar wykonany na `/private/tmp/m03` (odczyt) + lokalna baza `127.0.0.1:54400` (odczyt), 2026-09-06.
> Moduł `05_INITIATIVES` jest ZAMROŻONY (`docs/program/MVP_FINAL_ZAMROZONE.json:954`) — każdy commit tej
> paczki wymaga markera **`[ODMROZENIE 05_INITIATIVES DEC-421]`**.

---

## 1. Cel dla użytkownika

Konsultant tworzy **plan** przyciskiem w Menu 2, otwiera go jako osobną kartę narzędzia i generator układa
kolejność wybranych inicjatyw w zadanym horyzoncie tak, żeby ludzie nie byli przeciążeni; analiza obciążenia
jest drugą taką kartą — z arkuszem okres × rola i propozycją przesunięć.

## 2. Zakres

| Powierzchnia | Plik | Stan dziś |
|---|---|---|
| Zakładka **Plan** | `src/components/Initiatives/PlanScenarioSurface.tsx` (1965 l.) | tabela pokazuje INICJATYWY, nie plany |
| Zakładka **Obciążenie** | `src/components/Initiatives/CapacityScenarioSurface.tsx` (1567 l.) | tabela pokazuje okresy/ograniczenia, nie analizy |
| Powłoka modułu | `src/components/Initiatives/InitiativesHub.tsx` (2808 l.) | Menu 2 bez CTA na obu zakładkach |
| Rejestr kart N | `src/components/standard/registry.ts` | 8 kluczy → **10** (`plan`, `capacity_analysis`) |
| Domena planu | `server/src/domain/initiatives-execution/planScenario.ts` | brak pola `name` |
| Domena mocy | `server/src/domain/initiatives-execution/capacityScenario.ts` | brak pola `name` |

Ekranów dotkniętych: **2** (Inicjatywy → Plan, Inicjatywy → Obciążenie). Nowych kart N: **2**.
Moduł zamrożony: `05_INITIATIVES` → marker `[ODMROZENIE 05_INITIATIVES DEC-421]` w KAŻDYM commicie.

## 3. Przyczyna źródłowa (pomiar, plik:linia)

**3.1 CTA nie może być w Menu 2, bo powłoka je wygasza dla tych zakładek**
`src/components/Initiatives/InitiativesHub.tsx:2429-2431`:
```
primaryCta={
  activeTab !== 'list'
    ? undefined
```
Zakładki `plan` i `capacity` dostają `primaryCta = undefined`. Ten sam warunek gasi `commandRowContent`
(`InitiativesHub.tsx:2450-2452`). Dlatego autor poprzedniej wersji wstawił przycisk **do treści**:
`PlanScenarioSurface.tsx:881-883` (`btn-primary` + `initiatives.planScenario.newPlan`) i analogicznie
w `CapacityScenarioSurface.tsx`. Formularz tworzenia jest rozwijany inline pod nagłówkiem
(`PlanScenarioSurface.tsx:885-978`, stan `showCreate`).

**3.2 Tabela Planu to lista OKIEN PLANU, nie lista planów**
`PlanScenarioSurface.tsx:1122-1198` — `StandardTable` z kolumnami `initiative · backlogState · earliest ·
proposedTarget · latest · dependencyReadiness · mandatoryDeadline · costOfDelay · roughDemand ·
capacityState · scheduleConfidence · conflict · nextAction`, dane `visiblePlanWindows`.
Lista planów istnieje **tylko jako `<select>`** — `PlanScenarioSurface.tsx:1176-1195` (`rows.map`).
To dokładnie to, co właściciel nazwał „w tej tabeli planów nie mamy inicjatyw, tylko listę planów".
Analogicznie w Obciążeniu: tabela = okresy/ograniczenia, wybór analizy = `<select>`.

**3.3 „Nazwa planu" pisze wprost identyfikator techniczny**
`PlanScenarioSurface.tsx:257` `const [newId, setNewId] = useState('')` → `:609` `scenarioId: newId.trim()`
→ pole `:889-895` z etykietą `initiatives.planScenario.form.planName` („Nazwa planu") i aria
`planNameAria` = **„Identyfikator scenariusza planu"** (`public/locales/pl/translation.json`).
Domena nie ma pola nazwy: `server/src/domain/initiatives-execution/planScenario.ts:22-37`
(`scenarioId`, `scenarioVersion`, `status`, `portfolioScenarioId`, …) — tak samo
`capacityScenario.ts`. Schemat wejścia `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:443-490`
(`PlanScenarioSchema`) też nie zna `name`. **To jest przyczyna `aco-plan-scenario-1786420688957` w UI (P4).**
Detektor kodów technicznych ISTNIEJE i już rozpoznaje prefiks `aco-`:
`src/components/shared/PreviewPane/businessDisplayLabel.ts:11-13` — ale żadna z dwóch powierzchni go nie woła
(`grep` na obu plikach: 0 trafień `businessDisplayLabel`).

**3.4 ALGORYTM UKŁADANIA POD OBCIĄŻENIE — ISTNIEJE (to nie jest praca od zera)**

| Element | Plik:linia | Co robi |
|---|---|---|
| `dependencyOrder` | `server/src/domain/initiatives-execution/planSolver.ts:14-47` | sortowanie topologiczne, wykrywa cykle i brakujące zależności, zwraca `conflicts` |
| `solvePlanScenario` | `planSolver.ts:71-171` | deterministyczny wybór okresu per inicjatywa: granica zależności (`:88-92`), przecięcie własnego okna (`intersects` :49-51), **ograniczenie mocy** (`demandFor` :54-70, `usedCapacity` :137-142) |
| jawny brak wiedzy | `planSolver.ts:113-136` | gdy podaż/popyt = UNKNOWN, solver NIE udaje: dopisuje założenie „ograniczenie nie zostało zastosowane" |
| konsument planu | `planAnalysisProposal.ts:60` | buduje propozycję zmian okien + `conflicts`, status `PENDING_REVIEW` |
| trasa | `routes/pmo/initiativesExecutionRuntime.routes.ts:3460` (create) i `:3522` (review) | `POST /plan-scenarios/:id/analysis-proposals/:proposalId`, `POST /plan-analysis-proposals/:id/review` |
| wołacz UI | `PlanScenarioSurface.tsx:687` `createPlanAnalysisProposal` | dziś schowany w inline „Warsztacie planu" |
| doradca obciążenia | `capacityOptionsAdvisor.ts:32-144` | `RESEQUENCE` / `SCOPE_SPLIT` / `ADD_CAPACITY` z uzasadnieniem po polsku; woła `solvePlanScenario` (`:53`) |
| trasa doradcy | `routes/pmo/initiativesCapacityAdvisor.routes.ts:40-90` | `POST /capacity-options/:id/propose` |
| wołacz UI | `CapacityScenarioSurface.tsx:794` | działa |

**Wniosek: nie budujemy nowego silnika.** Brakuje wyłącznie DROGI użytkownika do tego, co już liczy:
lista → karta → generator. Zakaz tworzenia drugiego solvera w tej paczce.

**3.5 Rejestry po stronie serwera są gotowe**
`GET /plan-scenarios` — `initiativesExecutionRuntime.routes.ts:3270-3291` (filtr uprawnień per portfel).
`GET /capacity-scenarios` — `:3934-3959`. Klienci: `src/services/initiatives-execution/runtimeApi.ts:783`
(`listPlanScenarioRegister`) i `:129` (`listCapacityScenarioRegister`). **Tabela planów i tabela analiz nie
wymagają nowego endpointu.**

**3.6 Persystencja**
Brak osobnych tabel. Agregaty siedzą w `ie_aggregate_state` (`aggregate_type` = `plan_scenario` /
`capacity_scenario`), z twardym CHECK-iem na horyzont: `server/migrations/935_plan_scenario_time_basis.sql:5-13`
(wymaga `windowUnit`, `timezone`, niepustej tablicy `periods`). Zapisy przez
`postgresMaterialCommandUnitOfWork.ts:407-433` (optimistic locking po `version`).

**3.7 Stan danych — lokalna baza 54400 (org DBR77 `cc9db573-260f-4a19-927f-f3cc1fbaea38`)**
```
SELECT aggregate_type, count(*) FROM ie_aggregate_state GROUP BY 1;  →  0 wierszy
SELECT count(*) FROM initiatives WHERE organization_id='cc9db573-…';  →  72
```
**0 planów, 0 analiz obciążenia.** To, co właściciel widział („Controls Engineer", „2026-P10", „Atelier
Capacity Baseline"), pochodzi z trybu pokazowego: `CapacityScenarioSurface.tsx:409-600` (`if (demoMode)`)
i słownika ról `:86-90`. `aco-plan-scenario-1786420688957` to identyfikator wpisany ręcznie w polu „Nazwa
planu" na stagingu — nie ma go w kodzie (`grep` po `aco-plan-scenario` w `src`/`server`: jedyne trafienie to
test `businessDisplayLabel.test.ts:33`).

**3.8 Zero testów i zero kontraktu**
`grep -rln "PlanScenarioSurface|CapacityScenarioSurface" --include=*.test.*` → **0 plików**.
`docs/modules/05_inicjatywy/04_UI_UX.md` (171 l.) nie wspomina zakładek Plan ani Obciążenie — te dwa ekrany
nigdy nie miały spisanego kontraktu.

**3.9 Menu 3 opisuje niewłaściwy zbiór**
`InitiativesHub.tsx:2385-2408` — 9 chipów Planu (`unscheduled`, `now`, `next`, `later`, `conflicted`,
`missing-dependencies`, `needs-capacity`, `ready`, `published`) filtruje INICJATYWY, a nie plany;
9 chipów Obciążenia filtruje ograniczenia, nie analizy. Po przebudowie tabeli te chipy przestają pasować.

---

## 4. Projekt rozwiązania

### 4.0 Zasady wiążące (dotyczą całej paczki)

1. **ZERO nowych silników AI i ZERO drugiego solvera.** Generator planu wywołuje istniejące
   `createPlanAnalysisProposal` → `solvePlanScenario`. Generator analizy obciążenia wywołuje istniejące
   `proposeCapacityOptions`. Jeśli w trakcie okaże się, że czegoś brakuje — wiersz w `99_DECYZJE`, nie nowy kod AI.
2. **Kanon:** listy wyłącznie `StandardTable` + `StandardModuleBar` + `StandardPreview`; karty wyłącznie
   `StandardArtifactShell` + `ArtifactRightPanel` + `PracujZAI`. Tokeny `c-*`, **zero `primary-*`**
   (każdy numer = crimson), fokus `c-focus`, kebab pionowy.
3. **i18n pl+en**, statusy po polsku: `EXECUTING → W realizacji`, `DRAFT → Szkic`,
   `SCHEDULED → Zaplanowana`, `PUBLISHED → Opublikowany`, `SUPERSEDED → Zastąpiony`,
   `PENDING_REVIEW → Do zatwierdzenia`.
4. **Zero identyfikatorów technicznych w UI** — patrz §4.3.
5. **Zero nowych flag.** Zmiana wchodzi jawnie albo nie wchodzi.

### 4.3 Nazwa zamiast identyfikatora (warunek P4, wspólny dla obu kart)

- Do agregatu planu i mocy dochodzi **opcjonalne** pole `name: string | null`
  (`planScenario.ts:22-37`, `capacityScenario.ts`, oba schematy zod
  `initiativesExecutionRuntime.routes.ts:443` i `:514`). Pole opcjonalne = stare agregaty czytają się dalej.
- `scenarioId` **generuje kod**, nie użytkownik: `plan-${crypto.randomUUID()}`. Pole „Nazwa planu"
  przestaje pisać `scenarioId`.
- Każde miejsce, gdzie UI pokazuje nazwę planu/analizy, przechodzi przez
  `resolveBusinessDisplayLabel({ displayName: name, rawId: scenarioId, fallback: t('…bezNazwy') })`
  (`src/components/shared/PreviewPane/businessDisplayLabel.ts:47`). Agregat bez nazwy (dane zastane)
  pokazuje `Plan bez nazwy · utworzony <data>`, **nigdy** `aco-…`.
- i18n: `planNameAria` przestaje brzmieć „Identyfikator scenariusza planu” → „Nazwa planu nadana przez Ciebie”.

### 4.1 Zakładka **Plan** = lista PLANÓW

**Menu 2** (`InitiativesHub.tsx:2429`): warunek `activeTab !== 'list'` rozszerzyć — dla `plan`
`primaryCta = { label: t('initiatives.plan.newPlan') /* „Nowy plan" */, onClick: … }`;
`filterControls` = jeden dropdown „Status: Wszystkie / Szkic / Opublikowany”.
Przycisk `btn-primary` z treści (`PlanScenarioSurface.tsx:881-883`) oraz inline formularz `:885-978`
**znikają** — kod formularza przenosi się do generatora karty (§4.2), nic nie jest kasowane bez zamiennika.

**Menu 3** — ≤ 3 chipy, liczone na PLANACH: `Szkice` · `Opublikowane` · `Z konfliktami`.
Dziewięć dzisiejszych chipów inicjatyw (`InitiativesHub.tsx:2386-2396`) przenosi się do sekcji
„Zakres inicjatyw" wewnątrz karty planu (nie ginie).

**Tabela** (`StandardTable`, dane z `listPlanScenarioRegister`):

| Kolumna | Źródło |
|---|---|
| Nazwa | `name` przez `resolveBusinessDisplayLabel` (§4.3) |
| Portfel / wersja | `portfolioScenarioId` (też przez resolver) + `v{portfolioScenarioVersion}` |
| Horyzont | `periods[0].start` – `periods[n].end`, format `formatPeriodDate` |
| Status | `status` po polsku (Szkic / Opublikowany / Zastąpiony) |
| Inicjatyw w planie | `windows.length` |
| Konflikty | liczba z ostatniej propozycji analizy (0 = „Brak”) |
| Zaktualizowano | `publishedAt` lub data ostatniego zapisu |
| Autor | `updatedBy` przez `KNOWN_ROLE_DISPLAY_LABELS` / imię użytkownika |

Pojedynczy klik = `StandardPreview` (kanon P1, jeden panel zwijany). Podwójny klik i pastylka „Otwórz”
= **karta N `plan`**.

### 4.2 Karta N `plan` (klasa L)

Powłoka `StandardArtifactShell` (Menu 4 nagłówek + Menu 5 sekcje, sticky wg
`docs/ssot/STEROWANIE_KART_N_I_AI.md` Zasada 2), prawy panel `ArtifactRightPanel`.

Sekcje (lewa nawigacja, w tej kolejności):
1. **Horyzont** — jednostka czasu, strefa, okresy (dzisiejsza edycja okresów z warsztatu, `PlanScenarioSurface.tsx:1319+`).
2. **Zakres inicjatyw** — wybór inicjatyw + status po polsku (dzisiejsze checkboksy, ale bez `EXECUTING/DRAFT/SCHEDULED`).
3. **Kolejność i okna** — dzisiejszy `StandardTable` okien planu (`:1122-1198`) przenosi się TUTAJ, bez zmian kolumn.
4. **Zależności i konflikty** — `conflicts` z ostatniej propozycji, każdy wiersz z uzasadnieniem solvera.
5. **Obciążenie ról** — okres × rola: suma popytu vs podaż z powiązanego scenariusza mocy;
   brak scenariusza = jawne „Nieznane — brak opublikowanej analizy obciążenia” (nie zero, nie pusto).
6. **Decyzje** — publikacja szkicu, ślad `publishedBy/publishedAt`, historia wersji (`readPlanScenarioHistory`).

**„Pracuj z AI"** (`src/components/standard/PracujZAI.tsx`, trzy pozycje kanoniczne):
- **Analizuj** → `createPlanAnalysisProposal` (tryb tylko-raport): pokazuje konflikty i przeciążenia, **nic nie zapisuje**.
- **Uzupełnij tę sekcję** → dla sekcji 3 i 5 uruchamia solver i podmienia TYLKO tę sekcję (propozycja).
- **Uzupełnij cały dokument** = **GENERATOR** (anatomia 1:1 z `Generator/GeneratorInicjatywModal.tsx:437+`,
  DEC-413: numerowane kroki na jednym ekranie):
  1. **Źródło** — portfel + wersja (kafle jak w generatorze inicjatyw),
  2. **Wybór** — które inicjatywy wchodzą do planu (lista z filtrem statusu),
  3. **Parametry** — początek horyzontu · liczba okresów · jednostka (tydzień/miesiąc) ·
     **tryb analizy**: `wg zależności` (solver bez scenariusza mocy) / `wg obciążenia ról`
     (solver z powiązanym opublikowanym scenariuszem mocy) / `mieszany` (najpierw zależności, potem moc),
  4. **Generuj** → propozycja kolejności z uzasadnieniem per inicjatywa,
  5. **Zatwierdź / Odrzuć** → `reviewPlanAnalysisProposal`. **Bez „Zatwierdź" nic nie wchodzi do planu.**

Tryb analizy mapuje się na istniejące wejście solvera: `wg zależności` = wywołanie bez
`capacityScenarioId`, `wg obciążenia ról` i `mieszany` = z `capacityScenarioId`
(`planAnalysisProposal.ts:46-59`). **Zero nowej logiki po stronie domeny.**

### 4.4 Zakładka **Obciążenie** = lista ANALIZ

**Menu 2**: CTA „Nowa analiza" + dropdown filtra statusu (dokładnie jak §4.1). Przycisk z treści
i inline formularz `CapacityScenarioSurface` znikają.
**Menu 3**: ≤ 3 chipy liczone na ANALIZACH: `Szkice` · `Opublikowane` · `Z lukami`.
**Tabela** (dane z `listCapacityScenarioRegister`): `Nazwa · Plan źródłowy · Okresy · Role · Luki ·
Status · Zaktualizowano`. „Luki" = liczba okresów, w których `demand.base > supply.base`
(reguła wprost z `capacityOptionsAdvisor.ts:36-41` — ta sama definicja, żeby liczby się zgadzały).

### 4.5 Karta N `capacity_analysis` (klasa L)

Sekcje: **Plan źródłowy** · **Arkusz obciążenia** (dzisiejsza tabela okres × rola z
`CapacityScenarioSurface`, przeniesiona 1:1, z etykietami zamiast surowych `KNOWN/UNKNOWN` —
`renderKnowledgeToken` `:74-81` już to umie) · **Luki i presja** · **Propozycje zmian** · **Decyzje**.

**„Pracuj z AI"**:
- **Analizuj** → gdzie jest przeciążenie (bez zapisu). Gdy `proposeCapacityOptions` rzuca
  `NoCapacityPressureError` (`capacityOptionsAdvisor.ts:6-12`), karta mówi po polsku
  „Brak przeciążeń do rozwiązania” — nie pusty ekran, nie błąd.
- **Uzupełnij tę sekcję / cały dokument** → `proposeCapacityOptions` → trzy propozycje
  (Przesuń kolejność / Podziel zakres / Dołóż moce) z wpływem i uzasadnieniem, do zatwierdzenia.

### 4.6 Czego ta paczka NIE robi (jawnie)

- **Nie zasila podaży (dostępności ludzi) z modułu Zespół** — dziś podaż wpisuje się ręcznie w scenariuszu
  mocy i tak zostaje. Kolumna bez danych pokazuje „Nieznane”, nie zero. → wiersz w `99_DECYZJE`.
- **Nie zmienia reguły, że analiza planu działa tylko na SZKICU** (`planAnalysisProposal.ts:45`) ani że
  scenariusz mocy musi być OPUBLIKOWANY i zgodny wersją (`:56-59`). Zmienia się tylko komunikat na polski.
- **Nie tworzy nowego algorytmu.** Heurystyką na istniejących danych jest wyłącznie liczba „Luki”
  w tabeli analiz (suma popytu ról per okres vs podaż) — liczona tą samą regułą co doradca.

---

## 5. Kroki wykonania

| # | Krok | Pliki | Rozmiar | Marker |
|---|---|---|---|---|
| 1 | Pole `name` w domenie i schematach (opcjonalne, kompatybilne wstecz) + `scenarioId` generowany kodem | `server/src/domain/initiatives-execution/planScenario.ts`, `capacityScenario.ts`, `routes/pmo/initiativesExecutionRuntime.routes.ts:443,514` | M | — |
| 2 | Rejestr kart N: 2 nowe klucze `plan`, `capacity_analysis` + wpisy + ekrany harnessu | `src/components/standard/registry.ts` | S | — |
| 3 | Menu 2: CTA + filtr dla zakładek `plan` i `capacity` | `src/components/Initiatives/InitiativesHub.tsx:2429-2452` | S | `[ODMROZENIE 05_INITIATIVES DEC-421]` |
| 4 | Menu 3: chipy liczone na planach / analizach (≤3), stare 9 przeniesione do sekcji karty | `InitiativesHub.tsx:2385-2408`, `canonicalMenu3.ts` | M | tak |
| 5 | Zakładka Plan → `StandardTable` PLANÓW + `StandardPreview` + „Otwórz” | `PlanScenarioSurface.tsx` | L | tak |
| 6 | Karta N `plan` (6 sekcji, `StandardArtifactShell`, `PracujZAI`) — przenosi dzisiejszy warsztat i tabelę okien | nowy `src/components/Initiatives/cards/PlanCard.tsx` + `PlanScenarioSurface.tsx` | L | tak |
| 7 | Generator planu (5 kroków, anatomia DEC-413) wpięty w „Uzupełnij cały dokument" | nowy `src/components/Initiatives/Generator/GeneratorPlanuModal.tsx` (wzór: `GeneratorInicjatywModal.tsx:437+`) | L | tak |
| 8 | Zakładka Obciążenie → `StandardTable` ANALIZ | `CapacityScenarioSurface.tsx` | L | tak |
| 9 | Karta N `capacity_analysis` (5 sekcji) + „Pracuj z AI" na `proposeCapacityOptions` | nowy `src/components/Initiatives/cards/CapacityAnalysisCard.tsx` | L | tak |
| 10 | Identyfikatory: `resolveBusinessDisplayLabel` na obu powierzchniach i w obu kartach | oba surface + obie karty | M | tak |
| 11 | i18n pl+en: statusy po polsku, nowe klucze `initiatives.plan.*`, `initiatives.capacityAnalysis.*` | `public/locales/{pl,en}/translation.json` | M | tak |
| 12 | Testy §6 | `src/components/Initiatives/__tests__/`, `server/src/**/__tests__/` (`git add -f`) | L | tak |

Kolejność wymuszona: 1 → 2 → 3/4 → 5 → 6 → 7; 8 → 9 może iść równolegle do 5–7 po kroku 1.
Krok 10 i 11 po 5–9. Krok 12 przy każdym kroku, nie na końcu.

---

## 6. Testy

**Jednostkowe + dowód mutacyjny** (mutacja celuje w ZABEZPIECZENIE, nie w mechanizm):

| Test | Asercja | Mutacja → RED |
|---|---|---|
| `PlanCard.zatwierdz.test.tsx` | propozycja generatora NIE zmienia planu, dopóki nie kliknięto „Zatwierdź” | usuń warunek `status === 'ACCEPTED'` przed zapisem → test czerwony |
| `PlanScenarioSurface.listaPlanow.test.tsx` | pierwsza kolumna tabeli to nazwa PLANU; żaden wiersz nie jest inicjatywą | podmień źródło na `windows` → RED |
| `nazwyBezKodow.test.tsx` | dla agregatu `{name:null, scenarioId:'aco-plan-scenario-123'}` render NIE zawiera `aco-` | usuń wywołanie `resolveBusinessDisplayLabel` → RED |
| `registry.kompletnosc.test.ts` (istnieje wzór w P10) | `plan` i `capacity_analysis` mają wpisy w `REJESTR_KART_N` | usuń wpis → RED (i tak nie skompiluje) |
| `planPublish.konflikt.realdb.test.ts` | plan z niepustym `conflicts` nie publikuje się bez jawnego potwierdzenia | usuń sprawdzenie konfliktu → RED |
| `capacityAnalysis.brakPresji.test.tsx` | `NoCapacityPressureError` → komunikat po polsku, nie pusty ekran ani stos błędu | zamień na `throw` w górę → RED |
| `planScenario.name.realdb.test.ts` | zapis i odczyt `name` na realnym PG (54400); agregat bez `name` czyta się dalej | usuń `name` z odczytu → RED |

**Trasy** — `realdb` (nie atrapa: `Database.ts:686` zwraca `changes:1` dla każdego UPDATE, więc zapis
warunkowy testujemy wyłącznie na PG 54400).

**Wizualne** — 1440 px, jasny + ciemny, `mean_luma > 150` dla jasnego, para light/dark musi się RÓŻNIĆ:
`evidence/p11-plan-obciazenie/` — `01-lista-planow.png`, `02-karta-planu.png`,
`03-generator-planu.png`, `04-lista-analiz.png`, `05-karta-analizy.png` (+ warianty `-dark`).

**Przepływ klikany** (Playwright, stanowisko lokalne): Inicjatywy → Plan → „Nowy plan” w Menu 2 →
karta → „Pracuj z AI” → „Uzupełnij cały dokument” → generator (5 kroków) → „Generuj” → propozycja
→ „Zatwierdź” → sekcja „Obciążenie ról” pokazuje rolę z przeciążeniem → powrót do listy planów.

---

## 7. Kryterium odbioru właściciela

Na `/initiatives` → Plan właściciel widzi **listę planów**, klika „Nowy plan” **w Menu 2**, dostaje osobną
kartę narzędzia, wskazuje 5 inicjatyw i horyzont 12 tygodni, generator proponuje kolejność z uzasadnieniem,
a w sekcji „Obciążenie ról” widzi, że Controls Engineer w okresie P11 jest przeciążony, i przesuwa jedną
inicjatywę — bez ani jednego napisu `aco-…` i bez ani jednego angielskiego statusu na ekranie.

---

## 8. Ryzyka i cofanie

| Ryzyko | Prawdopodobieństwo | Cofanie |
|---|---|---|
| Zmiana domeny `name` psuje odczyt zastanych agregatów | średnie | pole OPCJONALNE + test „agregat bez `name` czyta się dalej”; brak migracji danych = brak rollbacku danych |
| CHECK `935_plan_scenario_time_basis` odrzuca plan bez okresów | wysokie przy generatorze | generator zawsze tworzy ≥1 okres; test na pustym horyzoncie → 400 z polskim komunikatem |
| Przeniesienie tabeli okien do karty gubi funkcję | średnie | tabela przenoszona 1:1 (te same kolumny, ten sam `StandardTable`), test §6 wiersz 2 |
| Zamrożony `05_INITIATIVES` | pewne | marker `[ODMROZENIE 05_INITIATIVES DEC-421]` w każdym commicie; punkt powrotu = tag `mvp-final-05_INITIATIVES-20260905` |
| Rozjazd liczby „Luki” między listą a kartą | średnie | jedna funkcja licząca, reużyta w obu miejscach (reguła z `capacityOptionsAdvisor.ts:36-41`) |

Cofanie całości: `git revert` commitów paczki (gałąź `codex/p11-plan-obciazenie` nie jest scalona bez odbioru).
Brak flag = brak „wyłącz i udawaj, że działa”.

---

## 9. Nakład

| Rola | Zakres | Osobodni |
|---|---|---|
| Codex (funkcja celu) | kroki 1–12, całość | 2,5–3 |
| Opus | wsparcie przy kroku 6–7 (kontrakt karty + generator), jeśli Codex zgłosi STOP | 0,5 |
| Sonnet | krok 11 (i18n) — zrównoleglalny po kroku 5 | 0,3 |

Zrównoleglenie: gałąź Planu (5–7) i gałąź Obciążenia (8–9) po wspólnym kroku 1–2.

---

## 10. Cel osiągnięty = samokontrola Codexa (praca do celu)

**Komendy po każdym kroku:**
```bash
cd <worktree>
npx esbuild <każdy dotknięty plik> --loader:.tsx=tsx --outfile=/dev/null            # exit 0
npx vitest run --retry=0 --reporter=json --outputFile=/private/tmp/p11/<krok>.json <dotknięte testy>
bash scripts/check-list-canon.sh && bash scripts/check-artefakt.sh                  # exit 0
cd server && npx tsc --build tsconfig.build.json                                    # exit 0 (kroki 1, 12)
```
`numFailedTests` = 0 i zero `skipped`. `Transform failed` = błąd komendy, nie „baza zielona”.
Zastane czerwone policz **PRZED** pierwszą zmianą → `/private/tmp/p11/baza.json`; nowe = **0**.

**Progi liczbowe (bramka STOP):**

| Miara | Jak zmierzyć | Próg |
|---|---|---|
| kody techniczne w UI | `--dom` na obu listach i obu kartach + wzrokowo na 5 zrzutach | **0** wystąpień `aco-`, `ie-`, `scenario-<cyfry>` i UUID |
| karty w rejestrze | `grep -c` wpisów w `REJESTR_KART_N` | **10** (8 zastanych + `plan` + `capacity_analysis`) |
| tabela Planu | `--dom=table tbody tr` po otwarciu zakładki Plan | pierwsza kolumna = nazwa planu; **0** wierszy będących inicjatywą |
| CTA w Menu 2 | `--dom` na kontenerze Menu 2 | **1** przycisk „Nowy plan” na Planie, **1** „Nowa analiza” na Obciążeniu; **0** `btn-primary` w treści obu zakładek |
| chipy Menu 3 | `--dom` na pasku chipów | **≤ 3** na każdej z dwóch zakładek |
| angielskie statusy | stop-lista `EXECUTING, DRAFT, SCHEDULED, PUBLISHED, SUPERSEDED, PENDING_REVIEW, UNKNOWN, KNOWN, ESTIMATED` na zrzutach | **0** |
| `primary-*` | `grep -rn "primary-[0-9]"` w dotkniętych plikach | **0** |
| zrzuty | `evidence/p11-plan-obciazenie/*.png`, 1440, jasny (`mean_luma > 150`) + ciemny | **5 par**, każda para RÓŻNA (nie ten sam obraz pod dwiema nazwami) |
| testy | `vitest --reporter=json` | `numFailedTests` = 0, `skipped` = 0, nowe czerwone = 0 |
| mutacje | 7 mutacji z §6 | każda daje RED; mutacja bez RED = test nie broni zabezpieczenia → napraw test |

**Pomiar na żywo:** własne worktree, własny vite na wolnym porcie
(`VITE_DOTENV_DISABLED=1 VITE_API_TARGET=http://127.0.0.1:4100`), stanowisko lokalne:
API `127.0.0.1:4100`, PG `127.0.0.1:54400` (README: `scripts/dev/stanowisko-lokalne/README.md`).
**Nie uruchamiaj własnego serwera. Nie dotykaj `/private/tmp/m03` ani `/private/tmp/stanowisko-noc`
poza `cp auth.json`.** Zrzuty: `node scripts/dev/odbior-zywo/zrzut.mjs --url=… --port=… --host=127.0.0.1
--czekaj=6000 --dom=<selektor>` (`--czekaj` **nie mniej niż 6000** — karta z generatorem dociąga dane).
Baza lokalna ma **0 planów i 0 analiz** (§3.7), więc pierwszy plan **wolno utworzyć** — to jedyny wyjątek od
zakazu tworzenia rekordów; po pomiarze wpisz jego identyfikator do raportu (sprzątanie: zostaw, to baza NOC).

**Warunek STOP:** wszystkie progi spełnione → commit + `P11/98_RAPORT.md`. Próg niespełnialny bez decyzji
właściciela → wiersz w `P11/99_DECYZJE_WLASCICIELA.md` i praca dalej nad resztą. Zatrzymanie całości tylko
gdy stanowisko lokalne nie działa (raport STOP z `curl http://127.0.0.1:4100/api/health`).

**Zakazy:** `--no-verify`, `git stash`, `pkill`, sparse-checkout, `git worktree remove/prune`, `rm -rf`
poza własnym worktree, tworzenie flag, drugi solver / nowy silnik AI, edycja modułów zamrożonych bez
markera `[ODMROZENIE 05_INITIATIVES DEC-421]`, pytania do właściciela (niejasność → wiersz w `99_DECYZJE`), push.

---

## 11. Wklejka dla Codexa

```markdown
ZADANIE P11 — Plan i Obciążenie inicjatyw jako narzędzia (karty N) z generatorem (DEC-421).
KATALOG ROBOCZY: własne worktree z `origin/staging`, gałąź `codex/p11-plan-obciazenie`, commit-per-krok, BEZ push.
Paczka WIĄŻĄCA (przeczytaj w całości): docs/program/PROGRAM_NAPRAWCZY_20260905/P11_PLAN_I_OBCIAZENIE.md
Zasady: docs/ssot/STEROWANIE_KART_N_I_AI.md · src/components/standard/registry.ts · cardContract.types.ts
MODUŁ ZAMROŻONY: każdy commit z markerem [ODMROZENIE 05_INITIATIVES DEC-421].

CEL: konsultant tworzy plan przyciskiem w Menu 2, otwiera go jako osobną kartę narzędzia, a generator układa
kolejność wybranych inicjatyw w horyzoncie tak, by ludzie nie byli przeciążeni. Analiza obciążenia = druga karta.

CO JEST DZIŚ ŹLE (zmierzone):
- InitiativesHub.tsx:2429-2431 — primaryCta = undefined dla plan/capacity → CTA wsadzono W TREŚĆ
  (PlanScenarioSurface.tsx:881-883 + inline formularz :885-978).
- PlanScenarioSurface.tsx:1122-1198 — StandardTable pokazuje OKNA PLANU (inicjatywy); lista planów to tylko
  <select> (:1176-1195). To samo w CapacityScenarioSurface (tabela = okresy/ograniczenia).
- PlanScenarioSurface.tsx:257,609,892 — „Nazwa planu” pisze wprost scenarioId; planScenario.ts:22-37 nie ma
  `name` → w UI widać `aco-plan-scenario-1786420688957`. 0 testów obu powierzchni, brak kontraktu UI.

CO JUŻ ISTNIEJE — NIE PISZ TEGO OD NOWA (zakaz drugiego solvera i nowych silników AI):
- planSolver.ts:71 solvePlanScenario — deterministyczny solver: topologiczna kolejność zależności (:14),
  okno inicjatywy (:49), ograniczenie mocy (:54,:137), jawne „nie zastosowano, bo UNKNOWN” (:113-136).
- planAnalysisProposal.ts:60 → POST /plan-scenarios/:id/analysis-proposals/:proposalId (routes:3460) i
  /plan-analysis-proposals/:id/review (:3522); UI już to woła: PlanScenarioSurface.tsx:687.
- capacityOptionsAdvisor.ts:32 proposeCapacityOptions (RESEQUENCE/SCOPE_SPLIT/ADD_CAPACITY) →
  initiativesCapacityAdvisor.routes.ts:40; UI: CapacityScenarioSurface.tsx:794.
- Rejestry GOTOWE: GET /plan-scenarios (routes:3270), GET /capacity-scenarios (:3934).
Twoja robota to DROGA użytkownika do tego, co już liczy: lista → karta → generator.

KROKI (kolejność wymuszona; 8-9 równolegle do 5-7 po kroku 1):
1. Pole `name` (OPCJONALNE) w planScenario.ts, capacityScenario.ts i obu schematach zod
   (routes:443, :514); scenarioId generuje KOD (`plan-${crypto.randomUUID()}`), nie użytkownik.
2. registry.ts: 2 nowe klucze `plan` i `capacity_analysis` (klasa L) + wpisy + ekrany harnessu → 10 kart.
3. InitiativesHub.tsx:2429-2452 — Menu 2 dostaje CTA „Nowy plan” / „Nowa analiza” + dropdown filtra statusu.
4. Menu 3 (:2385-2408) — ≤3 chipy liczone na PLANACH (Szkice/Opublikowane/Z konfliktami) i ANALIZACH
   (Szkice/Opublikowane/Z lukami); dzisiejsze 9 chipów inicjatyw PRZENIEŚ do sekcji „Zakres inicjatyw” w karcie.
5. Zakładka Plan = StandardTable PLANÓW: Nazwa · Portfel/wersja · Horyzont · Status · Inicjatyw w planie ·
   Konflikty · Zaktualizowano · Autor. Klik = StandardPreview, „Otwórz” = karta N `plan`.
6. Karta N `plan` (StandardArtifactShell + ArtifactRightPanel + PracujZAI), sekcje: Horyzont · Zakres
   inicjatyw · Kolejność i okna (dzisiejsza tabela okien 1:1) · Zależności i konflikty · Obciążenie ról ·
   Decyzje.
7. Generator planu = „Pracuj z AI → Uzupełnij cały dokument”, anatomia 1:1 z
   Generator/GeneratorInicjatywModal.tsx:437+ : 1.Źródło (portfel+wersja) 2.Wybór inicjatyw 3.Parametry
   (początek · liczba okresów · jednostka · tryb: wg zależności / wg obciążenia ról / mieszany) 4.Generuj
   5.Zatwierdź. Tryb mapuje się na wywołanie solvera z capacityScenarioId lub bez — ZERO nowej logiki domeny.
8. Zakładka Obciążenie = StandardTable ANALIZ: Nazwa · Plan źródłowy · Okresy · Role · Luki · Status ·
   Zaktualizowano. „Luki” liczone regułą z capacityOptionsAdvisor.ts:36-41 (jedna funkcja, reużyta w karcie).
9. Karta N `capacity_analysis`: Plan źródłowy · Arkusz obciążenia (dzisiejsza tabela okres×rola 1:1) ·
   Luki i presja · Propozycje zmian · Decyzje. NoCapacityPressureError → „Brak przeciążeń do rozwiązania”.
10. Każda nazwa planu/analizy przez resolveBusinessDisplayLabel (businessDisplayLabel.ts:47); agregat bez
    nazwy → „Plan bez nazwy · utworzony <data>”, NIGDY `aco-…`.
11. i18n pl+en: EXECUTING→W realizacji, DRAFT→Szkic, SCHEDULED→Zaplanowana, PUBLISHED→Opublikowany,
    SUPERSEDED→Zastąpiony, PENDING_REVIEW→Do zatwierdzenia; planNameAria przestaje mówić „Identyfikator”.
12. Testy §6 paczki (nowe pliki przez `git add -f`), 7 mutacji — każda ma dać RED.
KANON: StandardTable/StandardModuleBar/StandardPreview dla list; StandardArtifactShell/ArtifactRightPanel/
PracujZAI dla kart; tokeny c-*; ZERO primary-* (każdy numer = crimson); fokus c-focus; i18n pl+en; zero flag.

DECYZJE WŁAŚCICIELA JUŻ PODJĘTE (nie pytaj, wykonuj): „Nowy plan” tworzy kartę ze szkicem zapisanym od razu,
generator w karcie; podaż ludzi w MVP ręcznie + jawne „Nieznane”; „Nowa analiza” tylko na opublikowanym
planie (komunikat po polsku); plan z konfliktami wolno opublikować z jawnym potwierdzeniem w śladzie;
9 chipów Planu przechodzi do sekcji „Zakres inicjatyw” w karcie.

PROGI (STOP dopiero gdy wszystkie spełnione):
- 0 kodów technicznych w UI (aco-, ie-, scenario-<cyfry>, UUID) na 5 zrzutach i w --dom;
- 10 wpisów w REJESTR_KART_N; 1 CTA w Menu 2 na każdej zakładce i 0 btn-primary w treści obu zakładek;
- ≤3 chipy Menu 3 na każdej zakładce; 0 wierszy-inicjatyw w tabeli Planu; 0 primary-[0-9];
- 0 angielskich statusów (stop-lista: EXECUTING, DRAFT, SCHEDULED, PUBLISHED, SUPERSEDED, PENDING_REVIEW,
  UNKNOWN, KNOWN, ESTIMATED);
- 5 par zrzutów 1440 (jasny mean_luma>150 + ciemny), para RÓŻNA — nie ten sam obraz pod dwiema nazwami;
- esbuild per plik exit 0; server tsc --build exit 0; vitest --reporter=json: numFailedTests=0, skipped=0,
  zastane czerwone policzone PRZED (/private/tmp/p11/baza.json), nowe=0; check-list-canon i check-artefakt exit 0;
- 7 mutacji z §6 → każda RED (mutacja bez RED = test nie broni zabezpieczenia, popraw test).

POMIAR NA ŻYWO: własne worktree, własny vite na wolnym porcie (VITE_DOTENV_DISABLED=1
VITE_API_TARGET=http://127.0.0.1:4100); stanowisko lokalne API 4100, PG 54400
(scripts/dev/stanowisko-lokalne/README.md). Zrzuty: node scripts/dev/odbior-zywo/zrzut.mjs --url=… --port=…
--host=127.0.0.1 --czekaj=6000 --dom=<selektor>. Baza NOC ma 0 planów i 0 analiz — pierwszy plan WOLNO
utworzyć (jedyny wyjątek od zakazu tworzenia rekordów), jego id wpisz do raportu.

RAPORT: P11/98_RAPORT.md — zmierzone przed/po, progi z liczbami, commity, zrzuty, wynik mutacji, co
niezmierzone i dlaczego. DECYZJE: P11/99_DECYZJE_WLASCICIELA.md (jedno pytanie na wiersz, po polsku,
z rekomendacją i skutkiem „Tak”).

ZAKAZY: --no-verify, git stash, pkill, sparse-checkout, git worktree remove/prune, rm -rf poza własnym
worktree, flagi, drugi solver / nowy silnik AI, edycja modułów zamrożonych bez markera, pytania do
właściciela, push, dotykanie /private/tmp/m03 i /private/tmp/stanowisko-noc (poza cp auth.json).
Pracuj, aż progi spełnione albo każdy niespełniony ma wiersz w 99_DECYZJE.
```

---

## 12. Niejasności — ROZSTRZYGNIĘTE przez CTO 06.09 16:10 wg rekomendacji (właściciel może zmienić jednym zdaniem)

| # | Pytanie | Rekomendacja CTO |
|---|---|---|
| 1 | „Nowy plan” tworzy pusty szkic, czy od razu otwiera generator? | Otwiera KARTĘ ze szkicem zapisanym natychmiast; generator jest w karcie („Pracuj z AI”) — nic nie ginie po zamknięciu |
| 2 | Skąd dostępność ludzi (podaż)? Dziś tylko ręcznie w scenariuszu mocy | MVP: ręcznie + jawne „Nieznane”; zasilenie z modułu Zespół osobną paczką po MVP |
| 3 | Czy „Nowa analiza” ma działać na SZKICU planu? Dziś wymaga opublikowanego | Zostawić dzisiejszy warunek, tylko komunikat po polsku — inaczej analiza liczyłaby na ruchomym celu |
| 4 | Czy plan z konfliktami wolno opublikować? | Wolno, ale z jawnym potwierdzeniem („Publikuję mimo N konfliktów”) zapisanym w śladzie |
| 5 | 9 chipów Menu 3 z dzisiejszego Planu — zostawić gdziekolwiek? | Przenieść do sekcji „Zakres inicjatyw” w karcie planu; Menu 3 listy dostaje 3 chipy planów |
