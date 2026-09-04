## Po co ten dyżur istnieje

Bramka `G19` („Later-change regression obligations resolved") stoi na `NOT_PROVEN` we
**wszystkich szesnastu** modułach. Podchodziły do niej dwa dyżury: **335** (zamknięty
werdyktem „zero wierszy podniesionych, i to jest wynik") i **348** (zatrzymany w połowie).
Obydwa zaczynały od zera: mierzyły dryf, klasyfikowały moduły do kubełków i **kończyły się
na progu tej jednej pozycji, która produkuje dowód, a nie opis**.

**Ten dyżur nie zaczyna od zera.** Dyżur 348 domknął punkt wznowienia po odbiorze i
**wszystko leży w repo**, nie w katalogu tymczasowym:

```
evidence/g19/day348-artefakty/PUNKT-WZNOWIENIA.md
evidence/g19/day348-artefakty/{blok1,blok2,blok3}-przed.json
evidence/g19/day348-artefakty/{migration-1,migration-2}.log
evidence/g19/day348-artefakty/g19-dryf-dzis.txt
evidence/g19/day348-artefakty/staged.txt
evidence/g19/day348/r2-kubelki.md
```

★★ **PIERWSZA RZECZ, KTÓRĄ ROBISZ, TO PRZECZYTANIE `PUNKT-WZNOWIENIA.md` W CAŁOŚCI.**
Instrukcja każe Ci **wznowić**, nie powtórzyć. Trzecie liczenie tego samego dryfu jest
najgorszym możliwym wynikiem tego dyżuru — dwa dyżury już to policzyły, zgodnie, i żaden
z nich nie ruszył wiersza macierzy o milimetr.

### ★ Co jest ZROBIONE i ZWERYFIKOWANE — NIE POWTARZASZ

| Pozycja | Stan | Wynik, który dziedziczysz |
| --- | --- | --- |
| `R1` — przemiar dryfu | **ZROBIONY** (commit `7448139e69`) | **106 plików** na ścieżkach mierzonych przez `G19`, **90 bez testów**. Delta wobec pomiaru 335 to **dokładnie dwa nowe pliki** (`IdeaRightPanel.tsx`, `day277-decyzje-zapis.pg.test.ts`); **żaden nie zniknął** |
| `R2` — kubełki `A`/`B`/`C` | **ZROBIONY** (commit `1d5b181ded`) | `A=7`, `B=0`, `C=9`, bez zmiany statusów. ★ Sam autor nazwał to **hipotezą wykonawczą przed `R3`**, nie werdyktem |
| Migracje na świeżej bazie | **ZROBIONE** | dwa przebiegi zielone, drugi `Applying migrations: 0` (idempotencja potwierdzona) |
| Blok 1 | **ZMIERZONY** | `131` total / `127` green / `4` red — te same pełne nazwy co w 335 |
| Blok 2 | **ZMIERZONY** | `218` total / `218` green / `0` red |
| Blok 3 | **ZMIERZONY** | `18` total / `11` green / `7` red — imiennie: `day275` ×1, `day276` deck ×2, `day276` workbook ×2, `day277` ×2 |
| Para izolacyjna `day307` | **WYKONANA JAKO DOWÓD** | obcy `404` / właściciel `200` na tym samym `userId`; mutacja `AND organization_id = ?` w `TaskController.getUserWorkload` → `GREEN`→`RED`→`GREEN`, `git diff` po przywróceniu **pusty** |

★★★ **Historyczny wariant Bloku 2 na siedmiu plikach dawał `225/224/1` i został ODRZUCONY
jako zły mianownik.** Nie wracasz do niego, nie cytujesz go jako alternatywy i nie
„porównujesz obu wariantów". Właściwy mianownik Bloku 2 to `218`.

### ★ Co jest NIEZROBIONE — i to jest cały ten dyżur

1. **Pięć pozostałych modułów kubełka `A`**: `04_ASSESSMENT`, `05_INITIATIVES`,
   `06_EXECUTION`, `11_MATERIALS`, `13_CHAT`. Dla żadnego z nich nie ma dowodu.
2. **Rozstrzygnięcie, czy `day307` wystarcza** dla dwóch wierszy, którym `R2` go przypisał
   (`01_ORGANIZATION` i `08_MEETINGS`) — dowód istnieje, ale **nikt nie orzekł, czy zamyka
   te wiersze**.
3. **Orzeczenie per wiersz** dla całej szesnastki: czego dokładnie brakuje, imiennie.
4. **Pytanie o kotwicę**, którego dwa dyżury nie postawiły (patrz `R5`).

---

## ★★ SPROSTOWANIE ZLECENIA — cztery liczby, które mój pomiar na markerze obalił

Zlecenie, z którego powstała ta instrukcja, przekazało liczby z raportu dyżuru 348.
Sprawdziłem każdą z nich na markerze `29fcbd4de2`. **Dwie się potwierdziły, dwie nie.**

**POTWIERDZONE — nie mierzysz ich ponownie:**

- **106 plików** — `wc -l < evidence/g19/day348-artefakty/g19-dryf-dzis.txt` → `106`.
- **90 bez testów** — `bash -c "grep -vcE '__tests__|\.test\.' evidence/g19/day348-artefakty/g19-dryf-dzis.txt"` → `90`.

**OBALONE — i to jest ważne, bo dotyczy właśnie kotwicy:**

- ★★★ **„dystans 615 commitów" NIE JEST ODTWARZALNY.** Kotwicą wpisaną w wiersz `G19`
  modułu `01_ORGANIZATION` jest SHA odbioru z wiersza `G18` = `316bce9dd9`. Z tej kotwicy
  do markera `29fcbd4de2` mierzę:

  | Komenda | Wynik |
  | --- | --- |
  | `git rev-list --count 316bce9dd9..29fcbd4de2` | **1216** |
  | `git rev-list --count --no-merges 316bce9dd9..29fcbd4de2` | **1015** |
  | `git rev-list --count --first-parent 316bce9dd9..29fcbd4de2` | **315** |

  **Żadna z nich nie daje 615.** Ani na markerze dyżuru 348 (`6a4919f72d`: `1146` / `956`).
  Liczba `615` albo pochodzi z innej kotwicy, albo z komendy, której raport nie zapisał.
  ★ **To nie jest przytyk do dyżuru 348 — to dowód, że pytanie o kotwicę z `R5` jest realne**,
  a nie retoryczne: ta sama bramka daje trzy różne „dystanse" w zależności od jednej flagi.

- **Liście słowników**: zlecenie mówi `pl 35198 / en 33065`. Kanoniczna komenda na markerze
  daje **`pl 35199` / `en 33066`** — sprawdzone także prosto z obiektu commita
  (`git show 29fcbd4de2:public/locales/pl/translation.json`), więc to nie jest brud
  w katalogu roboczym. Te liczby są o jeden dzień stare. **Obowiązuje mój pomiar,
  a jeżeli Twój przeczy mojemu — obowiązuje Twój.**

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Zanim ruszysz `R1`, odtwórz **tanie** liczby z tabeli wyżej. Nie odtwarzasz przelotów
testowych ani migracji — to jest treść `R2`/`R3` i zrobisz je na swojej bazie.

```bash
cd /private/tmp/cx-day353-g19-wznowienie

# (a) punkt wznowienia ISTNIEJE w repo — sprawdz to `ls`-em, nie zaufaniem
ls -la evidence/g19/day348-artefakty/ evidence/g19/day348/
#   oczekiwane: 8 plikow w pierwszym katalogu (w tym PUNKT-WZNOWIENIA.md), 1 w drugim

# (b) dryf: 106 plikow, 90 bez testow
wc -l < evidence/g19/day348-artefakty/g19-dryf-dzis.txt
bash -c "grep -vcE '__tests__|\.test\.' evidence/g19/day348-artefakty/g19-dryf-dzis.txt"
#   moje liczby: 106 i 90

# (c) trzy bloki „PRZED" — czytasz z artefaktow, NIE uruchamiasz jeszcze niczego
node -e 'for (const b of ["blok1","blok2","blok3"]) { const j = JSON.parse(require("fs").readFileSync(`evidence/g19/day348-artefakty/${b}-przed.json`,"utf8")); console.log(b, j.numTotalTests, j.numPassedTests, j.numFailedTests); }'
#   moje liczby: blok1 131 127 4 · blok2 218 218 0 · blok3 18 11 7

# (d) ★★ DYSTANS OD KOTWICY — trzy komendy, trzy rozne liczby. To jest sedno pytania z R5.
git rev-list --count            316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
git rev-list --count --no-merges 316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
git rev-list --count --first-parent 316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
#   moje liczby: 1216 · 1015 · 315. ★ ZLECENIE MOWILO 615 — NIE ODTWORZYLEM TEJ LICZBY.

# (e) kotwica jest wpisana w wiersz G19 modulu 01 — przeczytaj ja doslownie
bash -c "grep -hE 'G19' docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md" | cut -c1-400
#   oczekiwane: 'Kotwica: SHA odbioru modulu z wiersza G18 = 316bce9dd9' oraz 'Mianownik: 49 plikow'
#   ★★ MIANOWNIK W MACIERZY MOWI 49. DRYF DZIS MOWI 106. To NIE jest sprzecznosc do naprawienia
#   przez nadpisanie liczby — to jest dokladnie ten problem, o ktory pytasz wlasciciela w R5.

# (f) cel mutacji z day307 istnieje na markerze
bash -c "grep -n 'getUserWorkload' server/src/controllers/TaskController.ts"
#   oczekiwane: definicja w okolicach wiersza 2681
ls server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts
#   oczekiwane: plik istnieje (216 niepustych linii)

# (g) TECHNICAL_REGRESSION_PASS zostal ODRZUCONY — sprawdz, ze go nigdzie nie ma
bash -c "grep -rn 'TECHNICAL_REGRESSION_PASS' docs/ | head"
#   oczekiwane: zero trafien w wierszach macierzy. Jesli jest w opisie decyzji — to opis odrzucenia.

# (h) liscie slownikow i bramki
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0
```

★ **Te liczby mają pozostać IDENTYCZNE przed pierwszym commitem i po ostatnim.** Ten dyżur
nie zmienia ani kodu produktu, ani słowników. Zmiana którejkolwiek z nich oznacza,
że wyszedłeś poza zakres — i cofasz zmianę.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ

★ Licencja obejmuje **całą ścieżkę**, żebyś nie musiał wybierać między złamaniem licencji
a zrobieniem połowy roboty.

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G19`, wyłącznie w modułach, dla których `R4` wykaże domknięcie, i wyłącznie commitem, który W TYM SAMYM `git show --stat` niesie plik dowodowy.** Zakaz dotykania jakiegokolwiek innego wiersza, w szczególności `G16` i `G18` | zmieniony wiersz + dowód w jednym commicie |
| **testy izolacyjne (odczyt+uruchomienie)** | `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` | odczyt i uruchomienie; **modyfikacja WYŁĄCZNIE w kopii poza repo** (seeder jest fail-closed na historyczne `6314/cx307`) | para `404`/`200` z logiem |
| **kontroler — cel mutacji** | `server/src/controllers/TaskController.ts` (`getUserWorkload`, okolice `2681`–`2730`) | **mutacja TYMCZASOWA po kopii przez `cp` do `SCRATCH`**; przywrócenie przez `cp`, **nigdy `git stash`** (`Z27`); `git diff` po przywróceniu **pusty** | `GREEN`→`RED`→`GREEN` + pusty `git diff` |
| **serwis** | `server/src/services/TaskAssignmentService.ts` | tylko odczyt — ustalasz, czy zabezpieczenie stoi w prechecku kontrolera, czy w serwisie; **wynik zapisujesz zdaniem w raporcie** | zdanie „zabezpieczenie stoi w `plik:linia`" |
| **trasy pozostałych modułów `A`** | `server/src/routes/**` dla `04`, `05`, `06`, `11`, `13` | tylko odczyt + uruchomienie istniejących testów | wskazanie testu zamykającego lukę albo brief braku |
| **nowe kontrakty testowe** | `tests/**` (★ **NIGDY pod `src/`**) | **zapis** — dla modułu `A` bez istniejącego dowodu produkujesz **czerwony z założenia** kontrakt `it('KONTRAKT DLA DYŻURU 353 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`; `git add -f` | plik kontraktu + jego czerwony wynik |
| **dowody** | `evidence/g19/day353/**` (**NOWY** katalog) | **zapis, `git add -f`** — ta instrukcja daje jawną licencję na binaria i logi; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie `*.json`, `*.log`, `*.md` przelotów |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY353_G19_WZNOWIENIE_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji o pierwszej wolnej literze.** Zakaz kasowania i przeredagowywania sekcji zastanych | jedna sekcja |
| **kod produktu** | `src/**`, `server/src/**` (poza mutacją tymczasową) | **★ ZAKAZ ZAPISU.** Ten dyżur nie pisze kodu; znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **bramki i harness** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | dwie twarde zasady — czytasz, nie wykonujesz | — | — | — |
| `R1` | weryfikacja punktu wznowienia + rozstrzygnięcie rozbieżności `615` | TAK | TAK — sam odczyt artefaktów i `git rev-list` | **TAK** |
| `R2` | odtworzenie `day307` na dzisiejszym markerze i **orzeczenie, czy wystarcza** dla `01` i `08` | TAK | TAK — mutacja siedzi w ciele jednej funkcji kontrolera | **TAK** |
| `R3` | pięć pozostałych modułów kubełka `A`: `04`, `05`, `06`, `11`, `13` | TAK | TAK — każdy moduł ma własną trasę i własny test | **TAK** |
| `R4` | orzeczenie per wiersz dla 16 modułów | TAK | TAK — dokument | **TAK** |
| `R5` | podniesienie wierszy z dowodem + **pytanie o kotwicę** | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`.** Pozycja bez commita jest pozycją niewykonaną.

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pliki dryfu `G19` | `106` | `(b)` z „Zmierz moje liczby sam" | TAK — artefakt z repo |
| 2 | pliki dryfu bez testów | `90` | `(b)` | TAK |
| 3 | Blok 1 | `131` / `127` / `4` | `(c)`, potem własny przelot w `R3` | TAK |
| 4 | Blok 2 | `218` / `218` / `0` | `(c)`, potem własny przelot | TAK — ★ wariant 7-plikowy `225/224/1` **odrzucony** |
| 5 | Blok 3 | `18` / `11` / `7` | `(c)`, potem własny przelot | TAK |
| 6 | dystans od kotwicy | `1216` / `1015` / `315` | `(d)` | TAK — ★ **`615` ze zlecenia nieodtworzone** |
| 7 | mianownik wpisany w macierz | `49` | `(e)` | TAK — ★ i **nie zgadza się** z `106`; to treść pytania z `R5` |
| 8 | kubełki po `R2` dyżuru 348 | `A=7`, `B=0`, `C=9` | `evidence/g19/day348/r2-kubelki.md` | TAK — ★ **hipoteza, nie werdykt** |
| 9 | moduły `A` bez dowodu | `5` (`04`,`05`,`06`,`11`,`13`) | `R3`, licznik własny | TAK |
| 10 | wierszy podniesionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i bramki | `35199` / `33066`, cztery `0` | `(h)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY353_G19_WZNOWIENIE_REPORT.md` | `R6` | główny produkt |
| `evidence/g19/day353/**` | `R1`–`R5` | **NOWY** katalog; wszystkie logi, `*.json` przelotów, `r4-orzeczenie.md` |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, pierwsza wolna litera |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **wyłącznie** gdy `R4` orzeknie domknięcie z dowodem | **wyłącznie wiersz `G19`**, jednym commitem z dowodem |
| `tests/**` (nowe kontrakty) | gdy moduł kubełka `A` nie ma testu zamykającego lukę | czerwony z założenia kontrakt + brief; `git add -f` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` (poza mutacją tymczasową, przywracaną przez `cp`) ·
`public/locales/**` · żaden wiersz macierzy poza `G19` · `scripts/**` · `docs/ui-standards/**` ·
`.github/workflows/**` · żaden plik dyżurów 351, 352, 354 ani 355–358.

★ Plik postępu `/private/tmp/cx-day353-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6412**, runtime **5552**, kontener **`cx-day353-pg`**, baza **`cx353`**,
worktree `/private/tmp/cx-day353-g19-wznowienie`, gałąź `codex/day353-g19-wznowienie-20260904`.
Sprawdziłem 04.09: wszystkie cztery porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.** Równolegle idą 351
(6410/5550), 352 (6411/5551), 354 (6413/5553) oraz **355–358 pisane przez innego autora,
których portów nie znam w chwili pisania**.

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- server/src/controllers/TaskController.ts   # PUSTY (mutacja przywrocona)
bash -c "grep -rnE '^(<{7}|>{7}|={7})' $(git diff --cached --name-only)"   # zero znacznikow konfliktu
```

---

## R0 — DWIE TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** Nie „dowód był w poprzednim commicie", nie „dowód jest w raporcie, który
dopiszę w `R6`". `git show --stat <commit dotykający macierzy>` musi zawierać plik
z `evidence/g19/day353/**` albo plik testu. Commit, który zmienia wiersz i nie niesie
dowodu, **cofasz `git reset --soft HEAD~1`** i składasz na nowo.

**ZASADA 2 — `TECHNICAL_REGRESSION_PASS` został ODRZUCONY i nie wolno go wprowadzić
pod inną nazwą.** Zakaz obejmuje każdy synonim: `MACHINE_PASS`, `TECHNICAL_PASS`,
`REGRESSION_TECHNICAL_OK`, `PASS_MASZYNOWY`, `PASS (zakres techniczny)` i każde inne
sformułowanie, którego skutkiem jest wiersz brzmiący jak zaliczenie. Stan wiersza po
podniesieniu ma **nazywać zakres dowodu i jego granicę** — na przykład
`NOT_PROVEN / OWNER_RETEST_PENDING — para izolacyjna udowodniona (evidence/g19/day353/…), brakuje oczu właściciela`.

★ **Jeżeli uważasz, że obie zasady razem czynią ten dyżur niewykonalnym — to jest wynik
i zapisujesz go w `R5` jako pytanie do właściciela. Nie obchodzisz ich.**

---

## R1 — WERYFIKACJA PUNKTU WZNOWIENIA (rdzeń, ale TANI)

★★ **To NIE jest powtórka `R1`/`R2` dyżuru 348.** Masz **potwierdzić, że dziedziczone
liczby są prawdziwe**, a nie policzyć je jeszcze raz od zera.

1. Przeczytaj `evidence/g19/day348-artefakty/PUNKT-WZNOWIENIA.md` w całości.
   **`ls` na każdej ścieżce, którą cytuje** — dowód poza repo wyparowuje, a ten akurat
   został uratowany do repo i ma istnieć.
2. Odtwórz komendy `(a)`–`(e)` z bloku „Zmierz moje liczby sam". Zapisz **swoje** wyniki
   obok moich w tabeli `porownanie-liczb.md`.
3. ★★ **Rozstrzygnij rozbieżność `615`.** Masz trzy moje liczby (`1216`/`1015`/`315`) i ani
   jedna nie daje `615`. Znajdź kombinację kotwicy i flagi, która ją daje — albo **zapisz
   wprost: „liczba `615` nie jest odtwarzalna z kotwicy wpisanej w macierz"**. Obie
   odpowiedzi są pełnowartościowe; **brak odpowiedzi nie jest**.
4. Zapisz **zdanie o tym, czy kubełki z `R2` dyżuru 348 dalej się bronią** — nie
   przeklasyfikowujesz szesnastu modułów, tylko sprawdzasz, czy dwa nowe pliki dryfu
   (`IdeaRightPanel.tsx`, `day277-decyzje-zapis.pg.test.ts`) zmieniają rodzaj brakującego
   dowodu w którymkolwiek module. Autor 348 twierdzi, że nie. **Sprawdź to i podpisz się
   pod tym albo obal.**

**Wymagany dowód:** `evidence/g19/day353/r1-porownanie-liczb.md` z parą kolumn
„liczba autora instrukcji / mój pomiar" dla wszystkich jedenastu wierszy tabeli `B.3` ·
jawne zdanie o `615` · zdanie o kubełkach. **Commit po `R1`.**

---

## R2 — `day307` NA DZISIEJSZYM MARKERZE I ORZECZENIE, CZY WYSTARCZA (rdzeń)

★★ **Dyżur 348 ten dowód WYKONAŁ.** Nie budujesz go drugi raz od zera — **odtwarzasz go
na dzisiejszym markerze i rozstrzygasz pytanie, którego 348 nie postawił: czy on w ogóle
zamyka wiersz `G19` dla `01_ORGANIZATION` i `08_MEETINGS`.**

1. Postaw kontener `cx-day353-pg`, port `6412`, baza `cx353`, obraz `pgvector/pgvector:pg16`
   (`postgres:15` **nie przechodzi migracji**). Migracje **dwoma przebiegami**; drugi ma dać
   `Applying migrations: 0`. Oba logi do `evidence/g19/day353/`.
2. **Kopia seedera poza repo.** `day307` jest fail-closed na historyczne `6314/cx307`.
   Kopiujesz plik do `SCRATCH`, zmieniasz **wyłącznie guard** na `6412`/`cx353`,
   **źródła w repo NIE dotykasz**.
3. Przelot pary: obcy ma dostać **`404`**, właściciel **`200`**, na **tym samym `userId`**.
   ★★ **Symetryczna odmowa (`404`/`404`) NIE JEST dowodem** — to kształt „zamknięte przez
   wygaszenie": funkcja wyłączona dla wszystkich, bramka zielona, produkt martwy. Para
   musi mieć **oba człony**: „obcy nie widzi" **i** „właściciel widzi, i widzi coś niepustego".
   Puste `200` właściciela to też nie dowód — zapisz długość ciała odpowiedzi.
4. **Mutacja celująca w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuwasz
   `AND organization_id = ?` z prechecku w `TaskController.getUserWorkload`
   (`server/src/controllers/TaskController.ts`, okolice `2681`–`2730`), po kopii przez `cp`
   do `SCRATCH`. Test ma **zaczerwienić się** komunikatem kształtu `expected 200 to be 404`.
   Przywracasz przez `cp` (**nigdy `git stash`**, `Z27`) → **zielony**;
   `git diff -- server/src/controllers/TaskController.ts` **pusty**.
   ★ Jeżeli po usunięciu warunku test dalej jest zielony — **zabezpieczenie stoi gdzie
   indziej albo nie stoi wcale**; wtedy szukasz go w `TaskAssignmentService.getUserWorkload`
   i mutujesz **tam**, a fakt „precheck kontrolera nie jest zabezpieczeniem" zapisujesz
   jako znalezisko.
5. ★★★ **ORZECZENIE — to jest właściwy produkt tej pozycji.** Odpowiedz pisemnie na
   pytanie: *czy para `day307` na trasie workloadu zamyka wiersz `G19` dla `01_ORGANIZATION`?
   A dla `08_MEETINGS`?* `R2` dyżuru 348 przypisał `08` do kubełka `A` uzasadnieniem
   „ma ten sam największy mianownik co `01`" — **i sam dodał, że identyczność mianownika
   nie jest jeszcze podstawą**. Rozstrzygnij to: albo pokaż, że mianownik `08` jest
   dosłownie tym samym zbiorem plików (wtedy jeden dowód uzasadnia dwa wiersze), albo
   orzeknij, że `08` potrzebuje własnej pary na własnej trasie — i **nazwij tę trasę**.

**Wymagany dowód:** dwa logi migracji · para z dwoma kodami i długością ciała odpowiedzi ·
mutacja w obie strony z pustym `git diff` · **pisemne orzeczenie dla `01` i `08` z
uzasadnieniem opartym na zbiorze plików, nie na liczbie**. **Commit po `R2`.**

---

## R3 — PIĘĆ POZOSTAŁYCH MODUŁÓW KUBEŁKA `A` (rdzeń)

Moduły: `04_ASSESSMENT`, `05_INITIATIVES`, `06_EXECUTION`, `11_MATERIALS`, `13_CHAT`.
Dla **każdego** z nich, po kolei:

1. **Który konkretny test/kontrakt zamyka lukę** — imiennie, ze ścieżką. Kandydaci
   wskazani przez `R2` dyżuru 348: `04` → kontrakty `day274`/`day275`; `05` → `day277`
   i trasy zapisu; `06` → `initiativesExecutionRuntime.dropdown`; `11` → kontrakty zapisu
   `day276`; `13` → trasy `chat`/`teresa` i `agent-hub`. **To są HIPOTEZY autora 348, nie
   ustalenia — sprawdź każdą.**
2. **Uruchomienie z `numTotalTests`.** `--retry=0`, `--reporter=json --outputFile=<plik
   w ARTEFAKTY>`. ★★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0`
   i **nie jest pomiarem** — to zdarzyło się dyżurowi 335 przy Bloku 3 z roota i słusznie
   zostało odrzucone. `No test files found` oraz `Transform failed` to **BŁĄD KOMENDY**,
   nie `PASS`.
3. **Dowód mutacyjny celujący w zabezpieczenie.** Zabezpieczeniem jest to, co odróżnia
   obcego od właściciela (albo zapis dozwolony od zabronionego) — **nie** mechanizm
   walidacji kształtu, nie mapowanie błędu, nie kolejność pól. Mutacja ma **skasować
   zabezpieczenie** i test ma **zaczerwienić się z tego powodu**; jeżeli czerwienieje
   z innego powodu, mutacja chybiła i musisz ją przecelować.
4. **Jeżeli dla któregoś modułu takiego testu NIE MA — to jest wynik**, nie porażka.
   Piszesz: „kubełek `A` był dla modułu `X` przypisany błędnie; brakuje kontraktu `Y`"
   i produkujesz **czerwony z założenia** kontrakt w `tests/`:
   `it('KONTRAKT DLA DYŻURU 353 — <co ma udowodnić>')` z nagłówkiem
   `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, `git add -f`.
5. **Odtwórz trzy bloki na SWOJEJ bazie** — Blok 1 wariantem (C), Blok 2 jednostkowo,
   Blok 3 wariantem (B) z cwd `server/`. Podaj `numTotalTests` dla każdego i **porównaj
   z liczbami dziedziczonymi** (`131/127/4`, `218/218/0`, `18/11/7`). Rozjazd zapisujesz;
   **nie naprawiasz** — czerwienie Bloku 1 i Bloku 3 to teren innych dyżurów.
6. **Sprzątanie:** `docker rm -fv cx-day353-pg` (bez `-v` wolumen zostaje), `df -h /`
   przed i po. ★ **Zakaz `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

**Wymagany dowód:** dla każdego z pięciu modułów albo wykonany dowód (test + `numTotalTests`
+ mutacja w obie strony), albo czerwony kontrakt z briefem · trzy bloki z `numTotalTests`
i porównaniem · `df -h /` przed i po. **Commit po `R3`** (a jeżeli robisz to modułami —
commit po każdym module; wtedy pięć commitów).

---

## R4 — ORZECZENIE PER WIERSZ: CO DOKŁADNIE BRAKUJE

Tabela **16 wierszy**, cztery kolumny: moduł · kubełek · **co zostało udowodnione**
(z nazwą przypadku i ścieżką artefaktu) · **czego dokładnie brakuje, żeby wiersz się
podniósł** · **kto to zrobi** (maszyna / właściciel / osobne zlecenie).

★★ **Zdanie „przelot właściciela pozostaje wymagany", powtórzone szesnaście razy, NIE JEST
orzeczeniem.** Wymagam konkretu, na przykład: *„brakuje pary izolacyjnej dla istniejącego
obiektu `X` na trasie `Y`; test do napisania, mutacja w `plik:linia`"* albo *„brakuje
wyłącznie oczu właściciela na realnym rekordzie `Z` — wszystko maszynowe zamknięte, dowód
w `evidence/g19/day353/…`"*.

**Wymagany dowód:** `evidence/g19/day353/r4-orzeczenie.md` · liczby zbiorcze: ile wierszy
domkniętych maszynowo, ile czeka wyłącznie na właściciela, ile ma realną lukę.
**Commit po `R4`.**

---

## R5 — PODNIESIENIE WIERSZY + ★★★ PYTANIE O KOTWICĘ

### Część A — podniesienie

1. Dla **każdego** wiersza uznanego w `R4` za domknięty maszynowo — gotowy tekst wiersza,
   który **nazywa zakres dowodu i jego granicę** i **nie jest** `PASS` ani synonimem
   odrzuconego wariantu (`R0`, zasada 2).
2. **Wpis i dowód idą JEDNYM commitem** (`R0`, zasada 1).
3. **Policz: ile wierszy podniosłeś, ile dowodów załączyłeś. Te dwie liczby mają być
   równe** — albo wyjaśniasz, dlaczego jeden dowód uzasadnia więcej niż jeden wiersz,
   pokazując, że mianownik tych wierszy jest **dosłownie tym samym zbiorem plików**
   (to jest dokładnie pytanie `01` vs `08` z `R2`).
4. **Zero podniesionych wierszy też jest wynikiem** — wtedy raport zawiera zdanie
   *„zero wierszy podniesionych, bo …"* z konkretnym powodem **per kubełek**. Dyżur 335 tak
   zrobił i miał rację. Powtórzenie tego z lepszym uzasadnieniem i świeższym pomiarem
   jest pełnowartościowe. Powtórzenie tego **bez** wykonania `R2` i `R3` nie jest.

### Część B — ★★★ pytanie, którego dwa dyżury nie postawiły

Sformułuj i zapisz **pytanie rozstrzygalne do właściciela** (albo **propozycję reguły**),
w brzmieniu własnym, wokół faktu:

> **Mianownik `G19` rośnie z każdą naszą pracą.** Wiersz macierzy mówi „`49` plików
> od kotwicy `316bce9dd9`". Pomiar 335 dał `104` pliki. Pomiar 348, jeden dzień później,
> dał `106`. Dystans od tej samej kotwicy do dzisiejszego markera to `1216` commitów
> (albo `1015`, albo `315` — zależnie od jednej flagi; liczba `615` z raportu 348 nie jest
> odtwarzalna). **Każdy dowód, który złożysz dzisiaj, jest dowodem na stan sprzed
> następnego scalenia.** Przy tej konstrukcji bramka `G19` nie domknie się **nigdy**,
> niezależnie od jakości pracy.

Pytanie ma być **rozstrzygalne** — czyli mieć postać wyboru z wypisanymi konsekwencjami,
nie postać „co robimy?". Naszkicuj co najmniej trzy warianty kotwicy i przy każdym napisz,
co się dzieje z bramką i ile pracy kosztuje:

- **kotwica zamrożona** (dowód wiąże się z konkretnym SHA i wygasa przy następnym odbiorze),
- **kotwica krocząca z progiem** (`G19` domknięty, dopóki dryf od ostatniego dowodu nie
  przekroczy `N` plików współdzielonych),
- **kotwica per warstwa** (osobny dowód dla warstwy współdzielonej i osobny dla modułu),
- ewentualny czwarty wariant, jeżeli zobaczysz lepszy.

★★★ **NIE ROZSTRZYGASZ TEGO SAM.** Nie wybierasz wariantu, nie wpisujesz go do macierzy,
nie zmieniasz definicji bramki. Produkt tej części to **jedna strona tekstu w raporcie,
zakończona pytaniem**, na które właściciel odpowiada jednym słowem.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód" · dwie zgodne liczby · sekcja „Pytanie o kotwicę" z co najmniej trzema
wariantami i konsekwencjami. **Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY353_G19_WZNOWIENIE_REPORT.md` zawiera, w tej kolejności:

1. **Co odziedziczyłeś i co z tego potwierdziłeś** — tabela z `R1`, para kolumn.
2. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, wprost.
3. Orzeczenie `R2` dla `01` i `08`.
4. Wyniki `R3` per moduł, z `numTotalTests` i wynikiem mutacji.
5. Tabelę `R4` (16 wierszy).
6. Wynik `R5` część A: ile wierszy, ile dowodów.
7. **Sekcję „Pytanie o kotwicę"** (`R5` część B).
8. Co zostało niewykonane i dlaczego — imiennie.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` o **pierwszej wolnej literze**.
Sekcje idą dziś do `Q`, ale równolegle dopisuje inny autor — **literę sprawdzasz komendą
tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`,
nigdy z góry.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `R1` potwierdził albo obalił każdą z jedenastu liczb tabeli `B.3`, imiennie, i wydał
   jawne zdanie o liczbie `615`.
2. `R2` dał parę `404`/`200` na **tym samym `userId`**, z niepustym ciałem odpowiedzi
   właściciela, mutację w obie strony i **pusty `git diff`** — oraz **pisemne orzeczenie
   dla `01` i `08`**.
3. `R3` dla **każdego** z pięciu modułów `A` dał albo dowód z mutacją celującą
   w zabezpieczenie, albo czerwony z założenia kontrakt w `tests/` z briefem.
4. Trzy bloki odtworzone na własnej bazie z `numTotalTests`, porównane z dziedziczonymi.
5. `R4` ma 16 wierszy i **ani jeden** nie brzmi „przelot właściciela pozostaje wymagany"
   bez konkretu.
6. Każdy commit dotykający macierzy niesie dowód w **tym samym** `git show --stat`.
7. Żaden wiersz nie brzmi `PASS` ani synonimem odrzuconego `TECHNICAL_REGRESSION_PASS`.
8. Sekcja „Pytanie o kotwicę" istnieje, ma ≥3 warianty z konsekwencjami i **nie rozstrzyga**.
9. Liście słowników i cztery bramki identyczne przed i po; `git diff` na kodzie produktu pusty.
10. Kontener usunięty, `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6412`, `5552`) jest zajęty — **STOP całości, nigdy podmiana**;
- `PUNKT-WZNOWIENIA.md` albo którykolwiek artefakt `evidence/g19/day348-artefakty/**` **nie
  istnieje** — wtedy podstawa tego dyżuru zniknęła i trzeba to zgłosić, a nie mierzyć od zera;
- migracje nie przechodzą dwukrotnie na czystej bazie;
- mutacja `day307` **nie czerwieni** testu w żadnym z dwóch miejsc (kontroler, serwis) —
  to znaczy, że zabezpieczenia nie ma, i jest to znalezisko `P0`, nie powód do improwizacji;
- realizacja `R5` wymagałaby wpisania stanu, który jest synonimem `PASS`.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „wznów, nie powtarzaj" × „każdą liczbę mierzysz sam (`Z24`)" | `R1` — mierzysz **tanie** liczby (odczyt artefaktów, `git rev-list`), a **drogie** (przeloty, migracje) robisz w `R2`/`R3` na własnej bazie, bo tam i tak są potrzebne |
| „podnieś wiersze" × „zakaz `PASS` i synonimów" | `R0` zasada 2 + `R5` — stan wiersza nazywa **zakres i granicę** dowodu |
| „dowód w tym samym commicie" × „commit po każdej pozycji `R`" | `R0` zasada 1 — pozycje `R1`–`R4` nie dotykają macierzy, więc kolizji nie ma; macierzy dotyka wyłącznie `R5` |
| „`08` w kubełku `A`" × „identyczność mianownika nie jest podstawą" | `R2` punkt 5 — orzekasz na **zbiorze plików**, nie na liczbie |
| „mianownik `49` w macierzy" × „`106` w pomiarze dryfu" | **NIE naprawiasz przez nadpisanie liczby** — to jest treść pytania z `R5` część B |
| „`615` commitów" × trzy moje liczby | `R1` punkt 3 — rozstrzygasz i zapisujesz; „nieodtwarzalne" jest dopuszczalną odpowiedzią |
| „wariant Bloku 2 `225/224/1`" × „`218/218/0`" | Odrzucony jako zły mianownik — **nie wracasz do niego** |
| „zakaz zmiany kodu produktu" × „mutacja w `TaskController.ts`" | `B.1` — mutacja jest **tymczasowa**, po `cp`, przywracana przez `cp`, z pustym `git diff` na końcu |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — ta instrukcja daje **jawną licencję** na `evidence/g19/day353/**` |
| „zero wierszy to też wynik" × „`R2`/`R3` są rdzeniem" | `R5` punkt 4 — zero wierszy jest wynikiem **po** wykonaniu `R2` i `R3`, nigdy zamiast nich |
| „pytanie do właściciela" × „mandat decydowania" | `R5` część B — kotwica bramki odbioru jest **regułą programu**, nie decyzją wykonawczą; opisujesz, nie rozstrzygasz |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone `ls`-em na markerze `29fcbd4de2`; zero `BRAK`. Oznaczone `NOWY`: `evidence/g19/day353/**`, raport, ewentualne kontrakty w `tests/` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; **dwie liczby ze zlecenia obalone własnym pomiarem** (`615` nieodtwarzalne, liście `35199/33066` zamiast `35198/33065`) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (zdanie · brief · wskazanie · wynik przelotu) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; mutacja siedzi w ciele jednej funkcji, `ApiGateway` nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4`; porty `6412`/`5552` zmierzone jako wolne, kontener, worktree i gałąź nie istnieją. ★ 355–358 pisze równolegle inny autor — `Z7` zaostrzony: port zajęty = STOP całości |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (sześć) | TAK — `§0.2d` w części A + sześć pułapek tego dyżuru w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 335 i 348 ma SHA commita albo ścieżkę artefaktu w repo |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
