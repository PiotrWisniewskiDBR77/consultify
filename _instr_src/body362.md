## Po co ten dyżur istnieje

Bramka `G15` („Integrator self-QA and impacted regression") ma dziś **dwa** `PASS`
(`01_ORGANIZATION`, `13_CHAT`) i **czternaście** wierszy otwartych. Cztery z nich stoją na
`PARTIAL_PASS / SERVER_NOT_MEASURED`:

> `04_ASSESSMENT` · `09_RESULTS` · `12_AUDITS` · `15_SETTINGS`

**`SERVER_NOT_MEASURED` to BRAK POMIARU, nie stwierdzona czerwień.** To jest najgorszy stan,
jaki bramka może mieć: wygląda jak dług, a może być zielenią, której nikt nie odebrał — albo
czerwienią, której nikt nie widział.

**Zadanie: wykonać brakujące pomiary serwerowe i zamknąć te wiersze, jeżeli wychodzą zielone.**
Na kryterium, którym zamknięto `13_CHAT` — jedyne `PASS` zdobyte 04.09:

> front `462/462/0` **+** serwer `67/67/0`, realny lokalny PostgreSQL, `--retry=0`,
> `MOCK_DB=false`, **zero błędów suity**, **mianownik dosłownie z §R1 rejestru `G15`** —
> nic z niego nie wolno wyjąć. Dowód w tym samym commicie.

To samo kryterium stoi pod drugim `PASS`: `01_ORGANIZATION` — „front+RealPG", 11 plików,
22/22 zielone.

★★★ **ŻADEN `PARTIAL` nie może stać się `PASS` przez zawężenie kryterium.** To jest kształt
„bezpiecznik nagradza defekt". Jeżeli kryterium jest źle postawione — **piszesz pytanie
do właściciela, nie poprawiasz po cichu**. Dyżur 336 miał **cztery okazje do taniej zieleni**
i **z żadnej nie skorzystał**. Ten sam standard.

---

## ★★ SPROSTOWANIE ZLECENIA — jedna liczba obalona, jedna doprecyzowana

Zlecenie, z którego powstała ta instrukcja, opisało rozkład `G15` jako:
*„2 `PASS`, 10 `PARTIAL_PASS` (podtypy `RED_LEGACY_*`), 4 `NOT_MEASURED` (`SERVER_NOT_MEASURED`)"*.

**Zmierzyłem to na markerze `2a7273e087` i to jest NIEDOKŁADNE.**

| Grupa | Ile | Moduły | Podtyp |
| --- | ---: | --- | --- |
| `PASS` | **2** | `01_ORGANIZATION`, `13_CHAT` | — |
| `PARTIAL_PASS` | **10** | `02`, `03`, `04`, `07`, `09`, `10`, `11`, `12`, `14`, `15` | `RED_LEGACY_*` **ORAZ** `SERVER_NOT_MEASURED` |
| `NOT_MEASURED` | **4** | `05`, `06`, `08`, `16` | `RED_LEGACY_1_CONFIRMED` ×3, `RED_LEGACY_2_CONFIRMED` ×1 |

★★★ **To są DWIE RÓŻNE GRUPY, a zlecenie zlepiło je w jedną.**

- **Cztery `SERVER_NOT_MEASURED` to `04`, `09`, `12`, `15`** — i ich stan to **`PARTIAL_PASS`**,
  nie `NOT_MEASURED`. **To jest Twój zakres.**
- **Cztery `NOT_MEASURED` to `05`, `06`, `08`, `16`** — z podtypem `RED_LEGACY_*_CONFIRMED`,
  czyli **potwierdzony dług zastany**, a nie brak pomiaru. **To jest inny gatunek braku,
  inne zlecenie i NIE DOTYKASZ tych wierszy.**

**Potwierdź to własnym pomiarem w `R1`** (komenda `(1)` z bloku weryfikacji) i zapisz wynik.
Gdyby mój rozkład okazał się błędny — **obowiązuje Twój**.

**Reszta tez zlecenia — POTWIERDZONA:**

| Teza | Mój pomiar |
| --- | --- |
| `13_CHAT` zamknięto na `front 462/462/0` + `serwer 67/67/0` | **potwierdzone** — cytat wprost z wiersza `G15` modułu `13` |
| `01_ORGANIZATION` stoi na „front+RealPG" | **potwierdzone** |
| `15_SETTINGS` nie ma ścieżki serwerowej w §R1 | **potwierdzone** — §R1 wymienia dla niego wyłącznie `src/components/settings/__tests__` i `tests/unit/settings` |
| dyżur 347: `401` z `542` czerwieni serwerowych to artefakt pomiaru | **potwierdzone** — reguła zapisana w rejestrze `G15`, sekcja „Aktualizacja dyżuru 347"; `okr.routes.test.ts` daje `0/118` z `enforce` i `118/118` bez |
| artefakty `evidence/g15/day336-artefakty/`, `day347/`, `day355-artefakty/` | **potwierdzone**, wszystkie trzy istnieją |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** (raport 336 podaje `35198`/`33065` — o dzień stare) |

---

## ★★★ TRZY FAKTY Z SUROWYCH ARTEFAKTÓW, KTÓRE ZMIENIAJĄ SKALĘ TEGO DYŻURU

Odczytałem `evidence/g15/day336-artefakty/*-serwer.json` (15 plików; `15_SETTINGS` nie ma,
bo nie ma ścieżki serwerowej). Dla Twoich trzech modułów z warstwą serwerową:

| Moduł | `numTotalTests` | pass | fail | **failed suites** | Co to znaczy |
| --- | ---: | ---: | ---: | ---: | --- |
| `04_ASSESSMENT` | `113` | `113` | `0` | **`0`** | ★★★ **serwer BYŁ zmierzony i wyszedł CZYSTO** na markerze `1c4b5a5635` — a wiersz od tamtej pory mówi `SERVER_NOT_MEASURED` |
| `09_RESULTS` | `567` | `136` | `413` | **`175`** | ★★★ **rodzina artefaktu pomiarowego 347** — `413` **nie jest liczbą defektów**, dopóki nie powtórzysz pomiaru z wariantem dobranym per pakiet |
| `12_AUDITS` | `317` | `244` | `1` | **`2`** | jedna czerwień imiennie: `auditProgramFixtures — fixture skali Audits (Postgres realny — AUD-MVP-DATA-001) CLEANUP: po sprzątaniu wszystkie pięć liczników wraca do zera, zero wierszy claude_a_ pozostaje` w `server/src/services/auditProgram*/__tests__/fixtureGenerator.pg.test.ts`. ★ `317 − 244 − 1 = 72` — sprawdź, czym są te 72 (pending? skipped? błąd suity?) |

★★ **To są WSKAZÓWKI, nie dowody.** Pochodzą z markera `1c4b5a5635`, Twój marker to
`2a7273e087`. **Dowodem jest Twój przelot.** Ale wiedza, że `04` prawdopodobnie jest zielone,
a `413` w `09` prawdopodobnie nie jest liczbą defektów, oszczędza Ci dnia pracy w złą stronę.

★★ **Mianowniki plików.** §R1 rejestru (pomiar na `35afcb15fd`) mówi:
`04 = 33`, `09 = 67`, `12 = 41`, `15 = 7`. Raport dyżuru 336 (pomiar na HEAD) mówi:
`04 = 53`, `09 = 69`, `12 = 40`, `15 = 7`. **Te liczby się różnią i to jest w porządku** —
liczba plików rośnie z pracą. **Mianownikiem obowiązującym są KATALOGI z §R1, nie liczba
plików z któregokolwiek raportu.** Policz pliki dziś sam, zapisz rozjazd i **nie zawężaj
katalogów, żeby liczba się zgodziła**.

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★★ DWA PYTANIA O KRYTERIUM, KTÓRE JUŻ ZADANO I KTÓRE NIE MAJĄ ODPOWIEDZI

Dyżur 336 zakończył 04.09 raport sekcją „PYTANIA DO WŁAŚCICIELA O KRYTERIUM":

1. *Czy `15_SETTINGS` ma mieć warstwę serwerową w mianowniku `G15`, mimo że §R1 wymienia
   wyłącznie dwa katalogi frontowe?*
2. *Czy potwierdzony dług zastany ma nadal blokować `PASS` `G15`, czy `G15` ma raportować
   osobno regresję względem bazy i bezwzględną zieleń bieżącego mianownika?*

**Sprawdziłem: ani jedno nie ma odpowiedzi.** `grep` po rejestrze znalezisk, po decyzjach
właściciela `P0/P1` i po ledgerze decyzji nie znajduje `15_SETTINGS` w żadnym z nich.

★★★ **Nie zadajesz tych pytań po raz drugi jako nowych.** Eskalujesz je **z datą pierwszego
zadania i nazwą dyżuru**, żeby właściciel widział, że pytamy po raz drugi — inaczej
wyprodukujemy trzecie rozliczenie tej samej sprawy, a to już nas w tym programie kosztowało.
★ Pytanie 2 jest przy okazji pytaniem o los **wszystkich dziesięciu** `PARTIAL_PASS`, nie
tylko Twoich czterech — powiedz to wprost.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **SSOT mianownika (odczyt)** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md`, §R1 | **★ TYLKO ODCZYT. Zakaz zmiany §R1.** Katalogi bierzesz z niego dosłownie | lista katalogów per moduł + policzone dziś pliki |
| **rejestr `G15` — dopisanie** | ten sam plik, **koniec pliku** | **★ WĄSKA — WYŁĄCZNIE nowa sekcja „Aktualizacja dyżuru 362"** na końcu. Zakaz zmiany sekcji zastanych | jedna sekcja |
| **surowe artefakty 336/347/355 (odczyt)** | `evidence/g15/day336-artefakty/**`, `evidence/g15/day347/**`, `evidence/g15/day355-artefakty/**`, `evidence/g15/day336-r*.md` | **tylko odczyt** | liczby wejściowe + porównanie z Twoimi |
| **macierz — CZTERY moduły** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{04_ASSESSMENT,09_RESULTS,12_AUDITS,15_SETTINGS}/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G15`**, wyłącznie w tych czterech, **wyłącznie z dowodem w tym samym commicie** | zmieniony wiersz + dowód |
| **macierz — POZOSTAŁYCH 12** | `modules/{01,02,03,05,06,07,08,10,11,13,14,16}_*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — w szczególności `05`, `06`, `08`, `16` (`NOT_MEASURED / RED_LEGACY_*_CONFIRMED`, inne zlecenie) oraz `01` i `13` (`PASS`, nie „poprawiasz" ich brzmienia) | brak zmian |
| **testy modułów (uruchomienie)** | katalogi z §R1 dla `04`, `09`, `12`, `15` — front i serwer | **odczyt + uruchomienie.** ★ **ZAKAZ zmiany treści testu**, żeby wyszedł zielony | `*.json` przelotów + `fullName` |
| **konfiguracja pomiaru** | `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**` | **★★★ NIETYKALNE DO ZAPISU — zakaz nr 1 tego dyżuru.** `G15` mierzy się konfigiem, więc „poprawienie" configu jest tożsame z podrobieniem wyniku | wypisane zmienne przy każdym przelocie |
| **zmienne środowiskowe** | `RUN_DB_TESTS`, `MOCK_DB`, `DB_TYPE`, `NODE_ENV`, `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`, `JWT_SECRET` | **dobierasz do RODZAJU PAKIETU wg reguły z rejestru (sekcja 347)** — nigdy do oczekiwanego wyniku; **każdy przelot zapisuje pełny zestaw** | zestaw zmiennych w logu każdego przelotu |
| **dowody** | `evidence/g15/day362/**` (**NOWY** katalog) | **zapis, `git add -f`** — jawna licencja na `*.json`, `*.log`, `*.txt`; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie przeloty + `przed-nazwy.txt`/`po-nazwy.txt`/`diff` |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY362_G15_POMIARY_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — JEDNA nowa sekcja, litera `AD`**; zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU.** Ten dyżur **mierzy i klasyfikuje**, nie naprawia. Znaleziony defekt → `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **bramki zastane** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz | — | — | — |
| `R1` | rozkład 16 wierszy + mianownik z §R1 + odczyt artefaktów 336 | TAK | TAK — sam odczyt | **TAK** |
| `R2` | front czterech modułów na własnej bazie | TAK | TAK — katalogi rozłączne per moduł | **TAK** |
| `R3` | serwer `04`, `09`, `12` — wariant per pakiet | TAK | TAK — każdy moduł osobno | **TAK ×3** |
| `R4` | `15_SETTINGS` — brak ścieżki serwerowej | TAK | TAK — dokument + jedno pytanie | **TAK** |
| `R5` | wpisy do macierzy + eskalacja dwóch pytań | TAK | TAK | **TAK** |
| `R6` | raport, sekcja rejestru `G15`, sekcja rejestru znalezisk | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R3` po każdym module.**

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wiersze `G15`: `PASS` / `PARTIAL_PASS` / `NOT_MEASURED` | `2` / `10` / `4` | `(1)` | TAK — ★ **sprostowanie zlecenia** |
| 2 | moduły `SERVER_NOT_MEASURED` | `4`: `04`, `09`, `12`, `15` | `(1)` | TAK — **Twój zakres** |
| 3 | moduły `NOT_MEASURED / RED_LEGACY_*_CONFIRMED` | `4`: `05`, `06`, `08`, `16` | `(1)` | TAK — **poza zakresem, nie dotykasz** |
| 4 | pliki testowe wg §R1 | `04=33`, `09=67`, `12=41`, `15=7` | `(2)` + własny `find` | TAK — ★ raport 336 mierzył na HEAD `53`/`69`/`40`/`7`; **policz dziś sam** |
| 5 | serwerowe JSON-y dyżuru 336 | `15` plików | `(4)` | TAK — `15_SETTINGS` nie ma i **to jest poprawne** |
| 6 | `04_ASSESSMENT` serwer (336) | `113` / `113` / `0`, suit `0` | `(4)` | TAK — wskazówka, nie dowód |
| 7 | `09_RESULTS` serwer (336) | `567` / `136` / `413`, suit `175` | `(4)` | TAK — ★ **artefakt pomiaru 347, nie liczba defektów** |
| 8 | `12_AUDITS` serwer (336) | `317` / `244` / `1`, suit `2` | `(4)` | TAK — ★ `317−244−1 = 72`, **ustal, czym są** |
| 9 | pytania o kryterium bez odpowiedzi | `2`, zadane 04.09 przez dyżur 336 | `(6)` | TAK |
| 10 | wierszy zmienionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `evidence/g15/day362/**` | `R1`–`R5` | **NOWY** katalog; wszystkie `*.json`, `*.log`, `przed-nazwy.txt`, `po-nazwy.txt`, `diff` |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY362_G15_POMIARY_REPORT.md` | `R6` | główny produkt |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | `R6` | **wyłącznie** sekcja „Aktualizacja dyżuru 362" **na końcu** |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AD` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `modules/{04_ASSESSMENT,09_RESULTS,12_AUDITS}/MODULE_ACCEPTANCE.md` | gdy `R2`+`R3` dadzą pełny pomiar | **wyłącznie wiersz `G15`** |
| `modules/15_SETTINGS/MODULE_ACCEPTANCE.md` | **wyłącznie** gdy `R4` da stan, który **nie jest** `PASS 0/0` | **wyłącznie wiersz `G15`** |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` · `public/locales/**` · **dwanaście plików `MODULE_ACCEPTANCE.md`
poza czterema Twoimi** · żaden wiersz macierzy poza `G15` · §R1 rejestru `G15` ·
`vitest*.config.ts` · `server/vitest.config*.ts` · `tests/setup.ts` · `tests/helpers/**` ·
`tests/__mocks__/**` · `scripts/**` · `.github/workflows/**` ·
żaden plik dyżurów 359, 360, 361 ani 363–366.

★ Plik postępu `/private/tmp/cx-day362-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6433**, runtime **5573**, kontener **`cx-day362-pg`**, baza **`cx362`**,
worktree `/private/tmp/cx-day362-g15-pomiary`, gałąź `codex/day362-g15-pomiary-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- src/ server/src/        # PUSTY
bash -c "git diff --cached --name-only | grep -E 'vitest.*config|tests/setup|tests/helpers|tests/__mocks__' && echo 'STOP: harness nietykalny' || echo 'harness nietkniety'"
bash -c "git diff --cached --name-only | grep -E 'modules/(01|02|03|05|06|07|08|10|11|13|14|16)_' && echo 'STOP: cudzy modul' || echo 'cudze moduly nietkniete'"
bash -c "git diff --cached -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md | grep -E '^-[^-]' && echo 'STOP: kasujesz rejestr G15' || echo 'rejestr G15 tylko dopisany'"
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| 359 | `G20` | wszystkie 16 |
| 360 | `G19` | `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| 361 | `G19` | `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| **362 (Ty)** | **`G15`** | **`04`, `09`, `12`, `15`** |

★ **Twoje pliki `04`, `09`, `12`, `15` są dotykane także przez inne dyżury — w INNYCH
kolumnach.** Konflikt scalenia rozstrzyga **nadzorca**. Nie próbujesz go uprzedzić, nie
scalasz cudzej gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza,
nawet jeżeli uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** `git show --stat` musi zawierać plik z `evidence/g15/day362/**`. Commit bez dowodu
**cofasz przez `git reset --soft HEAD~1`**. **Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — nie wolno „naprawiać" bramki przez nadpisanie mianownika ani zawężenie
kryterium.** Mianownik to **katalogi z §R1, dosłownie**. Nie wyjmujesz pliku, katalogu ani
„nieistotnej" suity. Nie zmieniasz configu ani `setup.ts`. Nie dobierasz zmiennej
środowiskowej do oczekiwanego wyniku. **Jeżeli kryterium jest źle postawione — piszesz
pytanie, nie poprawiasz.**

**ZASADA 3 — `TECHNICAL_REGRESSION_PASS` był odrzucony DWA RAZY i nie wolno go wprowadzić pod
żadną nazwą** — ani `SERVER_PASS_PARTIAL`, ani `PASS (zakres serwerowy)`, ani `MACHINE_PASS`.
`PASS` w `G15` znaczy dokładnie tyle, ile znaczy przy `13_CHAT`: **front i serwer, pełny
mianownik z §R1, realny PG, `--retry=0`, zero błędów suity**. Nic mniej.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część dyżuru niewykonalną — to jest wynik
i zapisujesz go jako pytanie. Nie obchodzisz ich.**

---

## R1 — ROZKŁAD, MIANOWNIK, ODCZYT ARTEFAKTÓW (rdzeń, tani)

1. **Potwierdź albo obal moje sprostowanie** o `PARTIAL_PASS` vs `NOT_MEASURED` — komenda
   `(1)`. Wypisz **wszystkie 16** wierszy ze stanem i podtypem. To zajmuje minutę i chroni
   Cię przed pracą nad złymi czterema modułami.
2. **Wypisz katalogi z §R1** dla `04`, `09`, `12`, `15` — dosłownie, front i serwer osobno.
   **Policz pliki dziś sam** (`find`/`rg`) i zapisz obok liczb historycznych
   (§R1: `33`/`67`/`41`/`7`; raport 336 na HEAD: `53`/`69`/`40`/`7`). **Rozjazd zapisujesz,
   nie naprawiasz zawężeniem katalogów.**
3. **Odczytaj surowe JSON-y dyżuru 336** dla `04`, `09`, `12` (komenda `(4)`). Zapisz
   `numTotalTests`, `numPassedTests`, `numFailedTests`, `numFailedTestSuites`.
   ★ Dla `12_AUDITS` **ustal, czym jest różnica `317 − 244 − 1 = 72`** — pending, skipped
   czy błąd suity. To rozstrzyga, czy `12` w ogóle może dostać `PASS`.
4. **Wypisz pełne nazwy (`fullName`) wszystkich czerwonych przypadków** z tych trzech plików
   do `evidence/g15/day362/przed-nazwy.txt`. To jest Twoja baza porównawcza —
   **porównania robisz po nazwach, nigdy po liczbach**.
5. **Przeczytaj regułę z sekcji „Aktualizacja dyżuru 347"** rejestru `G15` (trzy punkty)
   i wypisz, **który z Twoich pakietów wchodzi do której kategorii**. To jest plan `R3`.

**Wymagany dowód:** `evidence/g15/day362/r1-rozklad-i-mianownik.md` — 16 wierszy stanu,
katalogi §R1 dla czterech modułów, policzone dziś liczby plików obok historycznych, tabela
z JSON-ów 336, orzeczenie o `72` w `12_AUDITS`, przypisanie pakietów do kategorii 347 ·
`przed-nazwy.txt`. **Commit po `R1`.**

---

## R2 — FRONT CZTERECH MODUŁÓW (rdzeń)

Kryterium `13_CHAT` brzmi „front **i** serwer". Front tych czterech jest wg macierzy zielony,
ale **wiersz zamykasz swoim pomiarem, nie cudzym**.

1. Uruchom front **dla każdego z czterech modułów osobno**, na katalogach **dosłownie z §R1**.
   `--retry=0`, `--reporter=json --outputFile=<ARTEFAKTY>`.
2. Podaj `numTotalTests`, `numPassedTests`, `numFailedTests` **oraz `numFailedTestSuites`**.
   ★★ **Sama trójka liczb nie wystarcza**: dyżur 336 znalazł **10 plików/suit, które nie
   wykonały czerwonej asercji** — to nie są ani zielone, ani czerwone, to są **błędy
   komendy**. `numFailedTestSuites > 0` przy `numFailedTests = 0` znaczy, że coś się nie
   uruchomiło.
3. Porównaj z liczbami z macierzy (`04` — 620/620; `09` — 418/418; `12` — 17/17; `15` — 13/13).
   **Rozjazd zapisujesz.** Porównanie po **nazwach**, nie po liczbach.
4. ★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0` i **nie jest pomiarem**.
   `No test files found` i `Transform failed` to **BŁĄD KOMENDY**, nie `PASS`.

**Wymagany dowód:** cztery `*.json` w `evidence/g15/day362/` · tabela z czterema liczbami
per moduł · porównanie po nazwach. **Commit po `R2`.**

---

## R3 — SERWER `04`, `09`, `12` (rdzeń, commit ×3)

1. Kontener `cx-day362-pg`, port `6433`, baza `cx362`, obraz `pgvector/pgvector:pg16`.
   Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`.
   Oba logi do `evidence/g15/day362/`.
2. **Wariant bazowy** (dosłownie ten, którym 336 mierzył 15 modułów): `cwd=server`,
   `--config vitest.config.ts`, `--retry=0`, realny `DATABASE_URL`, `RUN_DB_TESTS=1`,
   `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`,
   `ENABLE_TEST_AUTH_BYPASS=false`, lokalny `JWT_SECRET`.
   **Zapisujesz pełny zestaw zmiennych przy KAŻDYM przelocie.**
3. ★★★ **`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` stosujesz PER PAKIET**, wg
   trzech punktów reguły z rejestru — **nigdy hurtem**. To jest cała różnica wobec 336:
   - pakiety dowodzące **koperty widoczności** (`tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`,
     `tests/integration/results/day46.*.realpg.test.ts`) — **zawsze z `enforce`**;
   - **izolowane pakiety kontraktu HTTP**, które zastępują middleware i nie tworzą realnej
     fikstury `organization_members` — **bez `enforce`**;
   - pakiet realnego Gateway/PG **bez `enforce` tylko wtedy**, gdy jego celem nie jest dowód
     koperty **i raport jawnie to uzasadnia**; domyślnie dowody uprawnień zostają fail-closed.
   ★ **Dla każdego pakietu zapisujesz, do której kategorii go przypisałeś i dlaczego.**
   Wariant dobrany do **rodzaju pakietu** jest poprawny; wariant dobrany do **oczekiwanego
   wyniku** jest podrobieniem pomiaru.
4. **Klasyfikacja czerwieni po `fullName`**, wobec `przed-nazwy.txt` z `R1`:
   `ZASTANA` (ta sama pełna nazwa czerwona wcześniej) · `NOWA` (nazwa czerwona dziś, zielona
   wcześniej) · `ZMIANA ZAKRESU` (nazwa zniknęła lub przybyła) · `BŁĄD KOMENDY` (suita nie
   wykonała ani jednej asercji). Zapisz `po-nazwy.txt` i `przed-po-nazwy.diff`.
5. ★★ **Jeżeli robisz parę z bazą `f65c4ff6a0`** — powtarzasz jawną kopię
   `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx` z HEAD (baza ma tam
   **nierozstrzygnięty marker konfliktu** w wierszu `110`, przez co pliki dotykające jej grafu
   importów wykonały **zero przypadków**) i **zapisujesz tę ingerencję** oraz `git status --short`
   przed usunięciem worktree bazy.
6. **Sprzątanie:** `docker rm -fv cx-day362-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po. ★ **Zakaz `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

★★ **Czego NIE robisz w `R3`:** nie naprawiasz ani jednej czerwieni. Ten dyżur mierzy
i klasyfikuje. Znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony**.

**Wymagany dowód (per moduł):** `*.json` przelotu · pełny zestaw zmiennych · przypisanie
każdego pakietu do kategorii 347 z uzasadnieniem · tabela klasyfikacji po `fullName` ·
dwa logi migracji · `df -h /` przed i po. **Commit po każdym module.**

---

## R4 — `15_SETTINGS`: MODUŁ BEZ ŚCIEŻKI SERWEROWEJ (rdzeń, krótki)

§R1 wymienia dla `15_SETTINGS` **wyłącznie** `src/components/settings/__tests__` i
`tests/unit/settings`. **Zero katalogów serwerowych.** Dyżur 336 z tego powodu **nie
wyprodukował dla niego JSON-a serwerowego i nie wpisał `PASS 0/0`** — i **zadał o to pytanie**,
które do dziś jest bez odpowiedzi.

**Twoje trzy kroki:**

1. **Sprawdź, czy §R1 ma rację.** Czy w repo istnieje **jakikolwiek** katalog testów
   serwerowych, który logicznie należy do Ustawień (kandydaci do sprawdzenia, nie ustalenia:
   `server/src/routes/**settings**`, `server/src/services/**settings**`, trasy profilu
   i preferencji użytkownika)? Wypisz co znalazłeś, z liczbą plików.
   ★ **Znalezienie takiego katalogu NIE upoważnia Cię do dopisania go do §R1** — §R1 jest
   nietykalne. Jest to **materiał do pytania**.
2. **Nie wpisujesz `PASS 0/0`.** Stan wiersza po Twoim dyżurze to albo `PARTIAL_PASS` z
   uzupełnionym frontem i **jawnym zdaniem, że warstwa serwerowa jest poza mianownikiem wg
   §R1 i czeka na decyzję**, albo bez zmian — nigdy zieleń przez pustkę.
3. **Eskaluj pytanie 1 dyżuru 336** — z datą pierwszego zadania (`2026-09-04`), nazwą dyżuru
   i **Twoim pomiarem z punktu 1** jako materiałem do decyzji. Pytanie ma być
   **rozstrzygalne**: wybór z wypisanymi konsekwencjami, nie „co robimy?".

**Wymagany dowód:** `evidence/g15/day362/r4-settings.md` — wynik poszukiwania katalogów
serwerowych z liczbami · brzmienie wiersza · rozstrzygalne pytanie. **Commit po `R4`.**

---

## R5 — WPISY DO MACIERZY I ESKALACJA PYTAŃ (rdzeń)

1. **Dla każdego z czterech modułów** ustal stan na podstawie `R2`+`R3`+`R4`:

| Warunek | Stan |
| --- | --- |
| front zielony **i** serwer zielony **i** pełny mianownik §R1 **i** zero błędów suity | **`PASS`** — z liczbami front i serwer, jak przy `13_CHAT` |
| pomiar wykonany, ale czerwień **`ZASTANA`** została | `PARTIAL_PASS / RED_LEGACY_<n>` — z **imienną** listą pełnych nazw |
| pomiar wykonany, czerwień **`NOWA`** | `PARTIAL_PASS / RED_NEW_<n>` — z imienną listą; **to jest znalezisko**, nie tło |
| `numFailedTestSuites > 0` przy `numFailedTests = 0` | **`BŁĄD KOMENDY`** — pomiar nieudany, stan **nie** idzie na `PASS` |
| brak ścieżki w §R1 (`15_SETTINGS`) | **NIGDY `PASS 0/0`** — patrz `R4` |

2. **Każdy zmieniony wiersz niesie w kolumnie dowodu:** liczby front (`X/X/0`), liczby serwer
   (`Y/Y/0` albo imienną czerwień), **`numFailedTestSuites`**, wariant zmiennych, marker
   pomiaru (`2a7273e087`), datę i **ścieżkę artefaktu** w `evidence/g15/day362/`.
3. **Wpis i dowód idą JEDNYM commitem.**
4. **Policz: ile wierszy zmieniłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe.**
5. **Eskaluj DWA pytania dyżuru 336** — z datą pierwszego zadania, nazwą dyżuru i Twoim
   materiałem. ★ Pytanie 2 („czy potwierdzony dług zastany ma nadal blokować `PASS`") dotyczy
   **wszystkich dziesięciu** `PARTIAL_PASS`, nie tylko Twoich czterech — powiedz to wprost,
   bo od odpowiedzi zależy, czy `G15` domknie się w jednym dyżurze, czy w sześciu.
6. **Zero zmienionych wierszy jest dopuszczalnym wynikiem** — po wykonaniu `R2`–`R4`,
   z powodem **per moduł**.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → stan → dowód" · dwie zgodne liczby · dwa eskalowane pytania. **Commit po `R5`.**

---

## R6 — RAPORT I DWIE SEKCJE REJESTRÓW

Raport `CODEX_DAY362_G15_POMIARY_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, na początku;
   w szczególności potwierdzenie albo obalenie mojego sprostowania `PARTIAL_PASS`
   vs `NOT_MEASURED`.
2. `R1`: rozkład 16 wierszy, katalogi §R1, policzone dziś pliki obok historycznych,
   orzeczenie o `72` w `12_AUDITS`.
3. `R2`: front czterech modułów — cztery liczby per moduł, porównanie po nazwach.
4. `R3`: serwer `04`, `09`, `12` — per pakiet: kategoria wg reguły 347, wariant zmiennych,
   liczby, klasyfikacja czerwieni po `fullName`. ★ **Ile czerwieni `09_RESULTS` okazało się
   artefaktem pomiaru, a ile zostało po poprawnym wariancie** — to jest najważniejsza liczba
   tego raportu.
5. `R4`: `15_SETTINGS` — co znalazłeś, dlaczego nie ma `PASS 0/0`.
6. `R5`: tabela „wiersz → stan → dowód", dwie zgodne liczby.
7. **Dwa eskalowane pytania o kryterium** — z datą pierwszego zadania i konsekwencjami.
8. **Defekty znalezione, ale nienaprawione** — `plik:linia` + diff nienałożony.
9. Co zostało niewykonane i dlaczego — imiennie.
10. `df -h /` przed i po; potwierdzenie usunięcia kontenera.

**Sekcja „Aktualizacja dyżuru 362"** na końcu
`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` — **dopisana,
nigdy zamiast czegoś**. Zawiera: marker pomiaru, cztery moduły, wariant per pakiet, liczby,
i **regułę dla kolejnych pomiarów**, jeżeli Twój dyżur ją doprecyzował.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AD`**, sprawdzana komendą
**tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`; litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AD` jest zajęta, bierzesz pierwszą wolną i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `R1` potwierdził albo obalił rozkład 16 wierszy i wypisał katalogi §R1 dla czterech
   modułów, z policzonymi dziś liczbami plików.
2. `R2` dał front dla **każdego** z czterech modułów, z `numTotalTests` **i**
   `numFailedTestSuites`, na katalogach **dosłownie z §R1**.
3. `R3` dał serwer dla `04`, `09`, `12`, z **wariantem dobranym PER PAKIET** wg reguły 347
   i uzasadnieniem dla każdego pakietu.
4. Klasyfikacja czerwieni wykonana **po `fullName`**, z plikami `przed-nazwy.txt`,
   `po-nazwy.txt` i `diff` w repo.
5. Raport podaje **imiennie**, ile czerwieni `09_RESULTS` było artefaktem pomiaru, a ile
   zostało.
6. `15_SETTINGS` **nie dostał `PASS 0/0`**; `R4` wypisał wynik poszukiwania katalogów
   serwerowych i **rozstrzygalne pytanie**.
7. **Żaden `PARTIAL` nie stał się `PASS` przez wyjęcie czegokolwiek z mianownika**, przez
   zmianę configu, `setup.ts`, treści testu ani przez dobór zmiennej do wyniku;
   `git diff` na kodzie produktu i na harnessie **pusty**.
8. Każdy zmieniony wiersz niesie **liczby front + serwer + `numFailedTestSuites` + wariant +
   marker + datę + ścieżkę artefaktu** i ma dowód w **tym samym** commicie; **liczba wierszy
   = liczbie dowodów**.
9. **Dwa pytania o kryterium eskalowane z datą pierwszego zadania** (04.09, dyżur 336),
   nie zgłoszone jako nowe.
10. Liście słowników i cztery bramki identyczne przed i po; **dwanaście cudzych wierszy `G15`
    nietkniętych**; §R1 rejestru `G15` nietknięte; kontener usunięty; `df -h /` przed i po.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6433`, `5573`) jest zajęty — **STOP całości, nigdy podmiana**;
- §R1 rejestru `G15` albo `evidence/g15/day336-artefakty/**` **nie istnieje** — wtedy zniknął
  SSOT mianownika albo baza porównawcza i trzeba to zgłosić, a nie mierzyć na własnym
  mianowniku;
- migracje nie przechodzą dwukrotnie na czystej bazie;
- doprowadzenie któregokolwiek wiersza do `PASS` wymagałoby **wyjęcia czegokolwiek
  z mianownika**, zmiany configu, `setup.ts` albo treści testu;
- pakiet nie daje się przypisać do żadnej z trzech kategorii reguły 347 — **wtedy STOP dla
  tego pakietu**, opis dlaczego, i pytanie do właściciela; nie dobierasz wariantu „na oko".

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „zamknij wiersze, jeżeli wychodzą zielone" × „zakaz zawężenia kryterium" | `R5`, tabela warunków — `PASS` wyłącznie przy pełnym mianowniku §R1 i zerze błędów suity |
| „`15_SETTINGS` też jest w zakresie" × „nie ma ścieżki serwerowej" | `R4` — nie `PASS 0/0`; front uzupełniony, warstwa serwerowa jako **eskalowane pytanie** |
| „wykonaj pomiar serwerowy" × „nie naprawiaj czerwieni" | `R3` punkt „czego NIE robisz" — mierzysz i klasyfikujesz; defekt → `plik:linia` + diff nienałożony |
| „stosuj wariant 336" × „347 udowodnił, że wariant 336 był zły" | `R3` punkt 3 — wariant bazowy z 336, ale `enforce` **per pakiet** wg reguły z rejestru |
| „`04` ma w repo `113/113/0`" × „to wciąż `SERVER_NOT_MEASURED`" | `R1` punkt 3 + `R3` — stary artefakt jest **wskazówką**, dowodem jest Twój przelot na Twoim markerze |
| „mianownik §R1 = `33`" × „raport 336 mierzy `53`" | `B.3` wiersz 4 — obowiązują **katalogi** §R1, nie liczba z raportu; rozjazd zapisujesz |
| „porównaj z bazą `f65c4ff6a0`" × „baza się nie kompilowała" | `R3` punkt 5 — jawna kopia `PreviewAIHintStrip.tsx` z HEAD, ingerencja zapisana |
| „zadaj pytanie o kryterium" × „zakaz pytania po raz drugi" | `R4`/`R5` — **eskalacja z datą pierwszego zadania**, nie nowe zgłoszenie |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g15/day362/**` |
| „dopisz do rejestru `G15`" × „§R1 nietykalne" | `B.1` — **wyłącznie nowa sekcja na końcu**; bezpiecznik w `B.4.5` sprawdza brak skasowanych linii |
| „mandat CTO — decyduj sam" × „dwa pytania do właściciela" | `R5` punkt 5 — wariant pomiaru i klasyfikację rozstrzygasz sam; **definicja kryterium bramki** jest regułą programu i idzie do właściciela |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `evidence/g15/day362/**`, raport, sekcja „Aktualizacja dyżuru 362", sekcja `AD` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; ★ **rozkład wierszy `G15` ze zlecenia OBALONY własnym pomiarem** (cztery `SERVER_NOT_MEASURED` to `PARTIAL_PASS`, a cztery `NOT_MEASURED` to inne moduły) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (lista katalogów · liczby · zestaw zmiennych) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; katalogi testów są rozłączne per moduł |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec 359, 360, 361); `6433`/`5573` zmierzone jako wolne. ★ 363–366 pisze inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 286, 336, 347 i 355 ma ścieżkę artefaktu albo `plik:linia` |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
