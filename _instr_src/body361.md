## Po co ten dyżur istnieje

Bramka `G19` stoi na `NOT_PROVEN / OWNER_RETEST_PENDING` we **wszystkich szesnastu** modułach.
Dyżur 353 podzielił je na dwa kubełki i **dziewięciu** przypisał etykietę „wymaga oczu
właściciela":

> `02_INTERVIEW` · `03_TOOLS` · `07_MY_WORK_AGENT` · `09_RESULTS` · `10_FINANCE` ·
> `12_AUDITS` · `14_ADMIN` · `15_SETTINGS` · `16_PARTNER`

**Ten dyżur nie podnosi tych wierszy. Ten dyżur ustala, czy ta etykieta jest prawdą.**

Powód jest twardy i policzalny: w `evidence/g19/day353/r4-orzeczenie.md` **osiem wierszy ma
w kolumnie „co zostało udowodnione" DOSŁOWNIE to samo zdanie** — „Wspólne Bloki 1–3 zielone
na markerze". Jednocześnie kolumna „czego brakuje" jest **zróżnicowana per moduł**. To jest
charakterystyczny rozjazd: **ktoś wiedział, czego brakuje, ale nie zmierzył, co jest.**
Autor 353 zresztą sam nazwał swoją klasyfikację **hipotezą warunkową względem decyzji
o kotwicy** — a kotwica została rozstrzygnięta 04.09 (`DEC-392`), więc warunek odpadł.

**Trzy produkty tego dyżuru, w tej kolejności:**

1. **Pomiar etykiety** — czy `OWNER_RETEST_PENDING` jest orzeczeniem indywidualnym, czy
   przepisanym hurtem. Odpowiedź obojętnie która, byle **zmierzona**.
2. **Triaż per wiersz**: brakuje `(a)` scenariusza, `(b)` realnego łańcucha
   (`ApiGateway` + JWT + Postgres), czy `(c)` oczu właściciela — a jeżeli `(c)`,
   to **co dokładnie ma zobaczyć i gdzie kliknąć**.
3. **Pakiet gotowy do wysłania właścicielowi** — nowy plik
   `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`, w stylu istniejącego
   `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` (kroki · na co patrzeć ·
   **czego NIE zgłaszać**).

★★★ **Ani jeden wiersz nie zmienia stanu bez dowodu. Pakiet dla właściciela NIE JEST dowodem —
jest przygotowaniem.** Jeżeli w triażu wyjdzie, że któryś wiersz da się zamknąć maszynowo —
**powiedz to i zamknij**, ale z pełnym rygorem: para na realnym PostgreSQL, mutacja celująca
w zabezpieczenie, `GREEN`→`RED`→`GREEN`, pusty `git diff`.

---

## ★ Co jest ZROBIONE — NIE POWTARZASZ

| Pozycja | Stan | Wynik, który dziedziczysz |
| --- | --- | --- |
| Przemiar dryfu | **ZROBIONY** trzy razy zgodnie | **106 plików**, **90 bez testów**. ★★★ **CZWARTE liczenie jest zakazane** |
| Kubełki `A`/`B`/`C` | **ZROBIONE** | `A = 01, 04, 05, 06, 08, 11, 13` (**7**, dyżur 360) · `B = 0` · `C` = Twoje **9** |
| Wzorzec dowodu (`day307`) | **WYKONANY** | obcy `404` / 64 B, właściciel `200` / 243 B; mutacja filtra organizacji → `200` zamiast `404`. `evidence/g19/day353/r2-day307-orzeczenie.md` |
| Pytanie o kotwicę | **ZADANE I ROZSTRZYGNIĘTE** | `DEC-392`, sekcja `R` rejestru: kotwica **ruchoma**, dowód ważny **na dzień odbioru**, wpis niesie **datę i SHA**, po **7 dniach** → `PASS_STALE` |
| Liczba `615` | **ZAMKNIĘTA JAKO NIEODTWARZALNA** | trzy warianty dają `1216` / `1015` / `315` |
| Wzór pakietu dla właściciela | **ISTNIEJE** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` — ★ dotyczy **`G16`**, nie `G19`; **naśladujesz strukturę, nie treść** |

---

## ★★ SPROSTOWANIE ZLECENIA — co mój pomiar potwierdził, a co doprecyzował

**POTWIERDZONE:**

| Teza | Mój pomiar |
| --- | --- |
| `G19`: 16 × `NOT_PROVEN / OWNER_RETEST_PENDING` | **potwierdzone** — w tym wszystkie dziewięć Twoich |
| kubełek `C` = 9 modułów | **potwierdzone**, z imionami: `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| etykieta `OWNER_RETEST_PENDING` mogła być przepisana hurtem | **★ POTWIERDZONE POMIAREM**: `grep -c 'Wspólne Bloki 1–3 zielone na markerze'` w `r4-orzeczenie.md` daje **`8`** |
| `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` istnieje i nadaje się na wzór | **potwierdzone** — ma sekcje „Zanim zaczniesz", „Jak zgłaszać uwagę", „Czego NIE zgłaszaj nigdy" i sekcje per moduł z „Kroki" / „Co się zmieniło" / „Czego NIE zgłaszaj" |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** |

**DOPRECYZOWANE PRZEZ MÓJ POMIAR:**

- ★★★ **Hurt dotyczy kolumny DOWODU, nie kolumny DIAGNOZY.** Osiem wierszy ma identyczne
  „co zostało udowodnione", ale **każdy ma inne „czego brakuje"** (`02` → `NModeLeftNav`
  i formularze; `09` → `HelpButton`, `ErrorState`, PL/EN; `16` → realny rekord partnera…).
  To nie jest zwykłe kopiuj-wklej — to jest **diagnoza bez pomiaru**. Twoje `R1` ma to nazwać
  precyzyjnie, a nie ogłosić „wszystko przepisane hurtem".
- ★★ **Istniejący pakiet ma otwarty spór o wersję stagingu**: wskazuje `1c4b5a5635`
  i alternatywnie `fb6547b7d0`, i sam mówi, że dyżur 350 **nie zweryfikował tego na stagingu,
  bo obowiązuje `Z28`**. Twój pakiet dziedziczy to ograniczenie: podaje SHA, **na którym
  obowiązuje**, i nie twierdzi, że staging na nim stoi.
- ★★ **`DEC-392` daje dowodowi TERMIN — 7 dni.** Pakiet, który nie niesie własnej daty
  i SHA, po dziesięciu dniach wyprodukuje `PASS`, który już nie obowiązuje. **Twój pakiet ma
  mieć nagłówek z datą, SHA i dniem wygaśnięcia.**
- ★ **`09_RESULTS`, `12_AUDITS` i `15_SETTINGS` są jednocześnie przedmiotem RÓWNOLEGŁEGO
  dyżuru 362** (bramka `G15`, kolumna inna niż Twoja, ten sam plik). Patrz `B.4.6`.

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **orzeczenie 353 (odczyt)** | `evidence/g19/day353/r4-orzeczenie.md`, `r2-day307-orzeczenie.md`, `r3-piec-modulow-i-bloki.md`, `r5-podniesienie-i-pytanie-o-kotwice.md` | **tylko odczyt** — to jest Twój materiał wejściowy | cytaty w tabeli `R1` |
| **macierz — DZIEWIĘĆ modułów `C`** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{02_INTERVIEW,03_TOOLS,07_MY_WORK_AGENT,09_RESULTS,10_FINANCE,12_AUDITS,14_ADMIN,15_SETTINGS,16_PARTNER}/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G19`**, wyłącznie w tych dziewięciu, **wyłącznie z dowodem w tym samym commicie** | zmieniony wiersz + dowód |
| **macierz — SIEDEM modułów `A`** | `modules/{01,04,05,06,08,11,13}_*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — równoległy dyżur 360 | brak zmian |
| **pakiet dla właściciela (NOWY)** | `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md` | **★ ZAPIS — to jest główny produkt `R4`.** Plik **NIE ISTNIEJE** na markerze | pakiet, dziewięć sekcji |
| **pakiet `G16` (wzór)** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` | **★ NIETYKALNY DO ZAPISU** — naśladujesz strukturę, nie nadpisujesz pliku | wskazanie naśladowanych sekcji |
| **kod frontu (odczyt)** | `src/**`, w szczególności komponenty współdzielone z listy dryfu | **tylko odczyt** — ustalasz, co konkretnie się zmieniło od odbioru i co właściciel ma zobaczyć | `plik:linia` + zdanie do pakietu |
| **flagi (odczyt)** | `src/utils/betaAccess.ts`, `server/src/sharedRuntime/utils/betaMenuStatus.ts`, rodziny `import.meta.env` | **tylko odczyt** — sprawdzasz, czy krok pakietu jest wykonalny dla właściciela | `plik:linia` flagi + zdanie |
| **trasy i strażnicy (odczyt + uruchomienie)** | `server/src/routes/**`, `server/src/controllers/**`, `server/src/services/**` | **odczyt + uruchomienie istniejących testów**; **mutacja TYMCZASOWA wyłącznie w `R3`**, po `cp` do `SCRATCH`, przywracana przez `cp`, **nigdy `git stash`** (`Z27`) | nazwa trasy i strażnika `plik:linia`; w `R3` — mutacja w obie strony |
| **nowe kontrakty testowe** | `tests/**` (★ **NIGDY pod `src/`**) | **zapis** — wyłącznie w `R3`, `git add -f` | plik kontraktu + wynik |
| **dowody** | `evidence/g19/day361/**` (**NOWY** katalog) | **zapis, `git add -f`** — jawna licencja; „zakaz binariów w repo" byłby wymyślonym powodem | tabele triażu, logi, `*.json` |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY361_G19_KUBELEK_C_REPORT.md` | **zapis (główny produkt raportowy)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — JEDNA nowa sekcja, litera `AC`**; zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu (zapis)** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU** poza mutacją tymczasową w `R3` | defekt → `plik:linia` + **diff nienałożony** |
| **bramki i harness** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs`, `scripts/dev/g19-waznosc-dowodu.mjs` (tworzy go **dyżur 360**), `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz | — | — | — |
| `R1` | **pomiar etykiety**: hurt czy orzeczenie | TAK | TAK — sam odczyt + `grep` | **TAK** |
| `R2` | **triaż per wiersz** `(a)`/`(b)`/`(c)` z wykluczeniem dwóch pozostałych | TAK | TAK — moduł po module | **TAK ×3** |
| `R3` | wyjęcie tego, co maszynowe — dowód albo jawne „żaden" | TAK | TAK | **TAK** |
| `R4` | **pakiet dla właściciela** | TAK | TAK — nowy dokument | **TAK** |
| `R5` | podniesienie wierszy wyłącznie z dowodem | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R2` po każdych trzech modułach.**

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | moduły kubełka `C` | `9` | `(1)`, `(3)` | TAK |
| 2 | moduły kubełka `A` — **nie dotykasz** | `7` | `(1)` | TAK |
| 3 | wiersze z identycznym zdaniem dowodu w `r4-orzeczenie.md` | `8` | `(2)` | TAK — ★ **teza `R1`** |
| 4 | wiersze `G19` kubełka `C` z identyczną etykietą w macierzy | `9` | `(3)` | TAK |
| 5 | pliki dryfu `G19` | `106` | `(4)` | TAK — **nie liczysz po raz czwarty** |
| 6 | pliki dryfu bez testów | `90` | `(4)` | TAK |
| 7 | okno ważności dowodu wg `DEC-392` | `7` dni | `(5)` | TAK |
| 8 | sekcje wzoru pakietu do naśladowania | `3` wspólne + `1` per moduł | `(6)` | TAK |
| 9 | sporne znaczniki wersji stagingu | `2` (`1c4b5a5635`, `fb6547b7d0`) | `(7)` | TAK — ★ **nierozstrzygalne z Twojej strony (`Z28`)** |
| 10 | wierszy podniesionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md` | `R4` | **NOWY** pakiet dla właściciela |
| `evidence/g19/day361/**` | `R1`–`R5` | **NOWY** katalog |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY361_G19_KUBELEK_C_REPORT.md` | `R6` | raport |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AC` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `modules/{02,03,07,09,10,12,14,15,16}_*/MODULE_ACCEPTANCE.md` | **wyłącznie** gdy `R3` da dowód maszynowy | **wyłącznie wiersz `G19`** |
| `tests/**` (nowe kontrakty) | gdy `R3` zamyka wiersz maszynowo | kontrakt + `git add -f` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` (poza mutacją tymczasową w `R3`) · `public/locales/**` ·
**siedem plików `MODULE_ACCEPTANCE.md` kubełka `A`** · żaden wiersz macierzy poza `G19` ·
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` · `scripts/**` ·
`.github/workflows/**` · `docs/ui-standards/**` ·
żaden plik dyżurów 359, 360, 362 ani 363–366.

★ Plik postępu `/private/tmp/cx-day361-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6432**, runtime **5572**, kontener **`cx-day361-pg`**, baza **`cx361`**,
worktree `/private/tmp/cx-day361-g19-kubelek-c`, gałąź `codex/day361-g19-kubelek-c-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- src/ server/src/        # PUSTY
bash -c "git diff --cached --name-only | grep -E 'modules/(01|04|05|06|08|11|13)_' && echo 'STOP: kubelek A' || echo 'kubelek A nietkniety'"
bash -c "git diff --cached --name-only | grep -q 'PRZELOT_WLASCICIELA_STAGING' && echo 'STOP: pakiet G16 nietykalny' || echo 'pakiet G16 nietkniety'"
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| 359 | `G20` | wszystkie 16 |
| 360 | `G19` | `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| **361 (Ty)** | **`G19`** | **`02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16`** |
| 362 | `G15` | `04`, `09`, `12`, `15` |

★ **Konflikt scalenia rozstrzyga nadzorca.** Nie próbujesz go uprzedzić, nie scalasz cudzej
gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza, nawet jeżeli
uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** `git show --stat` musi zawierać plik z `evidence/g19/day361/**` albo plik testu.
Commit bez dowodu **cofasz przez `git reset --soft HEAD~1`**.
**Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — pakiet dla właściciela NIE JEST dowodem.** Jest przygotowaniem. Wolno go złożyć
i **nie podnieść ani jednego wiersza** — to jest pełnowartościowy wynik. Nie wolno go
złożyć **i podnieść wiersze na jego podstawie**.

**ZASADA 3 — `TECHNICAL_REGRESSION_PASS` był odrzucony DWA RAZY i nie wolno go wprowadzić pod
żadną nazwą.** Zakaz obejmuje każdy synonim brzmiący jak zaliczenie. ★ Jeżeli `R3` zamknie
któryś wiersz maszynowo, obowiązuje kształt z **pięcioma polami** (`R5`): `data=`, `sha=`,
`mianownik=… wg …`, pełna nazwa przypadku, ścieżka artefaktu.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część dyżuru niewykonalną — to jest wynik
i zapisujesz go jako pytanie. Nie obchodzisz ich.**

---

## R1 — POMIAR ETYKIETY: HURT CZY ORZECZENIE (rdzeń, tani)

★★ **Teza, którą masz sprawdzić, nie potwierdzić.** Zlecenie mówi „sprawdź, czy ktoś nie
przepisał etykiety hurtem". Zapisz ją jako **pytanie pomiarowe**, nie jako fakt — bo hipoteza
nadzorcy potrafi wrócić jako „zweryfikowany fakt", jeżeli wykonawca jej nie zmierzy.

Dla **każdego** z dziewięciu wierszy:

1. **Cytat kolumny „co zostało udowodnione"** z `r4-orzeczenie.md`, dosłownie.
2. **Cytat kolumny „czego brakuje"**, dosłownie.
3. **Cytat kolumny dowodu z macierzy** (`MODULE_ACCEPTANCE.md`, wiersz `G19`), dosłownie.
4. **Orzeczenie:** czy te trzy cytaty razem opisują **ten moduł**, czy dowolny inny.
   Test operacyjny: **podmień w cytacie nazwę modułu na inną — czy zdanie dalej jest
   prawdziwe?** Jeżeli tak, to jest etykieta hurtowa.
5. **Twoja liczba:** ile z dziewięciu przechodzi ten test, a ile nie.

★★ **Nie kończ na „osiem to hurt".** Mój pomiar mówi, że **hurt siedzi w kolumnie dowodu,
a diagnoza jest zróżnicowana**. To znaczy coś konkretnego: **ktoś wiedział, czego brakuje,
ale nie zmierzył, co jest.** Sprawdź, czy tak jest naprawdę — i napisz to zdaniem, które
da się obalić.

**Wymagany dowód:** `evidence/g19/day361/r1-etykieta.md` — dziewięć wierszy × cztery cytaty
+ orzeczenie + Twoja liczba, oraz jedno zdanie werdyktu. **Commit po `R1`.**

---

## R2 — TRIAŻ PER WIERSZ: `(a)` / `(b)` / `(c)` (rdzeń, commit ×3)

Dla **każdego** z dziewięciu modułów przypisujesz **dokładnie jedną** kategorię — i musisz
**wykluczyć dwie pozostałe**, nie tylko wskazać jedną.

| Kategoria | Znaczenie | Co MUSISZ pokazać, żeby ją przypisać |
| --- | --- | --- |
| **`(a)` brak scenariusza** | nie ma opisu, co miałoby być udowodnione | wskazanie, że dla tego modułu nie istnieje ani jeden przypadek testowy pokrywający zmienioną ścieżkę — z komendą i liczbą |
| **`(b)` brak realnego łańcucha** | scenariusz jest, ale nikt go nie przepuścił przez `ApiGateway` + JWT + Postgres | **nazwa trasy i strażnika z `plik:linia`**, żeby dało się to zlecić maszynowo bez ponownego śledztwa; plus zdanie, dlaczego dzisiejszy test nie jest łańcuchem |
| **`(c)` oczy właściciela** | scenariusz jest, łańcuch jest, a mimo to maszyna nie orzeknie | **wykluczenie `(a)` i `(b)` dowodem** + **ekran, ścieżka kliknięć, rodzaj rekordu, co się zmieniło od odbioru, na co patrzeć** |

★★★ **Zdanie „przelot właściciela pozostaje wymagany" NIE JEST orzeczeniem `(c)`.** Powtórzone
dziewięć razy jest dokładnie tą etykietą hurtową, którą wykrywasz w `R1`. Wymagam konkretu,
na przykład: *„`09_RESULTS`: scenariusz istnieje (`tests/unit/results/…`), łańcuch istnieje
(`server/src/routes/resultsVnext/…`), ale zmiana dotyczy `HelpButton` i `ErrorState` w powłoce
współdzielonej — maszyna nie orzeknie, czy właściciel widzi POPRAWNY tekst po polsku;
właściciel wchodzi w Wyniki → otwiera realny raport z listy (nie „Przykład") → wywołuje stan
błędu przez odświeżenie z zerwaną siecią → patrzy, czy komunikat jest po polsku i czy
`HelpButton` otwiera pomoc"*.

★ **Sprawdź flagi**, zanim wpiszesz `(c)`. Krok, którego właściciel nie może wykonać, bo
funkcja jest za flagą OFF, unieważnia sekcję pakietu. Zapisz `plik:linia` flagi.
★★ Pamiętaj o kształcie **„flaga OFF w kodzie ≠ wyłączona"**: w sześciu rodzinach zmienna
środowiskowa omija flagę wczesnym `return true`.

**Wymagany dowód:** `evidence/g19/day361/r2-triaz.md` — dziewięć wierszy, kategoria,
**wykluczenie dwóch pozostałych**, `plik:linia`, liczby zbiorcze `(a)`/`(b)`/`(c)`.
**Commit po każdych trzech modułach.**

---

## R3 — WYJĘCIE TEGO, CO MASZYNOWE (rdzeń)

Jeżeli `R2` wykaże wiersz, który **da się zamknąć maszynowo** — zamykasz go, ale z pełnym
rygorem, bez ani jednego skrótu:

1. Kontener `cx-day361-pg`, port `6432`, baza `cx361`, obraz `pgvector/pgvector:pg16`.
   Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`.
2. **Para** przez realny `ApiGateway` z realnym JWT: obcy odmowa, właściciel `200`
   **z niepustym ciałem**, na **tym samym identyfikatorze istniejącego obiektu**. Zapisz oba
   kody i obie długości. ★★ **Symetryczna odmowa nie jest dowodem** — to kształt „zamknięte
   przez wygaszenie": funkcja wyłączona dla wszystkich, bramka zielona, produkt martwy.
3. **Mutacja celująca w ZABEZPIECZENIE**, nie w mechanizm: kasujesz to, co odróżnia obcego od
   właściciela. Jeżeli test czerwienieje z **innego** powodu — chybiłeś, przecelowujesz
   i **zapisujesz, że pierwsza próba chybiła**. Mutacja po `cp` do `SCRATCH`, przywrócenie
   przez `cp` (**nigdy `git stash`**, `Z27`), `git diff` **pusty**.
4. **Przelot z `--retry=0` i `--reporter=json --outputFile=<ARTEFAKTY>`**, `numTotalTests`
   podany. ★★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0` i **nie jest
   pomiarem**. `No test files found` i `Transform failed` to **BŁĄD KOMENDY**, nie `PASS`.
5. **Sprzątanie:** `docker rm -fv cx-day361-pg`, `df -h /` przed i po. ★ **Zakaz
   `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

★★ **Jeżeli ŻADEN wiersz nie da się zamknąć maszynowo — to jest wynik, nie porażka.**
Piszesz to wprost, **per moduł**, z powodem: *„`X` nie da się zamknąć maszynowo, bo …"*.
Wtedy kontenera nie stawiasz w ogóle i zapisujesz, że nie był potrzebny.

**Wymagany dowód:** albo pełny dowód dla wskazanych wierszy (para + mutacja + `numTotalTests`
+ pusty `git diff`), albo jawne zdanie „zero wierszy zamykalnych maszynowo, bo …" **per moduł**.
**Commit po `R3`.**

---

## R4 — PAKIET DLA WŁAŚCICIELA (rdzeń, główny produkt)

Tworzysz **NOWY** plik `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`.
Naśladujesz **strukturę** istniejącego `PRZELOT_WLASCICIELA_STAGING_20260904.md`
(**nie nadpisujesz go** — tamten dotyczy `G16` i jest nietykalny).

**Nagłówek pakietu — obowiązkowe pola:**

| Pole | Dlaczego obowiązkowe |
| --- | --- |
| **Czego dotyczy** | `G19` = „czy coś się zepsuło od czasu odbioru", a **nie** `G16` = „przed/po naprawach". Właściciel musi wiedzieć, czego szuka |
| **SHA, na którym pakiet obowiązuje** | `DEC-392`: wpis niesie datę i SHA |
| **Data wystawienia i dzień wygaśnięcia** | `DEC-392`: **7 dni**, potem `PASS_STALE` |
| **Zdanie o wersji stagingu** | spór `1c4b5a5635` vs `fb6547b7d0` jest otwarty; `Z28` zakazuje sprawdzenia. **Pakiet nie twierdzi, że staging stoi na tym SHA** — mówi, że weryfikację wersji robi nadzorca przed przelotem |
| **Ile to zajmie** | właściciel planuje czas; istniejący pakiet mówi „60–90 minut" |

**Sekcje wspólne (naśladujesz):** „Zanim zaczniesz" · „Jak zgłaszać uwagę" (jedna linia na
uwagę: **moduł · ekran · co widzę · czego oczekiwałem · zrzut**) · **„Czego NIE zgłaszaj
nigdy"**.

★★★ **Sekcja „Czego NIE zgłaszaj" jest najważniejszą częścią pakietu.** Bez niej właściciel
zgłosi rzeczy świadomie odłożone do fali 2 i rozliczymy je po raz trzeci. Do tej sekcji
wchodzą **wyłącznie** rzeczy, które masz **udokumentowane numerem decyzji albo ścieżką** —
nigdy Twoje przypuszczenia.

**Sekcja per moduł — dziewięć sekcji, każda z czterema polami:**

1. **Kroki** — dosłowna ścieżka kliknięć, od wejścia do modułu do obiektu obserwacji.
2. **Rekord** — ★★ **„otwórz rekord z PRAWDZIWĄ nazwą (klient, projekt, inicjatywa), nie
   »Showcase«, »Przykład«, »Demo«. Jeśli lista jest pusta — zapisz to jako uwagę, nie
   improwizuj na rekordzie pokazowym."** To zdanie ma być w **każdej** sekcji: rozjazd
   „ekran zatwierdzony na fiksturze ≠ ekran z listy" kosztował nas tydzień przy Inicjatywach.
3. **Co się zmieniło od odbioru** — konkretnie, z nazwą komponentu z listy dryfu (`02` →
   `NModeLeftNav` i formularze; `03` → formularze współdzielone i `ErrorState`; `07` →
   warunkowe renderowanie wspólnej powłoki; `09` → `HelpButton`/`ErrorState`/PL-EN;
   `10` → treść i stany warunkowe PL/EN; `12` → formularze i stany błędów/pustki;
   `14` → `HelpButton`/`ErrorState` i dane warunkowe; `15` → formularze współdzielone;
   `16` → realny rekord partnera w PL/EN). ★ **Sprawdź każde wskazanie w kodzie**, zanim je
   przepiszesz — to są wskazania dyżuru 353, nie ustalenia.
4. **Czego NIE zgłaszaj w tym module** — z numerem decyzji albo ścieżką.

★ **Język i motyw:** wzorzec mówi, że przełączenie PL↔EN i jasny↔ciemny wystarczy zrobić
**raz w całym przelocie**. Zachowaj to — pakiet ma być wykonalny w jednym posiedzeniu.

★ **Tabela na końcu**: dziewięć wierszy, kolumna na datę wykonania części, żeby właściciel
mógł rozłożyć przelot na raty.

**Wymagany dowód:** plik pakietu w repo · lista dziewięciu sekcji z czterema polami każda ·
zdanie w raporcie, które wskazania 353 potwierdziłeś w kodzie, a które obaliłeś.
**Commit po `R4`.**

---

## R5 — PODNIESIENIE WIERSZY (wyłącznie z dowodem)

1. Podnosisz **wyłącznie** wiersze zamknięte w `R3`, z **pięcioma polami**: `data=`, `sha=`,
   `mianownik=<liczba> wg <ścieżka>`, **pełna nazwa przypadku**, **ścieżka artefaktu**.
   Wiersz bez któregokolwiek pola jest wpisem bez dowodu.
2. **Wpis i dowód idą JEDNYM commitem.**
3. **Policz: ile wierszy podniosłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe.**
4. **Zero podniesionych wierszy jest oczekiwanym i pełnowartościowym wynikiem tego dyżuru** —
   pod warunkiem, że `R1`, `R2` i `R4` są wykonane, a raport mówi **per moduł**, dlaczego.
5. ★ **Dla wierszy `(c)` zaproponuj brzmienie, którego użyje przyszły dyżur PO przelocie
   właściciela** — gotowy szablon z pustymi polami `data=`/`sha=`, żeby następny nie musiał
   go wymyślać. **Nie wpisujesz go do macierzy.**

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód → pięć pól" · dwie zgodne liczby · szablon dla `(c)`. **Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY361_G19_KUBELEK_C_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, na początku.
2. `R1`: werdykt o etykiecie, z liczbą i cytatami.
3. `R2`: tabela dziewięciu wierszy z kategorią i **wykluczeniem dwóch pozostałych**;
   liczby zbiorcze `(a)`/`(b)`/`(c)`.
4. `R3`: co zamknięto maszynowo albo jawne „zero, bo …" per moduł.
5. `R4`: co zawiera pakiet; **które wskazania dyżuru 353 potwierdziłeś w kodzie, a które
   obaliłeś** — imiennie.
6. `R5`: ile wierszy, ile dowodów; szablon dla `(c)`.
7. **Pytania do właściciela** — rozstrzygalne, z wariantami i konsekwencjami.
8. Co zostało niewykonane i dlaczego — imiennie, per moduł.
9. `df -h /` przed i po.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AC`**, sprawdzana komendą
**tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`; litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AC` jest zajęta, bierzesz pierwszą wolną i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `R1` dał **zmierzony** werdykt o etykiecie `OWNER_RETEST_PENDING` — z cytatami dla
   wszystkich dziewięciu i testem „podmień nazwę modułu".
2. `R2` przypisał **każdemu** z dziewięciu dokładnie jedną kategorię `(a)`/`(b)`/`(c)`
   **z wykluczeniem dwóch pozostałych**; **ani jedno `(c)` nie brzmi „przelot właściciela
   pozostaje wymagany"** bez ekranu, ścieżki kliknięć, rodzaju rekordu i przedmiotu obserwacji.
3. Każde `(b)` niesie **nazwę trasy i strażnika z `plik:linia`** — gotową do zlecenia.
4. `R3` albo zamknął wskazane wiersze z parą, mutacją celującą w zabezpieczenie i pustym
   `git diff`, albo napisał **per moduł**, dlaczego się nie da.
5. Pakiet `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md` istnieje, ma nagłówek z **SHA,
   datą i dniem wygaśnięcia**, sekcję **„Czego NIE zgłaszaj"** i **dziewięć** sekcji
   modułowych po cztery pola.
6. Pakiet **nie twierdzi**, że staging stoi na jakimkolwiek SHA.
7. Każdy podniesiony wiersz ma **pięć pól** i dowód w **tym samym** commicie; **liczba
   podniesionych = liczbie dowodów**. Zero podniesionych jest dopuszczalne.
8. **Żaden wiersz nie brzmi `TECHNICAL_REGRESSION_PASS` ani synonimem.**
9. **Ani jeden z siedmiu wierszy kubełka `A` nie został dotknięty**; pakiet `G16` nietknięty;
   `git diff` na kodzie produktu pusty.
10. Liście słowników i cztery bramki identyczne przed i po; kontener (jeżeli powstał) usunięty;
    `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6432`, `5572`) jest zajęty — **STOP całości, nigdy podmiana**;
- `evidence/g19/day353/r4-orzeczenie.md` albo `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`
  **nie istnieje** — wtedy zniknęła podstawa albo wzór tego dyżuru i trzeba to zgłosić;
- sekcja `R` (`DEC-392`) rejestru nie istnieje — reguła ważności jest podstawą pakietu;
- realizacja `R5` wymagałaby wpisania stanu, który jest synonimem odrzuconego
  `TECHNICAL_REGRESSION_PASS`;
- pakiet wymagałby połączenia ze stagingiem, demo albo produkcją w którąkolwiek stronę
  (`Z28`) — **wtedy pakiet zostaje bez tego kroku, z jawną adnotacją**, a STOP dotyczy
  wyłącznie tego kroku, nie całości.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „to nie jest dyżur od podnoszenia wierszy" × „jeżeli da się zamknąć — zamknij" | `R3` — zamykasz **tylko to**, co przejdzie pełny rygor dowodu; reszta zostaje |
| „pakiet dla właściciela" × „pakiet nie jest dowodem" | `R0` zasada 2 — pakiet to przygotowanie; wiersz zmienia stan wyłącznie z dowodem |
| „ustal, czego brakuje" × „zakaz robienia zrzutów i renderowania" | `R2` — ustalasz **z kodu i historii**, a wynikiem jest instrukcja dla oczu właściciela, nie obraz |
| „sprawdź, czy etykieta jest hurtowa" × „nie zamieniaj tezy nadzorcy w fakt" | `R1` — teza jest **pytaniem pomiarowym**; obie odpowiedzi pełnowartościowe, byle zmierzone |
| „naśladuj istniejący pakiet" × „nie nadpisuj go" | `B.1` — nowy plik `PRZELOT_WLASCICIELA_G19_20260904.md`; tamten dotyczy `G16` |
| „pakiet ma mówić, na czym stoi" × „`Z28` zakazuje sprawdzenia stagingu" | `R4`, nagłówek — pakiet podaje **SHA, na którym obowiązuje**, i oddaje weryfikację wersji nadzorcy |
| „dowód ważny 7 dni" × „pakiet dla właściciela na później" | `R4` — pakiet **niesie własną datę wygaśnięcia**; przelot po terminie wymaga odświeżenia pomiaru, nie nowego pakietu |
| „zakaz zmiany kodu produktu" × „mutacja w `R3`" | `B.1` — mutacja **tymczasowa**, po `cp`, przywracana przez `cp`, z pustym `git diff` |
| „dziewięć wierszy" × „zakaz hurtu" | `R2` — każdy wiersz ma **własne** wykluczenie dwóch kategorii; dziewięć takich samych uzasadnień = dyżur odrzucony |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g19/day361/**` |
| „mandat CTO — decyduj sam" × „pytania do właściciela" | `R6` punkt 7 — triaż i pakiet rozstrzygasz sam; do właściciela idzie wyłącznie to, co wymaga jego oczu albo decyzji produktowej |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`, `evidence/g19/day361/**`, raport, sekcja `AC` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; liczba `8` (etykieta hurtowa) zmierzona przeze mnie 04.09 |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (cytat · zdanie · wskazanie `plik:linia`) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; `R2` idzie moduł po module, `R4` to jeden nowy dokument |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec 359, 360, 362); `6432`/`5572` zmierzone jako wolne. ★ 363–366 pisze inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 353 ma ścieżkę artefaktu |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
