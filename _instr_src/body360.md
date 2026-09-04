## Po co ten dyżur istnieje

Bramka `G19` („Later-change regression obligations resolved") stoi na
`NOT_PROVEN / OWNER_RETEST_PENDING` we **wszystkich szesnastu** modułach. Podchodziły do niej
trzy dyżury: **335** („zero wierszy podniesionych, i to jest wynik"), **348** (zatrzymany
w połowie) i **353** (złożył jeden dowód, orzekł per wiersz i **postawił pytanie o kotwicę**).

Pytanie brzmiało: *na czym ma stać dowód `G19`, skoro mianownik rośnie z każdą naszą pracą?*
Właściciel oddał decyzję CTO. **04.09 zapadła `DEC-392`** i jest zapisana w repo, w sekcji `R`
pliku `docs/program/REJESTR_ZNALEZISK_20260903.md`:

> **Kotwica `G19` jest RUCHOMA.** Wiersz przechodzi na podstawie pomiaru wykonanego na
> **markerze odbioru**, a nie na historycznym punkcie. Wpis niesie **datę i SHA pomiaru**.
> Po **7 dniach** wiersz sam wygasa do **`PASS_STALE`** i wymaga powtórzenia.
>
> **Czego ta decyzja NIE robi:** nie obniża progu i nie zamyka ani jednego wiersza z góry.
> Wiersz nadal zmienia stan **wyłącznie z dowodem załączonym w tym samym commicie**,
> a `TECHNICAL_REGRESSION_PASS` pozostaje odrzucony.

★★★ **Decyzja bez maszyny jest zdaniem w rejestrze, nie regułą.** Dopóki nikt nie policzy wieku
dowodu, `PASS_STALE` nigdy się nie pojawi — a wtedy `DEC-392` daje dokładnie to, przed czym
sama ostrzega: wiersz, który wygląda na zamknięty i nie woła o siebie. **Dlatego `R1` tego
dyżuru buduje bezpiecznik ważności, i dopiero po nim wolno Ci podnieść pierwszy wiersz.**

**Zakres roboczy: siedem modułów kubełka `A`** — `01_ORGANIZATION`, `04_ASSESSMENT`,
`05_INITIATIVES`, `06_EXECUTION`, `08_MEETINGS`, `11_MATERIALS`, `13_CHAT`.
Dziewięć modułów kubełka `C` idzie **równolegle** dyżurem 361 i **nie dotykasz ich ani razu**.

---

## ★ Co jest ZROBIONE i ZWERYFIKOWANE — NIE POWTARZASZ

| Pozycja | Stan | Wynik, który dziedziczysz |
| --- | --- | --- |
| Przemiar dryfu | **ZROBIONY** (dyżury 335, 348, 353) | **106 plików** na ścieżkach mierzonych przez `G19`, **90 bez testów**. ★★★ **CZWARTE liczenie jest zakazane** |
| Kubełki `A`/`B`/`C` | **ZROBIONE** (`evidence/g19/day353/r4-orzeczenie.md`) | `A = 01, 04, 05, 06, 08, 11, 13` (**7**) · `B = 0` · `C = 02, 03, 07, 09, 10, 12, 14, 15, 16` (**9**) |
| Wzorzec dowodu (`day307`) | **WYKONANY I ORZECZONY** | obcy `404` / 64 B, właściciel `200` / 243 B na tym samym `userId`; usunięcie filtra organizacji daje **dokładnie `200` zamiast `404`**; `git diff` po przywróceniu pusty. Ślad: `evidence/g19/day353/r2-day307-orzeczenie.md` |
| Orzeczenie: czy `day307` zamyka `08_MEETINGS` | **ORZECZONE: NIE** | `R2` dyżuru 353 wykazał, że `day307` **nie wykonuje trasy Meetings**; `08` potrzebuje własnej pary |
| Pięć czerwonych briefów | **W REPO** | `tests/unit/day353-g19-{04-assessment,05-initiatives,06-execution,11-materials,13-chat}.contract.test.ts` — **czerwone z założenia**, opisują czego brakuje |
| Pytanie o kotwicę | **ZADANE I ROZSTRZYGNIĘTE** | `DEC-392`, sekcja `R` rejestru znalezisk |
| Liczba `615` | **ZAMKNIĘTA JAKO NIEODTWARZALNA** | trzy jawne warianty dają `1216` / `1015` / `315`; **nie wracasz do tego** |

---

## ★★ SPROSTOWANIE ZLECENIA — co mój pomiar potwierdził, a czego nie

Sprawdziłem każdą tezę zlecenia na markerze `2a7273e087` w `/private/tmp/m03`.

**POTWIERDZONE:**

| Teza | Mój pomiar |
| --- | --- |
| `G19`: 16 × `NOT_PROVEN / OWNER_RETEST_PENDING` | **potwierdzone** |
| kubełki `A=7` / `B=0` / `C=9` | **potwierdzone** z `evidence/g19/day353/r4-orzeczenie.md` — i **znam imiona**: `A` = `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| dryf `106` plików, `90` bez testów | **potwierdzone** |
| dystans od kotwicy `316bce9dd9` daje `1216` / `1015` / `315`, żaden nie daje `615` | **potwierdzone** |
| macierz wpisuje mianownik `49`, dryf mierzy `106` | **potwierdzone** |
| `DEC-392` istnieje w repo, sekcja `R` | **potwierdzone** — z pełnym uzasadnieniem i akapitem „Czego ta decyzja NIE robi" |
| wzorzec dowodu: `day307-crossorg-read-flight.pg.test.ts`, przypadek `denies foreign workload lookup…` | **potwierdzone** — wiersz `214` pliku |
| cel mutacji: `TaskController.getUserWorkload` | **potwierdzone** — definicja `2681`, wywołania serwisu `2703` i `2725` |
| artefakty `evidence/g19/day348-artefakty/` i `day353-artefakty/` | **potwierdzone** — ★ **oraz** `evidence/g19/day353/` (siedem plików: `r1`…`r5` + dwa logi migracji), o którym zlecenie nie wspomniało, a to w nim leży orzeczenie per wiersz |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** |

**DOPRECYZOWANE PRZEZ MÓJ POMIAR — czego zlecenie nie powiedziało:**

- ★★★ **Trasa i cele mutacji dla `08_MEETINGS` są ustalone, nie hipotetyczne.**
  `GET /api/meetings/:id` → `server/src/routes/meeting.routes.ts:345`. Strażnicy: filtr
  `organization_id = ?` w `getMeeting` (`server/src/services/meetingService.ts:285`, dosłownie
  `SELECT * FROM meetings WHERE id = ? AND organization_id = ? LIMIT 1`) **oraz** `canAccessMeeting`
  (`server/src/routes/meeting.routes.ts:150`). **Mutujesz każdy osobno.**
- ★★★ **Ta trasa zwija „nie znaleziono" i „brak dostępu" do tego samego `404` — i ma to
  napisane w komentarzu** (`meeting.routes.ts:333-343`). Czyli symetryczną odmowę dostaniesz
  tam **za darmo i bez znaczenia**. To jest dokładnie kształt „zamknięte przez wygaszenie"
  wbudowany w projekt trasy. **Bez `200` właściciela z niepustym ciałem nie masz dowodu.**
- ★ **Pięć czerwonych briefów dyżuru 353 istnieje w `tests/unit/`** — nie musisz zgadywać,
  czego brakuje w `04`, `05`, `06`, `11`, `13`. Przeczytaj je, zanim ustalisz trasy.
- ★ **`13_CHAT` ma w `G15` stan `PASS`, a w `G19` `NOT_PROVEN`** — to nie jest sprzeczność
  (inne bramki mierzą co innego), ale to jest moduł, który da się dziś zamknąć najtaniej,
  bo ma najmniej długu pomiarowego. Nie znaczy to, że wolno mu obniżyć próg.

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ

★ Licencja obejmuje **całą ścieżkę**, żebyś nie musiał wybierać między złamaniem licencji
a zrobieniem połowy roboty.

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **bezpiecznik ważności (NOWY)** | `scripts/dev/g19-waznosc-dowodu.mjs` | **★ ZAPIS — to jest produkt `R1`.** Plik **NIE ISTNIEJE** na markerze | skrypt + kod wyjścia + liczba zbadanych wierszy |
| **test bezpiecznika (NOWY)** | `tests/unit/g19-waznosc-dowodu.test.mjs` (**NIGDY pod `src/`**) | **★ ZAPIS**, `git add -f` | test + dowód mutacyjny w obie strony |
| **macierz odbioru — SIEDEM modułów** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{01_ORGANIZATION,04_ASSESSMENT,05_INITIATIVES,06_EXECUTION,08_MEETINGS,11_MATERIALS,13_CHAT}/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G19`**, wyłącznie w tych siedmiu, wyłącznie commitem, który w tym samym `git show --stat` niesie plik dowodowy | zmieniony wiersz + dowód |
| **macierz — DZIEWIĘĆ modułów `C`** | `modules/{02,03,07,09,10,12,14,15,16}_*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — równoległy dyżur 361 | brak zmian |
| **testy izolacyjne (odczyt + uruchomienie)** | `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` | odczyt i uruchomienie; **modyfikacja WYŁĄCZNIE w kopii poza repo** (seeder fail-closed na `6314`/`cx307`) | para `404`/`200` z logiem i długością ciała |
| **cel mutacji `01`** | `server/src/controllers/TaskController.ts` (`getUserWorkload`, `2681`–`2730`) | **mutacja TYMCZASOWA** po `cp` do `SCRATCH`; przywrócenie przez `cp`, **nigdy `git stash`** (`Z27`) | `GREEN`→`RED`→`GREEN` + pusty `git diff` |
| **cel mutacji `08` — kandydat 1** | `server/src/services/meetingService.ts:285` (filtr `organization_id = ?` w `getMeeting`) | **mutacja TYMCZASOWA** j.w. | wynik mutacji + zdanie „to jest / nie jest strażnik" |
| **cel mutacji `08` — kandydat 2** | `server/src/routes/meeting.routes.ts:150` (`canAccessMeeting`) | **mutacja TYMCZASOWA** j.w. | wynik mutacji + zdanie |
| **serwisy pozostałych modułów `A`** | `server/src/services/**`, `server/src/controllers/**`, `server/src/routes/**` dla `04`, `05`, `06`, `11`, `13` | **odczyt + uruchomienie + mutacja TYMCZASOWA** po `cp`; ustalasz strażnika i zapisujesz go zdaniem `plik:linia` | zdanie „zabezpieczenie stoi w `plik:linia`" + mutacja |
| **czerwone briefy 353** | `tests/unit/day353-g19-{04,05,06,11,13}*.contract.test.ts` | **odczyt; ZAPIS dozwolony wyłącznie po to, żeby brief zamienić w działający kontrakt** — a jeżeli to robisz, usuwasz z niego nagłówek „CZERWONY Z ZAŁOŻENIA" i **piszesz w raporcie, że brief przestał być briefem** | kontrakt zielony z mutacją |
| **nowe kontrakty testowe** | `tests/**` (★ **NIGDY pod `src/`**) | **zapis**, `git add -f` | plik kontraktu + wynik |
| **dowody** | `evidence/g19/day360/**` (**NOWY** katalog) | **zapis, `git add -f`** — jawna licencja na logi i `*.json`; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie `*.json`, `*.log`, `*.md` przelotów |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY360_G19_KUBELEK_A_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji, litera `AB`**. Zakaz kasowania i przeredagowywania sekcji zastanych, zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu (poza mutacjami)** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU.** Znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **bramki i harness zastane** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz | — | — | — |
| `R1` | **bezpiecznik ważności `DEC-392`**: skrypt + test + dowód mutacyjny | TAK | TAK — nowy plik, zero zależności | **TAK** |
| `R2` | kalibracja przyrządu (`day307`) + wiersz `01_ORGANIZATION` | TAK | TAK — mutacja w ciele jednej funkcji kontrolera | **TAK** |
| `R3` | `08_MEETINGS` — własna para + dwaj kandydaci na strażnika | TAK | TAK — jedna trasa, dwa punkty mutacji | **TAK** |
| `R4` | `04`, `05`, `06`, `11`, `13` | TAK | TAK — każdy moduł ma własną trasę i własny brief | **TAK ×5** |
| `R5` | podniesienie wierszy: pięć pól, dwie zgodne liczby | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R4` po każdym module.** Pozycja bez commita jest
pozycją niewykonaną.

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wiersze `G19` na `NOT_PROVEN` | `16` | `(5)` | TAK |
| 2 | moduły kubełka `A` | `7` (`01`,`04`,`05`,`06`,`08`,`11`,`13`) | `(2)` — `r4-orzeczenie.md` | TAK |
| 3 | moduły kubełka `C` — **nie dotykasz** | `9` | `(2)` | TAK |
| 4 | pliki dryfu `G19` | `106` | `(3)` | TAK — **nie liczysz po raz czwarty** |
| 5 | pliki dryfu bez testów | `90` | `(3)` | TAK |
| 6 | mianownik wpisany w macierz | `49` | `(4)` | TAK — ★ **nie zgadza się z `106`; to OSOBNE pytanie, nie liczba do podmiany** |
| 7 | dystans od kotwicy | `1216` / `1015` / `315` | `(4)` | TAK — ★ `615` **zamknięte jako nieodtwarzalne** |
| 8 | czerwone briefy w `tests/unit/` | `5` | `(6)` | TAK |
| 9 | wierszy `G19` zbadanych przez NOWY bezpiecznik | `16` | `R1` | TAK — **podłoga liczebności; mniej = błąd, nie sukces** |
| 10 | wierszy podniesionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `scripts/dev/g19-waznosc-dowodu.mjs` | `R1` | **NOWY** bezpiecznik |
| `tests/unit/g19-waznosc-dowodu.test.mjs` | `R1` | **NOWY** test, `git add -f` |
| `evidence/g19/day360/**` | `R1`–`R5` | **NOWY** katalog |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY360_G19_KUBELEK_A_REPORT.md` | `R6` | główny produkt |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AB` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `modules/{01,04,05,06,08,11,13}_*/MODULE_ACCEPTANCE.md` | gdy `R2`–`R4` dadzą dowód | **wyłącznie wiersz `G19`** |
| `tests/unit/day353-g19-*.contract.test.ts` | gdy brief zamieniasz w działający kontrakt | usuwasz nagłówek „CZERWONY Z ZAŁOŻENIA" i piszesz o tym w raporcie |
| `tests/**` (nowe kontrakty) | gdy moduł `A` nie ma testu zamykającego lukę | nowy kontrakt + `git add -f` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` (poza mutacjami tymczasowymi, przywracanymi przez `cp`) ·
`public/locales/**` · **dziewięć plików `MODULE_ACCEPTANCE.md` kubełka `C`** ·
żaden wiersz macierzy poza `G19` · `scripts/check-*.sh` ·
`scripts/dev/p0p1-licznik-e1.mjs` · `.github/workflows/**` · `docs/ui-standards/**` ·
żaden plik dyżurów 359, 361, 362 ani 363–366.

★ Plik postępu `/private/tmp/cx-day360-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6431**, runtime **5571**, kontener **`cx-day360-pg`**, baza **`cx360`**,
worktree `/private/tmp/cx-day360-g19-kubelek-a`, gałąź `codex/day360-g19-kubelek-a-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- server/src/ src/        # PUSTY (wszystkie mutacje przywrocone)
bash -c "git diff --cached --name-only | grep -E 'modules/(02|03|07|09|10|12|14|15|16)_' && echo 'STOP: kubelek C' || echo 'kubelek C nietkniety'"
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
node scripts/dev/g19-waznosc-dowodu.mjs; echo "waznosc_exit=$?"
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| 359 | `G20` | wszystkie 16 |
| **360 (Ty)** | **`G19`** | **`01`, `04`, `05`, `06`, `08`, `11`, `13`** |
| 361 | `G19` | `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| 362 | `G15` | `04`, `09`, `12`, `15` |

★ **Konflikt scalenia rozstrzyga nadzorca.** Nie próbujesz go uprzedzić, nie scalasz cudzej
gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza, nawet jeżeli
uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** `git show --stat <commit dotykający macierzy>` musi zawierać plik z
`evidence/g19/day360/**` albo plik testu. Commit bez dowodu **cofasz przez
`git reset --soft HEAD~1`**. **Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — `TECHNICAL_REGRESSION_PASS` był odrzucony DWA RAZY i nie wolno go wprowadzić
pod żadną nazwą.** Zakaz obejmuje `MACHINE_PASS`, `TECHNICAL_PASS`, `REGRESSION_TECHNICAL_OK`,
`PASS_MASZYNOWY`, `PASS (zakres techniczny)` i każdy inny kształt brzmiący jak zaliczenie
**bez nazwania mianownika**. ★ `DEC-392` dopuszcza słowo `PASS`, ale **wyłącznie** w kształcie
z pięcioma polami z `R5`. `PASS` bez daty, bez SHA i bez mianownika jest tym samym fałszem
pod inną nazwą.

**ZASADA 3 — nie wolno „naprawiać" bramki przez nadpisanie mianownika ani zawężenie
kryterium.** Macierz mówi `49`, dryf mówi `106`. `DEC-392` rozstrzyga **regułę ważności**, nie
mianownik. Jeżeli po Twoim dowodzie mianownik nadal się nie zgadza, **piszesz osobne,
rozstrzygalne pytanie do właściciela** i zostawiasz liczbę w spokoju.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część dyżuru niewykonalną — to jest wynik
i zapisujesz go jako pytanie. Nie obchodzisz ich.**

---

## R1 — BEZPIECZNIK WAŻNOŚCI DOWODU (`DEC-392`) — rdzeń, robisz to PIERWSZE

★★★ **Nie wolno Ci podnieść ani jednego wiersza, dopóki ta pozycja nie ma commita.** Powód:
`DEC-392` opiera się na wygasaniu, a wygasanie, którego nikt nie liczy, nie istnieje.

**Produkt: `scripts/dev/g19-waznosc-dowodu.mjs`** (plik NOWY, nie istnieje na markerze).

Skrypt czyta wiersz `G19` z **każdego z 16** plików
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` i dla każdego orzeka:

| Warunek | Wynik |
| --- | --- |
| stan wiersza nie twierdzi domknięcia (`NOT_PROVEN`, `NOT_STARTED`, …) | `NIE_DOTYCZY` — bez pola daty nie jest to błąd |
| stan twierdzi domknięcie, ale **brak pola daty albo SHA** | **`BRAK_DATY_POMIARU` → BLOKUJE** (`exit 1`) |
| stan twierdzi domknięcie, data starsza niż **7 dni** od dnia migawki | **`PASS_STALE` → BLOKUJE** (`exit 1`) |
| stan twierdzi domknięcie, data w oknie 7 dni, SHA obecny | `WAZNY` |

Wymagania konstrukcyjne, wszystkie obowiązkowe:

1. **Podłoga liczebności.** Jeżeli skrypt zbadał **mniej niż 16** wierszy `G19`, kończy się
   **błędem**, nie sukcesem. „Brak pomiaru nie jest wynikiem" — bramka, która przechodzi, bo
   nic nie znalazła, jest gorsza niż jej brak.
2. **Dzień migawki** ma być parametrem (`--snapshot-date`), domyślnie dzisiejszy — dokładnie
   jak w `scripts/dev/p0p1-licznik-e1.mjs`, żeby wynik dało się odtworzyć.
3. **Wypisuje tabelę** (moduł · stan · data · SHA · orzeczenie) i **kod wyjścia**.
4. **Nie edytuje macierzy.** Miernik nie dotyka mierzonego.
5. Funkcje eksportowane, żeby test mógł je wołać bez `spawn`.

**Test: `tests/unit/g19-waznosc-dowodu.test.mjs`** (`git add -f`), z **dowodem mutacyjnym
celującym w ZABEZPIECZENIE**, nie w mechanizm odczytu:

| Mutacja | Co ma się stać | Dlaczego to celuje w zabezpieczenie |
| --- | --- | --- |
| okno `7` dni → `3650` dni | wiersz z datą sprzed 30 dni **przestaje** być `PASS_STALE` → **test CZERWIENIEJE** | zabezpieczeniem jest **termin ważności** |
| usunięcie warunku „brak daty blokuje" | wiersz twierdzący domknięcie bez daty **przechodzi** → **test CZERWIENIEJE** | zabezpieczeniem jest **wymóg pomiaru** |
| usunięcie podłogi `16` | podanie katalogu z jednym modułem daje `exit 0` → **test CZERWIENIEJE** | zabezpieczeniem jest **kompletność mianownika** |

★★ Jeżeli któraś mutacja **nie** zaczerwienia testu — mutacja chybiła albo zabezpieczenia nie
ma; przecelowujesz ją i **zapisujesz, że pierwsza próba chybiła**. Mutacje robisz po `cp` do
`SCRATCH`, przywracasz przez `cp` (**nigdy `git stash`**, `Z27`), `git diff` po przywróceniu
**pusty**.

★ **Uruchom bezpiecznik na stanie wejściowym.** Dziś wszystkie 16 wierszy to `NOT_PROVEN`,
więc oczekiwany wynik to `16 × NIE_DOTYCZY`, `exit 0`, **zbadanych wierszy: 16**. Zapisz to —
to jest Twoja linia bazowa.

**Wymagany dowód:** skrypt · test · `evidence/g19/day360/r1-waznosc.md` z tabelą trzech mutacji
(nazwa przypadku, wynik przed, wynik po, wynik po przywróceniu) · log uruchomienia na stanie
wejściowym z liczbą `16`. **Commit po `R1`.**

---

## R2 — KALIBRACJA PRZYRZĄDU I WIERSZ `01_ORGANIZATION` (rdzeń)

★★ **Nie budujesz wzorca drugi raz.** Odtwarzasz go na **swojej** bazie, żeby wiedzieć, że
przyrząd działa u Ciebie — i dopiero potem używasz go jako dowodu dla `01`.

1. Kontener `cx-day360-pg`, port `6431`, baza `cx360`, obraz `pgvector/pgvector:pg16`.
   Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`.
   Oba logi do `evidence/g19/day360/`.
2. **Kopia seedera poza repo.** `day307` jest fail-closed na historyczne `6314`/`cx307`.
   Kopiujesz plik do `SCRATCH`, zmieniasz **wyłącznie guard** na `6431`/`cx360`, **źródła
   w repo NIE dotykasz**.
3. Przelot pary: obcy **`404`**, właściciel **`200`**, na **tym samym `userId`**, z **zapisaną
   długością ciała odpowiedzi** dla obu. Dyżur 353 zmierzył `64 B` i `243 B` — **Twoje liczby
   mogą się różnić i to jest w porządku**, byle właściciel dostał coś niepustego.
4. **Mutacja celująca w ZABEZPIECZENIE** (`Z32`): usuwasz `AND organization_id = ?` z prechecku
   w `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts`, `2681`–`2730`),
   po `cp` do `SCRATCH`. Test ma zaczerwienić się komunikatem kształtu
   `expected 200 to be 404`. Przywracasz przez `cp` → zielony; `git diff` **pusty**.
5. **Podnosisz wiersz `G19` modułu `01_ORGANIZATION`** — z pięcioma polami z `R5`, dowodem
   w tym samym commicie.

★★ **Uwaga na mianownik.** `01` ma w macierzy wpisane `Mianownik: 49`, a dryf mierzy `106`.
Twój dowód dotyczy **jednej trasy**. W `R5` zobaczysz, że to determinuje **słowo stanu**:
`PASS` wolno napisać tylko wtedy, gdy pole mianownika w wierszu jest **pokryte** dowodem.
Jeżeli nie jest — stan **nie zawiera słowa `PASS`** i nazywa lukę.

**Wymagany dowód:** dwa logi migracji · para z dwoma kodami i długościami ciała · mutacja
w obie strony z pustym `git diff` · wiersz `01` z pięcioma polami. **Commit po `R2`.**

---

## R3 — `08_MEETINGS`: WŁASNA PARA, DWAJ KANDYDACI NA STRAŻNIKA (rdzeń)

`R2` dyżuru 353 orzekł, że `day307` **nie wykonuje trasy Meetings**, więc `08` potrzebuje
własnej pary. Trasę i kandydatów ustaliłem za Ciebie na markerze:

| Rzecz | Ścieżka | Co to jest |
| --- | --- | --- |
| trasa | `GET /api/meetings/:id` → `server/src/routes/meeting.routes.ts:345` | jedno spotkanie, org brana **z tokena**, nigdy z parametru |
| strażnik — kandydat 1 | `server/src/services/meetingService.ts:285` | `SELECT * FROM meetings WHERE id = ? AND organization_id = ? LIMIT 1` |
| strażnik — kandydat 2 | `server/src/routes/meeting.routes.ts:150` | `canAccessMeeting(req, meeting)` |

★★★ **PUŁAPKA WBUDOWANA W PROJEKT TRASY.** Komentarz przy tej trasie
(`meeting.routes.ts:333-343`) mówi wprost, że **„nie znaleziono" i „brak dostępu" zwijają się
do tego samego `404`**, celowo, żeby nie przeciekało, który przypadek zaszedł. Skutek dla
Ciebie: **`404`/`404` dostaniesz tam za darmo i nie znaczy to nic**. Dowodem jest wyłącznie
para **obcy `404` / właściciel `200` z niepustym ciałem**, na **tym samym `meetingId`**.

1. Zasiej **jedno realne spotkanie** w organizacji właściciela. Zapisz `meetingId`.
2. Para: obcy `404`, właściciel `200`, **długość ciała obu** zapisana.
3. **Mutuj każdego kandydata OSOBNO** (dwie mutacje, dwie pary logów):
   - usuń `AND organization_id = ?` z zapytania w `meetingService.ts:285`;
   - zneutralizuj `canAccessMeeting` (`return true`).
   Dla każdej zapisz: czy test zaczerwieniał, **z jakim komunikatem** i czy komunikat mówi
   o izolacji, czy o czymś innym.
4. **Napisz zdanie:** „zabezpieczeniem trasy `GET /api/meetings/:id` jest `plik:linia`" —
   albo „są nim oba, i oto dowód dla każdego z osobna", albo „jeden z nich nie jest
   zabezpieczeniem i oto dlaczego".
5. ★ Jeżeli **żadna** mutacja nie zaczerwienia testu — zabezpieczenia nie ma, i to jest
   znalezisko **`P0`**, a nie powód do improwizacji. Piszesz **STOP** dla tego wiersza,
   zapisujesz znalezisko i idziesz do `R4`.

**Wymagany dowód:** para z `meetingId`, kodami i długościami ciała · **dwie** mutacje w obie
strony z pustym `git diff` · zdanie o strażniku. **Commit po `R3`.**

---

## R4 — PIĘĆ MODUŁÓW: `04`, `05`, `06`, `11`, `13` (rdzeń, commit ×5)

Dla **każdego** modułu, po kolei — i **commit po każdym**:

1. **Przeczytaj brief dyżuru 353** (`tests/unit/day353-g19-<nr>-<nazwa>.contract.test.ts`).
   Brief mówi, czego brakuje. To jest punkt startu, **nie ustalenie**.
   Znane z `evidence/g19/day353/r4-orzeczenie.md`:
   - `04_ASSESSMENT` — brakuje mutacyjnej obrony odczytu cross-org **istniejącej** oceny
     na `/api/v8/assessment/:id`; `day274` 2/2 i `day275` 1/1 przeszły, ale nie bronią.
   - `05_INITIATIVES` — `day277` 2/2 (właściciel zapis/readback, obcy `404`); brakuje
     `GREEN`→`RED`→`GREEN` po usunięciu filtra organizacji z decision enhancements.
   - `06_EXECUTION` — dropdown 2/2 na jawnym PG; brakuje pary obcy/właściciel dla
     **istniejącego** execution case przez `ApiGateway` i mutacji filtra organizacji.
   - `11_MATERIALS` — `day276` deck 2/2, workbook 2/2, workbook odmawia obcemu; brakuje
     mutacji filtra organizacji komendy workbook i pary dla decka.
   - `13_CHAT` — Agent Hub limiter 9/9, **ale wyłącznie kontrakt tekstowy**; brakuje realnej
     pary `ApiGateway`/JWT/PG dla istniejącej rozmowy albo planu agenta i mutacji strażnika.
2. **Ustal trasę i strażnika sam**, cytując `plik:linia`.
3. **Para izolacyjna**: obcy odmowa, właściciel `200` z **niepustym** ciałem, na **tym samym
   identyfikatorze istniejącego obiektu**. Zapisz oba kody i obie długości.
4. **Mutacja celująca w strażnika.** Jeżeli test czerwienieje z innego powodu niż brak
   izolacji — chybiłeś, przecelowujesz, i **zapisujesz, że pierwsza próba chybiła**.
5. **Przelot z `--retry=0` i `--reporter=json --outputFile=<ARTEFAKTY>`**, `numTotalTests`
   podany. ★★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0` i **nie jest
   pomiarem** — to zdarzyło się dyżurowi 335 i słusznie zostało odrzucone.
   `No test files found` i `Transform failed` to **BŁĄD KOMENDY**, nie `PASS`.
6. **Jeżeli dla któregoś modułu dowód się nie składa — to jest wynik, nie porażka.**
   Piszesz imiennie: „`X` był w kubełku `A` błędnie; brakuje `Y`", zostawiasz brief czerwony
   i **nie podnosisz wiersza**.
7. **Sprzątanie na koniec:** `docker rm -fv cx-day360-pg` (bez `-v` wolumen zostaje),
   `df -h /` przed i po. ★ **Zakaz `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

**Wymagany dowód (per moduł):** trasa i strażnik z `plik:linia` · para z kodami i długościami ·
mutacja w obie strony z pustym `git diff` · `numTotalTests` · **albo** jawne orzeczenie
„kubełek `A` przypisany błędnie, brakuje …". **Commit po każdym module.**

---

## R5 — PODNIESIENIE WIERSZY: PIĘĆ PÓL, DWIE ZGODNE LICZBY (rdzeń)

★★★ **KAŻDY podniesiony wiersz `G19` musi literalnie zawierać PIĘĆ pól.** Wiersz, któremu
brakuje choć jednego, jest wpisem bez dowodu — i unieważnia dyżur.

| Pole | Kształt | Po co |
| --- | --- | --- |
| **data pomiaru** | `data=2026-09-04` | `DEC-392`: dowód ważny na dzień odbioru |
| **SHA pomiaru** | `sha=<10 znaków markera>` | `DEC-392`: wpis niesie SHA |
| **mianownik** | `mianownik=<liczba> wg <ścieżka źródła>` | żeby dało się orzec, co dowód pokrywa |
| **nazwa przypadku** | pełna nazwa `it(...)`, nie liczba | 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb |
| **ścieżka artefaktu** | `evidence/g19/day360/…` | dowód ma leżeć w repo, nie w katalogu tymczasowym |

**Słowo stanu — reguła twarda:**

- **`PASS`** wolno napisać **wyłącznie** wtedy, gdy pole `mianownik` wiersza jest **pokryte
  Twoim dowodem w całości**, i wtedy wiersz brzmi np.
  `PASS (DEC-392, kotwica ruchoma) — data=…, sha=…, mianownik=… wg …, przypadek „…", dowód …`.
- Gdy dowód pokrywa **izolację modułu**, ale nie cały zadeklarowany mianownik — **stan NIE
  ZAWIERA słowa `PASS`** i nazywa lukę, np.
  `IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY — data=…, sha=…, mianownik pokryty=<N> z <M> wg …`.
  ★ To **nie jest** synonim `TECHNICAL_REGRESSION_PASS`: tamten twierdził zaliczenie i milczał
  o mianowniku; ten **nie twierdzi zaliczenia i podaje mianownik liczbą**.
- ★ **Zakaz wymyślenia trzeciego słowa**, które brzmi jak zaliczenie. Jeżeli nie mieścisz się
  w tych dwóch kształtach — to jest pytanie do właściciela, nie nowy termin.

**Dalej:**

1. **Wpis i dowód idą JEDNYM commitem.**
2. **Policz: ile wierszy podniosłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe.**
   Jeden dowód uzasadnia więcej niż jeden wiersz **tylko** wtedy, gdy pokażesz, że mianownik
   tych wierszy jest **dosłownie tym samym zbiorem plików** — dyżur 353 sprawdził to dla
   `01` vs `08` i **orzekł, że nie jest**.
3. **Uruchom NOWY bezpiecznik ważności po ostatnim wpisie.** Ma zbadać `16` wierszy i **nie
   zgłosić ani jednego `BRAK_DATY_POMIARU`**. Jeżeli zgłosi — Twój wpis nie ma pięciu pól.
4. **Zero podniesionych wierszy też jest wynikiem** — po wykonaniu `R1`–`R4`, z powodem
   **per moduł**. Nigdy zamiast nich.
5. ★ **Pytanie o mianownik.** Jeżeli po Twoich dowodach rozjazd `49` vs `106` dalej stoi —
   sformułuj **jedno rozstrzygalne pytanie** do właściciela (wybór z wypisanymi
   konsekwencjami, nie „co robimy?"). `DEC-392` rozstrzygnęła regułę ważności; mianownika
   nie rozstrzygnęła i **nie wolno Ci go rozstrzygnąć samemu**.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód → pięć pól" · dwie zgodne liczby · wynik bezpiecznika po ostatnim wpisie ·
pytanie o mianownik (jeżeli rozjazd stoi). **Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY360_G19_KUBELEK_A_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, na początku.
2. `R1`: bezpiecznik ważności — trzy mutacje, wynik przed/po/po przywróceniu, liczba
   zbadanych wierszy, kod wyjścia na stanie wejściowym.
3. `R2`: kalibracja `day307` — dwa kody, dwie długości ciała, mutacja, pusty `git diff`.
4. `R3`: `08_MEETINGS` — para, **dwie** mutacje, zdanie o strażniku.
5. `R4`: pięć modułów, per moduł — trasa, strażnik, para, mutacja, `numTotalTests`.
6. `R5`: tabela „wiersz → dowód → pięć pól", dwie zgodne liczby, wynik bezpiecznika.
7. **Pytanie o mianownik** (jeżeli rozjazd `49` vs `106` stoi) — rozstrzygalne, z wariantami.
8. Co zostało niewykonane i dlaczego — imiennie, per moduł.
9. `df -h /` przed i po; potwierdzenie usunięcia kontenera.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AB`**, sprawdzana komendą
**tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`; litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AB` jest zajęta, bierzesz pierwszą wolną i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. **Reguła `PASS_STALE` zaimplementowana maszynowo**, z **dowodem mutacyjnym celującym
   w zabezpieczenie** (termin ważności, wymóg daty, podłoga liczebności) — trzy mutacje,
   każda czerwieniąca test, każda przywrócona z pustym `git diff`.
2. Bezpiecznik ma **podłogę `16`** i kończy się błędem, gdy zbadał mniej.
3. `R2` dał parę `404`/`200` na tym samym `userId` z niepustym ciałem właściciela i mutację
   w obie strony.
4. `R3` dał parę na `GET /api/meetings/:id` **z niepustym `200` właściciela** (samo `404`/`404`
   jest tam wbudowane w projekt i nie liczy się) oraz **dwie osobne mutacje**.
5. `R4` dla **każdego** z pięciu modułów dał albo dowód z mutacją celującą w strażnika, albo
   jawne orzeczenie „kubełek `A` przypisany błędnie, brakuje …".
6. **Siedem wierszy podniesionych** — albo mniej, z powodem **per moduł**; **liczba
   podniesionych = liczbie dowodów**.
7. **Każdy podniesiony wiersz ma PIĘĆ pól** (data, SHA, mianownik, nazwa przypadku, ścieżka
   artefaktu) i przechodzi przez NOWY bezpiecznik bez `BRAK_DATY_POMIARU`.
8. **Żaden wiersz nie brzmi `TECHNICAL_REGRESSION_PASS` ani synonimem**; słowo `PASS` użyte
   wyłącznie tam, gdzie mianownik jest pokryty.
9. **Ani jeden z dziewięciu wierszy kubełka `C` nie został dotknięty**; mianownik nie został
   nadpisany; `git diff` na kodzie produktu pusty.
10. Liście słowników i cztery bramki identyczne przed i po; `reachability --check-baseline`
    `exit 0`; kontener usunięty; `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6431`, `5571`) jest zajęty — **STOP całości, nigdy podmiana**;
- `evidence/g19/day353/r4-orzeczenie.md` albo sekcja `R` (`DEC-392`) rejestru **nie istnieje** —
  wtedy podstawa tego dyżuru zniknęła i trzeba to zgłosić, a nie improwizować reguły;
- migracje nie przechodzą dwukrotnie na czystej bazie;
- **żadna** mutacja na trasie `08_MEETINGS` nie czerwieni testu — to znaczy, że zabezpieczenia
  nie ma; **znalezisko `P0`**, STOP dla tego wiersza (nie dla całego dyżuru), idziesz do `R4`;
- realizacja `R5` wymagałaby wpisania stanu, który jest synonimem odrzuconego
  `TECHNICAL_REGRESSION_PASS`;
- zamknięcie wiersza wymagałoby nadpisania mianownika.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „`DEC-392` dopuszcza `PASS`" × „zakaz `PASS` i synonimów z dyżuru 353" | `R5` — `PASS` wyłącznie z pięcioma polami i wyłącznie przy pokrytym mianowniku; inaczej stan nazywa lukę |
| „podnieś siedem wierszy" × „dowód w tym samym commicie" | `R2`–`R4` — każdy wiersz podnoszony razem ze swoim plikiem dowodowym; `R5` tylko zlicza |
| „wznów, nie powtarzaj" × „każdą liczbę mierzysz sam (`Z24`)" | `B.3` — mierzysz **tanie** liczby (odczyt artefaktów, `git rev-list`), **drogie** robisz na własnej bazie w `R2`–`R4`, bo tam i tak są potrzebne |
| „reguła ruchomej kotwicy" × „nie obniżaj progu" | `R0` zasada 1 — zmienia się punkt odniesienia, nie wymóg dowodu; `R1` dokłada wygasanie, które **podnosi**, a nie obniża koszt utrzymania |
| „mianownik `49`" × „dryf `106`" | `R0` zasada 3 + `R5` punkt 5 — **osobne pytanie**, nie liczba do podmiany |
| „`08` w kubełku `A`" × „`day307` nie zamyka `08`" | `R3` — `08` dostaje **własną** parę na własnej trasie, którą nazwałem w `TRASY_TYL` |
| „trasa zwija `404` dla obu przypadków" × „para ma być `404`/`200`" | `R3`, pułapka 1 — dowodem jest **`200` właściciela z niepustym ciałem**, `404` obcego sam z siebie nic nie znaczy |
| „zakaz zmiany kodu produktu" × „mutacje w `TaskController`, `meetingService`, `meeting.routes`" | `B.1` — mutacje są **tymczasowe**, po `cp`, przywracane przez `cp`, z pustym `git diff` |
| „czerwone briefy 353 są dowodem braku" × „licencja na ich zmianę" | `B.1` — wolno zamienić brief w działający kontrakt, ale wtedy **usuwasz nagłówek „CZERWONY Z ZAŁOŻENIA" i piszesz o tym w raporcie**; cichy zielony brief byłby zatarciem śladu |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g19/day360/**` |
| „mandat CTO — decyduj sam" × „pytanie o mianownik do właściciela" | `R5` punkt 5 — kotwicę rozstrzygnął CTO (`DEC-392`); mianownik bramki odbioru jest **regułą programu** i idzie do właściciela |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `scripts/dev/g19-waznosc-dowodu.mjs`, `tests/unit/g19-waznosc-dowodu.test.mjs`, `evidence/g19/day360/**`, raport, sekcja `AB` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; wszystkie uruchomione 04.09 |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (zdanie · wskazanie · wynik przelotu) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; mutacje siedzą w ciele pojedynczych funkcji, `ApiGateway` nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec pozostałych trzech dyżurów paczki); `6431`/`5571` zmierzone jako wolne. ★ 359, 361, 362 idą równolegle i mają rozłączne moduły macierzy; 363–366 pisze inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 335, 348 i 353 ma ścieżkę artefaktu albo `plik:linia` |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
