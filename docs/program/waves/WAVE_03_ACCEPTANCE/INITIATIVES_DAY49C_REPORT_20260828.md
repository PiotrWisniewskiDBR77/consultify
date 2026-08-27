# INICJATYWY — RAPORT DYŻURU 49C (2026-08-28)

## Werdykt

`PARTIAL / STOPPED_BY_BINDING_SPEC` (stan na koniec dyżuru 49C) — odziedziczono i zweryfikowano wcześniejsze A.1–C.1; kontynuację zatrzymano w D.1. Nie rozpoczęto E.1, F.1 ani R.1, ponieważ użytkownik nakazał kolejność D.1 → E.1 → F.1 → R.1 → R.2 oraz regułę STOP zamiast zgadywania.

**★ AKTUALIZACJA — dokończenie 2026-08-27, gałąź `day49-finish-20260828`, commity `3fa8697972`..`d76592fdb4`.** Nadzorca wydał wąską licencję odblokowującą D.1 STOP (jeden nowy plik harnessu, jeden wpis rejestru, port 3361). Werdykt końcowy tej kontynuacji: **D.1 = DONE dla Planu, NIE_ZROBIONE dla Mocy** (patrz sekcja niżej) · **E.1 = DONE (mechanicznie, ze spot-checkiem)** · **F.1 = PARTIAL** (naprawiono realną wadę seeda, ale nie dostarczono danych prezentacyjnych pętli §A.2) · **R.1 = DONE** · **R.2 = ten dopisek**. Pełny opis w sekcji „★★ KONTYNUACJA 2026-08-27" na końcu tego pliku.

## Marker — wynik obu komend dosłownie

```text
$ git rev-parse HEAD   # przed pierwszym commitem Day49C
b6c4bcb2eb32eeb17076a9c29460a696bd182796
$ git rev-parse b6c4bcb2eb
b6c4bcb2eb32eeb17076a9c29460a696bd182796
```

Gałąź: `codex/initiatives-day49c-20260828`. Instrukcja `2ee40c7d` przeczytana w całości: `1842/1842`; SHA-256: `0c0080bb8521ceb30dd97770ec2a75b5225cabcc51fd901400c988edfbee183a`.

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Korekta: przed odczytaniem Z5 wykonałem w chronionym checkoutcie wyłącznie odczytowe `git status`, `git remote -v`, `git worktree list` oraz `git fetch github-backup`. Nie zmieniłem tam plików. Po poznaniu Z5 cała praca odbywała się w `/private/tmp/consultify-initiatives-day49c`; jedynym kontaktem z checkoutem właściciela był dozwolony symlink `node_modules`.

## Oświadczenie o zakazie `git stash` (Z27)

`git stash list` zwrócił pusty wynik. Nie użyto stash.

## Oświadczenie o zakazie wysyłki powiadomień (Z30)

`ENABLE_INITIATIVE_EXECUTION_OUTBOX_CONSUMER` nie był ustawiony. `initiativeExecutionOutboxConsumer.ts:147` zwraca `DISABLED`, jeśli wartość nie jest literalnie `true`. Consumer nie ma dostawcy e-mail/SMS/webhook: zapisuje neutralne pokwitowanie wyłącznie do `ie_outbox_delivery_receipts` w lokalnym PG.

## Dowód celu połączenia (Z20/Z25/Z26/Z28)

Jednorazowy kontener `cx-day49-pg`, obraz `pgvector/pgvector:pg16`, mapowanie `127.0.0.1:5817 → 5432`, DB `cx_day49`. Pełny runner zastosował `858` migracji; drugi identyczny przebieg zastosował `0`. `SELECT current_database(), inet_server_port()` wykonany wewnątrz kontenera zwrócił `cx_day49|` (połączenie przez socket nie raportowało portu); mapowanie portu potwierdzono przez Docker. Nie użyto Railway ani zdalnej bazy.

## Pomiar zasięgu ZASTANY przed pierwszym commitem

```text
server: Test Files 5 failed | 9 passed (14)
server: Tests 24 failed | 63 passed (87), SKIPPED 0
root: Test Files 13 failed | 86 passed | 27 skipped (126)
root: Tests 39 failed | 399 passed | 43 skipped (481)
```

Komendy miały w tej samej linii `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5817/cx_day49` i `--retry=0`; testy serwerowe uruchomiono z `server` i `--config vitest.config.ts`. Czerwień jest zastana (m.in. równoległy init schematu i FK przy `TRUNCATE`), nie została nazwana PASS.

## Push po pierwszym commicie

Pierwszym commitem na nowej gałęzi był odziedziczony A.3: `51a9f6ae7b`. Natychmiast po nim wykonano `git push -u github-backup codex/initiatives-day49c-20260828`; push utworzył zdalną gałąź na `github-backup`. Nie użyto `origin`.

## Pozycje — tabela zbiorcza

| Pozycja | Status | Commit / dowód |
| --- | --- | --- |
| A.1 | ODZIEDZICZONE | marker `b6c4bcb2eb`; realny Gateway i PG opisane w raporcie Day49 odczytanym z obiektu Git |
| A.2 | ODZIEDZICZONE | marker `b6c4bcb2eb`; doradca uczciwie zachowuje `UNKNOWN/null` |
| A.3 | ODZIEDZICZONE | `51a9f6ae7b`; realny `CapacityScenarioSurface demoMode={false}` i transport fetch w harnessie |
| A.4 | ODZIEDZICZONE | marker `b6c4bcb2eb`; test propose → GET → select → GET przez realny Gateway |
| B.1 | ODZIEDZICZONE | `c6c48a6569`; tabela 25 funkcji |
| B.2 | ODZIEDZICZONE | `5c78f3b6d6`; brak bezspornego wykonania mieszczącego się w licencji |
| C.1 | ODZIEDZICZONE | `38d7295f60`; trasa zmierzona przez realny Gateway, widok za flagą default OFF |
| D.1 | `STOP / NOT_COMMITTED` | brak licencjonowanego ekranu Planu w harnessie 3357; prototyp wycofany w całości |
| E.1 | NOT_STARTED | zatrzymane przez kolejność po STOP D.1 |
| F.1 | NOT_STARTED | zatrzymane przez kolejność po STOP D.1 |
| R.1 | NOT_STARTED | brak nowych, kompletnie dowiedzionych pozycji do podniesienia |
| R.2 | PARTIAL | ten raport |

## D.1 — STOP

Literalny blocker: `rg -n 'PlanScenarioSurface|CapacityScenarioSurface' dev-render/screens dev-render/main.tsx` znajduje tylko `dev-render/screens/capacity-advisor-a3.tsx` i wpis `capacity-advisor-a3`. Harness nie ma ekranu renderującego `PlanScenarioSurface`. D.1 wymaga sześciu zrzutów: oba ekrany × jasny/ciemny/pusty w PL. Bez ekranu Planu trzy z sześciu dowodów są niewykonalne.

**Licencja, którą sprawdziłem:** §1.7 daje zapis do `PlanScenarioSurface.tsx`, `CapacityScenarioSurface.tsx` i dopisywanie kluczy locale. Nie wymienia `dev-render/**`; wszystko niewymienione jest tylko do odczytu. Wcześniejsza licencja nadzorcy dotyczyła jednego konkretnego pliku A.3 renderującego realny `CapacityScenarioSurface`, nie ekranu D.1 dla Planu. Nie rozszerzyłem jej samodzielnie.

Niecommitowany prototyp przenosił widoczne napisy przez `t()` z parytetem PL/EN; Capacity miał `7/7 PASS`, a Plan zachowywał zastany jeden czerwony test oczekujący dawnej etykiety `Analyze`. Prototyp został całkowicie wycofany, ponieważ sam kod i test nie zastępują obowiązkowego dowodu wizualnego.

Do odblokowania potrzeba jawnej licencji na jeden ekran harnessu dla realnego `PlanScenarioSurface` (oraz wpis rejestru) albo wskazania istniejącego, licencjonowanego ekranu, którego nie ma na markerze.

## Znany stan otwarty D.1 — wołający `proposeCapacityOptions`

Teza zlecenia o braku produkcyjnego wołającego jest po odziedziczonym A.3 nieaktualna na HEAD: `CapacityScenarioSurface.tsx` importuje i wywołuje `proposeCapacityOptions`. To dowodzi istnienia wołającego, nie działania. Działanie było wcześniej dowiedzione testem komponentowym `7/7 PASS` (klik → POST → pełne `load()` → trójka), a backend markerem A.4 przez realny Gateway. W tej kontynuacji nie powtórzono realnego kliku przeglądarkowego, ponieważ D.1 zatrzymała brakująca licencja harnessu Planu; dlatego twierdzenie o kliku pozostaje niezweryfikowane w tej sesji.

## Korekty wobec instrukcji

- Marker `44f301142f` zastąpiono markerem `b6c4bcb2eb` na jawne polecenie użytkownika.
- Nazwę raportu zastąpiono `INITIATIVES_DAY49C_REPORT_20260828.md` na jawne polecenie użytkownika.
- Po pierwszym commicie wykonano push natychmiast, zamiast dopiero przy domknięciu.
- Stary raport Day49B usunięto z końcowego drzewa, aby końcowy stan zawierał dokładnie jeden raport tej kontynuacji.

## ★★ TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano w tej sesji realnego kliku A.3 w przeglądarce; zielony test komponentowy nie jest dowodem przeglądarkowym.
- Nie sprawdzono widoku D.1 oczami właściciela ani na żywej bazie demo; użycie żywej bazy było zabronione.
- Nie zweryfikowano kompletności tłumaczeń Plan/Moc, ponieważ prototyp D.1 został wycofany po wiążącym STOP-ie wizualnym.
- Nie sklasyfikowano każdej trasy E.1 przez realne HTTP ani nie uruchomiono seeda F.1, bo te pozycje nie zostały rozpoczęte po STOP D.1.

## Rekomendacje dla nadzorcy

1. Nadać wąską licencję na jeden ekran `dev-render` dla realnego `PlanScenarioSurface` i jeden wpis rejestru, z portem 3357.
2. Wznowić D.1 od wycofanego prototypu, wykonać sześć zrzutów PL i pełny pomiar HEAD.
3. Dopiero po kompletnym D.1 przejść do E.1, F.1 i R.1 zgodnie z wiążącą kolejnością.

---

## ★★ KONTYNUACJA 2026-08-27 — dokończenie D.1→E.1→F.1→R.1→R.2

Wykonawca: wewnętrzny robotnik dokończeniowy (nie Codex), na jawne polecenie
nadzorcy. Gałąź: `day49-finish-20260828`, worktree `/private/tmp/finish-49`
(z `github-backup/codex/initiatives-day49c-20260828` przy `db36621679`).
Push na `github-backup` po każdym commicie. Właściciel checkout
`/Users/piotrwisniewski/Developer/Consultify` NIE był modyfikowany; jedyny
kontakt to symlink `node_modules` (odczyt) zgodnie z `DEC-2026-08-26-86`.

**Oświadczenie o naruszeniu Z5.** Przed poznaniem pełnej ramki ochrony
checkoutu wykonałem `cat /Users/piotrwisniewski/Developer/Consultify/.claude/launch.json`
— pojedynczy odczyt tego chronionego pliku, próbując zrozumieć konfigurację
portów podglądu przeglądarki. Nie zapisałem tam niczego. Po zorientowaniu się
w regule od razu przeszedłem na własny `.claude/launch.json` w
`/private/tmp/finish-49`. Zgłaszam to jako naruszenie, nie ukrywam.

### Środowisko

Jednorazowy kontener `cx-fin49-pg` (obraz `pgvector/pgvector:pg16`,
`127.0.0.1:5833 → 5432`), baza główna `cx_fin49`. Pełny przebieg
`server/scripts/migrate.postgres.ts` z `NODE_ENV=test RUN_DB_TESTS=1
MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5833/cx_fin49`
zastosował **858** migracji za pierwszym razem, **0** za drugim (potwierdzona
idempotencja runnera). Harness `dev-render` na porcie **3361** (uruchamiany
przez `.claude/launch.json` w tym worktree, wpis `initiatives-day49-finish-d1`).
Kontener i baza fixture (`consultify_w3_initiatives_owner_fin49`, w tym samym
kontenerze) usunięte po pracy.

### D.1 — pełne PL dla Planu; DONE dla Planu, NIE_ZACZĘTE dla Mocy

**Licencja wykorzystana dokładnie wg ramki nadzorcy:** jeden nowy plik
`dev-render/screens/plan-scenario-d1.tsx`, jeden wpis w `dev-render/main.tsx`
dopisany **obok** `capacity-advisor-a3` (nie na końcu pliku), port 3361.
Ekran renderuje realny `<PlanScenarioSurface demoMode={false} />` z atrapą
`window.fetch` przechwytującą wyłącznie trasy `plan-scenarios` — komponent
przechodzi przez swój pełny `load()`, `demoMode` wewnątrz komponentu nie był
dotykany.

**Tłumaczenie (`PlanScenarioSurface.tsx`):**

```
$ grep -c "\bt(" src/components/Initiatives/PlanScenarioSurface.tsx
# przed tą kontynuacją: 0
# po tej kontynuacji:   153
```

137 nowych kluczy pod `initiatives.planScenario.*` dopisanych do
`public/locales/pl/translation.json` i `public/locales/en/translation.json`
(parytet PL+EN w tym samym commicie `3fa8697972`; `git diff --stat` obu
plików: `153 insertions(+), 0 deletions(-)` każdy — czysto addytywne,
zweryfikowane). Twarde etykiety polskie (`planStatusLabel` →
`planStatusKey` + `t()`) zachowały dokładnie to samo brzmienie. Angielskie
napisy błędu/ładowania (np. „Loading Plan Scenario register", „Plan changed
or its Portfolio basis is stale...") dostały pierwsze w historii polskie
tłumaczenie. Aria-labels (statyczne i interpolowane) przeniesione do `t()`
— sprawdzone grepem `aria-label="[A-Za-z]` na końcu pracy: **pusto**.

Jedyne pozostawione poza `t()` napisy to techniczne identyfikatory stanu
(`UNKNOWN`, `LOW`/`MEDIUM`/`HIGH` w `<option>`) — zgodne z ustalonym w pliku
wzorcem nietłumaczenia surowych kodów stanu (Z16) i z zakazem tłumaczenia
identyfikatorów technicznych z instrukcji źródłowej.

**Test komponentowy (dowód mutacyjny, nie tautologia):** przed poprawką
`tests/unit/initiatives-execution/planScenarioSurface.test.tsx` był **7/7
RED** przeciw przetłumaczonemu komponentowi (dokładny dowód: uruchomiłem go
zaraz po zmianie w komponencie, zanim dotknąłem testu — czerwień była
realna, nie wymyślona). Dodałem lokalny `vi.mock('react-i18next', ...)` (ten
sam wzorzec co w sąsiednim `capacityScenarioSurface.test.tsx`, `tests/setup.ts`
nietknięty — `Z18`) z pełną mapą 137 kluczy + interpolacją `{{var}}`, i
poprawiłem asercje oczekujące starego angielskiego tekstu. Wynik końcowy:

```
$ npx vitest run tests/unit/initiatives-execution/planScenarioSurface.test.tsx --config vitest.config.ts --retry=0
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Regresja sąsiadów (bez zmian w tych plikach): `planScenario.test.ts` `2/2
PASS`, `capacityScenarioSurface.test.tsx` `7/7 PASS`.

**Trzy obowiązkowe zrzuty Planu — dokładnie to, co zobaczyłem:**

1. `/private/tmp/finish-49-screenshots/d1-plan-light.png` (SHA-256
   `5342fa81ee...`) — jasny motyw, realne dane przez pełny `load()`: nagłówek
   „Plan inicjatyw" / „Kolejność, okna czasowe i zależności zatwierdzonego
   portfela.", przycisk „Nowy plan", selektor „Aktywny plan" z wpisem „Plan
   transformacji operacyjnej · Opublikowany · v2", tabela z nagłówkami po
   polsku („Inicjatywa", „Stan backlogu", „Wstępny najwcześniejszy /
   docelowy / najpóźniejszy", „Gotowość zależności" itd.), pięć wierszy
   inicjatyw z polskimi nazwami, przycisk „Otwórz narzędzia planu", stopka
   „Lista" / „Uwagi".
2. `/private/tmp/finish-49-screenshots/d1-plan-dark.png` (SHA-256
   `1e398e1cfc...`) — identyczny scenariusz w ciemnym motywie: tło i tekst
   poprawnie przechodzą na tokeny `c-*` (ciemne tło granatowe, jasny tekst),
   żadnego crimson/`primary-*` jako tło ani fokus, kontrast czytelny.
3. `/private/tmp/finish-49-screenshots/d1-plan-empty.png` (SHA-256
   `2a3a8532bb...`) — pusty rejestr planu ORAZ pusta lista inicjatyw
   (`&state=empty` w harnessie zeruje obie), renderuje kanoniczny stan pusty
   `StandardTable` z przetłumaczonym tytułem „Brak inicjatyw w tym zakresie"
   i opisem „Zmień filtr albo dodaj inicjatywę w narzędziach aktywnego
   planu." — ikona skrzynki, wyśrodkowany layout, spójny z resztą triady.

**Czego NIE zrobiono w D.1:** pełne tłumaczenie `CapacityScenarioSurface.tsx`
(oryginalna instrukcja §D.1 wymagała OBU plików — Plan i Moc — „dwie z
trzech zakładek modułu"). Stan na koniec tej kontynuacji: `grep -c "\bt("
src/components/Initiatives/CapacityScenarioSurface.tsx` = **4** (wyłącznie
napisy dopisane wcześniej przez A.3 dla przycisku „Zaproponuj opcje"; reszta
pliku — 1380 linii — pozostaje bez `t()`, tak jak zastałem). Sześć zrzutów z
oryginalnej DoD §D.1 (oba ekrany × jasny/ciemny/pusty) **nie zostało
dostarczonych** — dostarczono wyłącznie trzy dla Planu, zgodnie z wyraźnym,
węższym poleceniem tej kontynuacji („dowieź trzy obowiązkowe zrzuty Planu").
Ekran Mocy ma już swoje własne trzy zrzuty z A.3
(`a3-after-{light,dark,empty}.jpg` w
`/private/tmp/consultify-initiatives-day49b-screenshots/`), ale te dowodzą
działania przycisku propozycji, nie kompletności tłumaczenia całego ekranu.

### Rozstrzygnięcie stanu `proposeCapacityOptions`

Zadanie nadzorcy: „sprawdź i rozstrzygnij realnym klikiem w harnessie, nie
deklaracją". Wykonano: uruchomiłem harness na porcie 3361 z
`VITE_WAVE3_INITIATIVES_CAPACITY_ADVISOR=true` (flaga domyślnie OFF w
produkcji — tu ustawiona tylko na potrzeby dowodu w tym jednym przebiegu
harnessu), otworzyłem `?screen=capacity-advisor-a3&phase=before`, kliknąłem
„Otwórz narzędzia obciążenia", potem realnym kliknięciem (Playwright,
przeglądarka headless Chromium, nie wywołanie funkcji) — „Zaproponuj opcje".

**Co zobaczyłem na własne oczy** (zrzut
`/private/tmp/finish-49-screenshots/verify-a3-after-click.png`, SHA-256
`39c2d2e877...`): po kliknięciu przycisk pozostał, pod nim pojawił się
komunikat „Opcje zostały zapisane i przeładowane.", a niżej — sekcja „Opcje
rozwiązania ograniczeń" z realnym porównaniem `advisor-capacity-a3 · v1 ·
DRAFT` (Plan `plan-a3 v4` · Capacity `v3`) i **dokładnie trzema** kartami:
„Zmień kolejność" (RESEQUENCE), „Podziel zakres" (SCOPE_SPLIT), „Zwiększ
dostępność" (ADD_CAPACITY) — każda z polami Termin/Zakres/Koszt/Ryzyko,
większość uczciwie `UNKNOWN — brak potwierdzonej wartości ·
EVIDENCE_MISSING` (dyscyplina doradcy z A.2 nienaruszona), plus przycisk
„Wybierz do dalszej decyzji" na każdej karcie.

**Werdykt:** `proposeCapacityOptions` w
`src/services/initiatives-execution/runtimeApi.ts` ma dziś **realnego,
działającego wołającego produkcyjnego** — `CapacityScenarioSurface.tsx`,
przycisk „Zaproponuj opcje" — i ten wołający **działa end-to-end po realnym
kliknięciu w przeglądarce**, nie tylko w teście jednostkowym. To domyka
stan otwarty z raportu 49C: teza o braku wołającego jest dziś **w pełni
nieaktualna**, a działanie jest **udowodnione klikiem**, nie zadeklarowane.

### E.1 — inwentarz tras inicjatyw

**Mianownik, zmierzony samodzielnie:**

```
$ grep -cE "router\.(get|post|put|patch|delete)\(" <każdy z 9 plików>
initiative-generator.routes.ts             3
initiative-governance.routes.ts           17
initiativeBackbone.routes.ts               2
initiativeCandidates.routes.ts             5
initiativeGeneratorBrain.routes.ts         3
initiativeMaterialize.routes.ts            2
initiatives-additive.routes.ts             9
pmo/initiatives.routes.ts                141
pmo/initiativesExecutionRuntime.routes.ts 148
RAZEM                                    330
```

Zgadza się dokładnie z niezależną liczbą z instrukcji źródłowej (330).

**Metoda:** skrypt Pythona sparsował wszystkie 330 deklaracji `router.<metoda>(`
(z tolerancją na wcięcie — pierwsza wersja regexu złapała tylko 182, poprawiona
złapała 330), dla każdej wziął migawkę ciała handlera (do 60 linii albo do
następnej deklaracji) i sklasyfikował ją heurystykami: bezwarunkowy
`res.status(501/503)` bez realnej pracy → `KIKUT`; wywołanie `deps.reader.*`,
`deps.unitOfWork`, `dbAll/dbGet/dbRun`, słowo kluczowe SQL, `*Service.`,
`*Repository.`, `*Controller.` → `REALNA`; dopasowanie do
`LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` w
`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` (odczytany,
nie zmieniony) dla tras zapisu w `pmo/initiatives.routes.ts` po linii 160 →
`ODMOWA`. Konsument w `src/` szukany grepem po literalnych segmentach ścieżki
w plikach nietestowych.

**Ustalenie strukturalne:** `pmo/initiatives.routes.ts` (i jego pod-router
`runtime-v1`, czyli cały plik `initiativesExecutionRuntime.routes.ts`) jest
zamontowany **podwójnie** — pod `/api/initiatives` (linia 691) i
`/api/pmo/initiatives` (linia 1151) w `server/src/Gateway.ts` (odczyt).
Wszystkie 289 tras z tych dwóch plików są więc osiągalne pod dwoma różnymi
prefiksami.

**Zero KIKUT, zweryfikowane wprost, nie próbką:**

```
$ grep -nE "status\(50[13]\)|NOT_IMPLEMENTED|notImplemented" <wszystkie 9 plików>
pmo/initiatives.routes.ts:132                    (warunkowy fallback notConfigured — 6 miejsc użycia, wszystkie w blokach catch dla konkretnego kodu błędu)
pmo/initiativesExecutionRuntime.routes.ts:5398   (warunkowy fallback gdy deps.controlKpis nie wstrzyknięty)
```

Obie trafienia to **warunkowe** degradacje wewnątrz realnych handlerów (ścieżka
domyślna wykonuje prawdziwy odczyt/zapis), nie bezwarunkowe kikuty. Żadna z
330 tras nie jest czystym stubem.

**Werdykt końcowy (330/330 sklasyfikowane):**

| Werdykt | Liczba |
| --- | --- |
| `REALNA` | 300 |
| `ODMOWA` | 30 |
| `KIKUT` | 0 |

30 `ODMOWA` to dokładnie trasy zapisu w `pmo/initiatives.routes.ts`
dopasowane do `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS`
(`start-execution/block/unblock/move`, `milestones/resources/staffing-plans/
budget-items/raid/gate-roles/**`, `lifecycle-transition-*`,
`apply-template/apply-blueprint`) — globalny middleware
`router.use(requireCanonicalInitiativeExecutionWriter)` (linia 160) zwraca im
`409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED` **zanim** żądanie dotrze do
handlera, niezależnie od tego, co ten handler zawiera. To jest uczciwa,
działająca odmowa (dokładnie definicja `ODMOWA` z instrukcji), nie martwy
kod.

Konsument znaleziony mechanicznie w `src/` dla **89/330** tras (dolna
granica metody — pośrednie wywołania przez funkcje pomocnicze łączące URL w
runtime nie zawsze są łapane przez grep literału ścieżki). „Brak konsumenta"
dla pozostałych **nie jest** równoznaczne z `KIKUT` (wyraźne zastrzeżenie z
instrukcji źródłowej — panel pomylił to raz).

**★ Ograniczenie metody, nieujawnione twierdzenie usunięte uczciwie:**
skala werdyktu z instrukcji ma **cztery** wartości, w tym `REALNA_Z_SYNTEZĄ`.
Próbowałem automatycznie odróżnić „zwykłe REALNA" od „REALNA ze
składaniem/wyliczaniem odpowiedzi po stronie serwera" heurystyką (`.map(`,
`Promise.all`, słowa „merge/aggregate/synthesize") — heurystyka złapała 74
trasy, ale ręczna weryfikacja **dwóch** próbek
(`capacity-options/:id/select`, `plan-scenarios/:scenarioId/analysis-
proposals/:proposalId`) pokazała, że obie to fałszywe trafienia (zwykłe
REALNA, bez rzeczywistej syntezy) — heurystyka reaguje na wszechobecny
`.map()` używany do zwykłego kształtowania JSON, nie na faktyczną syntezę.
**Scaliłem cały bucket z powrotem do `REALNA`** zamiast prezentować fałszywą
precyzję. To jest świadomie NIEZWERYFIKOWANE i wymienione w sekcji poniżej —
pełne, wiarygodne rozróżnienie `REALNA` vs `REALNA_Z_SYNTEZĄ` wymagałoby
ręcznego przeczytania znacznej części z 330 handlerów, czego w tej
kontynuacji nie zrobiłem.

Ręczna weryfikacja próbki: 5/5 losowo wybranych tras z najsłabszym sygnałem
(tylko ogólne `await x(...)` bez dopasowania do silnych wzorców) potwierdzone
jako realna praca backendu po przeczytaniu kodu
(`acceptResourceCommitment(deps.unitOfWork,...)`,
`createWizardSession(...)`, `listCandidates(...)`,
`initiativeExistsInOrg(...)`, `materializePortfolio(queryHelpers,...)`) — 5/5
zgodnych z klasyfikacją REALNA.

Pełna tabela 330 wierszy: sekcja „Załącznik E.1" na końcu tego pliku.

### F.1 — dane demo Inicjatyw

**Ocena istniejącego seeda
(`server/scripts/seed-wave3-initiatives-owner-review.ts`, 851→859 linii po
mojej poprawce):** skrypt jest starannie zbudowany — deterministyczne UUID,
manifest `wx`/`0600` z nonce, wewnętrzna weryfikacja replay/kolizji dla
kandydata/profilu/execution linku — ale **nie uruchamiał się w ogóle na
obecnym HEAD**. Jego własna asercja końcowa (cold-SQL readback) sprawdzała
`successful_migrations === 834` — liczbę zastaną w dniu, gdy skrypt był
ostatnio aktualizowany. HEAD niesie dziś **858** migracji (potwierdzone moim
własnym przebiegiem `migrate.postgres.ts` w BLOKU 0 tej kontynuacji: 858
zastosowanych, potem 0). Każde uruchomienie `seed` kończyło się błędem
`BLOCKED: readback successful_migrations expected 834, got 858`.

**Naprawa (licencja pełna dla `server/scripts/seed-*initiatives*.ts`):**
zmieniłem `834` na `858`, z komentarzem wyjaśniającym że liczba ta odświeży
się ponownie przy każdej kolejnej migracji z DOWOLNEGO modułu — to jest
zastała, kruchą konstrukcja, którą re-synchronizuję, nie przeprojektowuję
(commit `e058748134`).

**Dowód idempotencji (baza `consultify_w3_initiatives_owner_fin49` w TYM
SAMYM kontenerze `cx-fin49-pg`, port 5833 — nazwa wymuszona własnym strażnikiem
skryptu, `INITIATIVES_OWNER_FIXTURE_DATABASE_URL` musi pasować do
`consultify_w3_initiatives_owner_*`):**

```
$ ... reset  → { dropped: true, catalogAbsent: true }
$ ... seed   → readback: {personas:6, candidates:2, accepted_candidates:1,
                initiatives:1, system_portfolios:1,
                project_actor_memberships:1, profile_receipts:1,
                execution_links:1, execution_relations:1,
                complete_runtime_read_models:1, execution_tasks:2,
                execution_decisions:1, operational_allocations:2,
                management_signals:1, interventions:1,
                report_definitions:1, report_runs:1,
                negative_profile_receipts:0, negative_execution_links:0,
                successful_migrations:858}
$ ... reset  → { dropped: true, catalogAbsent: true }
$ ... seed   → readback: IDENTYCZNE 19/19 liczników
```

**Zawartość:** brak śmieciowych rekordów (`test`/`foo`/`asdf`/Lorem ipsum
nieznalezione); persony i nazwy po polsku (np. inicjatywa „Automatyzacja
planowania przezbrojeń"; persony Anna Kowalska, Marek Nowak, Ewa Nowicka).
Domeny e-mail `@local.test` (konwencja fixture, nie routowalna, nieszkodliwa).

**★ Czego NIE zrobiono — uczciwie, priorytet 4 z instrukcji, ostatnia
pozycja przed R.1/R.2:** seed **nie tworzy** opublikowanego scenariusza
Planu ani scenariusza Mocy z realnym przeciążeniem
(`SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type IN
('plan_scenario','capacity_scenario')` → **0** po seedzie). To jest dokładnie
zawartość prezentacyjna dla pętli §A.2, o którą prosiła instrukcja źródłowa —
bez niej właściciel włączy flagę `VITE_WAVE3_INITIATIVES_CAPACITY_ADVISOR` i
zobaczy uczciwe „brak przeciążenia", nie pokaz najlepszej rzeczy z tego
dyżuru. **Powód nie-zrobienia:** istniejący seed pisze inne agregaty
(`initiative`, `execution_case`) **surowym SQL-em wprost do
`ie_aggregate_state`**, z ręcznie skonstruowanym `payload_json` — nie przez
warstwę domenową (`materialCommand.ts` i spółka są zresztą zabronione do
zapisu w tym dyżurze). Odtworzenie poprawnego kształtu `payload_json` dla
`plan_scenario`/`capacity_scenario` (zagnieżdżone `knowledgeState`,
`sourceRef`, wersjonowanie CAS) tą samą metodą wymagałoby dokładnej znajomości
kontraktu czytników (`postgresInitiativeReader.ts`, tylko do odczytu) bez
możliwości uruchomienia realnego zapisu przez komendę, żeby porównać wynik.
Ryzyko: sfabrykowany, subtelnie błędny stan bazy, który wygląda dobrze na
pierwszy rzut oka, ale psuje odczyt gdzie indziej — dokładnie ten rodzaj
placebo, którego zakazuje `Z23`. Uznałem to za gorsze niż uczciwe „nie
zrobione".

**Werdykt ws. lokalnego cienia (E8):** **ZOSTAJE, z uzasadnieniem** — NIE
usunięty. Przesłanka usunięcia z instrukcji („po §F.1 seed daje realne dane,
więc cień jest zbędny") nie zaszła: seed nadal nie daje żadnych danych
Planu/Mocy. Usunięcie cienia teraz zostawiłoby `demoMode` bez jakiejkolwiek
prezentowalnej zawartości — to byłaby regresja, nie poprawa. Rekomendacja
dla następnego dyżuru: dokończyć zawartość prezentacyjną (najlepiej przez
wywołanie realnych tras `POST /plan-scenarios/:id` i `POST
/capacity-scenarios/:id` z uwierzytelnionej sesji seeda, analogicznie do
`runCanonicalJourney()` już istniejącego w tym samym pliku dla execution
linku — nie surowym SQL-em), dopiero wtedy usunąć cień.

### R.1 — `MODULE_ACCEPTANCE.md`

Zrobione, commit `91f7e3fdf9`. Dopisany datowany blok „Day 49 finish
(2026-08-27)" w tym samym stylu co istniejące bloki z 2026-08-24, plus
śródliniowa korekta dowodu w wierszu `G04` (stara liczba migracji 834 →
858, zero agregatów Plan/Capacity w fixture). **Żadna bramka G00–G20 nie
została podniesiona na `PASS`** — nic z tej kontynuacji nie jest dowodem
podróży właściciela z osiągalnością na tym poziomie. Żaden zastany wpis
`FAIL`/`BLOCKED`/`PENDING` nie został usunięty ani ukryty.

### R.2 — ten raport

Ten plik. Jedyny dokument zmieniony poza `MODULE_ACCEPTANCE.md` i plikami
kodu/testów/lokalizacji wymienionymi w commitach.

### ★ Mianownik testów (Z24 w duchu, bez pełnego przebiegu — `HIGIENA
WYKONANIA` zakazuje pełnego `vitest` robotnikom)

Uruchomiłem WYŁĄCZNIE testy dotykające plików, które zmieniłem — nie cały
korpus (to jest świadome ograniczenie zasięgu, nie ukryta liczba):

```
tests/unit/initiatives-execution/planScenarioSurface.test.tsx   7/7 PASS
tests/unit/initiatives-execution/planScenario.test.ts           2/2 PASS  (regresja, nietknięty)
tests/unit/initiatives-execution/capacityScenarioSurface.test.tsx 7/7 PASS (regresja, nietknięty)
```

**Nie uruchomiłem** pełnego korpusu root/server (`~481`/`~87` testów wg
zastanego pomiaru 49C) — to przekraczałoby zakres tej kontynuacji i higienę
wykonania. Nie przepisuję cudzej liczby zasięgu jako własnej; zastany pomiar
z 49C (39 failed | 399 passed | 43 skipped root; 24 failed | 63 passed
server) pozostaje **zastały**, nie zweryfikowany ponownie w tej sesji.

### ★★ TWIERDZENIA NIEZWERYFIKOWANE (obowiązkowa, nie może być pusta)

1. **Naruszenie Z5** (opisane wyżej): jeden odczyt `.claude/launch.json` z
   chronionego checkoutu właściciela, zanim poznałem regułę. Nie zapis, ale
   naruszenie.
2. **`REALNA` vs `REALNA_Z_SYNTEZĄ` w E.1 nie jest wiarygodnie rozróżnione.**
   Wszystkie 330 tras oznaczyłem `REALNA` po tym, jak heurystyka syntezy
   dała 2/2 fałszywe trafienia w ręcznej próbce. Rzeczywista liczba tras z
   faktyczną syntezą po stronie serwera jest nieznana — może być zero, może
   być kilkanaście (np. `planSolver`-adjacent albo `portfolio-health`
   endpoints są najbardziej prawdopodobnymi kandydatami, ale NIE
   sprawdziłem ich indywidualnie pod tym kątem).
3. **„Konsument w `src/` dla 89/330" to dolna granica, nie górna.** Metoda
   (grep literału ścieżki) nie łapie wywołań przez funkcje pomocnicze
   budujące URL dynamicznie ani wywołań spoza `src/` (np. z innych skryptów
   serwerowych, jeśli takie istnieją). Rzeczywista liczba tras z konsumentem
   może być wyższa.
4. **Nie zweryfikowałem izolacji najemcy (§E.2) w ogóle** — nie było w
   zakresie tej kontynuacji (nadzorca jawnie pominął E.2 w kolejności
   wiążącej D.1→E.1→F.1→R.1→R.2). Stan §E.2 pozostaje dokładnie taki, jak
   zastałem — `NIE_ZACZĘTE` wg raportu 49B/49C, nie zmieniony.
5. **Nie sprawdziłem, czy 74-elementowy bucket heurystyki syntezy** (przed
   scaleniem z powrotem do REALNA) systematycznie trafia w konkretne rodziny
   endpointów (np. wszystkie `GET .../history`, `GET .../diff`) — mogłoby to
   być użyteczną wskazówką dla przyszłego ręcznego przeglądu, ale tej
   analizy nie wykonałem.
6. **Migracja `successful_migrations: 858` jest prawdziwa TYLKO na SHA tej
   kontynuacji** (`d76592fdb4`) — jak każda taka liczba, zdezaktualizuje się
   przy następnej migracji z dowolnego modułu. Nie naprawiłem tej kruchości
   strukturalnie (patrz F.1 wyżej), tylko re-zsynchronizowałem wartość.
7. **Nie kliknąłem przez PRZEGLĄDARKĘ ścieżki `writePlanScenario`/`Publish`**
   w harnessie D.1 — dowód D.1 dotyczy wyłącznie odczytu (`load()`
   przeszedł, dane wyrenderowały się po polsku). Zapis/publikacja Planu
   przez ten konkretny harness nie były klikane w tej sesji (test
   komponentowy `7/7 PASS` dowodzi zachowania zapisu na poziomie
   jednostkowym, nie przeglądarki).

### Rekomendacje dla nadzorcy

1. Dokończyć D.1 dla `CapacityScenarioSurface.tsx` (1380 linii, wciąż tylko
   4 wywołania `t()`) — osobna, porównywalna wielkością pozycja do tej,
   którą wykonałem dla Planu w tej kontynuacji.
2. Rozstrzygnąć `REALNA` vs `REALNA_Z_SYNTEZĄ` w E.1 ręcznym przeglądem, jeśli
   ta precyzja jest potrzebna do decyzji produktowej — obecny stan traktuje
   wszystkie 330 jako `REALNA` z jawnym zastrzeżeniem.
3. Dokończyć F.1: dane prezentacyjne pętli §A.2 (Plan + Capacity Scenario w
   seedzie) przez rozszerzenie `runCanonicalJourney()` o wywołania realnych
   tras zapisu z uwierzytelnionej sesji, nie surowym SQL-em; dopiero wtedy
   usunąć lokalny cień `demoMode` w `CapacityScenarioSurface.tsx`.
4. Rozważyć zastąpienie sztywnego `successful_migrations: N` w seedzie
   asercją odporną na dryf (np. „N ≥ liczba migracji Inicjatyw + próg
   minimalny"), żeby ta sama wada nie wróciła przy następnej migracji z
   dowolnego modułu.

### SHA commitów tej kontynuacji (wszystkie na `day49-finish-20260828`,
wypchnięte na `github-backup`)

```
3fa8697972  feat(initiatives): full Polish for the Plan Scenario surface (D.1, part 1/2)
d4be0d9056  feat(initiatives): licensed dev-render screen for PlanScenarioSurface (D.1, part 2/2)
e058748134  fix(initiatives): re-synchronize the stale migration-count assertion in the owner demo seed (F.1)
91f7e3fdf9  docs(initiatives): raise 05_INITIATIVES acceptance to the delivered scope (R.1)
d76592fdb4  test(initiatives): update PlanScenarioSurface's component test for full Polish (D.1)
```

Bazowy commit tej kontynuacji: `db36621679` (tip `codex/initiatives-day49c-20260828`
w chwili startu). `git log --oneline db36621679..HEAD` pokazuje dokładnie
powyższe pięć commitów, w tej kolejności.

### Załącznik E.1 — pełna tabela 330 tras

Wygenerowana mechanicznie (metoda opisana wyżej); `#` to numer porządkowy w
kolejności parsowania plików (nie ma znaczenia semantycznego).

| # | Metoda + ścieżka | plik:linia | zamontowana pod | werdykt | konsument w src/ | uwaga |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | GET / | initiative-generator.routes.ts:17 | /api/initiatives/ | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 2 | POST /generate | initiative-generator.routes.ts:33 | /api/initiatives/generate | REALNA | src/components/assessment/modals/GenerateInitiativesModal.tsx:181 |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 3 | PUT /:id | initiative-generator.routes.ts:138 | /api/initiatives/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 4 | POST /goals | initiative-governance.routes.ts:36 | /api/initiatives-v4/goals | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 5 | GET /goals | initiative-governance.routes.ts:65 | /api/initiatives-v4/goals | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 6 | GET /goals/:goalId | initiative-governance.routes.ts:78 | /api/initiatives-v4/goals/:goalId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 7 | PUT /goals/:goalId | initiative-governance.routes.ts:92 | /api/initiatives-v4/goals/:goalId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 8 | GET /goals/:goalId/rollup | initiative-governance.routes.ts:122 | /api/initiatives-v4/goals/:goalId/rollup | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 9 | POST /goals/:goalId/initiatives | initiative-governance.routes.ts:141 | /api/initiatives-v4/goals/:goalId/initiatives | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 10 | GET /goals/:goalId/initiatives | initiative-governance.routes.ts:170 | /api/initiatives-v4/goals/:goalId/initiatives | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 11 | DELETE /goals/:goalId/initiatives/:initiativeId | initiative-governance.routes.ts:187 | /api/initiatives-v4/goals/:goalId/initiatives/:initiativeId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 12 | POST /blueprints | initiative-governance.routes.ts:203 | /api/initiatives-v4/blueprints | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 13 | GET /blueprints | initiative-governance.routes.ts:233 | /api/initiatives-v4/blueprints | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 14 | POST /blueprints/:blueprintId/apply | initiative-governance.routes.ts:245 | /api/initiatives-v4/blueprints/:blueprintId/apply | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 15 | POST /blueprints/:blueprintId/reject | initiative-governance.routes.ts:267 | /api/initiatives-v4/blueprints/:blueprintId/reject | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 16 | POST /initiatives/:initiativeId/gates | initiative-governance.routes.ts:286 | /api/initiatives-v4/initiatives/:initiativeId/gates | REALNA | src/services/initiatives-execution/runtimeApi.ts:214 |  |
| 17 | GET /initiatives/:initiativeId/gates | initiative-governance.routes.ts:317 | /api/initiatives-v4/initiatives/:initiativeId/gates | REALNA | src/services/initiatives-execution/runtimeApi.ts:214 |  |
| 18 | POST /gates/:gateId/evaluate | initiative-governance.routes.ts:331 | /api/initiatives-v4/gates/:gateId/evaluate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 19 | POST /initiatives/:initiativeId/decisions | initiative-governance.routes.ts:345 | /api/initiatives-v4/initiatives/:initiativeId/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:160 |  |
| 20 | GET /initiatives/:initiativeId/decisions | initiative-governance.routes.ts:369 | /api/initiatives-v4/initiatives/:initiativeId/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:160 |  |
| 21 | POST /from-audit | initiativeBackbone.routes.ts:44 | /api/initiatives/from-audit | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 22 | GET /portfolio-health | initiativeBackbone.routes.ts:71 | /api/initiatives/portfolio-health | REALNA | src/components/Initiatives/PortfolioHealthView.tsx:81 |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 23 | POST /flow-transform/certify | initiativeCandidates.routes.ts:52 | /api/initiatives/flow-transform/certify | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 24 | GET /candidates | initiativeCandidates.routes.ts:91 | /api/initiatives/candidates | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 25 | POST /candidates/scan | initiativeCandidates.routes.ts:121 | /api/initiatives/candidates/scan | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 26 | POST /candidates/:id/accept | initiativeCandidates.routes.ts:152 | /api/initiatives/candidates/:id/accept | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 27 | POST /candidates/:id/dismiss | initiativeCandidates.routes.ts:196 | /api/initiatives/candidates/:id/dismiss | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 28 | POST /propose-cards | initiativeGeneratorBrain.routes.ts:69 | /api/initiatives/propose-cards | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | czysta deterministyczna funkcja proposeCards(), bez zapytania do bazy — realne wykonanie, nie kikut |
| 29 | POST /:id/generate-full | initiativeGeneratorBrain.routes.ts:83 | /api/initiatives/:id/generate-full | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 30 | POST /:id/generate-section-card | initiativeGeneratorBrain.routes.ts:131 | /api/initiatives/:id/generate-section-card | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 31 | POST /portfolio/materialize | initiativeMaterialize.routes.ts:58 | /api/initiatives/portfolio/materialize | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 32 | POST /:id/materialize | initiativeMaterialize.routes.ts:88 | /api/initiatives/:id/materialize | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 33 | POST /:initiativeId/suggested-changes | initiatives-additive.routes.ts:86 | /api/initiatives/:initiativeId/suggested-changes | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 34 | GET /:initiativeId/suggested-changes | initiatives-additive.routes.ts:125 | /api/initiatives/:initiativeId/suggested-changes | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 35 | PATCH /suggested-changes/:id | initiatives-additive.routes.ts:160 | /api/initiatives/suggested-changes/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 36 | GET /:initiativeId/economics-links | initiatives-additive.routes.ts:207 | /api/initiatives/:initiativeId/economics-links | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 37 | POST /:initiativeId/economics-links | initiatives-additive.routes.ts:286 | /api/initiatives/:initiativeId/economics-links | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 38 | POST /propose | initiatives-additive.routes.ts:336 | /api/initiatives/propose | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 39 | POST /validate-portfolio-mece | initiatives-additive.routes.ts:389 | /api/initiatives/validate-portfolio-mece | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 40 | GET /funnel/stats | initiatives-additive.routes.ts:466 | /api/initiatives/funnel/stats | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 41 | GET /:id/lineage | initiatives-additive.routes.ts:487 | /api/initiatives/:id/lineage | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 42 | POST /wizard/sessions | initiatives.routes.ts:211 | /api/initiatives/wizard/sessions, /api/pmo/initiatives/wizard/sessions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 43 | GET /wizard/sessions/:sessionId | initiatives.routes.ts:232 | /api/initiatives/wizard/sessions/:sessionId, /api/pmo/initiatives/wizard/sessions/:sessionId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 44 | POST /wizard/sessions/:sessionId/candidates/generate | initiatives.routes.ts:240 | /api/initiatives/wizard/sessions/:sessionId/candidates/generate, /api/pmo/initiatives/wizard/sessions/:sessionId/candidates/generate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 45 | GET /wizard/sessions/:sessionId/candidates | initiatives.routes.ts:262 | /api/initiatives/wizard/sessions/:sessionId/candidates, /api/pmo/initiatives/wizard/sessions/:sessionId/candidates | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 46 | GET /wizard/sessions/:sessionId/audit-events | initiatives.routes.ts:275 | /api/initiatives/wizard/sessions/:sessionId/audit-events, /api/pmo/initiatives/wizard/sessions/:sessionId/audit-events | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 47 | PATCH /wizard/candidates/:candidateId/triage | initiatives.routes.ts:288 | /api/initiatives/wizard/candidates/:candidateId/triage, /api/pmo/initiatives/wizard/candidates/:candidateId/triage | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 48 | GET /wizard/sessions/:sessionId/shortlist-gate | initiatives.routes.ts:316 | /api/initiatives/wizard/sessions/:sessionId/shortlist-gate, /api/pmo/initiatives/wizard/sessions/:sessionId/shortlist-gate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 49 | POST /wizard/sessions/:sessionId/drafts-created | initiatives.routes.ts:346 | /api/initiatives/wizard/sessions/:sessionId/drafts-created, /api/pmo/initiatives/wizard/sessions/:sessionId/drafts-created | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 50 | POST /similarity-check | initiatives.routes.ts:406 | /api/initiatives/similarity-check, /api/pmo/initiatives/similarity-check | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 51 | POST /:id/merge-from-insight | initiatives.routes.ts:660 | /api/initiatives/:id/merge-from-insight, /api/pmo/initiatives/:id/merge-from-insight | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | deleguje do handleMergeOrExtendFromInsight(...) — realny handler w innym miejscu pliku |
| 52 | POST /:id/extend-from-insight | initiatives.routes.ts:668 | /api/initiatives/:id/extend-from-insight, /api/pmo/initiatives/:id/extend-from-insight | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | deleguje do handleMergeOrExtendFromInsight(...) — realny handler w innym miejscu pliku |
| 53 | GET /capacity | initiatives.routes.ts:688 | /api/initiatives/capacity, /api/pmo/initiatives/capacity | REALNA | src/services/initiatives-execution/runtimeApi.ts:130 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 54 | GET /portfolio | initiatives.routes.ts:749 | /api/initiatives/portfolio, /api/pmo/initiatives/portfolio | REALNA | src/components/Initiatives/PortfolioHealthView.tsx:81 |  |
| 55 | GET /portfolio/rollups | initiatives.routes.ts:755 | /api/initiatives/portfolio/rollups, /api/pmo/initiatives/portfolio/rollups | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 56 | GET /portfolio/dependencies | initiatives.routes.ts:761 | /api/initiatives/portfolio/dependencies, /api/pmo/initiatives/portfolio/dependencies | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 57 | POST /portfolio/dependencies | initiatives.routes.ts:767 | /api/initiatives/portfolio/dependencies, /api/pmo/initiatives/portfolio/dependencies | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 58 | DELETE /portfolio/dependencies/:id | initiatives.routes.ts:781 | /api/initiatives/portfolio/dependencies/:id, /api/pmo/initiatives/portfolio/dependencies/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 59 | GET /programs | initiatives.routes.ts:795 | /api/initiatives/programs, /api/pmo/initiatives/programs | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 60 | POST /programs | initiatives.routes.ts:852 | /api/initiatives/programs, /api/pmo/initiatives/programs | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 61 | GET /programs/:programId | initiatives.routes.ts:930 | /api/initiatives/programs/:programId, /api/pmo/initiatives/programs/:programId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 62 | GET /programs/:programId/rollup | initiatives.routes.ts:1003 | /api/initiatives/programs/:programId/rollup, /api/pmo/initiatives/programs/:programId/rollup | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 63 | PUT /programs/:programId | initiatives.routes.ts:1023 | /api/initiatives/programs/:programId, /api/pmo/initiatives/programs/:programId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 64 | DELETE /programs/:programId | initiatives.routes.ts:1118 | /api/initiatives/programs/:programId, /api/pmo/initiatives/programs/:programId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 65 | GET / | initiatives.routes.ts:1177 | /api/initiatives/, /api/pmo/initiatives/ | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 66 | GET /raci-results-summary | initiatives.routes.ts:1190 | /api/initiatives/raci-results-summary, /api/pmo/initiatives/raci-results-summary | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 67 | POST /:id/duplicate | initiatives.routes.ts:1223 | /api/initiatives/:id/duplicate, /api/pmo/initiatives/:id/duplicate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 68 | GET /templates | initiatives.routes.ts:1257 | /api/initiatives/templates, /api/pmo/initiatives/templates | REALNA | src/hooks/useInitiativeGenerator.ts:343 |  |
| 69 | GET /templates/:templateId | initiatives.routes.ts:1278 | /api/initiatives/templates/:templateId, /api/pmo/initiatives/templates/:templateId | REALNA | src/hooks/useInitiativeGenerator.ts:343 |  |
| 70 | POST /templates | initiatives.routes.ts:1299 | /api/initiatives/templates, /api/pmo/initiatives/templates | REALNA | src/hooks/useInitiativeGenerator.ts:343 |  |
| 71 | PUT /templates/:templateId | initiatives.routes.ts:1326 | /api/initiatives/templates/:templateId, /api/pmo/initiatives/templates/:templateId | REALNA | src/hooks/useInitiativeGenerator.ts:343 |  |
| 72 | DELETE /templates/:templateId | initiatives.routes.ts:1363 | /api/initiatives/templates/:templateId, /api/pmo/initiatives/templates/:templateId | REALNA | src/hooks/useInitiativeGenerator.ts:343 |  |
| 73 | POST /templates/:templateId/duplicate | initiatives.routes.ts:1396 | /api/initiatives/templates/:templateId/duplicate, /api/pmo/initiatives/templates/:templateId/duplicate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 74 | GET /templates/:templateId/wbs | initiatives.routes.ts:1498 | /api/initiatives/templates/:templateId/wbs, /api/pmo/initiatives/templates/:templateId/wbs | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 75 | POST /templates/:templateId/wbs | initiatives.routes.ts:1514 | /api/initiatives/templates/:templateId/wbs, /api/pmo/initiatives/templates/:templateId/wbs | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 76 | PUT /templates/:templateId/wbs/:itemId | initiatives.routes.ts:1563 | /api/initiatives/templates/:templateId/wbs/:itemId, /api/pmo/initiatives/templates/:templateId/wbs/:itemId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 77 | DELETE /templates/:templateId/wbs/:itemId | initiatives.routes.ts:1592 | /api/initiatives/templates/:templateId/wbs/:itemId, /api/pmo/initiatives/templates/:templateId/wbs/:itemId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 78 | POST /templates/:templateId/wbs/reorder | initiatives.routes.ts:1617 | /api/initiatives/templates/:templateId/wbs/reorder, /api/pmo/initiatives/templates/:templateId/wbs/reorder | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 79 | GET /templates/:templateId/validate | initiatives.routes.ts:1646 | /api/initiatives/templates/:templateId/validate, /api/pmo/initiatives/templates/:templateId/validate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 80 | POST /templates/:templateId/clone | initiatives.routes.ts:1662 | /api/initiatives/templates/:templateId/clone, /api/pmo/initiatives/templates/:templateId/clone | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 81 | PATCH /:id/template | initiatives.routes.ts:1696 | /api/initiatives/:id/template, /api/pmo/initiatives/:id/template | REALNA | src/hooks/useInitiativeGenerator.ts:343 |  |
| 82 | POST /:id/apply-template | initiatives.routes.ts:1746 | /api/initiatives/:id/apply-template, /api/pmo/initiatives/:id/apply-template | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 83 | POST /:id/changes | initiatives.routes.ts:2005 | /api/initiatives/:id/changes, /api/pmo/initiatives/:id/changes | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 84 | POST /:id/apply-blueprint | initiatives.routes.ts:2195 | /api/initiatives/:id/apply-blueprint, /api/pmo/initiatives/:id/apply-blueprint | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 85 | GET /section-types | initiatives.routes.ts:2276 | /api/initiatives/section-types, /api/pmo/initiatives/section-types | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 86 | GET /section-types/:id | initiatives.routes.ts:2298 | /api/initiatives/section-types/:id, /api/pmo/initiatives/section-types/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 87 | POST /section-types | initiatives.routes.ts:2320 | /api/initiatives/section-types, /api/pmo/initiatives/section-types | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 88 | PUT /section-types/:id | initiatives.routes.ts:2352 | /api/initiatives/section-types/:id, /api/pmo/initiatives/section-types/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 89 | DELETE /section-types/:id | initiatives.routes.ts:2395 | /api/initiatives/section-types/:id, /api/pmo/initiatives/section-types/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 90 | POST /section-types/:id/duplicate | initiatives.routes.ts:2438 | /api/initiatives/section-types/:id/duplicate, /api/pmo/initiatives/section-types/:id/duplicate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 91 | POST /generate-section | initiatives.routes.ts:2483 | /api/initiatives/generate-section, /api/pmo/initiatives/generate-section | REALNA | src/hooks/useInitiativeGenerator.ts:391 |  |
| 92 | POST /review-section | initiatives.routes.ts:2535 | /api/initiatives/review-section, /api/pmo/initiatives/review-section | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 93 | POST /generate-section-fill | initiatives.routes.ts:2591 | /api/initiatives/generate-section-fill, /api/pmo/initiatives/generate-section-fill | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 94 | POST /readiness-analysis | initiatives.routes.ts:2675 | /api/initiatives/readiness-analysis, /api/pmo/initiatives/readiness-analysis | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 95 | POST /suggest-sections | initiatives.routes.ts:2795 | /api/initiatives/suggest-sections, /api/pmo/initiatives/suggest-sections | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 96 | POST / | initiatives.routes.ts:2838 | /api/initiatives/, /api/pmo/initiatives/ | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 97 | POST /from-tool-session | initiatives.routes.ts:2940 | /api/initiatives/from-tool-session, /api/pmo/initiatives/from-tool-session | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 98 | GET /by-status/:statuses | initiatives.routes.ts:3069 | /api/initiatives/by-status/:statuses, /api/pmo/initiatives/by-status/:statuses | REALNA | src/components/assessment/InitiativesTable.tsx:174 |  |
| 99 | GET /:id | initiatives.routes.ts:3075 | /api/initiatives/:id, /api/pmo/initiatives/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 100 | PUT /:id/profile | initiatives.routes.ts:3077 | /api/initiatives/:id/profile, /api/pmo/initiatives/:id/profile | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 101 | PUT /:id | initiatives.routes.ts:3102 | /api/initiatives/:id, /api/pmo/initiatives/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 102 | PATCH /:id/status | initiatives.routes.ts:3113 | /api/initiatives/:id/status, /api/pmo/initiatives/:id/status | REALNA | src/components/assessment/manage/InitiativesManagementPanel.tsx:621 |  |
| 103 | PATCH /:id/quick-update | initiatives.routes.ts:3124 | /api/initiatives/:id/quick-update, /api/pmo/initiatives/:id/quick-update | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 104 | PATCH /:id | initiatives.routes.ts:3139 | /api/initiatives/:id, /api/pmo/initiatives/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 105 | DELETE /:id | initiatives.routes.ts:3166 | /api/initiatives/:id, /api/pmo/initiatives/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 106 | GET /:id/readiness | initiatives.routes.ts:3182 | /api/initiatives/:id/readiness, /api/pmo/initiatives/:id/readiness | REALNA | src/services/initiatives-execution/runtimeApi.ts:555 |  |
| 107 | POST /:id/submit-review | initiatives.routes.ts:3188 | /api/initiatives/:id/submit-review, /api/pmo/initiatives/:id/submit-review | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 108 | POST /:id/approve | initiatives.routes.ts:3198 | /api/initiatives/:id/approve, /api/pmo/initiatives/:id/approve | REALNA | src/components/assessment/modals/GenerateInitiativesModal.tsx:242 |  |
| 109 | POST /:id/start-execution | initiatives.routes.ts:3229 | /api/initiatives/:id/start-execution, /api/pmo/initiatives/:id/start-execution | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 110 | POST /:id/block | initiatives.routes.ts:3239 | /api/initiatives/:id/block, /api/pmo/initiatives/:id/block | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 111 | POST /:id/unblock | initiatives.routes.ts:3249 | /api/initiatives/:id/unblock, /api/pmo/initiatives/:id/unblock | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 112 | POST /:id/complete | initiatives.routes.ts:3259 | /api/initiatives/:id/complete, /api/pmo/initiatives/:id/complete | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 113 | POST /:id/move | initiatives.routes.ts:3269 | /api/initiatives/:id/move, /api/pmo/initiatives/:id/move | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 114 | POST /bulk-assign | initiatives.routes.ts:3283 | /api/initiatives/bulk-assign, /api/pmo/initiatives/bulk-assign | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 115 | POST /:id/archive | initiatives.routes.ts:3293 | /api/initiatives/:id/archive, /api/pmo/initiatives/:id/archive | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 116 | GET /:id/capacity | initiatives.routes.ts:3303 | /api/initiatives/:id/capacity, /api/pmo/initiatives/:id/capacity | REALNA | src/services/initiatives-execution/runtimeApi.ts:130 |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 117 | GET /:id/capacity/timeline | initiatives.routes.ts:3322 | /api/initiatives/:id/capacity/timeline, /api/pmo/initiatives/:id/capacity/timeline | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 118 | GET /:id/kpis | initiatives.routes.ts:3349 | /api/initiatives/:id/kpis, /api/pmo/initiatives/:id/kpis | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 119 | POST /:id/kpis | initiatives.routes.ts:3355 | /api/initiatives/:id/kpis, /api/pmo/initiatives/:id/kpis | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 120 | PUT /:id/kpis/:kpiId | initiatives.routes.ts:3365 | /api/initiatives/:id/kpis/:kpiId, /api/pmo/initiatives/:id/kpis/:kpiId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 121 | DELETE /:id/kpis/:kpiId | initiatives.routes.ts:3375 | /api/initiatives/:id/kpis/:kpiId, /api/pmo/initiatives/:id/kpis/:kpiId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 122 | GET /:id/milestones | initiatives.routes.ts:3389 | /api/initiatives/:id/milestones, /api/pmo/initiatives/:id/milestones | REALNA | src/services/initiatives-execution/runtimeApi.ts:113 |  |
| 123 | POST /:id/milestones | initiatives.routes.ts:3395 | /api/initiatives/:id/milestones, /api/pmo/initiatives/:id/milestones | ODMOWA | src/services/initiatives-execution/runtimeApi.ts:113 | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 124 | PUT /:id/milestones/:milestoneId | initiatives.routes.ts:3405 | /api/initiatives/:id/milestones/:milestoneId, /api/pmo/initiatives/:id/milestones/:milestoneId | ODMOWA | src/services/initiatives-execution/runtimeApi.ts:113 | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 125 | DELETE /:id/milestones/:milestoneId | initiatives.routes.ts:3415 | /api/initiatives/:id/milestones/:milestoneId, /api/pmo/initiatives/:id/milestones/:milestoneId | ODMOWA | src/services/initiatives-execution/runtimeApi.ts:113 | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 126 | GET /:id/schedule-baselines | initiatives.routes.ts:3429 | /api/initiatives/:id/schedule-baselines, /api/pmo/initiatives/:id/schedule-baselines | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 127 | GET /:id/schedule-baselines/:version | initiatives.routes.ts:3435 | /api/initiatives/:id/schedule-baselines/:version, /api/pmo/initiatives/:id/schedule-baselines/:version | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 128 | GET /:id/resources | initiatives.routes.ts:3454 | /api/initiatives/:id/resources, /api/pmo/initiatives/:id/resources | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 129 | POST /:id/resources | initiatives.routes.ts:3460 | /api/initiatives/:id/resources, /api/pmo/initiatives/:id/resources | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 130 | DELETE /:id/resources/:resourceId | initiatives.routes.ts:3470 | /api/initiatives/:id/resources/:resourceId, /api/pmo/initiatives/:id/resources/:resourceId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 131 | PUT /:id/resources/:resourceId | initiatives.routes.ts:3480 | /api/initiatives/:id/resources/:resourceId, /api/pmo/initiatives/:id/resources/:resourceId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 132 | POST /:id/resources/ai-apply-log | initiatives.routes.ts:3490 | /api/initiatives/:id/resources/ai-apply-log, /api/pmo/initiatives/:id/resources/ai-apply-log | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 133 | GET /:id/staffing-plans | initiatives.routes.ts:3501 | /api/initiatives/:id/staffing-plans, /api/pmo/initiatives/:id/staffing-plans | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 134 | POST /:id/staffing-plans | initiatives.routes.ts:3502 | /api/initiatives/:id/staffing-plans, /api/pmo/initiatives/:id/staffing-plans | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 135 | GET /:id/staffing-plans/:planId | initiatives.routes.ts:3508 | /api/initiatives/:id/staffing-plans/:planId, /api/pmo/initiatives/:id/staffing-plans/:planId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 136 | PUT /:id/staffing-plans/:planId | initiatives.routes.ts:3509 | /api/initiatives/:id/staffing-plans/:planId, /api/pmo/initiatives/:id/staffing-plans/:planId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 137 | DELETE /:id/staffing-plans/:planId | initiatives.routes.ts:3515 | /api/initiatives/:id/staffing-plans/:planId, /api/pmo/initiatives/:id/staffing-plans/:planId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 138 | POST /:id/staffing-plans/:planId/roles | initiatives.routes.ts:3522 | /api/initiatives/:id/staffing-plans/:planId/roles, /api/pmo/initiatives/:id/staffing-plans/:planId/roles | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 139 | PUT /:id/staffing-plans/:planId/roles/:roleId | initiatives.routes.ts:3528 | /api/initiatives/:id/staffing-plans/:planId/roles/:roleId, /api/pmo/initiatives/:id/staffing-plans/:planId/roles/:roleId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 140 | DELETE /:id/staffing-plans/:planId/roles/:roleId | initiatives.routes.ts:3534 | /api/initiatives/:id/staffing-plans/:planId/roles/:roleId, /api/pmo/initiatives/:id/staffing-plans/:planId/roles/:roleId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 141 | GET /:id/staffing-plans/:planId/gaps | initiatives.routes.ts:3541 | /api/initiatives/:id/staffing-plans/:planId/gaps, /api/pmo/initiatives/:id/staffing-plans/:planId/gaps | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 142 | POST /:id/staffing-plans/:planId/sync-capacity | initiatives.routes.ts:3542 | /api/initiatives/:id/staffing-plans/:planId/sync-capacity, /api/pmo/initiatives/:id/staffing-plans/:planId/sync-capacity | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 143 | GET /:id/budget-items | initiatives.routes.ts:3557 | /api/initiatives/:id/budget-items, /api/pmo/initiatives/:id/budget-items | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 144 | POST /:id/budget-items | initiatives.routes.ts:3563 | /api/initiatives/:id/budget-items, /api/pmo/initiatives/:id/budget-items | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 145 | PUT /:id/budget-items/:itemId | initiatives.routes.ts:3573 | /api/initiatives/:id/budget-items/:itemId, /api/pmo/initiatives/:id/budget-items/:itemId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 146 | DELETE /:id/budget-items/:itemId | initiatives.routes.ts:3583 | /api/initiatives/:id/budget-items/:itemId, /api/pmo/initiatives/:id/budget-items/:itemId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 147 | GET /:id/tools | initiatives.routes.ts:3597 | /api/initiatives/:id/tools, /api/pmo/initiatives/:id/tools | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 148 | POST /:id/tools | initiatives.routes.ts:3603 | /api/initiatives/:id/tools, /api/pmo/initiatives/:id/tools | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 149 | PUT /:id/tools/:toolId | initiatives.routes.ts:3613 | /api/initiatives/:id/tools/:toolId, /api/pmo/initiatives/:id/tools/:toolId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 150 | DELETE /:id/tools/:toolId | initiatives.routes.ts:3623 | /api/initiatives/:id/tools/:toolId, /api/pmo/initiatives/:id/tools/:toolId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 151 | GET /:id/intangible-assets | initiatives.routes.ts:3637 | /api/initiatives/:id/intangible-assets, /api/pmo/initiatives/:id/intangible-assets | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 152 | POST /:id/intangible-assets | initiatives.routes.ts:3643 | /api/initiatives/:id/intangible-assets, /api/pmo/initiatives/:id/intangible-assets | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 153 | PUT /:id/intangible-assets/:assetId | initiatives.routes.ts:3653 | /api/initiatives/:id/intangible-assets/:assetId, /api/pmo/initiatives/:id/intangible-assets/:assetId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 154 | DELETE /:id/intangible-assets/:assetId | initiatives.routes.ts:3663 | /api/initiatives/:id/intangible-assets/:assetId, /api/pmo/initiatives/:id/intangible-assets/:assetId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 155 | GET /:id/stakeholders | initiatives.routes.ts:3673 | /api/initiatives/:id/stakeholders, /api/pmo/initiatives/:id/stakeholders | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 156 | POST /:id/stakeholders | initiatives.routes.ts:3674 | /api/initiatives/:id/stakeholders, /api/pmo/initiatives/:id/stakeholders | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 157 | DELETE /:id/stakeholders/:stakeholderId | initiatives.routes.ts:3679 | /api/initiatives/:id/stakeholders/:stakeholderId, /api/pmo/initiatives/:id/stakeholders/:stakeholderId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 158 | GET /:id/watchers | initiatives.routes.ts:3685 | /api/initiatives/:id/watchers, /api/pmo/initiatives/:id/watchers | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 159 | POST /:id/watchers | initiatives.routes.ts:3686 | /api/initiatives/:id/watchers, /api/pmo/initiatives/:id/watchers | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 160 | DELETE /:id/watchers/:watcherId | initiatives.routes.ts:3691 | /api/initiatives/:id/watchers/:watcherId, /api/pmo/initiatives/:id/watchers/:watcherId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 161 | GET /:id/raid | initiatives.routes.ts:3697 | /api/initiatives/:id/raid, /api/pmo/initiatives/:id/raid | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 162 | POST /:id/raid | initiatives.routes.ts:3698 | /api/initiatives/:id/raid, /api/pmo/initiatives/:id/raid | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 163 | PATCH /:id/raid/:raidId | initiatives.routes.ts:3703 | /api/initiatives/:id/raid/:raidId, /api/pmo/initiatives/:id/raid/:raidId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 164 | DELETE /:id/raid/:raidId | initiatives.routes.ts:3708 | /api/initiatives/:id/raid/:raidId, /api/pmo/initiatives/:id/raid/:raidId | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 165 | GET /:id/history | initiatives.routes.ts:3714 | /api/initiatives/:id/history, /api/pmo/initiatives/:id/history | REALNA | src/services/initiatives-execution/runtimeApi.ts:672 |  |
| 166 | GET /:id/comments | initiatives.routes.ts:3720 | /api/initiatives/:id/comments, /api/pmo/initiatives/:id/comments | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 167 | POST /:id/comments | initiatives.routes.ts:3721 | /api/initiatives/:id/comments, /api/pmo/initiatives/:id/comments | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 168 | DELETE /:id/comments/:commentId | initiatives.routes.ts:3726 | /api/initiatives/:id/comments/:commentId, /api/pmo/initiatives/:id/comments/:commentId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 169 | GET /:id/task-dependencies | initiatives.routes.ts:3740 | /api/initiatives/:id/task-dependencies, /api/pmo/initiatives/:id/task-dependencies | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 170 | GET /:id/gate-roles | initiatives.routes.ts:3746 | /api/initiatives/:id/gate-roles, /api/pmo/initiatives/:id/gate-roles | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 171 | PUT /:id/gate-roles | initiatives.routes.ts:3747 | /api/initiatives/:id/gate-roles, /api/pmo/initiatives/:id/gate-roles | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [zablokowane globalnym router.use(requireCanonicalInitiativeExecutionWriter) na linii 160 — metoda zapisu na trasie legacy dopasowanej do LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS zw |
| 172 | POST /:id/lifecycle-transition-proposals | initiatives.routes.ts:3801 | /api/initiatives/:id/lifecycle-transition-proposals, /api/pmo/initiatives/:id/lifecycle-transition-proposals | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwierd |
| 173 | POST /:id/lifecycle-transition-executions | initiatives.routes.ts:3833 | /api/initiatives/:id/lifecycle-transition-executions, /api/pmo/initiatives/:id/lifecycle-transition-executions | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwierd |
| 174 | POST /:id/lifecycle-gate-decisions | initiatives.routes.ts:3877 | /api/initiatives/:id/lifecycle-gate-decisions, /api/pmo/initiatives/:id/lifecycle-gate-decisions | ODMOWA | brak konsumenta (nie znaleziono literału trasy w src/) | [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwierd |
| 175 | POST /similar-check | initiatives.routes.ts:3957 | /api/initiatives/similar-check, /api/pmo/initiatives/similar-check | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 176 | POST /validate-card | initiatives.routes.ts:3958 | /api/initiatives/validate-card, /api/pmo/initiatives/validate-card | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 177 | POST /:id/gate-ai-check | initiatives.routes.ts:3959 | /api/initiatives/:id/gate-ai-check, /api/pmo/initiatives/:id/gate-ai-check | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 178 | GET /:id/linked-items | initiatives.routes.ts:3960 | /api/initiatives/:id/linked-items, /api/pmo/initiatives/:id/linked-items | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 179 | POST /:id/linked-items | initiatives.routes.ts:3961 | /api/initiatives/:id/linked-items, /api/pmo/initiatives/:id/linked-items | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 180 | DELETE /:id/linked-items/:linkId | initiatives.routes.ts:3966 | /api/initiatives/:id/linked-items/:linkId, /api/pmo/initiatives/:id/linked-items/:linkId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 181 | GET /:id/gate-readiness-check | initiatives.routes.ts:3971 | /api/initiatives/:id/gate-readiness-check, /api/pmo/initiatives/:id/gate-readiness-check | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 182 | GET /:id/status-history | initiatives.routes.ts:3972 | /api/initiatives/:id/status-history, /api/pmo/initiatives/:id/status-history | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 183 | POST /source-proposals | initiativesExecutionRuntime.routes.ts:1477 | /api/initiatives/runtime-v1/source-proposals, /api/pmo/initiatives/runtime-v1/source-proposals | REALNA | src/services/initiatives-execution/runtimeApi.ts:486 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 184 | GET /source-proposals | initiativesExecutionRuntime.routes.ts:1542 | /api/initiatives/runtime-v1/source-proposals, /api/pmo/initiatives/runtime-v1/source-proposals | REALNA | src/services/initiatives-execution/runtimeApi.ts:486 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 185 | POST /source-proposals/:proposalId/revisions | initiativesExecutionRuntime.routes.ts:1600 | /api/initiatives/runtime-v1/source-proposals/:proposalId/revisions, /api/pmo/initiatives/runtime-v1/source-proposals/:proposalId/revisions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 186 | GET /source-proposals/:proposalId | initiativesExecutionRuntime.routes.ts:1636 | /api/initiatives/runtime-v1/source-proposals/:proposalId, /api/pmo/initiatives/runtime-v1/source-proposals/:proposalId | REALNA | src/services/initiatives-execution/runtimeApi.ts:486 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 187 | POST /registrations | initiativesExecutionRuntime.routes.ts:1673 | /api/initiatives/runtime-v1/registrations, /api/pmo/initiatives/runtime-v1/registrations | REALNA | src/services/initiatives-execution/runtimeApi.ts:529 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 188 | POST /adoptions/accepted-classic | initiativesExecutionRuntime.routes.ts:1731 | /api/initiatives/runtime-v1/adoptions/accepted-classic, /api/pmo/initiatives/runtime-v1/adoptions/accepted-classic | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 189 | POST /source-proposals/:proposalId/decisions | initiativesExecutionRuntime.routes.ts:1789 | /api/initiatives/runtime-v1/source-proposals/:proposalId/decisions, /api/pmo/initiatives/runtime-v1/source-proposals/:proposalId/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:940 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 190 | GET /initiatives | initiativesExecutionRuntime.routes.ts:1859 | /api/initiatives/runtime-v1/initiatives, /api/pmo/initiatives/runtime-v1/initiatives | REALNA | src/components/Studio/StudioLinkModal.tsx:71 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 191 | PATCH /initiatives/:initiativeId/metadata | initiativesExecutionRuntime.routes.ts:1899 | /api/initiatives/runtime-v1/initiatives/:initiativeId/metadata, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/metadata | REALNA | src/services/initiatives-execution/runtimeApi.ts:980 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 192 | POST /initiatives/:initiativeId/cancel | initiativesExecutionRuntime.routes.ts:1947 | /api/initiatives/runtime-v1/initiatives/:initiativeId/cancel, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/cancel | REALNA | src/services/initiatives-execution/runtimeApi.ts:1002 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 193 | GET /initiatives/:initiativeId | initiativesExecutionRuntime.routes.ts:1986 | /api/initiatives/runtime-v1/initiatives/:initiativeId, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId | REALNA | src/components/Studio/StudioLinkModal.tsx:71 |  |
| 194 | GET /initiatives/:initiativeId/cards | initiativesExecutionRuntime.routes.ts:2010 | /api/initiatives/runtime-v1/initiatives/:initiativeId/cards, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/cards | REALNA | src/services/initiatives-execution/runtimeApi.ts:1104 |  |
| 195 | GET /initiatives/:initiativeId/card-selection | initiativesExecutionRuntime.routes.ts:2034 | /api/initiatives/runtime-v1/initiatives/:initiativeId/card-selection, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/card-selection | REALNA | src/services/initiatives-execution/runtimeApi.ts:1129 |  |
| 196 | POST /initiatives/:initiativeId/card-selection | initiativesExecutionRuntime.routes.ts:2058 | /api/initiatives/runtime-v1/initiatives/:initiativeId/card-selection, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/card-selection | REALNA | src/services/initiatives-execution/runtimeApi.ts:1129 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 197 | POST /initiatives/:initiativeId/definition-remediation | initiativesExecutionRuntime.routes.ts:2113 | /api/initiatives/runtime-v1/initiatives/:initiativeId/definition-remediation, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/definition-remediation | REALNA | src/services/initiatives-execution/runtimeApi.ts:1314 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 198 | GET /initiatives/:initiativeId/capabilities | initiativesExecutionRuntime.routes.ts:2162 | /api/initiatives/runtime-v1/initiatives/:initiativeId/capabilities, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/capabilities | REALNA | src/services/initiatives-execution/runtimeApi.ts:1207 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 199 | GET /initiatives/:initiativeId/gates/definition/readiness | initiativesExecutionRuntime.routes.ts:2244 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/definition/readiness, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/definition/readiness | REALNA | src/services/initiatives-execution/runtimeApi.ts:1171 |  |
| 200 | POST /initiatives/:initiativeId/source-refresh | initiativesExecutionRuntime.routes.ts:2300 | /api/initiatives/runtime-v1/initiatives/:initiativeId/source-refresh, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/source-refresh | REALNA | src/services/initiatives-execution/runtimeApi.ts:1189 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 201 | POST /initiatives/:initiativeId/cards/:cardKey/publications | initiativesExecutionRuntime.routes.ts:2352 | /api/initiatives/runtime-v1/initiatives/:initiativeId/cards/:cardKey/publications, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/cards/:cardKey/publications | REALNA | src/services/initiatives-execution/runtimeApi.ts:1412 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 202 | POST /initiatives/:initiativeId/cards/:cardKey/reviews | initiativesExecutionRuntime.routes.ts:2412 | /api/initiatives/runtime-v1/initiatives/:initiativeId/cards/:cardKey/reviews, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/cards/:cardKey/reviews | REALNA | src/services/initiatives-execution/runtimeApi.ts:1228 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 203 | POST /initiatives/:initiativeId/gates/definition/requests | initiativesExecutionRuntime.routes.ts:2467 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/definition/requests, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/definition/requests | REALNA | src/services/initiatives-execution/runtimeApi.ts:1262 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 204 | POST /initiatives/:initiativeId/gates/definition/decisions | initiativesExecutionRuntime.routes.ts:2518 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/definition/decisions, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/definition/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:1278 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 205 | GET /my-work/definition-decisions | initiativesExecutionRuntime.routes.ts:2571 | /api/initiatives/runtime-v1/my-work/definition-decisions, /api/pmo/initiatives/runtime-v1/my-work/definition-decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:1278 |  |
| 206 | GET /my-work/definition-remediation | initiativesExecutionRuntime.routes.ts:2597 | /api/initiatives/runtime-v1/my-work/definition-remediation, /api/pmo/initiatives/runtime-v1/my-work/definition-remediation | REALNA | src/services/initiatives-execution/runtimeApi.ts:1334 |  |
| 207 | POST /my-work/definition-remediation/:aggregateType/:aggregateId/resolve | initiativesExecutionRuntime.routes.ts:2613 | /api/initiatives/runtime-v1/my-work/definition-remediation/:aggregateType/:aggregateId/resolve, /api/pmo/initiatives/runtime-v1/my-work/definition-remediation/:aggregateType/:aggregateId/resolve | REALNA | src/services/initiatives-execution/runtimeApi.ts:1363 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 208 | GET /initiatives/:initiativeId/gates/analysis/readiness | initiativesExecutionRuntime.routes.ts:2669 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/readiness, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/readiness | REALNA | src/services/initiatives-execution/runtimeApi.ts:555 |  |
| 209 | POST /initiatives/:initiativeId/gates/analysis/start | initiativesExecutionRuntime.routes.ts:2698 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/start, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/start | REALNA | src/services/initiatives-execution/runtimeApi.ts:568 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 210 | POST /initiatives/:initiativeId/gates/analysis/requests | initiativesExecutionRuntime.routes.ts:2744 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/requests, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/requests | REALNA | src/services/initiatives-execution/runtimeApi.ts:592 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 211 | POST /initiatives/:initiativeId/gates/analysis/decisions | initiativesExecutionRuntime.routes.ts:2795 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/decisions, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/analysis/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:621 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 212 | GET /my-work/analysis-decisions | initiativesExecutionRuntime.routes.ts:2848 | /api/initiatives/runtime-v1/my-work/analysis-decisions, /api/pmo/initiatives/runtime-v1/my-work/analysis-decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:637 |  |
| 213 | POST /portfolio-scenarios/:scenarioId | initiativesExecutionRuntime.routes.ts:2865 | /api/initiatives/runtime-v1/portfolio-scenarios/:scenarioId, /api/pmo/initiatives/runtime-v1/portfolio-scenarios/:scenarioId | REALNA | src/services/initiatives-execution/runtimeApi.ts:649 |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 214 | GET /portfolio-scenarios/:scenarioId | initiativesExecutionRuntime.routes.ts:2920 | /api/initiatives/runtime-v1/portfolio-scenarios/:scenarioId, /api/pmo/initiatives/runtime-v1/portfolio-scenarios/:scenarioId | REALNA | src/services/initiatives-execution/runtimeApi.ts:649 |  |
| 215 | GET /portfolio-scenarios/:scenarioId/history | initiativesExecutionRuntime.routes.ts:2943 | /api/initiatives/runtime-v1/portfolio-scenarios/:scenarioId/history, /api/pmo/initiatives/runtime-v1/portfolio-scenarios/:scenarioId/history | REALNA | src/services/initiatives-execution/runtimeApi.ts:672 |  |
| 216 | GET /portfolio-scenarios/:scenarioId/diff | initiativesExecutionRuntime.routes.ts:2971 | /api/initiatives/runtime-v1/portfolio-scenarios/:scenarioId/diff, /api/pmo/initiatives/runtime-v1/portfolio-scenarios/:scenarioId/diff | REALNA | src/services/initiatives-execution/runtimeApi.ts:686 |  |
| 217 | POST /initiatives/:initiativeId/gates/portfolio/requests | initiativesExecutionRuntime.routes.ts:3009 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/portfolio/requests, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/portfolio/requests | REALNA | src/services/initiatives-execution/runtimeApi.ts:698 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 218 | GET /initiatives/:initiativeId/gates/portfolio/decision | initiativesExecutionRuntime.routes.ts:3062 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/portfolio/decision, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/portfolio/decision | REALNA | src/services/initiatives-execution/runtimeApi.ts:736 |  |
| 219 | POST /initiatives/:initiativeId/gates/portfolio/decisions | initiativesExecutionRuntime.routes.ts:3088 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/portfolio/decisions, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/portfolio/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:748 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 220 | GET /my-work/portfolio-decisions | initiativesExecutionRuntime.routes.ts:3143 | /api/initiatives/runtime-v1/my-work/portfolio-decisions, /api/pmo/initiatives/runtime-v1/my-work/portfolio-decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:761 |  |
| 221 | GET /plan-scenarios | initiativesExecutionRuntime.routes.ts:3160 | /api/initiatives/runtime-v1/plan-scenarios, /api/pmo/initiatives/runtime-v1/plan-scenarios | REALNA | src/services/initiatives-execution/runtimeApi.ts:771 |  |
| 222 | POST /plan-scenarios/:scenarioId | initiativesExecutionRuntime.routes.ts:3184 | /api/initiatives/runtime-v1/plan-scenarios/:scenarioId, /api/pmo/initiatives/runtime-v1/plan-scenarios/:scenarioId | REALNA | src/services/initiatives-execution/runtimeApi.ts:771 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 223 | GET /plan-scenarios/:scenarioId | initiativesExecutionRuntime.routes.ts:3242 | /api/initiatives/runtime-v1/plan-scenarios/:scenarioId, /api/pmo/initiatives/runtime-v1/plan-scenarios/:scenarioId | REALNA | src/services/initiatives-execution/runtimeApi.ts:771 |  |
| 224 | GET /plan-scenarios/:scenarioId/history | initiativesExecutionRuntime.routes.ts:3271 | /api/initiatives/runtime-v1/plan-scenarios/:scenarioId/history, /api/pmo/initiatives/runtime-v1/plan-scenarios/:scenarioId/history | REALNA | src/services/initiatives-execution/runtimeApi.ts:803 |  |
| 225 | GET /plan-scenarios/:scenarioId/diff | initiativesExecutionRuntime.routes.ts:3305 | /api/initiatives/runtime-v1/plan-scenarios/:scenarioId/diff, /api/pmo/initiatives/runtime-v1/plan-scenarios/:scenarioId/diff | REALNA | src/services/initiatives-execution/runtimeApi.ts:817 |  |
| 226 | POST /plan-scenarios/:scenarioId/analysis-proposals/:proposalId | initiativesExecutionRuntime.routes.ts:3349 | /api/initiatives/runtime-v1/plan-scenarios/:scenarioId/analysis-proposals/:proposalId, /api/pmo/initiatives/runtime-v1/plan-scenarios/:scenarioId/analysis-proposals/:proposalId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 227 | POST /plan-analysis-proposals/:proposalId/review | initiativesExecutionRuntime.routes.ts:3411 | /api/initiatives/runtime-v1/plan-analysis-proposals/:proposalId/review, /api/pmo/initiatives/runtime-v1/plan-analysis-proposals/:proposalId/review | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 228 | GET /portfolio-scenarios | initiativesExecutionRuntime.routes.ts:3441 | /api/initiatives/runtime-v1/portfolio-scenarios, /api/pmo/initiatives/runtime-v1/portfolio-scenarios | REALNA | src/services/initiatives-execution/runtimeApi.ts:649 |  |
| 229 | POST /capacity-scenarios/:scenarioId | initiativesExecutionRuntime.routes.ts:3456 | /api/initiatives/runtime-v1/capacity-scenarios/:scenarioId, /api/pmo/initiatives/runtime-v1/capacity-scenarios/:scenarioId | REALNA | src/services/initiatives-execution/runtimeApi.ts:130 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 230 | GET /capacity-scenarios/:scenarioId | initiativesExecutionRuntime.routes.ts:3548 | /api/initiatives/runtime-v1/capacity-scenarios/:scenarioId, /api/pmo/initiatives/runtime-v1/capacity-scenarios/:scenarioId | REALNA | src/services/initiatives-execution/runtimeApi.ts:130 |  |
| 231 | GET /capacity-scenarios/:scenarioId/history | initiativesExecutionRuntime.routes.ts:3567 | /api/initiatives/runtime-v1/capacity-scenarios/:scenarioId/history, /api/pmo/initiatives/runtime-v1/capacity-scenarios/:scenarioId/history | REALNA | src/services/initiatives-execution/runtimeApi.ts:858 |  |
| 232 | POST /resource-commitments/:commitmentId | initiativesExecutionRuntime.routes.ts:3583 | /api/initiatives/runtime-v1/resource-commitments/:commitmentId, /api/pmo/initiatives/runtime-v1/resource-commitments/:commitmentId | REALNA | src/services/initiatives-execution/runtimeApi.ts:867 |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 233 | POST /resource-commitments/:commitmentId/accept | initiativesExecutionRuntime.routes.ts:3621 | /api/initiatives/runtime-v1/resource-commitments/:commitmentId/accept, /api/pmo/initiatives/runtime-v1/resource-commitments/:commitmentId/accept | REALNA | src/services/initiatives-execution/runtimeApi.ts:881 |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 234 | POST /resource-commitments/:commitmentId/decisions | initiativesExecutionRuntime.routes.ts:3650 | /api/initiatives/runtime-v1/resource-commitments/:commitmentId/decisions, /api/pmo/initiatives/runtime-v1/resource-commitments/:commitmentId/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:895 |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 235 | POST /initiatives/:initiativeId/gates/schedule/requests | initiativesExecutionRuntime.routes.ts:3680 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/schedule/requests, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/schedule/requests | REALNA | src/services/initiatives-execution/runtimeApi.ts:214 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 236 | POST /initiatives/:initiativeId/gates/schedule/decisions | initiativesExecutionRuntime.routes.ts:3725 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gates/schedule/decisions, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gates/schedule/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:231 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 237 | GET /my-work/schedule-decisions | initiativesExecutionRuntime.routes.ts:3778 | /api/initiatives/runtime-v1/my-work/schedule-decisions, /api/pmo/initiatives/runtime-v1/my-work/schedule-decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:244 |  |
| 238 | GET /handoff-packages/:handoffPackageId | initiativesExecutionRuntime.routes.ts:3794 | /api/initiatives/runtime-v1/handoff-packages/:handoffPackageId, /api/pmo/initiatives/runtime-v1/handoff-packages/:handoffPackageId | REALNA | src/services/initiatives-execution/runtimeApi.ts:254 |  |
| 239 | GET /capacity-scenarios | initiativesExecutionRuntime.routes.ts:3824 | /api/initiatives/runtime-v1/capacity-scenarios, /api/pmo/initiatives/runtime-v1/capacity-scenarios | REALNA | src/services/initiatives-execution/runtimeApi.ts:130 |  |
| 240 | POST /initiatives/:initiativeId/handoff/requests | initiativesExecutionRuntime.routes.ts:3851 | /api/initiatives/runtime-v1/initiatives/:initiativeId/handoff/requests, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/handoff/requests | REALNA | src/services/initiatives-execution/runtimeApi.ts:143 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 241 | POST /initiatives/:initiativeId/handoff/decisions | initiativesExecutionRuntime.routes.ts:3896 | /api/initiatives/runtime-v1/initiatives/:initiativeId/handoff/decisions, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/handoff/decisions | REALNA | src/services/initiatives-execution/runtimeApi.ts:160 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 242 | GET /my-work/handoff-acceptances | initiativesExecutionRuntime.routes.ts:3944 | /api/initiatives/runtime-v1/my-work/handoff-acceptances, /api/pmo/initiatives/runtime-v1/my-work/handoff-acceptances | REALNA | src/services/initiatives-execution/runtimeApi.ts:173 |  |
| 243 | GET /execution-cases | initiativesExecutionRuntime.routes.ts:3960 | /api/initiatives/runtime-v1/execution-cases, /api/pmo/initiatives/runtime-v1/execution-cases | REALNA | src/services/initiatives-execution/runtimeApi.ts:97 |  |
| 244 | GET /execution-cases/:executionCaseId | initiativesExecutionRuntime.routes.ts:3981 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId | REALNA | src/services/initiatives-execution/runtimeApi.ts:97 |  |
| 245 | GET /initiatives/:initiativeId/execution-case | initiativesExecutionRuntime.routes.ts:4010 | /api/initiatives/runtime-v1/initiatives/:initiativeId/execution-case, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/execution-case | REALNA | src/services/initiatives-execution/runtimeApi.ts:97 |  |
| 246 | POST /execution-cases/:executionCaseId/milestones/:milestoneId | initiativesExecutionRuntime.routes.ts:4041 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/milestones/:milestoneId, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/milestones/:milestoneId | REALNA | src/services/initiatives-execution/runtimeApi.ts:113 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 247 | GET /execution-cases/:executionCaseId/milestones | initiativesExecutionRuntime.routes.ts:4084 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/milestones, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/milestones | REALNA | src/services/initiatives-execution/runtimeApi.ts:113 |  |
| 248 | POST /execution-cases/:executionCaseId/tasks/:taskId | initiativesExecutionRuntime.routes.ts:4118 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 249 | PATCH /execution-cases/:executionCaseId/tasks/:taskId | initiativesExecutionRuntime.routes.ts:4157 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 250 | POST /execution-cases/:executionCaseId/tasks/:taskId/complete | initiativesExecutionRuntime.routes.ts:4187 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId/complete, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId/complete | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 251 | POST /execution-cases/:executionCaseId/decisions/:decisionId | initiativesExecutionRuntime.routes.ts:4217 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 252 | POST /execution-cases/:executionCaseId/decisions/:decisionId/request | initiativesExecutionRuntime.routes.ts:4248 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId/request, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId/request | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 253 | POST /execution-cases/:executionCaseId/decisions/:decisionId/decide | initiativesExecutionRuntime.routes.ts:4277 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId/decide, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId/decide | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 254 | GET /execution-cases/:executionCaseId/work | initiativesExecutionRuntime.routes.ts:4307 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/work, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/work | REALNA | src/services/initiatives-execution/runtimeApi.ts:97 | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 255 | POST /execution-cases/:executionCaseId/tasks/:taskId/transitions | initiativesExecutionRuntime.routes.ts:4331 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId/transitions, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 256 | POST /execution-cases/:executionCaseId/decisions/:decisionId/transitions | initiativesExecutionRuntime.routes.ts:4362 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId/transitions, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/decisions/:decisionId/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 257 | GET /my-work/execution | initiativesExecutionRuntime.routes.ts:4393 | /api/initiatives/runtime-v1/my-work/execution, /api/pmo/initiatives/runtime-v1/my-work/execution | REALNA | src/services/initiatives-execution/runtimeApi.ts:121 |  |
| 258 | POST /execution-cases/:executionCaseId/tasks/:taskId/allocations/:allocationId | initiativesExecutionRuntime.routes.ts:4405 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId/allocations/:allocationId, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/tasks/:taskId/allocations/:allocationId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 259 | POST /operational-allocations/simulate | initiativesExecutionRuntime.routes.ts:4467 | /api/initiatives/runtime-v1/operational-allocations/simulate, /api/pmo/initiatives/runtime-v1/operational-allocations/simulate | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | symulacja deterministyczna (simulateOperationalAllocation) — liczona po stronie serwera z danych wejściowych, bez zapisu do bazy [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyk |
| 260 | POST /operational-allocations/:allocationId/transitions | initiativesExecutionRuntime.routes.ts:4514 | /api/initiatives/runtime-v1/operational-allocations/:allocationId/transitions, /api/pmo/initiatives/runtime-v1/operational-allocations/:allocationId/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 261 | GET /execution-cases/:executionCaseId/allocations | initiativesExecutionRuntime.routes.ts:4544 | /api/initiatives/runtime-v1/execution-cases/:executionCaseId/allocations, /api/pmo/initiatives/runtime-v1/execution-cases/:executionCaseId/allocations | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 262 | GET /my-work/operational-allocations | initiativesExecutionRuntime.routes.ts:4564 | /api/initiatives/runtime-v1/my-work/operational-allocations, /api/pmo/initiatives/runtime-v1/my-work/operational-allocations | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 263 | GET /command-receipts/:clientRequestId/read-back | initiativesExecutionRuntime.routes.ts:4578 | /api/initiatives/runtime-v1/command-receipts/:clientRequestId/read-back, /api/pmo/initiatives/runtime-v1/command-receipts/:clientRequestId/read-back | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 264 | POST /execution-control-kpi-policies/:policyId | initiativesExecutionRuntime.routes.ts:4622 | /api/initiatives/runtime-v1/execution-control-kpi-policies/:policyId, /api/pmo/initiatives/runtime-v1/execution-control-kpi-policies/:policyId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 265 | POST /goals/:goalId/perspective | initiativesExecutionRuntime.routes.ts:4659 | /api/initiatives/runtime-v1/goals/:goalId/perspective, /api/pmo/initiatives/runtime-v1/goals/:goalId/perspective | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 266 | POST /initiatives/:initiativeId/budget-entries/:entryId/void | initiativesExecutionRuntime.routes.ts:4695 | /api/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId/void, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId/void | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 267 | POST /initiatives/:initiativeId/budget-entries/:entryId | initiativesExecutionRuntime.routes.ts:4727 | /api/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 268 | POST /initiatives/:initiativeId/realizations/:realizationId | initiativesExecutionRuntime.routes.ts:4768 | /api/initiatives/runtime-v1/initiatives/:initiativeId/realizations/:realizationId, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/realizations/:realizationId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 269 | GET /initiatives/:initiativeId/realizations | initiativesExecutionRuntime.routes.ts:4802 | /api/initiatives/runtime-v1/initiatives/:initiativeId/realizations, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/realizations | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 270 | POST /initiatives/:initiativeId/raid-mitigations/:raidItemId | initiativesExecutionRuntime.routes.ts:4819 | /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations/:raidItemId, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations/:raidItemId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 271 | GET /initiatives/:initiativeId/raid-mitigations | initiativesExecutionRuntime.routes.ts:4854 | /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 272 | POST /initiatives/:initiativeId/manager-actions/:managerActionId | initiativesExecutionRuntime.routes.ts:4871 | /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-actions/:managerActionId, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/manager-actions/:managerActionId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 273 | GET /initiatives/:initiativeId/manager-actions | initiativesExecutionRuntime.routes.ts:4905 | /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-actions, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/manager-actions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 274 | POST /initiatives/:initiativeId/manager-suggestions/:suggestionId/review | initiativesExecutionRuntime.routes.ts:4925 | /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-suggestions/:suggestionId/review, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/manager-suggestions/:suggestionId/review | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 275 | GET /initiatives/:initiativeId/manager-suggestion-reviews | initiativesExecutionRuntime.routes.ts:4960 | /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-suggestion-reviews, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/manager-suggestion-reviews | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 276 | GET /execution-write-map | initiativesExecutionRuntime.routes.ts:4980 | /api/initiatives/runtime-v1/execution-write-map, /api/pmo/initiatives/runtime-v1/execution-write-map | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | statyczna mapa legacy→canonical tras zwracana wprost (bez zapytania do bazy) — celowa trasa odkrycia, nie odmowa i nie kikut |
| 277 | POST /management-signals/ingest | initiativesExecutionRuntime.routes.ts:5017 | /api/initiatives/runtime-v1/management-signals/ingest, /api/pmo/initiatives/runtime-v1/management-signals/ingest | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 278 | POST /interventions/:interventionId | initiativesExecutionRuntime.routes.ts:5049 | /api/initiatives/runtime-v1/interventions/:interventionId, /api/pmo/initiatives/runtime-v1/interventions/:interventionId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 279 | POST /interventions/:interventionId/transitions | initiativesExecutionRuntime.routes.ts:5080 | /api/initiatives/runtime-v1/interventions/:interventionId/transitions, /api/pmo/initiatives/runtime-v1/interventions/:interventionId/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 280 | GET /management-signals | initiativesExecutionRuntime.routes.ts:5111 | /api/initiatives/runtime-v1/management-signals, /api/pmo/initiatives/runtime-v1/management-signals | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 281 | GET /interventions | initiativesExecutionRuntime.routes.ts:5130 | /api/initiatives/runtime-v1/interventions, /api/pmo/initiatives/runtime-v1/interventions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 282 | POST /report-definitions/:definitionId | initiativesExecutionRuntime.routes.ts:5149 | /api/initiatives/runtime-v1/report-definitions/:definitionId, /api/pmo/initiatives/runtime-v1/report-definitions/:definitionId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 283 | POST /report-definitions/:definitionId/transitions | initiativesExecutionRuntime.routes.ts:5188 | /api/initiatives/runtime-v1/report-definitions/:definitionId/transitions, /api/pmo/initiatives/runtime-v1/report-definitions/:definitionId/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 284 | GET /report-definitions | initiativesExecutionRuntime.routes.ts:5219 | /api/initiatives/runtime-v1/report-definitions, /api/pmo/initiatives/runtime-v1/report-definitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 285 | POST /report-runs/:reportRunId | initiativesExecutionRuntime.routes.ts:5238 | /api/initiatives/runtime-v1/report-runs/:reportRunId, /api/pmo/initiatives/runtime-v1/report-runs/:reportRunId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 286 | POST /report-runs/:reportRunId/transitions | initiativesExecutionRuntime.routes.ts:5279 | /api/initiatives/runtime-v1/report-runs/:reportRunId/transitions, /api/pmo/initiatives/runtime-v1/report-runs/:reportRunId/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 287 | POST /report-runs/:reportRunId/reconstruct | initiativesExecutionRuntime.routes.ts:5310 | /api/initiatives/runtime-v1/report-runs/:reportRunId/reconstruct, /api/pmo/initiatives/runtime-v1/report-runs/:reportRunId/reconstruct | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 288 | GET /report-definitions/:definitionId | initiativesExecutionRuntime.routes.ts:5341 | /api/initiatives/runtime-v1/report-definitions/:definitionId, /api/pmo/initiatives/runtime-v1/report-definitions/:definitionId | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 289 | GET /report-runs | initiativesExecutionRuntime.routes.ts:5364 | /api/initiatives/runtime-v1/report-runs, /api/pmo/initiatives/runtime-v1/report-runs | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 290 | GET /control-kpis | initiativesExecutionRuntime.routes.ts:5383 | /api/initiatives/runtime-v1/control-kpis, /api/pmo/initiatives/runtime-v1/control-kpis | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | degradowany fallback 503 gdy deps.controlKpis brak wstrzykniętego czytnika; ścieżka domyślna woła deps.controlKpis.read (realny odczyt) |
| 291 | POST /delivery-acceptances/:id/request | initiativesExecutionRuntime.routes.ts:5404 | /api/initiatives/runtime-v1/delivery-acceptances/:id/request, /api/pmo/initiatives/runtime-v1/delivery-acceptances/:id/request | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 292 | POST /delivery-acceptances/:id/decide | initiativesExecutionRuntime.routes.ts:5436 | /api/initiatives/runtime-v1/delivery-acceptances/:id/decide, /api/pmo/initiatives/runtime-v1/delivery-acceptances/:id/decide | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 293 | POST /results-acceptances/:id/request | initiativesExecutionRuntime.routes.ts:5467 | /api/initiatives/runtime-v1/results-acceptances/:id/request, /api/pmo/initiatives/runtime-v1/results-acceptances/:id/request | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 294 | POST /results-acceptances/:id/decide | initiativesExecutionRuntime.routes.ts:5499 | /api/initiatives/runtime-v1/results-acceptances/:id/decide, /api/pmo/initiatives/runtime-v1/results-acceptances/:id/decide | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 295 | GET /delivery-acceptances | initiativesExecutionRuntime.routes.ts:5530 | /api/initiatives/runtime-v1/delivery-acceptances, /api/pmo/initiatives/runtime-v1/delivery-acceptances | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 296 | GET /results-acceptances | initiativesExecutionRuntime.routes.ts:5549 | /api/initiatives/runtime-v1/results-acceptances, /api/pmo/initiatives/runtime-v1/results-acceptances | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 297 | GET /benefits-handoff-packs/:id | initiativesExecutionRuntime.routes.ts:5568 | /api/initiatives/runtime-v1/benefits-handoff-packs/:id, /api/pmo/initiatives/runtime-v1/benefits-handoff-packs/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 298 | GET /my-work/acceptances | initiativesExecutionRuntime.routes.ts:5587 | /api/initiatives/runtime-v1/my-work/acceptances, /api/pmo/initiatives/runtime-v1/my-work/acceptances | REALNA | src/services/initiatives-execution/runtimeApi.ts:173 |  |
| 299 | POST /finance-reconciliations/:id | initiativesExecutionRuntime.routes.ts:5598 | /api/initiatives/runtime-v1/finance-reconciliations/:id, /api/pmo/initiatives/runtime-v1/finance-reconciliations/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 300 | POST /results-observations/:id | initiativesExecutionRuntime.routes.ts:5630 | /api/initiatives/runtime-v1/results-observations/:id, /api/pmo/initiatives/runtime-v1/results-observations/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 301 | GET /finance-reconciliations/:id | initiativesExecutionRuntime.routes.ts:5662 | /api/initiatives/runtime-v1/finance-reconciliations/:id, /api/pmo/initiatives/runtime-v1/finance-reconciliations/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 302 | GET /results-observations | initiativesExecutionRuntime.routes.ts:5681 | /api/initiatives/runtime-v1/results-observations, /api/pmo/initiatives/runtime-v1/results-observations | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 303 | GET /results-observations/:id | initiativesExecutionRuntime.routes.ts:5703 | /api/initiatives/runtime-v1/results-observations/:id, /api/pmo/initiatives/runtime-v1/results-observations/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 304 | POST /effectiveness/:id | initiativesExecutionRuntime.routes.ts:5722 | /api/initiatives/runtime-v1/effectiveness/:id, /api/pmo/initiatives/runtime-v1/effectiveness/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 305 | POST /effectiveness/:id/transitions | initiativesExecutionRuntime.routes.ts:5754 | /api/initiatives/runtime-v1/effectiveness/:id/transitions, /api/pmo/initiatives/runtime-v1/effectiveness/:id/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 306 | POST /effectiveness/:id/close | initiativesExecutionRuntime.routes.ts:5785 | /api/initiatives/runtime-v1/effectiveness/:id/close, /api/pmo/initiatives/runtime-v1/effectiveness/:id/close | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 307 | POST /closures/:id/requests | initiativesExecutionRuntime.routes.ts:5816 | /api/initiatives/runtime-v1/closures/:id/requests, /api/pmo/initiatives/runtime-v1/closures/:id/requests | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 308 | POST /closures/:id/decisions | initiativesExecutionRuntime.routes.ts:5864 | /api/initiatives/runtime-v1/closures/:id/decisions, /api/pmo/initiatives/runtime-v1/closures/:id/decisions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 309 | GET /closures | initiativesExecutionRuntime.routes.ts:5919 | /api/initiatives/runtime-v1/closures, /api/pmo/initiatives/runtime-v1/closures | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 310 | GET /effectiveness-snapshots/:id | initiativesExecutionRuntime.routes.ts:5938 | /api/initiatives/runtime-v1/effectiveness-snapshots/:id, /api/pmo/initiatives/runtime-v1/effectiveness-snapshots/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 311 | POST /archives/:id | initiativesExecutionRuntime.routes.ts:5957 | /api/initiatives/runtime-v1/archives/:id, /api/pmo/initiatives/runtime-v1/archives/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 312 | GET /effectiveness | initiativesExecutionRuntime.routes.ts:5989 | /api/initiatives/runtime-v1/effectiveness, /api/pmo/initiatives/runtime-v1/effectiveness | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 313 | GET /closure-snapshots/:id | initiativesExecutionRuntime.routes.ts:6008 | /api/initiatives/runtime-v1/closure-snapshots/:id, /api/pmo/initiatives/runtime-v1/closure-snapshots/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 314 | GET /archives | initiativesExecutionRuntime.routes.ts:6027 | /api/initiatives/runtime-v1/archives, /api/pmo/initiatives/runtime-v1/archives | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 315 | GET /my-work/effectiveness | initiativesExecutionRuntime.routes.ts:6046 | /api/initiatives/runtime-v1/my-work/effectiveness, /api/pmo/initiatives/runtime-v1/my-work/effectiveness | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 316 | POST /material-changes/:id | initiativesExecutionRuntime.routes.ts:6059 | /api/initiatives/runtime-v1/material-changes/:id, /api/pmo/initiatives/runtime-v1/material-changes/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 317 | POST /material-changes/:id/transitions | initiativesExecutionRuntime.routes.ts:6091 | /api/initiatives/runtime-v1/material-changes/:id/transitions, /api/pmo/initiatives/runtime-v1/material-changes/:id/transitions | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 318 | GET /material-changes | initiativesExecutionRuntime.routes.ts:6122 | /api/initiatives/runtime-v1/material-changes, /api/pmo/initiatives/runtime-v1/material-changes | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 319 | GET /my-work/material-changes | initiativesExecutionRuntime.routes.ts:6141 | /api/initiatives/runtime-v1/my-work/material-changes, /api/pmo/initiatives/runtime-v1/my-work/material-changes | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 320 | POST /ai-analysis-proposals/:id | initiativesExecutionRuntime.routes.ts:6160 | /api/initiatives/runtime-v1/ai-analysis-proposals/:id, /api/pmo/initiatives/runtime-v1/ai-analysis-proposals/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 321 | POST /ai-analysis-proposals/:id/review | initiativesExecutionRuntime.routes.ts:6192 | /api/initiatives/runtime-v1/ai-analysis-proposals/:id/review, /api/pmo/initiatives/runtime-v1/ai-analysis-proposals/:id/review | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 322 | GET /ai-analysis-proposals | initiativesExecutionRuntime.routes.ts:6223 | /api/initiatives/runtime-v1/ai-analysis-proposals, /api/pmo/initiatives/runtime-v1/ai-analysis-proposals | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 323 | GET /my-work/ai-analysis-reviews | initiativesExecutionRuntime.routes.ts:6234 | /api/initiatives/runtime-v1/my-work/ai-analysis-reviews, /api/pmo/initiatives/runtime-v1/my-work/ai-analysis-reviews | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 324 | POST /capacity-options/:id | initiativesExecutionRuntime.routes.ts:6247 | /api/initiatives/runtime-v1/capacity-options/:id, /api/pmo/initiatives/runtime-v1/capacity-options/:id | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  [sygnał: nazwane wywołanie await bez dopasowania do wzorca Service/Repository/deps — 5/5 próbek ręcznie potwierdzonych jako realne wywołania backendu; grep całych 9 plików potwier |
| 325 | POST /capacity-options/:id/select | initiativesExecutionRuntime.routes.ts:6279 | /api/initiatives/runtime-v1/capacity-options/:id/select, /api/pmo/initiatives/runtime-v1/capacity-options/:id/select | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 326 | GET /capacity-options | initiativesExecutionRuntime.routes.ts:6310 | /api/initiatives/runtime-v1/capacity-options, /api/pmo/initiatives/runtime-v1/capacity-options | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 327 | POST /initiatives/:initiativeId/gate-signoffs | initiativesExecutionRuntime.routes.ts:6321 | /api/initiatives/runtime-v1/initiatives/:initiativeId/gate-signoffs, /api/pmo/initiatives/runtime-v1/initiatives/:initiativeId/gate-signoffs | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) | [wstępnie oznaczone jako REALNA_Z_SYNTEZĄ heurystyką .map()/Promise.all — dwie ręczne próbki pokazały fałszywe trafienia (zwykłe REALNA), więc scalono z powrotem do REALNA; rozróżn |
| 328 | GET /my-work/gate-signoffs | initiativesExecutionRuntime.routes.ts:6372 | /api/initiatives/runtime-v1/my-work/gate-signoffs, /api/pmo/initiatives/runtime-v1/my-work/gate-signoffs | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 329 | GET /gate-quorums | initiativesExecutionRuntime.routes.ts:6395 | /api/initiatives/runtime-v1/gate-quorums, /api/pmo/initiatives/runtime-v1/gate-quorums | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |
| 330 | GET /source-read-back | initiativesExecutionRuntime.routes.ts:6407 | /api/initiatives/runtime-v1/source-read-back, /api/pmo/initiatives/runtime-v1/source-read-back | REALNA | brak konsumenta (nie znaleziono literału trasy w src/) |  |