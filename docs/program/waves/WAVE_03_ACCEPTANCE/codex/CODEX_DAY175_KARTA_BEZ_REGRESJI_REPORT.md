# CODEX — DYŻUR 175 — KARTA BEZ REGRESJI

Data: 2026-08-30

Marker: `d3d36cd5f5`

Gałąź: `codex/day175-karta-bez-regresji-20260830`

Worktree: `/private/tmp/cx-day175-karta-bez-regresji`

Status: **R1/R2/R3 ZREALIZOWANE I ZWERYFIKOWANE W ZAKRESIE TESTÓW; BRAK ODBIORU W REALNEJ PRZEGLĄDARCE**

## 1. Stan wejściowy i baza

Wynik §0.1 (2), dosłownie:

```text
a3fa12bd66 docs(codex): dyzury 174-179 wydane — stop agenta+koszt+polityki, karta bez regresji (163-bis), ustawienia MEMBER, partner G08, ocena sourceType, czat i18n
93f979a865 decyzje wlasciciela runda 2: warsztat Audytow TERAZ, kalendarz ON, migracja legacy->kanon w MVP, straznik groundingu poluzowany z rubryka
7b4da09c7b doradca mocy: kolumna Rola/zespol przestaje powtarzac Opiekuna — realne role z proposedAssignments, ograniczenie bez zmyslonego przymiotnika
2142a145a0 dziennik: Z-10 macierz WSTRZYMANA (wzorzec = SIRI, zbudowalem prezentacje zamiast narzedzia) + Z-11 logowanie wlasciciela
74775cea67 decyzje wlasciciela 30.08 wieczor: Spotkania beta OD RAZU, sygnaly ON, PDF audytu w MVP, powierzchnia odbioru = STAGING (K5 doprecyzowany)
73725a19b2 plan i doradca mocy: duplikat kolumny usuniety, trzy zawsze-puste kolumny domyslnie ukryte, etykiety skrocone — 10 kolumn zamiast 14, zero ucinania
6ee31b4da1 macierz obszary x poziomy: prawdziwa siatka 2D wyrenderowana po raz pierwszy — 609 linii martwego kodu, siedem osi, liczba poziomow ze zrodla prawdy
d3d36cd5f5 sciezka wyjscia K1-K6 (kotwica: plan 4-fazowy 24.08, Faza 2 -> 3) + odbior 170 zaktualizowany: SCALONO po FIX-170, mechanika A
ab82afbc1b merge: dyzur 170 + FIX-170 (okna check-inu OKR — mechanika A po naprawie dat ::text, test przenosny, B2+isCurrent zasercjonowane; UI C do zrzutu B1) — odbior adwersaryjny
99f9e3bf71 dziennik: Z-9 — kopii prawdy o osiach jest osiem, nie piec; czwarty raz zawezilem zasieg
2eefeb93aa osie DRD: trzy kolejne odklejone kopie podlaczone do zrodla prawdy (radar, import raportu, import serwerowy) + kolejnosc osi 1-7 w harnessie
913edb8ad3 fix(day170): distinguish fetch failure from empty occurrence list
080516f294 fix(day170): dates as ::text, portable test, B2+isCurrent asserted
6a28e8f1d3 DRD 7E: propozycja pieciu poziomow kompetencji i kultury AI — obszar, ktory w dokumentacji wlasciciela byl zapowiedziany i nieopisany
645e5b9fc0 odbior 170: NIE SCALAC — data o dobe wstecz poza UTC (commit naprawy wprowadzil blad, ktory mial naprawic), test-tautologia 226b5aaae4, pin bazy wykonawcy klasy Z31; naprawa wydana robotnikowi
36a3085b2d dziennik: Z-9 — prawda o osiach DRD w szesciu kopiach; trzecie sprostowanie tego samego dnia i wzorzec bledu (zawezanie zasiegu do tego, co zmierzone)
4b8097b879 macierz DRD: poziomy osi z jednego zrodla prawdy (drdStructure) zamiast wlasnej kopii — kultura i cyber mialy 5 zamiast 6
2fc5e3321f tabele: ostatnia kolumna przestaje byc ucinana — jadro skaluje kolumny gdy suma przekracza kontener (8 ekranow zmierzonych, 6 naprawionych)
1abf43dbd4 rekonesans zamkniecia 16 modulow: szkic z kart zweryfikowany kodem przez 5 agentow — 8 tez obalonych, 6 nowych znalezisk, suma 21-29 dyzurow w trzech falach; sprostowanie wiersza komentarzy w rejestrze
ca147b3aef DRD: zrodlo nowsze niz ksiazka znalezione — os 6 ma 6 poziomow, os 7 ma 5; prostuje wlasna nieprecyzyjnosc (blad jest w JEDNYM pliku, nie w kodzie)
e7f35db083 grafika: dziennik zdarzen z kontekstem (regula 10) — osiem zdarzen sesji, w tym dwa sprostowania wlasnych bledow
7bbd512ad1 zasady: reguly 9 i 10 od wlasciciela — zlecaj robotnikom z doborem modelu do trudnosci; dokumentuj KONTEKST zdarzenia, nie tylko wynik
c94dffcfa0 zasady: regula 8 — zakaz git stash u robotnikow (wspolny stos zabiera cudza prace)
f2194c5bbc Finanse/predykcja: wybor trybu i wariantow to pigulki kanonu Menu 2 — ten sam defekt co w Wycenie, znaleziony przy okazji
54609cc2b4 DRD: ksiazka wlasciciela 'Digital Pathfinder' kontra kod — dwie osie maja o jeden poziom za malo, prostuje wlasna rekomendacje
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
d3d36cd5f51ed9db796bb350c1109ebc2e4b705c
```

`git status --short | head -3` nie wypisał żadnej linii. Dysk: 24 GiB wolne. Porty `6075`, `5020`, `5021`: brak listenerów. Tip bazowy uciekł o 7 commitów; start nastąpił dokładnie z markera, bez rebase.

Pełna baza lokalna: kontener `cx-day175-pg`, `127.0.0.1:6075`, baza `cx175`, obraz `pgvector/pgvector:pg16`. Pierwszy przebieg od pustej bazy zastosował 869 migracji, następny 0. Po dodaniu migracji 175: 1 (`20260830_day175_task_risk_alternatives.sql`), następny 0. Readback `information_schema`: `risks` i `alternatives` mają typ `jsonb`.

## 2. Korekty wobec instrukcji

1. T5 oczekiwał braku dyżuru 174. Pomiar na starcie znalazł lokalną gałąź `codex/day174-stop-agenta-20260830`; instrukcja 174 była już na nowszym tipie `a3fa12bd66`, choć nie na markerze. Przeczytałem jej tabelę licencji przed pierwszym pushem. Nie ma kolizji z licencją 175.
2. Instrukcja wielokrotnie wymaga pomiaru „wg §0.4a”, lecz wydany plik nie zawiera sekcji 0.4a (nagłówki przechodzą z 0.2d do 0.5). Bezpieczna interpretacja: zmierzyłem pełną listę plików `git diff --name-only d3d36cd5f5..HEAD`, uruchomiłem oba imienne pakiety dowodowe z `--retry=0`, raportuję pełne nazwy i liczniki; nie wymyślam nieistniejącego protokołu.
3. Pierwsza próba testu serwerowego z rootu i `--config server/vitest.config.ts` dała `numTotalTests: 0`; nie została uznana za PASS. Poprawny przebieg wykonano z katalogu `server/`, gdzie `server/vitest.config.ts` zbiera `src/**`.
4. Lint sześciu plików ujawnił zastany `simple-import-sort/imports` w `tasks.routes.ts`; diff nie zmienia żadnego importu. Cztery błędy Prettier w nowych testach poprawiono. Ponowny lint nowych testów: 0 błędów, 1 ostrzeżenie `no-explicit-any` w lokalnym mocku propsów.

## 3. Rozłączność

Instrukcja 173 została przeczytana w całości. Jej zapis obejmuje root `vitest.config.ts`, blok `DecisionDetailView.tsx`, `InitiativeTasksTab.tsx`, `UserTaskList.tsx`, `Portfolio/InitiativeSidePanel.tsx`, `Initiatives/calendar/InitiativeCalendar.tsx`, testy 173 i raport 173. Żaden z tych plików nie pokrywa się z zapisem 175.

Tabela licencji 174 obejmuje pliki planera/workerów/agenta, opcjonalny cennik/migrację, testy 174 i raport 174; imiennie uznaje `vitest.config.ts` za nietykalny. Nie pokrywa się z plikami 175.

Nie zmieniono plików 160/161/162/170/171/172 ani porzuconego worktree/gałęzi 163. Brama `router.use(requireCanonicalExecutionWriter)` pozostała bez zmian.

## 4. R1 — dobra część 163

Przeniesiono semantycznie, bez cherry-picka: addytywną migrację JSONB (z nazwą Day 175), dwa pola walidatora, dwie tenant-scoped metody kontrolera, GET/PUT trasy oraz test RealPG przez `ApiGateway`. Ręczny transfer był konieczny, aby nie przejąć regresyjnego frontu i raportu 163.

GET frontu używa wspólnego `Api.get` i jest fail-soft: awaria tej sekcji daje rozpoznawalny `console.warn`, ustawia tylko obie listy na `[]` i nie wywraca ładowania pozostałych pól karty.

## 5. R2 — reakcja frontu na stałe 409

Po sukcesie `Api.updatePersonalTask` nadal wykonują się: token wersji, toast sukcesu (dla zapisu ręcznego), eventy, `onSaved`, a następnie próba `Api.put('/tasks/:id/risk-alternatives')`.

Błąd podtrasy jest przechwytywany lokalnie. Zapis ręczny dostaje odróżnialny komunikat `Task saved, but Risk & Alternatives could not be saved`; autozapis `silent=true` nie pokazuje toasta i pozostawia `console.warn`. Błąd nie dociera do ogólnego `catch`, więc nie powstaje fałszywy `Failed to save task`. Wspólny blok baseline wykonuje się i kończy pętlę 900 ms.

Świadoma luka: `persistedDraft`/`draftSnapshot` nadal nie zawiera `risks`/`alternatives`. Edycja wyłącznie tej sekcji nie uruchamia samodzielnie autosave. Nie zmieniłem tego, bo tabela licencji ogranicza zapis w `TaskDetailView.tsx` do `loadTask` i `handleSave`; zmiana `persistedDraft` byłaby poza imiennym zakresem. Stan: **DO DECYZJI WŁAŚCICIELA**.

## 6. Dowody PASS → FAIL → PASS

### Real PostgreSQL / real ApiGateway

Komenda końcowa użyła w jednej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6075/cx175 JWT_SECRET=cx175-test-secret-do-not-reuse`, config serwerowy i `--retry=0`.

Finalny wynik: 2/2 PASS, 0 failed:

- `Day 175 task Risk & Alternatives persistence on real PostgreSQL reads JSONB through the real ApiGateway and a fresh PostgreSQL query`
- `Day 175 task Risk & Alternatives persistence on real PostgreSQL records the canonical-writer 409 and proves the attempted write changed nothing`

Mutacja: kontroler zwracał `risks: []`. Wynik: 1/2 FAIL; pierwszy pełny test padł na różnicy między odpowiedzią HTTP a świeżym readbackiem PG. Po przywróceniu SHA pliku wrócił do `e2435cce...`, finalnie 2/2 PASS.

Pułapki Z33: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) przez pracę z katalogu `server/`, config respektujący shell i asercję `DB_TYPE === postgres`; (d) przez `ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT. Test montuje realny `ApiGateway`, nie goły router. PUT 409 ma `--retry=0` i readback bez zmian.

### Front / fake timers

Finalny wynik: 1/1 PASS, 0 failed:

- `TaskDetailView Risk & Alternatives save regression keeps the successful task save, reports the gated section, and stops the 900ms autosave loop`

Test edytuje istniejące zadanie, wykonuje zapis ręczny, wymusza 409 wspólnego klienta, sprawdza sukces bazowy i odrębny sygnał częściowy, następnie przewija zegar o 900 ms. Finalnie `updatePersonalTask` i `Api.put` mają po jednym wywołaniu.

Mutacja: lokalny catch ponownie rzucał błąd przed baseline. Wynik: 0/1 FAIL dokładnie z `expected vi.fn() to be called 1 times, but got 2 times`. Po przywróceniu SHA `TaskDetailView.tsx` wrócił do `9a0daec8...`, finalnie 1/1 PASS.

Pułapki Z33 (a)–(d) nie leżą na ścieżce tego czysto frontendowego testu z mockiem API; pułapka (e) jest jego przedmiotem i została wyłączona fake timers, licznikiem wywołań oraz mutacją w obie strony. `RUN_DB_TESTS=0 MOCK_DB=true`; test nie jest przedstawiany jako dowód backendu.

## 7. Z30 — zero wysyłki

Przed migracjami: `BRAK ZMIENNYCH POCZTY`. Po pełnych migracjach zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy. Grep drenaży w `server/src/Gateway.ts`: 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 8. Artefakty

- `day175-migration-apply.log` — `d2f8d5c19bb8da2459d73b848bd7ed4e8210c4f01d2d444985aa69c9ec99a92f`
- `day175-migration-idempotence.log` — `f5e27c4ecfd23f71ce9df83d8ca6153135f722016ae4accce84cac20b2260010`
- `day175-realpg-final-pass.json` — `a487e453997788e599fe298d0fa63206b55dd07e1e08a7c2067fb52e21dcd50e`
- `day175-realpg-mutated-fail.json` — `847370de091a859cfb1c5d28f23272a2567d2803b65d30c43a1b4f5ffcbb741a`
- `day175-frontend-final-pass.json` — `93313a3db31c632361fe30c204d687e1e7665f105c06ecdba726435a2892adcf`
- `day175-frontend-mutated-fail-loop.json` — `561c5a9fe21987c0b674115fcc6a34dabc4f2975d58c03380eb2040299f961a0`

Wszystkie leżą poza repo w `/private/tmp/cx-day175-karta-bez-regresji-artefakty`.

## 9. Pliki i commity

Implementacja: `104719eb7d` (`fix(day175): preserve task save across gated risk section`), push potwierdzony na `github-backup/codex/day175-karta-bez-regresji-20260830`.

Pliki implementacji:

- `server/migrations/20260830_day175_task_risk_alternatives.sql`
- `server/src/controllers/TaskController.ts`
- `server/src/routes/__tests__/day175.task-risk-alternatives-persistence.pg.test.ts`
- `server/src/routes/pmo/tasks.routes.ts`
- `server/src/validators/task.validators.ts`
- `src/components/MyWork/TaskDetailView.tsx`
- `src/components/MyWork/__tests__/TaskDetailView.riskAlternativesSave.ownerBehavior.test.tsx`

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- Nie uruchomiono pełnego kanonicznego runtime ani realnej przeglądarki; brak zrzutów i sieciowego logu UI. Zachowanie komunikatów i timera jest zweryfikowane w komponencie z mockiem API.
- Nie udowodniono trwałego PUT `risk-alternatives`, ponieważ zamierzona globalna brama zwraca 409; test dowodzi właśnie 409 i niezmienionej bazy.
- Nie rozszerzono ani nie zmierzono autosave dla edycji wyłącznie `risks/alternatives`; luka pozostaje do decyzji właściciela.
- Nie wykonano pełnego repozytoryjnego typecheck/lintu bez długu zastanego. Imienne testy przechodzą, `git diff --check` jest czysty, nowe testy mają 0 błędów lint.
