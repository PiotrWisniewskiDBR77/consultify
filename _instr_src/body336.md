## Po co ten dyżur istnieje

Bramka **G15 — „Integrator self-QA and impacted regression"** jest jedyną bramką macierzy,
w której **jeden moduł ma `PASS`, a pozostałe piętnaście ma sześć różnych podtypów porażki
zlepionych w jedną kolumnę**. Dopóki te podtypy nie są rozłożone na czynniki, nikt nie umie
odpowiedzieć na najprostsze pytanie: **ile z tej bramki to dług, którego dziś nikt nie ruszy,
a ile to praca do wykonania jedną komendą na moduł.**

**Stan zastany, zmierzony na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:**

| Moduł | Stan `G15` |
| --- | --- |
| `01_ORGANIZATION` | `PASS` |
| `02_INTERVIEW` | `PARTIAL_PASS / RED_LEGACY_7` |
| `03_TOOLS` | `PARTIAL_PASS / RED_LEGACY_1` |
| `04_ASSESSMENT` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `05_INITIATIVES` | `NOT_MEASURED / RED_LEGACY_1_CONFIRMED` |
| `06_EXECUTION` | `NOT_MEASURED / RED_LEGACY_1_CONFIRMED` |
| `07_MY_WORK_AGENT` | `PARTIAL_PASS / RED_LEGACY_2_PLUS_RED_NEW_1` |
| `08_MEETINGS` | `NOT_MEASURED / RED_LEGACY_1_CONFIRMED` |
| `09_RESULTS` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `10_FINANCE` | `PARTIAL_PASS / RED_LEGACY_1` |
| `11_MATERIALS` | `PARTIAL_PASS / RED_LEGACY_2` |
| `12_AUDITS` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `13_CHAT` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `14_ADMIN` | `PARTIAL_PASS / RED_LEGACY_7` |
| `15_SETTINGS` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `16_PARTNER` | `NOT_MEASURED / RED_LEGACY_2_CONFIRMED` |

Razem: **1 `PASS`, 11 `PARTIAL_PASS`, 4 `NOT_MEASURED`**.

**Te podtypy znaczą dwie zupełnie różne rzeczy, a stoją w jednej kolumnie:**

- **`RED_LEGACY_N`** — N czerwieni, dla których **istnieje para bazowa** i które reprodukują
  się na bazie. To jest **DŁUG ZASTANY**. Ten dyżur go **mierzy i wypisuje z nazwy**,
  **nie naprawia**.
- **`SERVER_NOT_MEASURED`** — front jest **w 100% zielony** (`04`: 620/620, `09`: 418/418,
  `12`: 17/17, `13`: 439/439, `15`: 13/13), a **warstwa serwerowa modułu nigdy nie została
  uruchomiona** — mimo że serwerowe katalogi testów **są w mianowniku** rejestru
  `REJESTR_G15_SAMOKONTROLA_20260903.md` sekcja R1. To jest **BRAK POMIARU**, czyli praca
  do wykonania **w tym dyżurze**.
- **`NOT_MEASURED / RED_LEGACY_N_CONFIRMED`** — klasy `ZASTANA`/`NOWA` **nie dało się
  orzec**, bo baza `f65c4ff6a0` miała **nierozstrzygnięty marker konfliktu**
  w `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx:110`, przez co pliki testowe
  dotykające grafu importów tego komponentu **wykonały na bazie zero przypadków**. To też
  jest **BRAK POMIARU** — i to taki, którego przyczyna **już nie istnieje**.
- **`RED_LEGACY_2_PLUS_RED_NEW_1`** (`07_MY_WORK_AGENT`) — jedyna czerwień w całej bramce
  sklasyfikowana jako **NOWA**: `MYW-IDEAS-010`.

**★★ Dwa fakty, które zmieniają obraz i które daję z góry do sprawdzenia:**

1. **Pomiar G15 jest podwójnie nieaktualny.** Baza `f65c4ff6a0` leży **662 commity** za
   `HEAD`, marker dyżuru `35afcb15fd` — **599 commitów**.
2. **Przeszkoda, która wyprodukowała cztery `NOT_MEASURED`, na `HEAD` już nie istnieje.**
   Marker konfliktu w `PreviewAIHintStrip.tsx` został rozstrzygnięty; plik się kompiluje.
   **Klasę `ZASTANA`/`NOWA` da się dziś orzec uczciwie** — czego 03.09 zrobić się nie dało.
3. **Jedyna czerwień `NOWA` w całej bramce** (`MYW-IDEAS-010`) figuruje dziś w rejestrze
   P0/P1 jako **`NAPRAWIONE` z SHA `a995ca4c20`**. Sprawdź, czy bramka nie niesie defektu,
   którego już nie ma.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- rozkład G15: **1 / 11 / 4** dokładnie jak w tabeli wyżej;
- `f65c4ff6a0` = przodek `HEAD`, **662 commity**; `35afcb15fd` = przodek, **599 commitów**;
- `PreviewAIHintStrip.tsx` **nie zawiera** markerów konfliktu i **kompiluje się** pod
  `esbuild`;
- serwerowe katalogi testów z mianownika **istnieją i nie są puste**:
  `server/src/routes/resultsVnext/__tests__` = **19** plików,
  `server/src/services/assessment/__tests__` = **13**,
  `server/src/routes/audits/__tests__` = **7**,
  `server/src/services/chatHandoff/__tests__` = **3**,
  `server/src/services/tools/__tests__` = **2**,
  `server/src/services/interview/__tests__` = **1**;
- `REJESTR_G15_SAMOKONTROLA_20260903.md` **nie jest generowany** przez żaden skrypt
  (`grep -rl 'REJESTR_G15' scripts/` nie znajduje nic) — dopisek do niego jest bezpieczny;
- `MYW-IDEAS-010` ma w rejestrze P0/P1 werdykt `NAPRAWIONE / SHA_OK / a995ca4c20`, a commit
  jest przodkiem `HEAD`;
- liście słowników: **pl 35198**, **en 33065**;
- **moje kontrolne liczniki plików testowych na `HEAD`** (do porównania z rejestrem, który
  liczył na `35afcb15fd`): `15_SETTINGS` = **7** (rejestr: 7), `13_CHAT` = **52**
  (rejestr: 51), `12_AUDITS` = **29** przy trzech z czterech katalogów (rejestr: 41 przy
  czterech). **Rozbieżności są oczekiwane — zmierz swoje i zapisz je.**

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**` | **TYLKO ODCZYT** — schemat jest kontraktem produktu; jeżeli test się o niego rozbija, przestarzały jest test | Cytat wiersza schematu + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa" w tym dyżurze znaczy: realne żądanie HTTP przez realny `ApiGateway`, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**` | **TYLKO ODCZYT** — ten dyżur URUCHAMIA testy tych tras, nie zmienia tras | Wpis do raportu: plik, linia, czerwień, klasa, rekomendacja jako diff **nienałożony** |
| **Serwis** | `server/src/services/**`, `server/src/domain/**` | **TYLKO ODCZYT** | jak wyżej |
| **Repozytorium** | `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Produkt UI (moduły)** | `src/components/**`, `src/views/**` | **TYLKO ODCZYT.** Ten dyżur MIERZY, nie naprawia — także wtedy, gdy czerwień wygląda na łatwą do usunięcia | Wpis do raportu z `plik:linia` i klasą czerwieni |
| **Produkt UI (współdzielony, 8 plików z rejestru)** | `RightRail.tsx`, `NModeLeftNav.tsx`, `CommentsCanvas.tsx`, `PreviewAIHintStrip.tsx`, `PreviewActivityStrip.tsx`, `EmptyState.tsx`, `EvidencePanelSection.tsx`, `ColumnResizer.tsx` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To są pliki, których zmiana wywołała całą bramkę; ich dotknięcie unieważnia pomiar | Opis w raporcie |
| **Testy — istniejące** | wszystkie katalogi z sekcji R1 rejestru G15 (front i serwer) | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **dodawać** nowe przypadki. **Zakaz** zmiany progu, usuwania asercji i zawężania zakresu, żeby zzielenieć — każda zmiana istniejącej asercji wymaga dowodu mutacyjnego, że test nadal broni tego, co bronił | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Dowody** | `evidence/g15/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Rejestr G15** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 336" — historia pomiaru z 03.09 zostaje **nietknięta**; sprawdź komendą (5), że plik nie jest generowany | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G15`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**, i **nigdy przez zawężenie kryterium**. Zakaz dotykania wierszy `G00`–`G14` i `G16`–`G20` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jeden wiersz, dopisany | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336_G15_ROZKLAD_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `scripts/dev/p0p1-licznik-e1.mjs`, wiersz `G20` (dyżur 334) · wiersz `G19`, `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` (dyżur 335) · `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx`, `dev-render/**` (dyżur 337) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) trzy bramki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | rozkład stanów `G15` | `1 PASS / 11 PARTIAL_PASS / 4 NOT_MEASURED` | komenda (1) z `§0.3` | TAK — czyta kolumnę statusu wszystkich 16 plików |
| 2 | liczba wystąpień każdego z sześciu podtypów | `SERVER_NOT_MEASURED` 5 · `RED_LEGACY_7` 2 · `RED_LEGACY_1` 2 · `RED_LEGACY_2` 1 · `RED_LEGACY_2_PLUS_RED_NEW_1` 1 · `RED_LEGACY_1_CONFIRMED` 3 · `RED_LEGACY_2_CONFIRMED` 1 | wynik (1) przepuszczony przez `sort \| uniq -c` | TAK — suma = 15 + 1 `PASS` = 16, **sprawdź to jawnie** |
| 3 | dystans bazy i markera G15 od `HEAD` | `662` / `599` commitów | komenda (2) z `§0.3` | TAK |
| 4 | czy przyczyna czterech `NOT_MEASURED` nadal istnieje | **NIE** — zero markerów konfliktu, `esbuild` OK | komenda (3) z `§0.3` | TAK — sprawdza **kompilowalność**, nie samą obecność pliku |
| 5 | czy serwerowe katalogi mianownika są niepuste | `19 / 13 / 7 / 3 / 2 / 1` plików | komenda (4) z `§0.3` | TAK — **to obala „nie ma czego mierzyć"** |
| 6 | liczba plików testowych per moduł na `HEAD` | patrz „Zmierz moje liczby sam" | `find <katalogi modułu> -name '*.test.*' -o -name '*.spec.*' \| wc -l` | TAK — **porównaj z rejestrem liczonym na `35afcb15fd`** |
| 7 | wykonane przypadki per przebieg | — | pole `numTotalTests` z raportu JSON | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |
| 8 | czerwienie per moduł: warstwa front | — | przebieg wariantem (C) | TAK |
| 9 | czerwienie per moduł: warstwa serwer | — | przebieg wariantem (B) na `cx336` | TAK — **to jest brakujący pomiar** |
| 10 | klasa każdej czerwieni | `ZASTANA` / `NOWA` | ta sama pełna nazwa przypadku na bazie `f65c4ff6a0` **i** na `HEAD` | TAK — **tylko jeżeli baza się skompilowała** |
| 11 | status `MYW-IDEAS-010` | `NAPRAWIONE / a995ca4c20` | komenda (6) z `§0.3` | TAK |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336_G15_ROZKLAD_REPORT.md` ·
`evidence/g15/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` **wyłącznie wiersz
`G15`, wyłącznie razem z dowodem w tym samym commicie** ·
`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` (sekcja
dopisana) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz) · nowe pliki testowe
(tylko jeżeli `R3` wykaże, że brakuje kontraktu — z `git add -f`).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/**` (ten dyżur **MIERZY produkt, nie zmienia
go**), `public/locales/**`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `.github/workflows/**`, `server/migrations/**`,
`scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md`, `evidence/g19/**`,
`G19_INWENTARZ_OBOWIAZKOW_20260903.md`, wiersze `G00`–`G14` i `G16`–`G20` macierzy,
`dev-render/**`, `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day336-g15-rozklad
git diff --name-only --cached | tee /private/tmp/cx-day336-g15-rozklad-artefakty/staged.txt
bash -c "grep -iE '^src/|^server/src/|^public/locales/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|p0p1-licznik|REJESTR_P0P1|evidence/g19|G19_INWENTARZ|dev-render/|controlEnumeration' /private/tmp/cx-day336-g15-rozklad-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — DWIE TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM commicie.**
Commit dotykający `MODULE_ACCEPTANCE.md` musi w tym samym `git show --stat` zawierać plik
dowodowy (`evidence/g15/*`) albo plik testu, na który wiersz się powołuje. Wpis bez dowodu
jest podstawą odrzucenia **całego dyżuru**.

**(2) `PARTIAL_PASS` nie staje się `PASS` przez zawężenie kryterium.** Najprostsza droga do
zzielenienia pięciu wierszy `SERVER_NOT_MEASURED` prowadzi przez napisanie, że warstwa
serwerowa nie należy do mianownika G15. **Należy** — `REJESTR_G15_SAMOKONTROLA_20260903.md`
sekcja R1 wymienia serwerowe katalogi testów w mianowniku **każdego** modułu, i katalogi te
istnieją oraz nie są puste (komenda (4)). Zawężenie kryterium jest zmierzonym kształtem
„bezpiecznik nagradza defekt": **im większy brak pomiaru, tym łatwiej przejść kryterium po
jego zawężeniu.**

**Jeżeli uważasz, że kryterium jest źle postawione — piszesz to WPROST, jako pytanie do
właściciela w `R6`, i NIE przepisujesz go po cichu.** Pytanie ma być rozstrzygalne
(„tak"/„nie"), np.: *„Czy warstwa serwerowa modułu ma należeć do mianownika G15, skoro
osobne bramki mierzą kontrakty tras?"* — a nie opisem problemu.

**Wymagany dowód:** dwa zdania w raporcie, że przeczytałeś obie zasady, plus `git show --stat`
każdego commita dotykającego macierzy. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DEKODOWANIE SZEŚCIU PODTYPÓW (rdzeń)

Dla **każdego** z sześciu podtypów (`RED_LEGACY_1`, `RED_LEGACY_2`, `RED_LEGACY_7`,
`RED_LEGACY_2_PLUS_RED_NEW_1`, `SERVER_NOT_MEASURED`, `RED_LEGACY_N_CONFIRMED`) produkujesz
w raporcie:

1. **Co dokładnie znaczy** — jedno zdanie, z **cytatem źródła**. Źródłem są skorygowane
   zdania G15 z odbioru dyżuru 286 (komenda (7) z `§0.3`, wiersze ok. 148–170) oraz treść
   samych komórek `G15` w macierzy. **Nie parafrazujesz — cytujesz.**
2. **Ile wierszy go nosi** — liczba, z komendą.
3. **Do której kategorii należy**: **DŁUG ZASTANY** (nie do naprawy w tym dyżurze)
   czy **BRAK POMIARU** (do wykonania).
4. **Co konkretnie trzeba zrobić**, żeby wiersz przestał go nosić.

★ **Nie zakładaj, że mój podział jest poprawny.** Ja twierdzę, że `RED_LEGACY_*` bez sufiksu
`_CONFIRMED` to dług zastany, a `SERVER_NOT_MEASURED` i `*_CONFIRMED` to brak pomiaru.
**Sprawdź to na cytatach.** Obalenie mojego podziału jest sukcesem dyżuru.

**Wymagany dowód:** tabela sześciu podtypów z cytatami, liczbami i kategorią.
**Commit po `R1`.**

## R2 — PODZIAŁ 16 WIERSZY: DŁUG ZASTANY KONTRA BRAK POMIARU (rdzeń)

Tabela **16 wierszy**, każdy z: modułem · obecnym stanem · **liczbą czerwieni klasy
`ZASTANA`** · **liczbą czerwieni klasy `NOWA`** · **liczbą czerwieni klasy NIEORZECZONEJ** ·
**czy warstwa serwerowa była mierzona (TAK/NIE)** · kategorią (`DŁUG` / `BRAK POMIARU` /
mieszany) · **co dokładnie zamknęłoby ten wiersz**.

Do tego **dwie liczby zbiorcze**, które są głównym produktem tej pozycji:

- **ile wierszy stoi WYŁĄCZNIE na długu zastanym** (czyli nie da się ich domknąć w tym
  dyżurze bez naprawiania produktu — a naprawianie produktu jest tu **zakazane**);
- **ile wierszy stoi WYŁĄCZNIE na braku pomiaru** (czyli domykają się przebiegiem).

★ **Wypisz dług z nazwy.** Każda czerwień klasy `ZASTANA` ma trafić do
`evidence/g15/day336-dlug-zastany.md` z **pełną nazwą przypadku** (`Z37`), plikiem i modułem.
„Siedem czerwieni zastanych" bez nazw nie jest wynikiem — jest zaokrągleniem.

**Wymagany dowód:** tabela 16 wierszy, dwie liczby zbiorcze, plik z imienną listą długu.
**Commit po `R2`.**

## R3 — WYKONANIE BRAKUJĄCYCH POMIARÓW SERWEROWYCH (rdzeń)

**To jest pozycja, w której dyżur produkuje brakujący pomiar, a nie tylko go opisuje.**

1. **Postaw kontener** `cx-day336-pg` na porcie `6372`, baza `cx336`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi ma być bezbłędny i bez zmian
   (idempotencja). `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Dla każdego modułu** uruchom **serwerowe** katalogi testów z jego mianownika (sekcja R1
   rejestru G15), z cwd `server/`, wariantem (B), `--retry=0`,
   `--reporter=json --outputFile=/private/tmp/cx-day336-g15-rozklad-artefakty/<modul>-serwer.json`.
   ★ Zacznij od pięciu modułów z podtypem `SERVER_NOT_MEASURED` (`04`, `09`, `12`, `13`, `15`) —
   tam front jest w 100% zielony i **serwer jest jedyną otwartą rzeczą**.
3. **Podaj `numTotalTests`, nie tylko `numFailedTests`.** Przebieg, w którym wykonało się
   zero przypadków, kończy się `exit 0` i **nie jest pomiarem**. `No test files found` to
   **BŁĄD KOMENDY**.
4. **Każda czerwień dostaje klasę** — patrz `R4`. Czerwień bez klasy jest wynikiem
   niepełnym.
5. **Nie naprawiasz produktu.** Jeżeli czerwień wygląda na trywialną do usunięcia —
   opisujesz ją w raporcie z `plik:linia` i **rekomendacją jako diff nienałożony**. To jest
   pozycja pomiarowa.
6. **Sprzątanie:** `docker rm -fv cx-day336-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po. Program stracił dobę na dysku zjedzonym przez niesprzątnięte artefakty.

**Wymagany dowód:** dla każdego z 16 modułów: komenda, `numTotalTests`, `numPassedTests`,
`numFailedTests`, ścieżka do JSON-a; osobno wyróżnione pięć modułów `SERVER_NOT_MEASURED`;
wynik obu przebiegów migracji; `df -h /` przed i po. **Commit po `R3`.**

## R4 — KLASA `ZASTANA`/`NOWA` NA BAZIE, KTÓRA SIĘ KOMPILUJE

Cztery moduły (`05`, `06`, `08`, `16`) mają `NOT_MEASURED`, bo baza `f65c4ff6a0` nie
kompilowała się w miejscu, które te testy importują. **Ta przeszkoda już nie istnieje.**

1. **Załóż worktree bazowy** z `f65c4ff6a0` w
   `/private/tmp/cx-day336-g15-rozklad-artefakty/baza` (**POZA repo**, `Z13`).
2. **Rozstrzygnij marker konfliktu na bazie** — kopią pliku z `HEAD` do worktree bazowego
   (przez `cp`, nigdy `git stash`), tak jak zrobił to odbiór 03.09 („baza naprawiona").
   **Zapisz dokładnie, co zrobiłeś** — to jest ingerencja w bazę pomiaru i musi być jawna.
3. **Zanim uruchomisz cokolwiek — sprawdź, że baza się kompiluje**: `esbuild` na plikach
   czerwonych i na `PreviewAIHintStrip.tsx`. **`Transform failed` jest błędem komendy, nie
   wynikiem.** Baza, na której plik wykonał zero przypadków, **nie jest bazą**.
4. **Dla każdej czerwieni** porównaj **pełną nazwę przypadku** (`Z37`) na bazie i na `HEAD`:
   ta sama nazwa czerwona po obu stronach ⇒ `ZASTANA`; czerwona tylko na `HEAD` ⇒ `NOWA`;
   nieuruchomiona po którejkolwiek stronie ⇒ `NIEORZECZONA`, i **tak ją zapisujesz**, nie
   zgadujesz.
5. **Skasuj worktree bazowy** po pomiarze; `df -h /` przed i po.

**Wymagany dowód:** dowód kompilowalności bazy, tabela czerwieni z klasami i pełnymi nazwami,
opis ingerencji w bazę, `df -h /` przed i po, potwierdzenie skasowania worktree.
**Commit po `R4`.**

## R5 — JEDYNA CZERWIEŃ `NOWA` W CAŁEJ BRAMCE

`07_MY_WORK_AGENT` niesie podtyp `RED_LEGACY_2_PLUS_RED_NEW_1`, gdzie `NOWA` to
`MYW-IDEAS-010`. Rejestr P0/P1 daje tej pozycji dziś werdykt `NAPRAWIONE / SHA_OK /
a995ca4c20`.

1. Sprawdź komendą (6), czy commit jest przodkiem `HEAD` i **czego dotyka** (`git show
   --stat`).
2. **Uruchom przypadek, który był czerwony**, na `HEAD` i podaj jego **pełną nazwę** oraz
   wynik.
3. Rozstrzygnij: czy bramka niesie defekt, którego już nie ma. Jeżeli tak — **to jest
   propozycja zmiany podtypu wiersza `07`** (z dowodem w tym samym commicie). Jeżeli nie —
   opisz, co dokładnie jest nadal czerwone.
4. ★ **Sprawdź RODZINĘ, nie tylko tę jedną pozycję.** Program ma zmierzony kształt „zlecenie
   obejmuje rodzinę": wypisz **wszystkie** pozycje `MYW-IDEAS-*` z rejestru P0/P1 i ich
   werdykty, zanim uznasz rodzinę za rozliczoną.

**Wymagany dowód:** `git show --stat` commita, pełna nazwa przypadku i jego wynik na `HEAD`,
tabela rodziny `MYW-IDEAS-*`. **Commit po `R5`.**

## R6 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: stan PRZED/PO wszystkich 16 wierszy · **tabelę sześciu podtypów z cytatami**
z `R1` · **tabelę 16 wierszy z podziałem na dług i brak pomiaru** oraz dwie liczby zbiorcze
z `R2` · **wyniki pomiarów serwerowych** z `R3` (`numTotalTests` dla każdego modułu) ·
**tabelę klas czerwieni** z `R4` z pełnymi nazwami · rozstrzygnięcie `MYW-IDEAS-010` z `R5` ·
**imienną listę długu zastanego** · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy **akapit `§0.2e`** dla
każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA O KRYTERIUM".** Jeżeli w trakcie
pracy uznasz, że któreś kryterium G15 jest źle postawione (np. że warstwa serwerowa nie
powinna być w mianowniku, albo że dług zastany nie powinien blokować bramki) — **piszesz to
tutaj, jako pytanie rozstrzygalne, i NIE zmieniasz kryterium sam**. Sekcja może być pusta,
ale wtedy piszesz wprost: „nie mam zastrzeżeń do kryterium".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`.

**Commit po `R6`.**

## Próg odbioru

**Każdy z sześciu podtypów `G15` ma jednozdaniową definicję z cytatem źródła; każdy z 16
wierszy ma przypisaną kategorię (dług zastany / brak pomiaru) z liczbami; brakujące pomiary
serwerowe są WYKONANE z `numTotalTests` dla każdego modułu; każda czerwień ma klasę orzeczoną
na bazie, która się skompilowała, albo jest jawnie oznaczona jako NIEORZECZONA.**

Żaden wiersz nie zmienia stanu na `PASS` przez zawężenie kryterium. Zastrzeżenie do kryterium
jest **pytaniem w raporcie**, nigdy cichą zmianą.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „sześć podtypów rozłożone na
czynniki z cytatami, k wierszy stoi wyłącznie na długu zastanym, l wyłącznie na braku pomiaru,
pomiary serwerowe wykonane dla m modułów, dług wypisany imiennie" — **jest pełnowartościowym
wynikiem, nawet jeśli ani jeden wiersz nie zmienił stanu.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Domknij maszynowe" vs „zakaz zamiany `PARTIAL` na `PASS`" | `R0` (2) i próg odbioru: domykasz **POMIAR**, nie stan wiersza; stan zmienia się tylko z dowodem i nigdy przez zawężenie kryterium |
| „Zmierz czerwienie" vs „zakaz naprawiania produktu" | `R3` punkt 5: czerwień opisujesz z `plik:linia` i **diffem nienałożonym**; to jest dyżur pomiarowy |
| „Orzeknij klasę `ZASTANA`" vs „baza nie kompilowała się" | `R4` punkty 2–3: rozstrzygasz marker konfliktu **kopią z `HEAD` przez `cp`**, jawnie to opisujesz i **najpierw dowodzisz kompilowalności** |
| „Nie dotykasz plików współdzielonych" vs „`R4` kopiuje `PreviewAIHintStrip.tsx`" | `R4` punkt 2: kopia trafia do **worktree bazowego POZA repo**, nie do repo; w repo ten plik pozostaje `TYLKO ODCZYT` |
| „Kryterium jest złe" vs „zakaz przepisywania kryterium" | `R0` (2) i `R6`: piszesz **pytanie rozstrzygalne** do właściciela; sekcja pytań jest obowiązkowa, choćby miała brzmieć „nie mam zastrzeżeń" |
| „Warstwa serwerowa niezmierzona" vs „nie ma czego mierzyć" | Komenda (4) z `§0.3`: katalogi **istnieją i są niepuste** (19/13/7/3/2/1 plików) — „nie ma czego mierzyć" jest obalone pomiarem |
| „`§0.2c` (C) mockuje bazę" vs „testy serwerowe wymagają realnego PG" | Sekcja `SCIEZKI`: front wariantem (C), serwer wariantem (B) na `cx336`; **atrapa nie jest dowodem zapisu** (`Database.ts:686`) |
| „Zero nowych dokumentów" (`Z13`) vs „dopisek do rejestru G15 i pliki dowodowe" | Tabela licencji: rejestr G15 i rejestr znalezisk to **AKTUALIZACJE istniejących**, `evidence/g15/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Worktree bazowy ułatwia dowód" vs `Z13` i próg 5 GB | `R4` punkty 1 i 5: worktree bazowy leży **poza repo**, jest kasowany po pomiarze, `df -h /` przed i po |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R4` punkt 2: kopia przez `cp`; `git diff` w repo po pracy ma nie zawierać plików współdzielonych |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — rejestr G15, odbiór 286, serwerowe katalogi testów sprawdzone; `evidence/g15/` **jawnie oznaczony jako nieistniejący**; jedyny nowy dokument rejestrowy to raport `R6` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1–6, 11 i 12 zmierzone przy wydaniu |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · trasa/montaż · kontroler · serwis · repozytorium · middleware · UI modułowe · UI współdzielone · testy · bezpieczniki · dowody · rejestr · macierz odbioru; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`, `R2`, `R5` nie dotykają kodu; `R3` i `R4` uruchamiają istniejące pakiety, nie zmieniając produktu |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6372/5512 wolne, brak kontenera `cx-day336-pg`, brak gałęzi i worktree; 334/335/337 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: zawężenie kryterium, baza która się nie kompiluje, `0 wykonanych` jako `PASS`, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
