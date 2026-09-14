# F2-3 PMO E3 — niezależny sceptyczny przegląd

**Werdykt: REQUEST_CHANGES. Kandydat `aa34e8ddf66f059e52a5f57fba8e980d61a250d4` nie może wejść do integracji, ponieważ końcowa bramka PMBOK-lite nie działa na zmierzonym schemacie PostgreSQL, a freeze nie spełnia kontraktu dowodowego.**

## Tożsamość odbioru

- kandydat: `aa34e8ddf66f059e52a5f57fba8e980d61a250d4`;
- baza: `21d7d27ecf8aa5f70def36ff52b1db14854e1eaf`;
- worktree: `/Users/piotrwisniewski/Developer/codex-wt/f2-3-pmo-20260913`;
- zakres przeglądu: Wpisy CTO 20, 22, 24, 27–29 oraz `F2_3_PMO_E3_FREEZE_20260914.md`;
- implementacja autora pozostała bez zmian.

## Znaleziska blokujące

### P1 — `CLOSURE_GATE` jest trwale zamknięta przez dwa zapytania niezgodne z realnym schematem

`server/src/services/stageGateService.ts` ocenia warunek braku blokujących decyzji przez `required = 1`, ale `decisions.required` ma w zmierzonym PostgreSQL typ `text`. PostgreSQL zwraca `operator does not exist: text = integer`. Następny warunek liczy `kpi_results`, lecz taka relacja nie istnieje w zmierzonym schemacie; obecne rodziny KPI to między innymi `project_kpis`, `initiative_kpis` i `kpi_measurements`. Oba wyjątki są przechwytywane i zamieniane na `false`, więc użytkownik dostaje zwykłe `NOT_READY`, a nie informację o błędzie schematu. W efekcie piąta z pięciu deklarowanych bramek nie może przejść nawet przy poprawnych danych.

Test RealPG `stageGates.pmoE3.realpg.test.ts` przechodzi tylko ścieżkę `READINESS_GATE`. Test modelu UI sprawdza projekcję pięciu wierszy z danych wejściowych, nie uruchamia zapytań pozostałych bramek. Do odbioru potrzeba realnego PostgreSQL dla DESIGN, PLANNING, EXECUTION i CLOSURE, w tym przynajmniej jednego rzeczywiście osiągalnego przejścia każdej bramki oraz fail-closed dla brakujących danych.

### P2 — freeze nie jest samowystarczalny i przekracza limit evidence

Śledzony katalog `evidence/f2-3-pmo` ma `4 494 867` bajtów, czyli przekracza limit 2 MB. Finalny freeze przyznaje, że zrzuty E3 jasny/ciemny nie zostały zapisane. Dostępne zrzuty E2 pokazują role, odpowiedzialności i plan komunikacji, ale nie pokazują finalnej tabeli bramek ani przejścia `Readiness = Passed`; dlatego deklarowanego przeklikania E3 nie można niezależnie obejrzeć ani odtworzyć z freeze.

Jedyny `FREEZE_MANIFEST.json` należy do dawnego `F2-3 PMO E1`, wskazuje bazę `bc40d532...` i zakres `review-and-ssot-only`. Nie opisuje kandydata `aa34e8dd...` względem `21d7d27e...`. Brakuje finalnego manifestu kodu, migracji, testów i dowodów E3. Dodatkowo `git diff --check 21d7d27e..aa34e8dd` jest czerwony przez liczne końcowe puste linie i trailing whitespace w odziedziczonych logach evidence.

Do odbioru potrzeba odchudzić evidence do maksymalnie 2 MB, zachować po jednym aktualnym zrzucie jasnym i ciemnym pokazującym finalny ekran E3, dodać samowystarczalny manifest z bazą i hashami oraz doprowadzić `git diff --check` do zielonego wyniku.

## Zakres potwierdzony

- `/projects` przy `VITE_PMO_PROJECTS === "true"` montuje `MyProjects`, a domyślne OFF przekierowuje do `/my-work`;
- kreator projektu woła realne `POST /api/projects`, a istniejący dowód Gateway/RealPG zapisuje i odczytuje kontrakt projektu;
- role, alokacje per osoba, plan komunikacji i wejścia do akceptacji korzystają z kanonicznego modelu projektu;
- tenant jest ustalany po stronie serwera; obcy projekt daje 404;
- zatwierdzenie bramki odczytuje rolę z `project_members` wewnątrz przypiętej transakcji; wildcard aplikacyjny OWNER nie zastępuje roli projektu;
- zapis receipt i zmiana fazy korzystają z jednego kontekstu `withPgTransaction`; test rollbacku jest adekwatny dla bramki READINESS;
- migracja `20262190_f2_3_pmo_stage_gates.sql` jest addytywna, zawiera pięć dozwolonych typów, FK `projects(id) ON DELETE CASCADE`, dwa indeksy i nie koliduje z pulą `20262200–20262219`; zgodę CTO odnotowano we Wpisie 27;
- ekran używa `StandardModuleBar`, `StandardTable` i `StandardPreview`; w dodanych liniach nie ma `primary-*`, crimson ani surowych kolorów hex;
- nowe klucze i18n mają parytet EN/PL.

## Własna walidacja odbiorcy

- focused Vitest: 8 plików, 21/21 PASS, `--retry=0`;
- `npm run -s type-check:server`: PASS, 0 błędów;
- esbuild per plik: 7/7 PASS;
- statyczny audyt nowych tokenów: 7/7 plików bez `primary-*`, crimson i hex;
- parytet i18n: `myWork.createProjectModal` 11/11, `myWork.projects` 167/167;
- read-only schema probe na lokalnym PostgreSQL: pozostałe zapytania DESIGN/PLANNING/EXECUTION parsują się, oba zapytania CLOSURE opisane w P1 zwracają rzeczywiste błędy PostgreSQL;
- `git diff --check`: FAIL wyłącznie w śledzonym evidence; to nadal łamie bramkę paczki.

## Drobna niespójność do poprawy razem z reworkiem

Kreator pozwala wpisać budżet `0` (`min={0}`), a `CreateProjectSchema` wymaga liczby dodatniej (`positive()`), więc wartość dozwolona przez UI kończy się błędem 400. UI i walidator powinny mieć ten sam kontrakt.

## Warunki ponownego odbioru

1. Naprawić zapytania CLOSURE na kanonicznych tabelach i typach.
2. Dodać realne testy wszystkich pięciu bramek na aktualnym schemacie, z SQL readbackiem fazy i receipt.
3. Odchudzić evidence do ≤2 MB, zapisać finalne light/dark i utworzyć manifest dokładnego kandydata.
4. Uzyskać zielone `git diff --check`, focused tests, server tsc i esbuild.
5. Zamrozić nowy SHA i wysłać do świeżego niezależnego re-review.
