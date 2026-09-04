## Po co ten dyżur istnieje

Bramka `G20` („Final 16/16 replay") ma szesnaście wierszy i **wszystkie szesnaście stoi na
`NOT_STARTED`, z myślnikiem w kolumnie dowodu**. To jest jedyna bramka programu, do której
nikt nigdy nie podszedł. Nie dlatego, że się nie da — dlatego, że nie zaczęto.

Jeden z siedmiu warunków bramy wejściowej `G20` („Zero open P0/P1 across all registers")
jest od 04.09 mierzony maszynowo: `scripts/dev/p0p1-licznik-e1.mjs`, wołany z CI jako
`npm run check:p0p1-e1`, z naprawionym `fetch-depth: 0` w `.github/workflows/test-suite.yml`.
Ten licznik ma dziś **zamkniętą dziurę**, przez którą dyżur 334 zamknął trzy pozycje
commitem sprzed powstania defektu:

- `gitShaState()` (`scripts/dev/p0p1-licznik-e1.mjs`, okolice wiersza `272`) porównuje datę
  commita z **datą zgłoszenia** i zwraca `SHA_STARSZY_NIZ_ZGLOSZENIE`;
- `collectReportedDates()` (okolice `120`) czyta daty zgłoszeń z repo z trzech źródeł, biorąc
  **najwcześniejszą**;
- pozycja bez daty dostaje `SHA_BRAK_DATY_ZGLOSZENIA` i **też blokuje** — brak pomiaru nie
  jest wynikiem.

Licznik mówi dziś uczciwie: **`BLOKUJE: 13`**, `exit 1`, mianownik `121`.

**Ten dyżur ma dwie robocizny i jeden opis:**

1. **Trzynaście pozycji dostaje rozstrzygnięcie OBIEKTU.** Dla każdej: albo SHA realnej
   naprawy **młodszej niż zgłoszenie i dotykającej obiektu z dowodu**, albo przeklasyfikowanie
   z numerem `DEC`, który obejmuje pozycję **imiennie**. ★ **Nie przeniesienie do innego
   kubełka.** ★ **Commit „checkpoint" nie jest dowodem naprawy.**
2. **Szesnaście wierszy `G20` zostaje wpisanych**, każdy z dowodem w tym samym commicie.
3. **Problem strukturalny zostaje opisany** i przygotowany do rozdziału — bramkę zamyka się
   dziś edytując tablicę `DAY320_RESOLUTIONS` **w tym samym pliku, który tę bramkę mierzy**.

---

## ★★ SPROSTOWANIE ZLECENIA — co mój pomiar potwierdził, a czego nie

Zlecenie, z którego powstała ta instrukcja, podało liczby stanu bramek. Sprawdziłem je
na markerze `2a7273e087` w `/private/tmp/m03`.

**POTWIERDZONE:**

| Teza zlecenia | Mój pomiar | Komenda |
| --- | --- | --- |
| `G20`: 16 × `NOT_STARTED` | **potwierdzone**, 16/16, kolumna dowodu = `—` | `(4)` z bloku weryfikacji |
| licznik daje `BLOKUJE: 13` | **potwierdzone** | `(1)` i `(2)` |
| licznik kończy się `exit 1` | **potwierdzone** — ale **wyłącznie bez potoku** | `(1)` |
| `G19`: 16 × `NOT_PROVEN / OWNER_RETEST_PENDING` | **potwierdzone** | `(6)` |
| `G16`: 16 × `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` | **potwierdzone** | własny `grep` |
| `ASM-OWN-003` / `ASM-OWN-003[OF]` — sprzeczność naprawiona, naprawa się utrzymała | **potwierdzone**: obie `ODLOZONE_DEC` na `DEC-2026-09-03-364`; ledger mówi „PO BRAMKACH (fala 2)" | `(2)` + `OWNER_DECISION_LEDGER_2026-08-24.md:416` |
| `MYW-CV-REC-001` ma `FALA_4_OWNER_DECISION` i wymaga świeżego zrzutu | **potwierdzone** — `07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:163` i `:228` | własny `grep` |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** | `(8)` |

**DOPRECYZOWANE PRZEZ MÓJ POMIAR — czego zlecenie nie powiedziało:**

- ★ **Mianownik licznika to `121`**, rozkład: `NAPRAWIONE 32` · `ZAMKNIETE_DEC 34` ·
  `ODLOZONE_DEC 42` · `W_BUDOWIE 0` · `BLOKUJE 13`. Suma się zgadza. **Ta liczba jest Twoim
  bezpiecznikiem przed „naprawą przez skurczenie mianownika"** — sprawdzasz ją przed i po.
- ★ **`| tail` połyka kod wyjścia licznika.** Mój pierwszy pomiar dał `EXIT=0` przy trzynastu
  blokerach, bo puściłem wynik przez potok. Powtórzyłem bez potoku i dostałem `1`. Zapisuję to
  jako pułapkę nr 7, bo dokładnie tak wygląda fałszywe „bramka zielona".
- ★ **Brama wejściowa `G20` ma SIEDEM warunków** (`FINAL_16_MODULE_REPLAY.md`, sekcja
  „Entry gate") i **żaden nie jest odhaczony**. Jeden z nich brzmi „All shared-component
  regression obligations are closed" — to jest `G19`, który stoi `NOT_PROVEN` w 16/16.
  **Wniosek, który musisz przyjąć na wejściu: `G20` nie może dziś brzmieć jak zaliczenie,
  i to nie jest Twoja porażka — to jest stan.**

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Wykonaj blok `(1)`–`(8)` z sekcji „Weryfikacja stanu wejściowego" w części A **w całości**
i zapisz wyniki obok moich w `evidence/g20/day359/r1-porownanie-liczb.md`. To jest tanie
(sam odczyt i jedno uruchomienie licznika) i jest warunkiem wejścia do `R2`.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA

★ Licencja obejmuje **całą ścieżkę**, żebyś nie musiał wybierać między złamaniem licencji
a zrobieniem połowy roboty.

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **dane licznika** | `scripts/dev/p0p1-licznik-e1.mjs` — **wyłącznie** tablica `DAY320_RESOLUTIONS` (okolice wierszy `28`–`90`) | **★ WĄSKA — ZAPIS tylko wpisów dla pozycji rozstrzygniętych w `R2`.** Wpis ma jeden z trzech kształtów: `{ type: 'SHA', sha: '<10 znaków>' }`, `{ type: 'DECISION', decision: 'DEC-…' }`, `{ type: 'UNRESOLVED', detail: '<powód>' }`. **Zakaz zmiany czegokolwiek poza tą tablicą** | zmieniony wpis + dowód w jednym commicie |
| **bezpieczniki licznika** | te same pliki, funkcje `gitShaState`, `collectReportedDates`, `reportedDateFor`, `expandIds`, `collectUniverse`, `evaluateCorpus`, `renderRegister`, `gateResult`, `isDeferredDecision`, stała `DEFAULT_FLOOR` | **★ NIETYKALNE DO ZAPISU.** Wolno czytać i wołać | cytat `plik:linia` w raporcie |
| **test licznika** | `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | **NIETYKALNY DO ZAPISU** — uruchamiasz przed pierwszym i po ostatnim commicie, oba wyniki do raportu | dwa `exit` |
| **rejestr generowany** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | **zapis WYŁĄCZNIE przez uruchomienie licznika.** ★ Ręczna edycja tego pliku unieważnia dyżur | plik po ostatnim uruchomieniu |
| **źródła korpusu (odczyt)** | `ROZLICZENIE_P0P1_20260903.md`, `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`, `docs/program/FALA_2_PO_STAGINGU.md`, `OWNER_DECISION_LEDGER_2026-08-24.md` | **★ TYLKO ODCZYT.** Dopisanie ID do cudzej rodziny decyzji, żeby odziedziczyło `DEC`, jest fałszerstwem dowodu | cytat wiersza w raporcie |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G20`**, wyłącznie commitem, który w tym samym `git show --stat` niesie plik dowodowy. `G15`, `G16`, `G18`, `G19` — **nietykalne** | 16 wierszy + dowody |
| **brama wejściowa** | `docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md` | **TYLKO ODCZYT w `R1`–`R4`.** ★ W `R4` wolno Ci **odhaczyć wyłącznie te pozycje „Entry gate", dla których masz dowód w tym samym commicie** — i żadnej innej; `Status: NOT_READY` i `Final product SHA: UNSET` zostają nietknięte | odhaczone pozycje z dowodem albo brak zmian |
| **archeologia gita** | całe repo, `git log`, `git show`, `git blame` | **odczyt bez ograniczeń** | tabela `R2` |
| **dowody** | `evidence/g20/day359/**` (**NOWY** katalog) | **zapis, `git add -f`** — ta instrukcja daje jawną licencję na logi i `*.json`; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie logi i tabele |
| **diff nienałożony** | `evidence/g20/day359/r5-rozdzial-danych.patch` | **zapis** — plik `*.patch`, **NIE nakładasz go** | patch + opis |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY359_G20_ZAMKNIECIE_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji, litera `AA`** (weryfikowana komendą tuż przed commitem). Zakaz kasowania i przeredagowywania sekcji zastanych, zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU.** Znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **workflow CI** | `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — w szczególności zakaz dopisania `--informational` do `check:p0p1-e1` | brak zmian |
| **bramki i harness** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz, nie wykonujesz | — | — | — |
| `R1` | odtworzenie migawki licznika, mianownika `121` i listy 13 pozycji | TAK | TAK — jedno uruchomienie + odczyt | **TAK** |
| `R2` | archeologia OBIEKTU dla każdej z 13 pozycji; rozstrzygnięcie `A`/`B`/`C` | TAK | TAK — `git log`/`git show` per pozycja | **TAK** |
| `R3` | wpisanie rozstrzygnięć do `DAY320_RESOLUTIONS` | TAK | TAK — jedna tablica danych | **TAK ×13** |
| `R4` | 16 wierszy `G20` z dowodem w tym samym commicie | TAK | TAK — dokument | **TAK** |
| `R5` | opis problemu strukturalnego + **diff nienałożony** rozdziału | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R3` po każdej z 13 pozycji z osobna.** Pozycja bez
commita jest pozycją niewykonaną.

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pozycje `BLOKUJE` | `13` | `(2)` | TAK |
| 2 | mianownik korpusu | `121` | `(1)` | TAK — **identyczny przed i po** |
| 3 | rozkład werdyktów | `32` / `34` / `42` / `0` / `13` | `(1)` | TAK — suma `121` |
| 4 | kod wyjścia licznika na wejściu | `1` | `(1)`, **bez potoku** | TAK |
| 5 | test licznika na wejściu | `exit 0` | `(3)` | TAK |
| 6 | wiersze `G20` na `NOT_STARTED` | `16` | `(4)` | TAK |
| 7 | pozycje „Entry gate" odhaczone | `0` z `7` | `(5)` | TAK |
| 8 | wiersze `G19` na `NOT_PROVEN` | `16` | `(6)` | TAK — **strukturalny sufit `G20`** |
| 9 | pozycji rozstrzygniętych / dowodów załączonych | — | `R3`, dwa liczniki | TAK — **muszą być równe** |
| 10 | wierszy `G20` podniesionych / dowodów | — | `R4`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY359_G20_ZAMKNIECIE_REPORT.md` | `R6` | główny produkt |
| `evidence/g20/day359/**` | `R1`–`R5` | **NOWY** katalog; wszystkie logi, tabele, patch |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AA` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `scripts/dev/p0p1-licznik-e1.mjs` | gdy `R2` rozstrzygnie pozycję | **wyłącznie** wpis w `DAY320_RESOLUTIONS` |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | po każdym uruchomieniu licznika | **wyłącznie maszynowo** |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | `R4` | **wyłącznie wiersz `G20`** |
| `docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md` | gdy masz dowód dla konkretnej pozycji „Entry gate" | **wyłącznie ta pozycja**; `Status` i `Final product SHA` nietknięte |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` · `public/locales/**` · żaden wiersz macierzy poza `G20` ·
`scripts/check-*.sh` · `scripts/dev/reachability-from-root.mjs` ·
`scripts/dev/__tests__/**` · `.github/workflows/**` · pięć źródeł korpusu z `pathsFor()` ·
żaden plik dyżurów 360, 361, 362 ani 363–366.

★ Plik postępu `/private/tmp/cx-day359-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6430**, runtime **5570**, kontener **`cx-day359-pg`**, baza **`cx359`**,
worktree `/private/tmp/cx-day359-g20-zamkniecie`, gałąź `codex/day359-g20-zamkniecie-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff --cached -- scripts/dev/p0p1-licznik-e1.mjs   # ★ WYLACZNIE wpisy DAY320_RESOLUTIONS
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
node scripts/dev/p0p1-licznik-e1.mjs > /dev/null 2>&1; echo "licznik_exit=$?"
bash -c "grep -E '^Mianownik:' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md"
#   ★ mianownik MUSI dalej wynosic 121
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| **359 (Ty)** | **`G20`** | **wszystkie 16** |
| 360 | `G19` | `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| 361 | `G19` | `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| 362 | `G15` | `04`, `09`, `12`, `15` |

★ **Konflikt scalenia rozstrzyga nadzorca.** Nie próbujesz go uprzedzić, nie scalasz cudzej
gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza, nawet jeżeli
uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** Nie „dowód był w poprzednim commicie", nie „dowód jest w raporcie, który dopiszę
w `R6`". `git show --stat <commit dotykający macierzy>` musi zawierać plik z
`evidence/g20/day359/**`. Commit, który zmienia wiersz i nie niesie dowodu, **cofasz przez
`git reset --soft HEAD~1`** i składasz na nowo. **Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — `TECHNICAL_REGRESSION_PASS` został odrzucony DWA RAZY i nie wolno go wprowadzić
pod żadną nazwą.** Zakaz obejmuje każdy synonim w każdej bramce: `TECHNICAL_REPLAY_PASS`,
`MACHINE_PASS`, `TECHNICAL_PASS`, `REGRESSION_TECHNICAL_OK`, `PASS_MASZYNOWY`,
`PASS (zakres techniczny)`, `READY`, `GREEN` i każde inne sformułowanie, którego skutkiem jest
wiersz brzmiący jak zaliczenie. Stan wiersza po podniesieniu ma **nazywać zakres dowodu i jego
granicę**.

**ZASADA 3 — nie wolno „naprawiać" bramki przez nadpisanie mianownika ani zawężenie kryterium.**
Mianownik licznika to `121`. Bramka `G20` ma siedem warunków wejścia. Nie usuwasz pozycji
z korpusu, nie dopisujesz `--informational`, nie zmieniasz definicji bramki i nie zmieniasz
funkcji, która ją mierzy.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część tego dyżuru niewykonalną — to jest
wynik i zapisujesz go jako pytanie do właściciela. Nie obchodzisz ich.**

---

## R1 — ODTWORZENIE MIGAWKI (rdzeń, tani)

1. Wykonaj blok `(1)`–`(8)` w całości. Zapisz **swoje** wyniki obok moich w
   `evidence/g20/day359/r1-porownanie-liczb.md` — jedenaście wierszy tabeli `B.3`, para kolumn
   „liczba autora instrukcji / mój pomiar".
2. **Zapisz listę 13 pozycji imiennie** do `evidence/g20/day359/r1-trzynascie.md`. Ta lista
   jest Twoją listą roboczą na `R2` i `R3`.
3. Uruchom test licznika (`node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`)
   i zapisz kod wyjścia. **To jest Twoja baza porównawcza** — ten sam test uruchamiasz po
   ostatnim commicie i oba wyniki idą do raportu.
4. Przeczytaj sekcję „Entry gate" z `FINAL_16_MODULE_REPLAY.md` i **wypisz siedem warunków
   z własnym orzeczeniem: który da się dziś zmierzyć, który jest zablokowany przez inną bramkę,
   a który wymaga właściciela.** To jest szkielet `R4`.

**Wymagany dowód:** `r1-porownanie-liczb.md` (11 wierszy, dwie kolumny) · `r1-trzynascie.md`
(13 ID) · `r1-brama-wejsciowa.md` (7 warunków, orzeczenie per warunek) · log testu licznika.
**Commit po `R1`.**

---

## R2 — ARCHEOLOGIA OBIEKTU: TRZYNAŚCIE POZYCJI (rdzeń, najdłuższy)

Dla **każdej** z 13 pozycji, po kolei, wypełniasz **sześć pól**. Wynik trafia do
`evidence/g20/day359/r2-archeologia.md`.

| Pole | Skąd je bierzesz |
| --- | --- |
| **`ID`** | lista z `R1` |
| **data zgłoszenia** | `node -e "import('./scripts/dev/p0p1-licznik-e1.mjs').then(m=>console.log(m.reportedDateFor(m.collectReportedDates(), 'ID')))"` — ★ to jest **ta sama** data, którą widzi bezpiecznik |
| **OBIEKT z dowodu** | wiersz pozycji w `ROZLICZENIE_P0P1_20260903.md` i w `modules/*/MODULE_ACCEPTANCE.md`: **`plik:linia` albo trasa HTTP**. Jeżeli w dowodzie nie ma ani pliku, ani trasy — **to jest wynik**: pozycja nie ma obiektu i nie da się jej zamknąć SHA (rozstrzygnięcie `C`) |
| **kandydaci SHA** | `git log --since=<data zgłoszenia> --oneline -- <plik z obiektu>` — ★ **tylko commity dotykające OBIEKTU**, nie „cokolwiek z tego dnia" |
| **weryfikacja kandydata** | `git show --stat <sha>` musi wymienić plik z obiektu; `git show <sha> -- <plik>` musi pokazać zmianę **istotną dla treści uwagi**, nie sam re-format. Temat commita nie może zawierać słowa `checkpoint` |
| **ROZSTRZYGNIĘCIE** | `A` = SHA (wpisujesz `{ type: 'SHA', … }`) · `B` = decyzja obejmująca pozycję **imiennie** (`{ type: 'DECISION', … }`) · `C` = wymaga właściciela → **zostaje `UNRESOLVED` z powodem, a Ty formułujesz JEDNO rozstrzygalne pytanie** |

### ★★ Co jest, a co NIE JEST rozstrzygnięciem

| Kształt | Werdykt |
| --- | --- |
| SHA młodszy niż zgłoszenie, `git show --stat` wymienia plik z obiektu, zmiana dotyczy treści uwagi | **`A` — rozstrzygnięcie** |
| SHA młodszy, ale `--stat` nie wymienia pliku z obiektu | **NIE** — bezpiecznik to przepuści, odbiór nie |
| SHA z tematem „checkpoint" | **NIE** — bezpiecznik zwróci `SHA_CHECKPOINT` |
| `DEC` cytujący pozycję po `ID` albo wymieniający jej obiekt w treści | **`B` — rozstrzygnięcie** |
| `DEC` rodziny, do której dopisałeś `ID`, żeby odziedziczyło decyzję | **NIE — to jest fałszerstwo dowodu** |
| zmiana werdyktu z `BLOKUJE` na `ODLOZONE_DEC` bez `DEC` obejmującego pozycję | **NIE — to są przenosiny** |
| `UNRESOLVED` z konkretnym powodem + jedno rozstrzygalne pytanie | **`C` — pełnowartościowy wynik** |

### ★★ Pozycje, dla których znam odpowiedź z góry — sprawdź, czy mam rację

- **`MYW-CV-REC-001`** — dokument źródłowy (`07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:163`, oraz
  wiersz `228` „Fala 4") stawia jej `FALA_4_OWNER_DECISION` i **wymaga świeżego zrzutu przed
  zamknięciem**. Uwaga właściciela mówi „podgląd całkowicie niezgodny ze standardem", a kod na
  `HEAD` używa `TableWithPreviewLayout` + `StandardTable` + `PreviewMetaCard`. **To jest
  sprzeczność kod↔uwaga, którą rozstrzyga się oczami, nie `git log`-iem.** Moje orzeczenie:
  rozstrzygnięcie `C`. **Sprawdź to i podpisz się pod tym albo obal.** Zrzutu w tym dyżurze
  **nie robisz** — produktem jest pytanie.
- **`MYW-DEC-REC-001`** i **`MYWORK-DEC-OWN-001`** — **duplikat tego samego zgłoszenia**
  (`2026-08-22` i `2026-08-23`, wspólna migawka `4a36e8a745`, dowód wskazuje
  `MyWorkHub.tsx:4137`). Jedna archeologia, **dwa rozstrzygnięcia imienne**. Jeżeli znajdziesz
  SHA, obie pozycje dostają ten sam — i **piszesz wprost, że to jedna naprawa**.
- **`RES-OWN-003`** — powód blokady to „brak licencjonowanego writera i cold readbacku
  4 KPI / 3 OKR / 3 ROI z PostgreSQL". To jest **brak funkcji**, nie brak SHA. Twoje
  rozstrzygnięcie prawdopodobnie brzmi `C` — ale **zanim to napiszesz, sprawdź flagę**:
  kilka razy w tym programie „nie ma funkcji" znaczyło „funkcja jest za flagą OFF".
  Wynik zapisujesz zdaniem z `plik:linia`.
- **`MYW-CV-REC-002`**, **`RES-OWN-004`** — powody mówią „źródło opisuje stan istniejący bez SHA
  naprawy". To jest kandydat na `C`, ale **sprawdź najpierw, czy obiekt w ogóle jest nazwany**;
  pozycja bez obiektu jest osobnym gatunkiem braku i tak ją nazwij.
- **`INT-INIT-AI-OBS-001`** — „brak osiągalnego wołacza fill-section i dowodu z realnym
  providerem AI". ★ Pułapka „wołacz istnieje ≠ renderuje się": jeżeli znajdziesz wołacza,
  sprawdź, czy komponent jest **osiągalny od korzenia** (`scripts/dev/reachability-from-root.mjs`),
  zanim napiszesz, że funkcja żyje.

### ★★ Czego NIE robisz w `R2`

Nie piszesz kodu produktu. Nie stawiasz kontenera, chyba że rozstrzygnięcie konkretnej pozycji
wymaga pomiaru runtime — a wtedy **mierzysz i zapisujesz wynik, nie naprawiasz**.

**Wymagany dowód:** `evidence/g20/day359/r2-archeologia.md` — **13 wierszy, sześć pól każdy**,
plus licznik zbiorczy: ile `A`, ile `B`, ile `C`. **Commit po `R2`.**

---

## R3 — WPISANIE ROZSTRZYGNIĘĆ (rdzeń, commit ×13)

Dla każdej pozycji z rozstrzygnięciem `A` lub `B` zmieniasz **jeden wpis** w
`DAY320_RESOLUTIONS`. Dla `C` zostawiasz `UNRESOLVED`, ale **poprawiasz pole `detail`**, tak
żeby zawierało powód i wskazanie, kto to rozstrzyga.

**Procedura, po każdej pojedynczej pozycji:**

```bash
# 1. zmiana JEDNEGO wpisu w DAY320_RESOLUTIONS
# 2. uruchomienie licznika BEZ POTOKU
node scripts/dev/p0p1-licznik-e1.mjs > /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-<ID>.out 2>&1
echo "licznik_exit=$?"
# 3. mianownik MUSI dalej byc 121
bash -c "grep -E '^Mianownik:' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md"
# 4. werdykt TEJ pozycji ma sie zmienic i zadnej innej
bash -c "grep -E '^\| .<ID>. \|' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md"
# 5. test licznika dalej zielony
node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs >/dev/null 2>&1; echo "test_exit=$?"
# 6. commit: wpis + wygenerowany rejestr + plik dowodowy z evidence/g20/day359/
```

★★ **Dowód dla pozycji to plik**, nie zdanie w commit-message:
`evidence/g20/day359/pozycje/<ID>.md` z: datą zgłoszenia, obiektem, kandydatami, wybranym SHA
lub DEC, wynikiem `git show --stat` i stanem werdyktu przed i po.

★★ **KONTROLA WSTECZNA po ostatniej pozycji** — obowiązkowa:

```bash
# zaden inny werdykt nie mogl sie zmienic przy okazji
bash -c "diff <(grep -oE '^\| .[A-Z][A-Z0-9-]*-[0-9]{3}(\[OF\])?. \| [A-Z_]+' /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-wejscie.out) <(grep -oE '^\| .[A-Z][A-Z0-9-]*-[0-9]{3}(\[OF\])?. \| [A-Z_]+' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md)"
#   oczekiwane: WYLACZNIE linie pozycji, ktore rozstrzygnales. Kazda inna zmiana = cofasz.
```

★ **Dowód mutacyjny bezpiecznika** (jeden raz, na koniec `R3`): weź **jedną** pozycję zamkniętą
przez Ciebie SHA, podmień w kopii poza repo ten SHA na commit **starszy niż zgłoszenie**
i pokaż, że licznik daje dla niej `SHA_STARSZY_NIZ_ZGLOSZENIE` i wraca do `BLOKUJE`. Przywracasz
przez `cp` (**nigdy `git stash`**, `Z27`), `git diff` po przywróceniu **pusty**.
★ Mutacja ma celować w **zabezpieczenie** (warunek wieku commita), nie w mechanizm odczytu
tabeli — jeżeli licznik czerwienieje z innego powodu, mutacja chybiła i przecelowujesz ją.

**Wymagany dowód:** 13 plików `evidence/g20/day359/pozycje/<ID>.md` · 13 commitów ·
log kontroli wstecznej · dowód mutacyjny bezpiecznika w obie strony z pustym `git diff` ·
**dwie zgodne liczby: ile pozycji rozstrzygniętych / ile dowodów załączonych**.

---

## R4 — SZESNAŚCIE WIERSZY `G20` (rdzeń)

**Dziś każdy wiersz brzmi `NOT_STARTED` i ma `—` w kolumnie dowodu. To znaczy: nikt tego nawet
nie zaczął.** Twoim produktem jest wiersz, który **mówi prawdę o tym, co zmierzono i co
blokuje** — dla każdego z 16 modułów.

1. Ułóż brzmienie stanu, które **nazywa zakres i granicę**. Przykład kształtu (nie kopiuj
   bezmyślnie, dopasuj do swojego pomiaru):
   `ENTRY_GATE_MEASURED / BLOCKED_BY_G19` z kolumną dowodu wymieniającą: ile z siedmiu
   warunków bramy wejściowej zmierzono, który warunek blokuje, i ścieżkę artefaktu.
   ★ **Zakaz `PASS` i każdego synonimu** (`R0`, zasada 2).
2. **Kolumna dowodu nie może brzmieć `—` ani „przelot właściciela pozostaje wymagany".**
   Wymagam konkretu: *„brama wejściowa zmierzona 04.09 na `2a7273e087`: 2 z 7 warunków
   spełnione (`G18` = akcept z SHA; P0/P1 = `BLOKUJE: N`), warunek „shared-component regression
   obligations" zablokowany przez `G19` = `NOT_PROVEN`; dowód `evidence/g20/day359/r4-<moduł>.md`"*.
3. **Wpis i dowód idą JEDNYM commitem** (`R0`, zasada 1). Wolno zrobić jeden commit na wszystkie
   16 wierszy, pod warunkiem że ten sam commit niesie 16 (albo jeden zbiorczy) plik dowodowy.
4. **Policz: ile wierszy zmieniłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe** —
   albo wyjaśniasz, dlaczego jeden dowód uzasadnia więcej niż jeden wiersz, pokazując, że
   podstawa tych wierszy jest **dosłownie tym samym zbiorem faktów** (dla `G20` to jest
   prawdopodobne — brama wejściowa jest wspólna — ale **musisz to napisać, nie założyć**).
5. **Zero zmienionych wierszy też jest wynikiem** — ale tylko wtedy, gdy `R1`–`R3` są wykonane
   i raport mówi imiennie, dlaczego stan `NOT_STARTED` jest **prawdziwszy** niż jakikolwiek
   inny. Wtedy piszesz to zdanie wprost.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód" (16 wierszy) · dwie zgodne liczby. **Commit po `R4`.**

---

## R5 — PROBLEM STRUKTURALNY: MIERNIK I TABLICA W JEDNYM PLIKU (rdzeń, opis + patch)

**Fakt do opisania:** bramkę `G20` zamyka się dziś edytując tablicę `DAY320_RESOLUTIONS`
**w tym samym pliku, który tę bramkę mierzy** (`scripts/dev/p0p1-licznik-e1.mjs`). Ktokolwiek
ma licencję na „zamknięcie pozycji", ma jednocześnie edytor otwarty na funkcji `gitShaState`.
Propozycja rozdziału leży w
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/NAPRAWA_DYZUR_334_20260904.md` (sekcja o danych
out-of-code, okolice wiersza `211`).

**Produkt tej pozycji — trzy rzeczy:**

1. **Opis ryzyka** w raporcie: co konkretnie może pójść źle, z cytatem `plik:linia`, i które
   z dzisiejszych bezpieczników by tego **nie** złapały.
2. **`evidence/g20/day359/r5-rozdzial-danych.patch`** — **diff NIENAŁOŻONY**, który wynosi
   `DAY320_RESOLUTIONS` do osobnego pliku danych (`scripts/dev/data/day320-resolutions.json`
   albo `.mjs` — uzasadnij wybór) i zostawia w liczniku sam odczyt.
3. **Warunek przyjęcia tego patcha**, wypisany imiennie, żeby następny dyżur nie musiał go
   wymyślać: (a) `REJESTR_P0P1_BLOKUJACE_G20.md` po nałożeniu jest **bajt w bajt identyczny**;
   (b) `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` pozostaje zielony **bez zmian w teście**;
   (c) dochodzi nowy test dowodzący, że licznik **czyta plik danych**, a nie ma go zaszytego —
   z dowodem mutacyjnym (usuń wpis z pliku danych → werdykt pozycji się zmienia).

★★ **NIE NAKŁADASZ tego patcha.** Licencja tego dyżuru obejmuje wyłącznie tablicę danych
w istniejącym pliku. Rozdział jest decyzją nadzorcy, a nie skutkiem ubocznym zamykania bramki.

**Wymagany dowód:** sekcja w raporcie · plik `*.patch` w `evidence/` · trzy warunki przyjęcia.
**Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY359_G20_ZAMKNIECIE_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, wprost, na
   początku.
2. Tabelę `R1`: 11 mianowników, para kolumn.
3. Siedem warunków bramy wejściowej `G20` z orzeczeniem per warunek.
4. **Tabelę `R2`: 13 pozycji × 6 pól**, z licznikiem `A`/`B`/`C`.
5. Wynik `R3`: ile pozycji rozstrzygniętych, ile dowodów, kod wyjścia licznika **przed i po**,
   mianownik **przed i po**, wynik kontroli wstecznej, dowód mutacyjny bezpiecznika.
6. Tabelę `R4`: 16 wierszy `G20`, „wiersz → dowód".
7. Sekcję `R5`: problem strukturalny + warunki przyjęcia patcha.
8. **Pytania do właściciela** — po jednym, **rozstrzygalnym**, na każdą pozycję `C`. Pytanie
   rozstrzygalne ma postać wyboru z wypisanymi konsekwencjami, nie „co robimy?".
9. Co zostało niewykonane i dlaczego — imiennie.
10. `df -h /` przed i po.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AA`**. Sprawdzasz ją
komendą **tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`, a litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AA` okaże się zajęta, bierzesz pierwszą wolną dwuliterową i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `node scripts/dev/p0p1-licznik-e1.mjs` (bez potoku) kończy się **`exit 0`** — **albo**
   raport wyjaśnia **imiennie**, które pozycje wymagają decyzji właściciela, z **jednym
   rozstrzygalnym pytaniem na pozycję**.
2. Każda z 13 pozycji ma w `r2-archeologia.md` wypełnione **sześć pól** i jawne rozstrzygnięcie
   `A`/`B`/`C`.
3. Każda pozycja rozstrzygnięta ma **własny commit** niosący plik dowodowy w tym samym
   `git show --stat`.
4. **Mianownik korpusu po dyżurze wynosi `121`**, a kontrola wsteczna pokazuje zmianę werdyktu
   **wyłącznie** dla pozycji, które rozstrzygnąłeś.
5. `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` zielony przed i po; **żadna funkcja
   bezpiecznika nie została zmieniona** (`git diff` na liczniku pokazuje wyłącznie
   `DAY320_RESOLUTIONS`).
6. Dowód mutacyjny bezpiecznika wykonany w obie strony, `git diff` po przywróceniu pusty.
7. Szesnaście wierszy `G20` zmienionych albo jawnie i imiennie uzasadnionych jako pozostawione;
   **ani jeden nie brzmi `PASS` ani synonimem**, ani nie ma `—` w kolumnie dowodu bez powodu.
8. `MYW-CV-REC-001` **nie została zamknięta samym SHA**.
9. `R5` ma opis, patch **nienałożony** i trzy warunki przyjęcia.
10. Liście słowników i cztery bramki identyczne przed i po; `git diff` na kodzie produktu pusty;
    kontener (jeżeli powstał) usunięty; `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6430`, `5570`) jest zajęty — **STOP całości, nigdy podmiana**;
- `scripts/dev/p0p1-licznik-e1.mjs` albo jego test **nie istnieje** na markerze — wtedy zniknęła
  podstawa tego dyżuru i trzeba to zgłosić, a nie mierzyć inaczej;
- licznik na wejściu daje mianownik inny niż `121` — **to nie jest powód do improwizacji**,
  tylko do zapisania rozbieżności i przejścia dalej na SWOICH liczbach; STOP dopiero wtedy, gdy
  licznik w ogóle nie startuje albo mianownik jest **mniejszy niż `100`** (`DEFAULT_FLOOR`);
- realizacja `R4` wymagałaby wpisania stanu, który jest synonimem `PASS`;
- rozstrzygnięcie którejkolwiek pozycji wymagałoby zmiany funkcji bezpiecznika.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „doprowadź licznik do `exit 0`" × „zakaz zmiany narzędzia, które mierzy" | `R3` — zmieniasz **dane** (`DAY320_RESOLUTIONS`), nigdy logikę; `exit 0` osiągalne wyłącznie przez rozstrzygnięcie obiektów |
| „doprowadź do `exit 0`" × „nie zamykaj bez dowodu" | Próg odbioru punkt 1 — `exit 0` **albo** imienne wyjaśnienie z pytaniem na pozycję; obie odpowiedzi pełnowartościowe |
| „wpisz 16 wierszy `G20`" × „zakaz `PASS`" | `R4` punkt 1 — stan nazywa **zakres i granicę**; `G19` = `NOT_PROVEN` jest strukturalnym sufitem i wolno go nazwać |
| „bezpiecznik sprawdza wiek" × „musi dotykać obiektu" | `R2` — bezpiecznik nie sprawdza obiektu; **obiekt jest Twoją robotą** i wchodzi do dowodu |
| „decyzja rodziny dziedziczy się mechanicznie" × „`DEC` ma obejmować pozycję imiennie" | `R2`, tabela „co jest rozstrzygnięciem" — dziedziczenie to udogodnienie odczytu, nie licencja na dopisanie `ID` do cudzej rodziny |
| „`MYW-DEC-REC-001` i `MYWORK-DEC-OWN-001` to duplikat" × „każda pozycja osobno" | `R2` — jedna archeologia, **dwa rozstrzygnięcia imienne**, jawnie nazwane jako jedna naprawa |
| „commit po każdej pozycji" × „dowód w tym samym commicie" | `R3` — dowód pozycji to **plik** w `evidence/g20/day359/pozycje/`, więc obie reguły spełnia ten sam commit |
| „opisz problem strukturalny" × „zakaz zmiany miernika" | `R5` — produktem jest **diff nienałożony** plus warunki przyjęcia; nakładanie to decyzja nadzorcy |
| „`RES-OWN-003` brak writera" × „zakaz zmiany kodu produktu" | `R2` — mierzysz i zapisujesz `plik:linia`, nie budujesz writera; brak funkcji jest wynikiem |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g20/day359/**` |
| „mandat decydowania" × „pytanie do właściciela" | `R6` punkt 8 — pozycje `A`/`B` rozstrzygasz sam; `C` to obiekty, które wymagają oczu albo decyzji produktowej, i te idą do właściciela |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na markerze `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `evidence/g20/day359/**`, raport, sekcja `AA` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; wszystkie uruchomione 04.09 na `2a7273e087` |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (cytat · orzeczenie · wynik) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; `R3` dotyka jednej tablicy danych, `R4` szesnastu niezależnych plików macierzy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec pozostałych trzech dyżurów paczki); `6430`/`5570` zmierzone jako wolne, kontener, worktree i gałąź nie istnieją. ★ 363–366 pisze równolegle inny autor — `Z7` zaostrzony: port zajęty = STOP całości |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, kod wyjścia licznika mierzony **bez potoku** |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat ma `plik:linia` albo ścieżkę artefaktu w repo |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
