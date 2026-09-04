## Po co ten dyżur istnieje

Dyżur 336 wykonał brakujący pomiar warstwy serwerowej i **uratował surowe wyniki do repo** —
63 pliki JSON w `evidence/g15/day336-artefakty/`. Wcześniej takie artefakty żyły wyłącznie
w katalogu tymczasowym sesji i znikały razem z nim. Dzięki temu **nie musisz powtarzać pomiaru,
żeby zacząć: masz go pod ręką, z pełnymi nazwami przypadków.**

Odbiorca tego dyżuru rozbił czerwienie modułu `09_RESULTS` i zobaczył coś, czego sam raport 336
nie nazwał ani razu: **to nie są setki niezależnych defektów, to jedno zachowanie powtórzone
setki razy — każde żądanie wraca `403`.**

**Jego zdanie, i sens tego dyżuru:**

> **Kto zaplanuje 542 naprawy, zaplanuje pracę, której nie ma.**

**Stan zastany, zmierzony przeze mnie na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`
z plików JSON leżących w repo:**

| Warstwa serwerowa | Przypadków | Zielonych | Czerwonych |
| --- | --- | --- | --- |
| 15 modułów razem | **1825** | **1153** | **542** |

| Moduł | Razem | Zielone | Czerwone | z tego kształt `403` |
| --- | --- | --- | --- | --- |
| `09_RESULTS` | 567 | 136 | **413** | **356** |
| `10_FINANCE` | 277 | 143 | **114** | **59** |
| `08_MEETINGS` | 33 | 25 | 8 | 0 |
| `02_INTERVIEW` | 63 | 51 | 2 | 0 |
| `07_MY_WORK_AGENT` | 43 | 41 | 2 | 0 |
| `05_INITIATIVES` | 125 | 124 | 1 | 0 |
| `11_MATERIALS` | 64 | 59 | 1 | 0 |
| `12_AUDITS` | 317 | 244 | 1 | 0 |
| `01`, `03`, `04`, `06`, `13`, `14`, `16` | 336 | 336 | **0** | 0 |

**`15_SETTINGS` nie ma pliku JSON i to nie jest przeoczenie** — sekcja R1 rejestru G15 nie
zawiera dla tego modułu ścieżki serwerowej, więc dyżur 336 świadomie nie wpisał fałszywego
`PASS 0/0` (`evidence/g15/day336-r3-serwer.md`, ostatni wiersz). **Modułów jest 15, nie 16 —
i to jest poprawne.**

**Rozbicie kształtu `403` w module `09_RESULTS` (moje liczby, z artefaktów):**

| Kształt komunikatu | Ile |
| --- | --- |
| `expected 403 to be 200` | 124 |
| `expected 403 to be 404` | 75 |
| `expected 403 to be 409` | 72 |
| `expected 403 to be 400` | 47 |
| `expected 403 to be 201` | 36 |
| pozostałe wystąpienia `403` (inne brzmienie asercji) | 2 |
| **razem kształt `403` w `09`** | **356** |
| `AssertionError: expected 'RESULTS_INTERNAL_BETA_VISIBILITY_D…'` | 12 |
| `expected 503 to be 200 / 400 / 409` | 8 + 3 + 3 |
| reszta (`vi.fn()`, `TypeError`, `ENOENT`) | 26 |

**Pliki, które padają w CAŁOŚCI** (wszystkie w `server/src/routes/resultsVnext/__tests__/`):

| Plik | Czerwone / wszystkie |
| --- | --- |
| `okr.routes.test.ts` | **118 / 118** |
| `kpi.routes.test.ts` | 33 / 33 |
| `roiForecastActual.routes.test.ts` | 27 / 27 |
| `okrReview.routes.test.ts` | 27 / 27 |
| `kpiScorecard.routes.test.ts` | 27 / 27 |
| `roiPir.routes.test.ts` | 26 / 26 |
| `roi.routes.test.ts` | 26 / 26 |
| `roiCaseApproval.routes.test.ts` | 22 / 22 |
| `kpiDeviation.routes.test.ts` | 21 / 21 |
| `roiBenefitsRealization.routes.test.ts` | 15 / 15 |
| `roiEconomicModel.routes.test.ts` | 14 / 14 |

**Plik, który pada częściowo i dlatego jest cenniejszy od tamtych:**
`roiFinanceSeam.routes.test.ts` **25 / 26** — jeden przypadek przechodzi. **Znajdź go i zapytaj,
czym się różni.** To jest najkrótsza droga do przyczyny.

**★★ Co odbiorca 336 już sprawdził i wykluczył — nie powtarzaj tego:**
podejrzenie padło na obejście logowania. `ENABLE_TEST_AUTH_BYPASS=false` → 118 FAIL;
`ENABLE_TEST_AUTH_BYPASS=true` → **też 118 FAIL**. **Przyczyna leży poza uwierzytelnianiem.**

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

**To jest hipoteza autora instrukcji, nie zweryfikowany fakt.** Podaję ją, żebyś nie szukał
po omacku, i podaję też, jak ją obalić.

Bramka `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` ma trzy wyjścia:

- wiersze **26-32** — jedyne wyjście „przepuść": działa **tylko** gdy `NODE_ENV === 'test'`
  **i jednocześnie** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE !== 'enforce'`;
- wiersze **38-44** — `403 RESULTS_INTERNAL_BETA_VISIBILITY_DENIED`, gdy brak `userId` albo
  `organizationId`;
- wiersze **49-66** — `403` z tym samym kodem, gdy w `organization_members` nie ma wiersza
  `ACTIVE` z rolą `OWNER` albo `ADMIN`;
- wiersze **68-74** — `catch` → `503 RESULTS_INTERNAL_BETA_VISIBILITY_UNAVAILABLE`.

Sam plik nosi komentarz opisujący dokładnie tę sytuację:

> *„Existing isolated route-unit suites replace auth middleware and have no membership database.
> They must opt in explicitly when exercising this production envelope."*

**Trzy pomiary, które robią z tego hipotezę, a nie zgadywanie:**

1. `§0.2c` wariant **(B)** — komplet, którym dyżur 336 uruchamiał pomiar — zawiera
   `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. To **wyłącza** wyjście z wierszy 26-32.
2. W `server/src/routes/resultsVnext/__tests__/` jest **19** plików testowych, a `vi.mock`
   koperty ma **3** z nich (`kpiDay17`, `okrCheckInSummaryDay17`, `search`). **Pozostałe 16
   jadą na REALNEJ kopercie.**
3. Nagłówek `okr.routes.test.ts` mówi wprost, że to pakiet **kontraktu HTTP**, w którym
   middleware auth/rbac/demo/rate-limit są zastąpione przepustkami, a RBAC ma **własny, osobny**
   dowód. Koperty widoczności **na tej liście nie ma** — i to jest luka.

**Wniosek hipotezy:** 16 pakietów kontraktu tras uruchomiono w trybie, w którym koperta
egzekwuje, ale **nie ma bazy członkostwa, o którą pyta** — więc każde żądanie zwraca `403`.
To nie jest 415 defektów produktu. To jeden rozjazd między trybem pomiaru a przeznaczeniem
pakietu.

**Jak ją OBALIĆ (i obalenie jest sukcesem dyżuru):** uruchom `okr.routes.test.ts` **dwa razy**,
zmieniając **wyłącznie** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`. Jeżeli obie strony dają
118 FAIL — moja hipoteza jest **fałszywa**, zapisujesz to wprost i szukasz dalej (kolejni
kandydaci: `requireOrgAccess`, `demoContextMiddleware`, `ENABLE_V8_GLOBAL`, montaż `v8/index.ts`).
Różnica wyniku między tymi dwoma przebiegami jest **dowodem przyczyny — ale nie jest naprawą.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- artefaktów 336 w repo: **63** pliki JSON, w tym **15** plików `<moduł>-serwer.json`;
- warstwa serwerowa razem: **1825 / 1153 / 542**;
- kształt `403`: **415 z 542** (76,6%) — **356** w `09_RESULTS`, **59** w `10_FINANCE`,
  **0** we wszystkich pozostałych modułach;
- `okr.routes.test.ts` = **118/118 FAIL**; jedenaście plików pada w całości;
  `roiFinanceSeam.routes.test.ts` = **25/26**;
- `vi.mock` koperty ma **3 z 19** plików testowych `resultsVnext`;
- słowo `403` **nie pada ani razu** w żadnym dokumencie dyżuru 336 — przyczyna nie została
  nazwana, to praca nowa;
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**` | **TYLKO ODCZYT** — schemat jest kontraktem produktu | Cytat wiersza schematu + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa" znaczy: realne żądanie HTTP przez realny `ApiGateway`, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Middleware — koperta widoczności** | `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wolno zmienić **wyłącznie** wtedy, gdy `R2` udowodni, że przyczyna leży w tym pliku, i **wyłącznie razem z parą dowodów** „obcy `403` / właściciel `200`" w TYM SAMYM commicie. **Zakaz poszerzania `ALLOWED_RESULTS_ROLES` i zakaz zmiany warunku tak, żeby koperta przestała egzekwować w runtime nie-testowym** | Brief z `plik:linia` + diff **nienałożony** |
| **Pozostałe middleware / model uprawnień** | `server/src/middleware/**` (w tym `auth.middleware.ts`) | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Kontroler / trasy** | `server/src/routes/**` | **TYLKO ODCZYT** — ten dyżur uruchamia testy tras, nie zmienia tras. Wyjątek wymaga `R2` i osobnego akapitu w raporcie | Wpis: plik, linia, czerwień, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Testy kontraktu tras `resultsVnext`** | `server/src/routes/resultsVnext/__tests__/**` (19 plików) | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **dopisać wypisanie się z koperty** (`vi.mock` koperty) dokładnie w takiej formie, w jakiej robią to już `kpiDay17`, `okrCheckInSummaryDay17` i `search` — jeżeli `R2` udowodni, że to jest właściwa naprawa. **Zakaz zmiany progu, usuwania asercji i zawężania zakresu, żeby zzielenieć** | — |
| **Testy serwerowe `10_FINANCE`** | `server/src/routes/v8/finance-v2/__tests__/**`, `server/src/services/finance/__tests__/**` | jak wyżej — **ta sama naprawa musi objąć RODZINĘ**, nie tylko `09_RESULTS` | — |
| **Dowód koperty (zabezpieczenie)** | `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`, `tests/integration/results/day46.*.realpg.test.ts` | **NIETYKALNE DO ZAPISU.** To jest miejsce, w którym zabezpieczenie jest bronione. Wolno je **uruchamiać** i **musisz** je uruchomić PRZED i PO naprawie | Wynik do raportu |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** Globalny `vi.mock` koperty w tych plikach = wygaszenie zabezpieczenia dla całego korpusu | Opis w raporcie |
| **Produkt UI** | `src/**`, `src/views/**`, `public/locales/**` | **TYLKO ODCZYT** | Opis w raporcie |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA na dodanie** testu dowodzącego pary „obcy `403` / właściciel `200`", jeżeli istniejące pokrycie okaże się niewystarczające. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Dowody** | `evidence/g15/day347/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Artefakty 336** | `evidence/g15/day336-artefakty/**`, `evidence/g15/day336-*.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest baza porównania; nadpisanie unieważnia cały dyżur | — |
| **Rejestr G15** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 347" | — |
| **Macierz odbioru** | `modules/09_RESULTS/MODULE_ACCEPTANCE.md`, `modules/10_FINANCE/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G15`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**. Zakaz dotykania wierszy `G00`–`G14`, `G16`–`G20` i pozostałych 14 modułów | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY347_403_PRZYCZYNA_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`, wiersz `G19` (dyżur 348) · `src/components/shared/__tests__/{filterableTable.r04-2a,standardPreview.r03,tablePreviewGeometry.r03-2}.test.tsx`, `server/src/routes/__tests__/day27{4,5,6}-*.pg.test.ts` (dyżur 349) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersz `G16` (dyżur 350) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu (dyżury 343-346) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | artefakty 336 w repo | `63` JSON, `15` plików `-serwer.json` | komenda (1) z `§0.3` | TAK |
| 2 | warstwa serwerowa razem | `1825 / 1153 / 542` | komenda (2) z `§0.3` | TAK — sumuje `numTotalTests`, nie tylko `numFailedTests` |
| 3 | czerwienie o kształcie `403` | `415 / 542` | komenda (2) z `§0.3` | TAK — filtruje po treści `failureMessages`, nie po nazwie testu |
| 4 | rozkład per moduł | tabela wyżej | komenda (3) z `§0.3` | TAK |
| 5 | rozbicie kształtów w `09` | `124/75/72/47/36 + 2` | własna komenda `R1` | TAK — **suma ma się zgodzić z 356, sprawdź to jawnie** |
| 6 | pliki padające w całości | 11 plików, `okr` 118/118 | własna komenda `R1` | TAK |
| 7 | ile pakietów wypisuje się z koperty | `3 z 19` | komenda (5) z `§0.3` | TAK — **to obala „wszystkie pakiety są równe"** |
| 8 | czy `403` znika po zmianie trybu | — | dwa przebiegi `R2` różniące się JEDNĄ zmienną | TAK — różnica jest dowodem przyczyny |
| 9 | czerwienie PO naprawie | — | przemiar `R4`, po **nazwach** | TAK — `Z37`: liczba bez nazw nie jest wynikiem |
| 10 | kaskada kontra czerwień własna | — | `R4`: ile czerwieni to `TypeError`/`createArtifactViaHttp` po pierwszym `403` | TAK — **w `10_FINANCE` to 31 + 20 przypadków** |
| 11 | ZASTANA kontra REGRESJA | — | ta sama `fullName` na bazie i na `HEAD` | TAK — **tylko jeżeli baza się skompilowała** |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY347_403_PRZYCZYNA_REPORT.md` ·
`evidence/g15/day347/**` (nowy katalog).

**Zapisujesz WARUNKOWO (tylko z dowodem `R2`/`R3`):**
`server/src/middleware/resultsInternalBetaVisibility.middleware.ts` ·
`server/src/routes/resultsVnext/__tests__/**` · serwerowe testy `10_FINANCE` ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`modules/{09_RESULTS,10_FINANCE}/MODULE_ACCEPTANCE.md` wyłącznie wiersz `G15` ·
`REJESTR_G15_SAMOKONTROLA_20260903.md` (sekcja dopisana) ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `public/locales/**`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`, `server/src/middleware/auth.middleware.ts`,
`server/src/services/ApiGateway.ts`, `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`,
`tests/integration/results/day46.*.realpg.test.ts`, `evidence/g15/day336-*`, `evidence/g19/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersze `G00`–`G14` i `G16`–`G20`,
MODULE_ACCEPTANCE pozostałych 14 modułów.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day347-403-przyczyna
git diff --name-only --cached | tee /private/tmp/cx-day347-403-przyczyna-artefakty/staged.txt
bash -c "grep -iE '^src/|^public/locales/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|auth\.middleware|ApiGateway|res-internal-beta-visibility|day46\..*realpg|day336-|evidence/g19|PRZELOT_WLASCICIELA|modules/0[1-8]_|modules/1[1-6]_' /private/tmp/cx-day347-403-przyczyna-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Każda zmiana dotykająca koperty widoczności wymaga PARY dowodów w tym samym commicie.**
Nie wystarczy „test przeszedł". Wymagam dwóch zdań z kodami odpowiedzi:
**(a)** żądanie od użytkownika, który **nie ma** wiersza `ACTIVE OWNER|ADMIN`
w `organization_members`, **nadal dostaje `403`**;
**(b)** żądanie od użytkownika, który **ma** taki wiersz, dostaje `200`/`201`.
Jeden dowód bez drugiego jest **wygaszeniem**, nie naprawą. To jest zmierzony kształt:
fail-closed świeci zielono, bo kontekst nie dociera, i funkcja przestaje działać dla wszystkich.

**(2) Nie naprawiasz po jednym teście.** Jeżeli po `R2` nie umiesz wskazać **jednej**
przyczyny obejmującej większość z 415 czerwieni — piszesz to wprost jako wynik i **nie
wchodzisz w 542 poprawki**. Zdanie „przyczyna jest wieloraka, oto trzy rodziny po N czerwieni"
jest pełnowartościowym wynikiem tego dyżuru.

**(3) Porównania po NAZWACH, nigdy po liczbach.** Tabela „przed / po" w `R4` ma dwie kolumny
pełnych nazw przypadków (`fullName`), nie dwie liczby. „Było 542, jest 127" bez listy nazw
NIE jest wynikiem (`Z37`) — jeden test mógł zgasnąć, a drugi się zapalić.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita dotykającego koperty. **Bez commita — to jest warunek, nie pozycja.**

## R1 — ODTWORZENIE 542 CZERWIENI PO NAZWACH I PODZIAŁ NA KSZTAŁTY (rdzeń)

Pracujesz na artefaktach, które **już są w repo** — nie uruchamiasz jeszcze niczego.

1. Wypisz **wszystkie 542 pełne nazwy** czerwonych przypadków z
   `evidence/g15/day336-artefakty/*-serwer.json` do
   `evidence/g15/day347/przed-nazwy.txt` — po jednej nazwie na wiersz, z prefiksem modułu
   i pliku. **To jest baza porównania dla `R4` i bez niej `R4` nie ma sensu.**
2. Pogrupuj je po **kształcie komunikatu**, nie po nazwie testu. Minimum kubełków:
   `403≠X` · `503≠X` · `RESULTS_INTERNAL_BETA_VISIBILITY_DENIED` w treści asercji ·
   `TypeError`/`undefined` · `createArtifactViaHttp failed` · `ENOENT` · reszta.
   **Podaj liczbę w każdym kubełku i sumę — suma ma się zgodzić z 542.**
3. Wskaż **kaskadę**: które kubełki są SKUTKIEM pierwszego `403`, a nie osobną czerwienią.
   W `10_FINANCE` moim zdaniem `31× TypeError` i `20× createArtifactViaHttp failed: 403`
   to kaskada — **sprawdź to, cytując treść komunikatu.**
4. Wskaż **plik-świadka**: `roiFinanceSeam.routes.test.ts` pada 25 z 26. **Nazwij ten jeden
   przypadek, który przechodzi, i powiedz, czym się różni od 25 pozostałych.**

**Wymagany dowód:** `evidence/g15/day347/przed-nazwy.txt` z 542 nazwami · tabela kubełków
z sumą · zdanie o kaskadzie z liczbą · nazwa i wyjaśnienie przypadku-świadka.
**Commit po `R1`.**

## R2 — PRZYCZYNA ŹRÓDŁOWA: JEDNA KOMENDA RÓŻNICOWA (rdzeń)

**To jest pozycja, w której hipoteza staje się faktem albo pada.**

1. **Postaw kontener** `cx-day347-pg` na porcie `6394`, baza `cx347`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. Uruchom `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` **dwa razy**,
   z cwd `server/`, `--retry=0`, `--reporter=json`, zmieniając **DOKŁADNIE JEDNĄ** zmienną:
   `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` kontra brak tej zmiennej.
   **Zapisz oba JSON-y i oba `numTotalTests` / `numFailedTests`.**
3. **Jeżeli różnica jest zerowa — moja hipoteza jest FAŁSZYWA.** Zapisz to zdaniem
   „hipoteza autora instrukcji obalona pomiarem" i szukaj dalej. Kolejni kandydaci, w tej
   kolejności: `requireOrgAccess`, `demoContextMiddleware`, `ENABLE_V8_GLOBAL`,
   montaż `server/src/routes/v8/index.ts`, seeder wiersza `organization_members`.
4. **Jeżeli różnica jest duża — nadal nie masz przyczyny, masz przełącznik.** Dopiero
   wskazanie `plik:linia`, które **czyta** tę zmienną, i pokazanie, że to ta gałąź decyduje
   o `403`, jest przyczyną. Cytuj wiersz.
5. **Rozstrzygnij rodzinę, nie pojedynczy plik** (`KROK 0` przed naprawą): wypisz wszystkie
   19 plików `resultsVnext/__tests__` plus serwerowe pakiety `10_FINANCE`, zaznacz, które
   wypisują się z koperty, a które nie. **Naprawa ma objąć całą rodzinę albo raport ma
   powiedzieć, dlaczego nie.**

**Wymagany dowód:** dwa JSON-y różniące się jedną zmienną, z `numTotalTests` obu · cytat
`plik:linia` gałęzi decydującej · tabela rodziny (plik → wypisuje się TAK/NIE).
**Commit po `R2`.**

## R3 — JEDNA NAPRAWA I PARA DOWODÓW (rdzeń)

**Naprawiasz RAZ.** Wybierasz jedno z rozwiązań i **uzasadniasz wybór**, wypisując, co
odrzuciłeś i dlaczego:

- **(A)** dopisanie wypisania się z koperty do tych pakietów kontraktu tras, które są
  jednostkowe z definicji — dokładnie w formie, w jakiej robią to już `kpiDay17`,
  `okrCheckInSummaryDay17` i `search`;
- **(B)** posadzenie w bazie pomiaru realnego wiersza `organization_members` (`ACTIVE`,
  `OWNER`), żeby koperta miała czego szukać;
- **(C)** rozdzielenie wariantu (B) `§0.2c` na dwa: `enforce` dla pakietów sprawdzających
  kopertę, bez `enforce` dla pakietów kontraktu HTTP — z zapisaniem tej różnicy w rejestrze
  G15, żeby następny pomiar nie powtórzył błędu;
- **(D)** cokolwiek innego, co `R2` wskaże jako właściwe.

**Czego NIE WOLNO — niezależnie od wybranej drogi:**
zmiany warunku w middlewarze tak, żeby koperta przestała egzekwować poza testami ·
poszerzenia `ALLOWED_RESULTS_ROLES` · globalnego `vi.mock` koperty w `tests/setup.ts`,
`tests/helpers/**` lub `tests/__mocks__/**` (`Z18`) · `.skip`, `.todo`, `--retry` innego
niż `0`, poszerzania `exclude` (`Z35`).

**Para dowodów, obowiązkowa, w tym samym commicie:**

1. **Obcy nadal odbity:** `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`
   uruchomiony na realnym PostgreSQL, z `enforce`, **zielony przed i po Twojej naprawie**.
   Do tego pięć plików `tests/integration/results/day46.*.realpg.test.ts` — wyniki obu
   przebiegów do raportu.
2. **Właściciel przechodzi:** realne żądanie HTTP przez realny `ApiGateway`, z podpisanym
   JWT, na Twoim PostgreSQL po pełnych migracjach, od użytkownika z wierszem
   `ACTIVE OWNER` — **z zapisanym kodem odpowiedzi** (`Z34`).
3. **Dowód mutacyjny celujący w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuń z zapytania
   koperty warunek `upper(status) = 'ACTIVE'` **albo** dopisz do `ALLOWED_RESULTS_ROLES`
   rolę `MEMBER` → test broniący koperty ma **zaczerwienić się**; cofnij przez `cp`
   (nigdy `git stash`, `Z27`) → ma **zzielenieć**; `git diff` po cofnięciu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
   ★ Mutacja w treści testu albo w zmiennej środowiskowej **nie liczy się** — ma trafić
   w kod, który realizuje zabezpieczenie.

**Wymagany dowód:** opis wybranej drogi z uzasadnieniem odrzucenia pozostałych · para
„obcy `403` / właściciel `200`" z kodami odpowiedzi · dowód mutacyjny w obie strony ·
wynik pakietu akceptacyjnego koperty przed i po. **Commit po `R3`.**

## R4 — PRZEMIAR PO NAPRAWIE I TABELA „PRZED / PO" PO NAZWACH

1. Uruchom **te same** pakiety serwerowe, które uruchomił dyżur 336, tym samym wariantem
   (poza świadomie zmienionym elementem z `R3`), `--retry=0`, `--reporter=json`.
   **Minimum: `09_RESULTS` i `10_FINANCE`.** Pozostałe 13 modułów — kontrolnie, żeby
   pokazać, że naprawa niczego nie zgasiła.
2. Zapisz `evidence/g15/day347/po-nazwy.txt` i zrób
   `diff evidence/g15/day347/przed-nazwy.txt evidence/g15/day347/po-nazwy.txt`.
3. **Tabela główna dyżuru:** trzy kolumny — **nazwy, które zniknęły** (naprawione),
   **nazwy, które zostały** (dług), **nazwy, które się POJAWIŁY** (każda pojawiona nazwa
   wymaga wyjaśnienia albo STOP-u).
4. **Podaj `numTotalTests`, nie tylko `numFailedTests`.** Przebieg z zerem wykonanych
   przypadków kończy się `exit 0` i **nie jest pomiarem**. `No test files found` i
   `Transform failed` to **BŁĄD KOMENDY**.
5. **Jawna liczba tego, co zostaje** — to jest produkt, którego program potrzebuje
   najbardziej: „z 542 czerwieni zniknęło N, zostaje M, i oto ich nazwy".

**Wymagany dowód:** `po-nazwy.txt` · pełny `diff` · tabela trzech kolumn · `numTotalTests`
dla każdego przebiegu · jawna liczba pozostających czerwieni. **Commit po `R4`.**

## R5 — ZASTANA KONTRA REGRESJA DLA TEGO, CO ZOSTAJE

Dla **każdej** czerwieni, która przetrwała `R4`, orzekasz klasę — po **NAZWACH**, nigdy
po liczbach:

1. Załóż worktree bazowy w `/private/tmp/cx-day347-403-przyczyna-artefakty/baza`
   (**POZA repo**, `Z13`). Bazę wybierasz sam i **uzasadniasz wybór w raporcie** — naturalny
   kandydat to marker, którego użył dyżur 336 do klasyfikacji (`evidence/g15/day336-r4-klasy.md`).
2. **Zanim uruchomisz cokolwiek — udowodnij, że baza się kompiluje**: `npx esbuild` na
   plikach, które będziesz mierzył. **`Transform failed` jest błędem komendy, nie wynikiem.**
   Baza, na której plik wykonał zero przypadków, **nie jest bazą**.
3. Ta sama `fullName` czerwona po obu stronach ⇒ **ZASTANA**; czerwona tylko na `HEAD` ⇒
   **REGRESJA**; nieuruchomiona po którejkolwiek stronie ⇒ **NIEORZECZONA**, i **tak ją
   zapisujesz**, nie zgadujesz.
4. **Wypisz dług z nazwy** do `evidence/g15/day347/dlug-po-naprawie.md`. „Sto dwadzieścia
   siedem czerwieni zastanych" bez nazw nie jest wynikiem — jest zaokrągleniem.
5. Skasuj worktree bazowy po pomiarze; `df -h /` przed i po. Program stracił dobę na dysku
   zjedzonym przez niesprzątnięte artefakty.

**Wymagany dowód:** dowód kompilowalności bazy · tabela klas z pełnymi nazwami ·
`dlug-po-naprawie.md` · `df -h /` przed i po · potwierdzenie skasowania worktree.
**Commit po `R5`.**

## R6 — RAPORT, JAWNA LICZBA I PYTANIA DO WŁAŚCICIELA

Raport zawiera: tabelę kubełków z `R1` · rozstrzygnięcie hipotezy z `R2` (**wprost:
potwierdzona czy obalona**) · opis JEDNEJ naprawy z `R3` wraz z uzasadnieniem odrzucenia
pozostałych dróg · parę dowodów „obcy `403` / właściciel `200`" · dowód mutacyjny w obie
strony · tabelę „przed / po" po nazwach z `R4` · **jawną liczbę czerwieni, które zostają** ·
tabelę klas ZASTANA/REGRESJA/NIEORZECZONA z `R5` · listę rozbieżności wobec liczb tej
instrukcji · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy akapit `§0.2e`
dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA".** Jeżeli po naprawie
zostaje dług, którego ten dyżur nie ruszał — wypisujesz go z nazwy i szacujesz, ile rodzin
naprawczych obejmuje. **To jest odpowiedź na zdanie odbiorcy 336: ile pracy tam naprawdę
jest, a ile było złudzeniem licznika.**

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Jeżeli uznasz, że wariant (B)
`§0.2c` jest źle postawiony dla pakietów kontraktu tras — **piszesz to tutaj jako pytanie
rozstrzygalne („tak"/„nie"), i NIE zmieniasz go po cichu w szkielecie ani w instrukcjach
innych dyżurów.** Sekcja może być pusta, ale wtedy piszesz wprost: „nie mam zastrzeżeń".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Jedna naprawa, mierzalny spadek czerwieni, tabela „przed / po" po NAZWACH i jawna liczba
tego, co zostaje** — przy nienaruszonej kopercie widoczności, udowodnionej parą „obcy `403` /
właściciel `200`" i dowodem mutacyjnym w obie strony.

Odbiorca odrzuci dyżur, w którym czerwienie zniknęły, a pary dowodów nie ma; w którym
porównanie jest po liczbach zamiast po nazwach; albo w którym naprawiono więcej niż jedną
rzecz naraz, tak że nie da się powiedzieć, która zadziałała.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „542 czerwienie rozłożone na
k kubełków, przyczyna wskazana/obalona z cytatem `plik:linia`, naprawa nie wykonana, bo
wymaga decyzji właściciela" — **jest pełnowartościowym wynikiem, nawet jeśli ani jedna
czerwień nie zgasła.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw 415 czerwieni" vs „zakaz wygaszania koperty" | `R0` (1) i `R3`: naprawa wymaga PARY dowodów — obcy nadal `403`, właściciel `200`; jeden bez drugiego jest wygaszeniem |
| „Middleware nietykalny (`Z12`)" vs „przyczyna może leżeć w middlewarze" | Tabela licencji: `resultsInternalBetaVisibility.middleware.ts` ma **wąską licencję pod warunkiem `R0`**; pozostałe middleware, w tym `auth.middleware.ts`, zostają nietykalne |
| „`Z18` zakazuje ruszać infrastruktury testów" vs „naprawa może być w konfiguracji testów" | `R3`: `vi.mock` koperty wolno dopisać **w pojedynczym pliku pakietu**, tak jak robią to trzy istniejące; **globalny mock w `tests/setup.ts`/`helpers`/`__mocks__` pozostaje zakazany** — to różnica między jednym pakietem a całym korpusem |
| „`Z10` zakazuje zmiany flag" vs „dyżur steruje `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`" | Sekcja `POZYCJE_Z_FLAGAMI`: to nie jest flaga funkcyjna produktu, tylko przełącznik trybu pomiaru czytany wyłącznie pod `NODE_ENV==='test'`; wolno nim sterować w komendzie, nie wolno zmieniać warunku w kodzie |
| „Znajdź jedną przyczynę" vs „nie zgaduj" | `R2` punkt 3: zerowa różnica między dwoma przebiegami **obala** hipotezę autora; obalenie jest sukcesem i ma być zapisane wprost |
| „Zmierz spadek" vs `Z37` (zakaz porównań po liczbach) | `R1` i `R4`: `przed-nazwy.txt` i `po-nazwy.txt` z pełnymi `fullName`; produktem jest `diff`, nie różnica dwóch liczb |
| „Naprawa ma objąć rodzinę" vs „naprawiasz RAZ" | `R2` punkt 5: rodzina to ta sama naprawa zastosowana mechanicznie, nie N różnych poprawek; jeżeli rodzina wymaga N różnych rozwiązań, to `R2` obalił jedność przyczyny i mówisz to wprost |
| „Uruchom testy koperty" vs „są NIETYKALNE" | Tabela licencji: nietykalne **do zapisu**; uruchamianie jest jawnie zamówione i obowiązkowe przed i po |
| „Worktree bazowy ułatwia dowód" vs `Z13` i próg 5 GB | `R5` punkty 1 i 5: worktree bazowy leży **poza repo**, jest kasowany po pomiarze, `df -h /` przed i po |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` punkt 3: mutację cofasz przez `cp` ze `SCRATCH`; `git diff` po cofnięciu ma być pusty |
| „Dopisz sekcję do rejestru znalezisk" vs „równoległy autor też dopisuje" | `R6`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry; kolizja liter jest przewidziana |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — 63 artefakty 336, middleware koperty, 19 plików `resultsVnext/__tests__`, pakiet akceptacyjny i pięć `day46.*.realpg` sprawdzone; `evidence/g15/day347/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-7 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · koperta · pozostałe middleware · kontroler · serwis/repozytorium · testy kontraktu · testy finansów · dowód koperty · infrastruktura testów · UI · nowe testy · dowody · artefakty 336 · rejestr · macierz · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` nie uruchamia niczego (czyta artefakty z repo), `R2` mierzy, `R3` zmienia dokładnie jedną rzecz, `R4`-`R5` mierzą |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6394/5534 wolne (`lsof` przy wydaniu), brak kontenera `cx-day347-pg`, brak gałęzi `codex/day347-*` i worktree; 348/349/350 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: wygaszenie koperty, `403` kontra `503`, kaskada jako osobne defekty, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
