# J1 Coverage — Niezależna Weryfikacja (Gate J)

**Weryfikator**: sesja niezależna, worktree `/Users/piotrwisniewski/consultify-wt/fv3p-d-statements`,
gałąź `codex/fv3p-j1-inventory` @ `1133ec0849`, baza porównawcza `ee5736a5a6`.
**Data**: 2026-08-12. **Baza testowa**: `j1_verify` na `127.0.0.1:54330` (PG 15), utworzona
`newdb.sh j1_verify`, posprzątana (`dropdb`) po zakończeniu. Zero połączeń do demo/staging/prod.

Autor twierdzi: **88 covered / 0 uncalled / 0 partially / 0 false-green**. Zgodnie z briefem,
podchodzę do tego z założeniem zawyżenia, dopóki sam nie zmierzę. Poniżej — co faktycznie
zmierzyłem, własną metodą, bez czytania `j1_endpoint_inventory.json` jako źródła prawdy (przeczytany
dopiero PO zbudowaniu własnego skanu, wyłącznie do porównania liczb końcowych).

---

## Tabela werdyktów

| # | Twierdzenie | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | 88/88 endpointów covered, żaden pominięty przez metodę dopasowania wzorca | Własny regex-skan 15 plików tras → 88 rejestracji `router.<method>(path)`. Własny skan 19 plików `__tests__` → 354 wywołania `request(<app>).<method>(...)`, sklasyfikowane (literal/template — 0 w pełni dynamicznych zmiennych, 0 pętli budujących URL). Normalizacja + dopasowanie do 88-endpointowego inwentarza: **88/88 trafień, 0 brakujących**. 9 "unmatched" to celowe sondy 404 (`this-path-truly-does-not-exist-anywhere`), nie realne endpointy. | **POTWIERDZONE** |
| 2 | 9/9 zamkniętych `uncalled` ma wartość dowodową (mutanty łapane, testy nie płytkie) | Powtórzyłem 6 z 9 (więcej niż wymagane minimum 5), **INNYMI mutacjami niż autor** (patrz §2 niżej). 6/6 złapanych, 0 false-green. Głębokość: wszystkie 6 mają asercje treści odpowiedzi ORAZ (dla 4/6) niezależny odczyt SQL. | **POTWIERDZONE** (na próbce 6/9; ekstrapolacja na pozostałe 3 rozsądna, ale nie zmierzona wprost) |
| 3a | Baseline happy path: `jobStatus:'succeeded'`, `periodsComputed:12`, SQL=372 wiersze | Własny `psql` (niezależny socket, port 54330) po realnym przebiegu testu: `finance_baseline_outputs` ma **dokładnie 372 wiersze** dla obu business_version_id założonych przez ten test (372 = 12 okresów × 31 linii/okres, potwierdzone `GROUP BY`); `compute_jobs.status='succeeded'` dla obu jobów. | **POTWIERDZONE** |
| 3b | Mutacja `jobStatus`→stała w gałęzi sukcesu jest teraz łapana (dawniej NIE była) | Zmutowałem `baseline.routes.ts:204` (`jobStatus: result.job.status` → `'MUTANT_STATUS'`), uruchomiłem `baseline.routes.pg.test.ts` → **czerwono** (`AssertionError: expected 'MUTANT_STATUS' to be 'succeeded'`), przywróciłem `git show ee5736a5a6:...`, `git diff` pusty. | **POTWIERDZONE** |
| 3c | 372 = 12×31, liczba sensowna nie przypadkowa | SQL: `count(*)/count(DISTINCT period_id)` = 31 dla obu business_version_id, `count(DISTINCT period_id)`=12. Katalog `financial_statement_lines` ma 32 wiersze łącznie (31 trafia do baseline output na okres — 1 linia poza forecastem, niezidentyfikowana wprost, ale spójność 12×31=372 jest realna, nie zbieg okoliczności). | **POTWIERDZONE** (z drobnym zastrzeżeniem: nie prześledziłem KTÓRA z 32 linii katalogu jest tą wyłączoną) |
| 4a | Test dzierżawy EM-1: 6/6 pass, load 271–318, mechanizm deterministyczny (nie realny sleep) | 3/3 pass na mojej maszynie, load **44,89–47,15** (dużo NIŻSZY niż oryginalne 245 i niż confirmation runs 271–318 — nie odtworzyłem porównywalnego obciążenia). Kod mechanizmu potwierdzony deterministyczny: `UPDATE compute_jobs SET lease_expires_at = now() - interval '1 minute'`, zero `setTimeout`/realnego sleep. | **CZĘŚCIOWO** — nie failuje u mnie, ale przy dużo niższym obciążeniu niż oryginalna awaria, więc to słabe potwierdzenie hipotezy „flake pod obciążeniem", nie mocny test tej hipotezy |
| 4b | Test SLO D2: 5/5 pass, `BLOCKED_EXTERNAL` uczciwe, nie wygodne | 5/5 pass, p95 **15,49–42,92ms** (load 33–37 — dużo niższe niż autor). Pełny przebieg (§5) pokazał D3b spread **1101%** p50 przy niskim obciążeniu — potwierdza, że ta maszyna jest z natury szumiąca NIEZALEŻNIE od load average. Ocena uczciwości: klasyfikacja wygląda uzasadniona (próg pochodzi z metodologii udokumentowanej PRZED tą sesją w osobnym raporcie W2_FC11, nie wymyślonej post-hoc; żadna z ~13 powtórek — 5 autora + 6(EM1)+5(D2) moich — nie zbliżyła się do progu; brak zmiany kodu w ścieżce). Zastrzeżenie: test mierzy SLO na masce jawnie opisanej jako „unpredictable, heavily contended" — to systemowy problem środowiska (brak dedykowanego CI runnera), nie tylko jednorazowy szum. | **CZĘŚCIOWO POTWIERDZONE** — klasyfikacja rozsądna i niepozorna, ale nie w 100% rozstrzygalna bez izolowanego hosta |
| 5 | Pełny przebieg: exit=0, 659/659, 60/60, ~27s | Własny przebieg (komenda identyczna jak w raporcie, `> plik 2>&1; code=$?`, bez potoku): **`EXIT_CODE=0`, `Test Files 60 passed (60)`, `Tests 659 passed (659)`, `WALL_SECONDS=31`** (vitest wewnętrznie 30,92s). Zero FAIL w logu. | **POTWIERDZONE** |
| 6 | Brak osłabienia testów (`.skip`/`.only`/usunięte asercje) | `git diff --numstat ee5736a5a6..1133ec0849 -- '*.pg.test.ts'`: 3 pliki tylko-dodane, 1 plik (`baseline...`) z 227+/14−; te 14 usunięć to WYŁĄCZNIE przepisany docstring (SCOPE DECISION → Gate J1 LUKA 2), zero zmian w istniejących `it()`/`expect()`. Grep `\.only\(`/`\.skip\(` (poza `describe.skipIf`) w diffie: 0 trafień. | **POTWIERDZONE** |
| 7 | Zero zmian kodu produkcyjnego poza testami; brak zostawionych mutantów | `git diff --stat ee5736a5a6..1133ec0849`: 6 plików — 2 docs (md+json), 4 pliki `*.pg.test.ts`. **Zero plików spoza `__tests__`/docs.** Grep `MUTANT\|TEMPORARY\|DO NOT COMMIT` w całym diffie: trafienia wyłącznie w treści raportu/JSON (opis metodologii, nie kod) i w komentarzach dokumentujących ISTNIEJĄCE (już scalone wcześniej) mutanty referencyjne. Żaden plik `.routes.ts` nie jest w diffie. | **POTWIERDZONE** |

**Werdykt końcowy: PASS.** Wszystkie kluczowe twierdzenia potwierdzone niezależnym pomiarem; dwa
podpunkty (4a, 4b) mają status CZĘŚCIOWO wyłącznie dlatego, że nie zdołałem odtworzyć porównywalnie
wysokiego obciążenia hosta co autor — nie znalazłem żadnego dowodu PRZECIWKO jego klasyfikacji.

---

## 1. Własna inwentaryzacja 88 endpointów — metoda i wynik

**Metoda**: regex `router\.(get|post|put|patch|delete)\(\s*\n?\s*['"]([^'"]+)['"]` na 15 plików
`server/src/routes/v8/finance-v2/*.routes.ts` (wyłączając `__tests__`), plus osobny grep za
`router.route(` i `.all(` (0 trafień — brak alternatywnej składni rejestracji) i za zakomentowanymi
rejestracjami (0 trafień). `index.ts` mountuje wszystkie 15 subrouterów płasko pod jednym
`v8Router.use('/finance-v2', financeV2Routes)` — brak dodatkowych prefiksów per plik.

**Wynik — 88 endpointów w 15 kategoriach (plikach)**:

| Plik | Liczba endpointów |
|---|---|
| analysis.routes.ts | 3 |
| artifacts.routes.ts | 5 |
| baseline.routes.ts | 4 |
| comments.routes.ts | 17 |
| compare.routes.ts | 6 |
| compute.routes.ts | 4 |
| crosscutting.routes.ts | 4 |
| export-import.routes.ts | 4 |
| lineage-navigator.routes.ts | 2 |
| models.routes.ts | 2 |
| prediction.routes.ts | 2 |
| saved-views.routes.ts | 6 |
| statements.routes.ts | 5 |
| valuation.routes.ts | 21 |
| versions.routes.ts | 3 |
| **SUMA** | **88** |

Zgadza się z deklarowaną liczbą 88 — ale to jest liczba REJESTRACJI TRAS w kodzie źródłowym,
niezależna od jakiegokolwiek pliku inwentaryzacyjnego autora.

**Metoda skanu wywołań testowych**: regex `request\(\s*[A-Za-z0-9_.]+\s*\)\s*\.\s*(get|post|put|patch|delete)\s*\(`
(dopuszcza DOWOLNĄ nazwę zmiennej `app`/`appA`/`appB`/`appA2`/`appB_as_userA2` — pierwsza wersja
regexu z literalnym `app|server` łapała tylko 174/354 wywołań i została odrzucona) na 19 plików
`*.pg.test.ts` pod `finance-v2/__tests__/` (potwierdzone `grep -rl "finance-v2" --include="*.pg.test.ts" .`
że to JEDYNE pliki testowe w repo odwołujące się do tego prefiksu — 78 plików `*.pg.test.ts` w
całym repo, 19 z nich tu). Dla każdego trafienia wyodrębniłem argument (parser nawiasów, nie regex —
obsługuje zagnieżdżone `(`/`)`), sklasyfikowałem jako `literal` / `template` / `variable_or_expr`.

**Wynik: 354 wywołania, 237 template-literal + 117 literal, 0 `variable_or_expr`.** Zero wywołań
budowanych przez zmienną trzymającą cały URL, zero pętli (`for`/`.forEach`/`it.each`/`describe.each`)
konstruujących ścieżki do wywołania — sprawdzone osobnym grepem; jedyne pętle w tych plikach to
generowanie danych fikstury (12 miesięcy) i iteracja po polu ODPOWIEDZI (asercja), nie po ścieżkach
żądań. **Metoda autora (dopasowanie wzorca) NIE pomija żadnej klasy dynamicznego wywołania, która
faktycznie występuje w tym kodzie** — obawa z brief'u (zmienna z URL-em, pętla po tablicy ścieżek)
nie materializuje się w tym repo.

Po normalizacji (`${...}` → `:param`, strip query string) i dopasowaniu do 88-endpointowego
inwentarza z §1: **wszystkie 88 endpointów mają ≥1 dopasowane wywołanie. 0 brakujących.** 9
niedopasowanych wywołań to celowe sondy 404 na nieistniejące ścieżki (`this-path-truly-does-not-exist-anywhere`),
nie prawdziwe endpointy — poprawnie odrzucone.

**Wniosek**: klasyfikacja 88 covered / 0 uncalled jest, na poziomie "wywołanie istnieje", w pełni
zgodna z moim niezależnym skanem. To NIE dowodzi głębokości asercji — to osobno w §2/§3.

---

## 2. Powtórka mutantów — 6 z 9 zamkniętych `uncalled`, INNYMI mutacjami niż autor

Autor mutował logikę serwisową (`financeCompareService.ts` wewnętrzne pola, stałe odpowiedzi).
Ja mutowałem na poziomie ROUTERA — inny mechanizm usterki (zamiana parametrów przy przekazaniu do
serwisu, korupcja pola w mapowaniu odpowiedzi routera) — żeby sprawdzić, czy testy łapią też BŁĘDY
SAMEGO WIRINGU, nie tylko logiki serwisu.

| # | Endpoint | Moja mutacja (RÓŻNA od autora) | Wynik | Przywrócone |
|---|---|---|---|---|
| 1 | `POST /compare/versions` | `compare.routes.ts`: zamieniłem `businessVersionIdA`↔`businessVersionIdB` przy wywołaniu `compareVersions()` (błąd przekazania parametrów w routerze, nie w serwisie) | **caught** — `AssertionError: expected 'A_IS_DIRECT_CHILD_OF_B' to be 'B_IS_DIRECT_CHILD_OF_A'` | `git show ee5736a5a6:...` → `git diff` pusty |
| 2 | `POST /compare/scenarios` | `compare.routes.ts`: zamieniłem `businessVersionIdBase`↔`businessVersionIdOther` | **caught** — `AssertionError: expected 11602500 to be close to 11943750` | jw., pusty diff |
| 3 | `GET /versions/:id/freshness-events` | `crosscutting.routes.ts`: `newState: e.new_state` → `'MUTANT_STATE'` (autor mutował `reasonCode`, INNE pole) | **caught** — `AssertionError: expected 'MUTANT_STATE' to be 'STALE_SOURCE'` | jw., pusty diff |
| 4 | `GET /exceptions/inbox` | `crosscutting.routes.ts`: korupcja pola `category` w mapowaniu odpowiedzi (autor zmutował handler żeby zawsze zwracał `[]` — ja zostawiłem realne wiersze, ale zepsułem treść pola) | **caught** — `AssertionError: expected 'MUTANT_CATEGORY' to be 'tie_out_fail'` | jw., pusty diff |
| 5 | `POST /comments/search-by-cell` | `comments.routes.ts`: przed wywołaniem `listByCell()` nadpisałem `columnKey.periodId` na stałą (błąd filtra, nie handler zwracający `[]`) | **caught** — 2 testy czerwone (`hit`-test i cross-tenant-test), oczekiwane niepuste tablice wyszły puste | jw., pusty diff |
| 6 | `GET /review-checklist/:id/changed-cells` | `comments.routes.ts`: `previousBusinessVersionId: result.previousBusinessVersionId` → stała `'MUTANT-BV-ID'` (autor mutował pole `changedCells`, ja zmutowałem SĄSIEDNIE pole w tym samym obiekcie odpowiedzi) | **caught** — `AssertionError: expected 'MUTANT-BV-ID' to be '6cd00678-...'` | jw., pusty diff |

**6/6 złapanych, 0 false-green, na próbce WIĘKSZEJ niż wymagane minimum 5, mutacjami CELOWO INNYMI
niż autor** (parametr-swap w routerze i korupcja sąsiedniego pola zamiast stałej-w-serwisie i
"zawsze []"). To jest silniejszy dowód niż powtórzenie identycznych mutacji autora, bo testuje
INNĄ warstwę (wiring routera, nie tylko logikę serwisu, którą autor już zweryfikował).

**Głębokość asercji** (dla każdego z 6): wszystkie sprawdzają treść pól odpowiedzi (nie tylko status
HTTP); 4/6 (`compare/versions`, `compare/scenarios`, `freshness-events`, `exceptions/inbox`) mają
DODATKOWO niezależny odczyt SQL potwierdzający surowe dane w bazie. `search-by-cell` i
`changed-cells` nie mają osobnego SQL-odczytu w SWOJEJ własnej asercji (ale `search-by-cell`'s
`beforeAll` fixture setup odczytuje `anchor::text` przez SQL). Żaden z 6 nie jest płytki
("`covered`-bez-głębi") — wszystkie kwalifikują się jako `covered`, nie `partially covered`.

Pozostałe 3 z 9 (`compare/entities`, `compare/valuation-methods`, `compare/actual-vs-forecast`) NIE
zostały przeze mnie powtórzone mutantem z braku czasu w budżecie — nie mam bezpośredniego dowodu na
nie, ale strukturalnie są analogiczne do `compare/versions`/`compare/scenarios` (ten sam plik, ten
sam wzorzec routera, ten sam poziom asercji w teście widoczny przy przeglądzie kodu). Nie
twierdzę, że są zweryfikowane — tylko że próbka 6/9 nie znalazła ŻADNEGO false-green, co jest silną
przesłanką przeciwko zawyżeniu.

---

## 3. Baseline happy path — niezależna weryfikacja

Zobacz tabelę werdyktów, wiersze 3a/3b/3c. Metoda: uruchomiłem `baseline.routes.pg.test.ts` przez
realny HTTP + realny Postgres, POCZEKAŁEM aż test się zakończy (plik NIE ma `afterAll`/cleanupu —
dane zostają w bazie), a następnie odpytałem `j1_verify` OSOBNYM `psql` procesem (inny socket TCP,
nie przez kod aplikacji):

```sql
SELECT organization_id, business_version_id, count(*)
FROM finance_baseline_outputs
WHERE organization_id IN ('org-pkgb2-base-...', 'org-pkgb2-base-...')
GROUP BY organization_id, business_version_id;
-- -> dwa wiersze po 372, plus dwa osobne business_version_id z 1 wierszem każdy
--    (fixture innego testu w tym samym pliku — "outputs reader", zaszyty bezpośrednio,
--    nie przez /compute) -> suma per-org 373, ale HAPPY-PATH bv ma dokładnie 372.
```

```sql
SELECT business_version_id, count(DISTINCT period_id) AS n_periods, count(*)/count(DISTINCT period_id) AS lines_per_period
FROM finance_baseline_outputs WHERE business_version_id IN (...);
-- -> 12 periods, 31 lines/period, dla OBU business_version_id niezależnie
```

`compute_jobs.status='succeeded'` potwierdzone SQL-em dla obu jobów uruchomionych przez ten test.

Mutacja 3b opisana w tabeli werdyktów — to DOKŁADNIE ta sama linia (`baseline.routes.ts:204`,
`jobStatus`), którą oryginalny audyt (§4 mutant #11 J1_ENDPOINT_INVENTORY_report.md) udowodnił jako
NIEZŁAPANĄ przed tą sesją. Po mojej własnej, niezależnej próbie: **czerwono**, przywrócone, `git diff`
pusty. Luka faktycznie zamknięta.

---

## 4. Dwa padające testy — ocena

### 4a. `faultMatrix.pg.test.ts` EM-1 (dzierżawa/lease)

3/3 pass na mojej maszynie, load 44,89–47,15 (measured przed KAŻDYM przebiegiem via `uptime`).
Mechanizm wstrzykiwania awarii zweryfikowany jako deterministyczny (`UPDATE ... lease_expires_at =
now() - interval`, zero `setTimeout`/realnego czasu) — zgadza się z twierdzeniem autora.

**Ograniczenie mojej weryfikacji**: load na mojej maszynie w trakcie testu (~45) był RADYKALNIE
niższy niż zarówno oryginalna awaria (245) jak i confirmation-runy autora (271–318). Nie
odtworzyłem porównywalnego obciążenia, więc "3/3 pass" jest słabym potwierdzeniem hipotezy
"flake pod ekstremalnym obciążeniem" — bo nie testowałem pod ekstremalnym obciążeniem. Nie mam
NARZĘDZI w tej sesji do sztucznego generowania obciążenia hosta (poza zakresem zadania). Nie
znalazłem żadnego dowodu PRZECIWKO klasyfikacji "nieodtwarzalny artefakt infrastruktury" — ale też
nie mam mocnego dowodu ZA, poza spójnością kodu (deterministyczny mechanizm, nie zależny od
rzeczywistego czasu).

### 4b. `perfSlo.pg.test.ts` D2 (SLO)

5/5 pass, p95 15,49–42,92ms (load 33–37 — również dużo niższe niż autor: 309–330). Próg = 750ms
(pochodna `140,23ms observed-max-p95 × 5`, metodologia z `W2_FC11_SLO_report.md`, zewnętrzny
dokument PRZEDISTNIEJĄCY tę sesję — nie wymyślony post-hoc żeby wytłumaczyć czerwony test).

**Dodatkowy dowód z §5 (pełny przebieg)**: nawet na moim NISKO obciążonym hoście, `D3b Sensitivity
grid persist` miał spread **1101% p50** (jeden outlier 102,96ms wśród próbek ~7-10ms) w TYM SAMYM
przebiegu co reszta. To pokazuje, że ta konkretna maszyna produkuje ekstremalne outliery
NIEZALEŻNIE od ogólnego load average — silny argument za "szum maszyny", nie "regresja kodu",
bo regresja kodu dawałaby SPÓJNIE wysoki czas, nie jeden odstający sample na 12.

**Ocena uczciwości `BLOCKED_EXTERNAL` (nie oceniam jako pewnik, tylko jako ważoną opinię)**:
- ZA uczciwością: próg pochodzi z osobnej, wcześniejszej metodologii (nie ad-hoc); żadna z ~16
  łącznych powtórek (5 autora + 3 moich EM-1 + 5 moich D2 + pośrednio 60 plików w pełnym przebiegu)
  nie zbliżyła się do progu; kod ścieżki (`computeAnalysisKpis`) nie jest w diffie tej sesji; sama
  maszyna ma udokumentowaną (w OSOBNYM, wcześniejszym raporcie) historię 9,3× rozrzutu.
- PRZECIW/zastrzeżenie: to NIE jest jednorazowy błąd pomiaru — to systemowa właściwość środowiska
  (dev-laptop z "load averages up to ~170" jako NORMĄ, nie wyjątkiem, cytowane wprost w
  `perfSloThresholds.ts`). Nazwanie tego `BLOCKED_EXTERNAL` jest uczciwe względem TEJ sesji (autor
  nic nie naprawił i nic nie ukrył), ale NIE rozwiązuje leżącego u podstaw problemu: SLO
  testowane na niedeterministycznym hoście będzie occasionally czerwone niezależnie od kodu, co
  jest ryzykiem dla przyszłego CI, nie tylko dla tej sesji.

**Werdykt cząstkowy**: klasyfikacja `BLOCKED_EXTERNAL` jest UZASADNIONA na dostępnych dowodach
(nie "wygodna" w sensie zamiatania realnego defektu pod dywan — nic nie wskazuje na defekt w
kodzie), ale nie w 100% ROZSTRZYGALNA bez dedykowanego, izolowanego hosta do pomiaru. Rekomendacja
(nie blokuje bramki): rozważyć wydzielenie testów SLO na dedykowany runner albo podniesienie
multiplikatora, żeby nie polegać na "nigdy się nie zdarzyło ponownie" jako jedynym dowodzie.

---

## 5. Pełny przebieg — reprodukcja

Komenda identyczna jak w raporcie autora (§6/§11.4), nowa baza `j1_verify`:

```bash
cd server
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/j1_verify" \
  npx vitest run src/routes/v8/finance-v2 src/services/finance/canonical \
  --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000 \
  > j1_fullrun.log 2>&1
code=$?
```

(kod wyjścia mierzony `$?` PO zakończeniu, plik przekierowany `2>&1`, BEZ potoku — brak ryzyka
`PIPESTATUS`.)

**Wynik**:

| Metryka | Wartość |
|---|---|
| Kod wyjścia (`$?`, jawny) | **0** |
| Czas ściany (`date +%s` przed/po) | **31 s** |
| Czas wewnętrzny vitest | 30,92s (transform 5,40s, import 4,64s, tests 47,85s — równolegle na 2 workerach) |
| Test Files | **60 passed (60)** |
| Tests | **659 passed (659)** |
| FAIL w logu | 0 (`grep -n "FAIL " log` → puste) |
| Load przed / po | 29,88 / 41,87 |

**Zgadza się z deklarowanym przebiegiem referencyjnym autora** (exit 0, 659/659, 60/60, ~27-31s —
w tym samym rzędzie wielkości, różnica czasu w granicach szumu tej samej maszyny). Jedna próba
wystarczyła — zielono za pierwszym razem, nie musiałem powtarzać żeby dostać czysty wynik (w
przeciwieństwie do autora, który miał 1 `socket hang up` w pierwszej próbie) — to SPÓJNE z
"infrastructure noise", nie sprzeczne: różne sesje na tej samej maszynie w różnym czasie mają
różne obciążenie.

---

## 6. Brak osłabienia (LUKA-6) i higiena (LUKA-7)

Zobacz tabelę werdyktów, wiersze 6/7 — pełne dane. Podsumowanie:

- `git diff --numstat ee5736a5a6..1133ec0849 -- '*.pg.test.ts'`: jedyne usunięcia (14 linii,
  `baseline.routes.pg.test.ts`) to przepisany docstring, zero zmian w `it()`/`expect()`.
- Zero `.only(`/`.skip(` (poza legalnym `describe.skipIf(!REAL_PG)`) w całym diffie.
- `git diff --stat ee5736a5a6..1133ec0849`: 6 plików — 2 dokumentacja (`.md`+`.json`), 4 pliki
  testowe. **Zero plików produkcyjnych** (`*.routes.ts`, `*Service.ts`, migracje) w diffie.
- Grep `MUTANT|TEMPORARY|DO NOT COMMIT` w całym diffie: wszystkie trafienia w treści
  raportu/JSON (opisujące metodologię/historię mutantów) — zero w faktycznym kodzie `.ts`
  poza test-plikami, i w test-plikach trafienia to string-literały w KOMENTARZACH/nazwach testów
  opisujące PRZESZŁE mutacje z §4 audytu, nie żywe, niezacommitowane mutanty.
- Drzewo robocze na koniec sesji: `git status --short` puste, `git diff --stat` puste (potwierdzone
  po KAŻDYM z 7 mutantów z tej sesji — 6 z §2 + 1 z §3b).

---

## 7. Nowe defekty znalezione w tej sesji

**Brak.** Nie znalazłem żadnego nowego defektu w kodzie produkcyjnym ani w testach. Jedyna drobna
nieścisłość: 372=12×31 jest potwierdzone SQL-em, ale NIE prześledziłem którą z 32 linii katalogu
(`financial_statement_lines`) baseline compute pomija w outputcie (31 z 32) — to ciekawostka
księgowa, nie defekt (liczby są wewnętrznie spójne i zgadzają się z niezależną asercją D1 w
`perfSlo.pg.test.ts`, jak twierdzi raport autora).

---

## 8. Higiena wykonania tej sesji weryfikacyjnej

- Baza testowa: `j1_verify`, `127.0.0.1:54330`, utworzona przed startem, `dropdb` na końcu.
- Bramka czterech zmiennych (`RUN_DB_TESTS=1`+`MOCK_DB=false`+`NODE_ENV=test`+jawny `DATABASE_URL`)
  użyta w KAŻDYM przebiegu testowym w tej sesji.
- 7 mutacji kodu produkcyjnego w tej sesji (6 z §2 + 1 z §3b), KAŻDA przywrócona natychmiast przez
  `git show ee5736a5a6:<plik> > <plik>`, potwierdzona pustym `git status --short`/`git diff --stat`
  PRZED przejściem do kolejnej. Zero `git stash`/`reset --hard`/`clean`.
- Zero zmian kodu produkcyjnego pozostawionych w drzewie — potwierdzone końcowym `git status --short`
  (puste) tuż przed napisaniem tego raportu.
- Zero połączeń do demo/staging/produkcji — każdy `DATABASE_URL` w tej sesji wskazywał jawnie
  `127.0.0.1:54330`.

---

## Werdykt końcowy

**PASS.** Niezależna weryfikacja potwierdza twierdzenie autora (88 covered / 0 uncalled / 0
partially / 0 false-green) na poziomie "wywołanie istnieje" (własny skan od zera, §1) ORAZ na
poziomie "wywołanie ma wartość dowodową" (własne mutanty, INNYMI metodami niż autor, 6/6 złapane,
§2). Baseline happy-path (LUKA 2) i pełny przebieg (659/659, exit 0) reprodukowane niezależnie z
identycznymi/zbliżonymi liczbami. Dwa padające testy poza zakresem (LUKA 3) mają uzasadnioną, nie
zamiataną pod dywan klasyfikację — z zastrzeżeniem, że moja weryfikacja obciążenia hosta (4a/4b)
jest słabsza niż reszta, bo nie odtworzyłem porównywalnie wysokiego obciążenia. Zero osłabienia
testów, zero zmian kodu produkcyjnego, zero pozostawionych mutantów. Gate J1 może zostać ogłoszona
na podstawie tego materiału.
