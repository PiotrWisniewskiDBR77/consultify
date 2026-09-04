## Po co ten dyżur istnieje

Bramka **`G19` — „Shared-surface regression obligations after later changes"** jest jedyną
bramką macierzy, w której **wszystkie 16 wierszy stoją na `NOT_PROVEN / OWNER_RETEST_PENDING`**,
mimo że wykonano pod nią bardzo dużo realnej pracy pomiarowej.

Dyżur 335 (scalony 04.09) **nie podniósł ani jednego wiersza — i miał rację**. Jego własny
raport kończy się zdaniem:

> *„Nie proponuję mocniejszego stanu."*

**Powód, dla którego miał rację, jest strukturalny i jest sednem tego dyżuru:** cały dowód
G19 stoi na **zamrożonym markerze `fee24bddb0`**, a bramka mierzy z definicji „obowiązki
regresji po **PÓŹNIEJSZYCH** zmianach". **Bramka, której mianownik rośnie szybciej niż dowód,
mierzy przeszłość i nie domknie się nigdy** — dopóki nikt nie rozstrzygnie, wobec czego ma
być mierzona.

**Stan zastany, zmierzony przeze mnie na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`:**

| Co | Pomiar dyżuru 335 (na `1c4b5a5635`) | **Mój pomiar dziś (na markerze)** |
| --- | --- | --- |
| commitów od `fee24bddb0` | 543 | **615** |
| plików mianownika G19 | 104 | **106** |
| plików bez testów | 89 | **90** |
| `server/src/routes` | (77 serwerowych razem) | **91** |
| `server/src/middleware` | — | **2** |
| `src/components/shared` | 7 | **7** |
| `src/components/ui` | — | **2** |
| `src/components/standard` | 0 | **1** |
| słowniki | 2 | **2** |

**Mianownik urósł o dwa pliki w jeden dzień, a dystans o 72 commity.** To nie jest błąd
dyżuru 335 — to jest własność bramki. **Zapis znaleziska `G19-Z3 = 0 plików` był prawdą, gdy
go zapisano, i jest fałszem dziś.**

**Wszystkie 16 wierszy `G19` mają dziś dokładnie ten sam stan** — sprawdziłem każdy z osobna:
`NOT_PROVEN / OWNER_RETEST_PENDING`, bez wyjątku.

## ★★ TO NIE JEST POWTÓRKA DYŻURU 335 — oto dokładna różnica

Dyżur 335 zostawił w repo cztery rzeczy, których **nie budujesz od nowa**:

1. **Kubełki dla 16 wierszy** (`evidence/g19/day335-kubelki.md`), z imiennym uzasadnieniem
   każdego: **`A` = 7 modułów** (`01`, `04`, `05`, `06`, `08`, `11`, `13`) — luka wykonalna
   maszynowo; **`B` = 0**; **`C` = 9 modułów** (`02`, `03`, `07`, `09`, `10`, `12`, `14`,
   `15`, `16`) — wymaga oczu właściciela na realnym rekordzie.
2. **Trzy mianowniki kotwic G18** — `141 / 125 / 123` plików, nie historyczne `49 / 30 / 28`;
   cztery późne kotwice dają listy **bajtowo identyczne** (`cmp` exit 0).
3. **Wyniki trzech bloków** na markerze `1c4b5a5635`: Blok 1 (UI jednostkowe) `131/127/4`,
   Blok 2 (middleware jednostkowe) `218/218/0`, Blok 3 (trasy przez realny `ApiGateway`/JWT/
   RealPG) `18/12/6`, po naprawie payloadu `day277` — `18/18`.
4. **Parę izolacyjną `day307` z KOMPLETNYM dowodem mutacyjnym**
   (`evidence/g19/day335-r3-maszynowy.md`): przypadek
   `Day 307 paired cross-org GET flight through ApiGateway denies foreign workload lookup
   while the owner reads the seeded task`; obcy token dostaje `404
   TASK_WORKLOAD_USER_NOT_FOUND`, właściciel **ten sam `userId`** czyta `200` z `total: 1`;
   mutacja usuwająca `AND organization_id = ?` z prechecku w `TaskController.getUserWorkload`
   (`server/src/controllers/TaskController.ts` okolice wiersza **2692**) daje RED
   (`expected 200 to be 404`), przywrócenie przez `cp` daje GREEN, `git diff` po przywróceniu
   pusty.

**Twoja robota to trzy rzeczy, których 335 NIE zrobił:**

- **przemiar na BIEŻĄCYM markerze** — jego liczby są sprzed 72 commitów;
- **wykonanie RESZTY kubełka `A`** — 335 wykonał jedną pozycję (`day307`, moduły `01`/`08`),
  a kubełek ma **siedem** modułów; pozostają `04`, `05`, `06`, `11`, `13`;
- **orzeczenie PER WIERSZ, co dokładnie brakuje**, żeby ten konkretny wiersz się podniósł —
  zdanie „przelot właściciela pozostaje wymagany" powtórzone 16 razy **nie jest orzeczeniem**.

## ★★ CZEGO NIE WOLNO ZROBIĆ — decyzja odbiorcy, której nie odwracasz

Dyżur 290 zaproponował zamknięcie G19 wariantem `TECHNICAL_REGRESSION_PASS`. **Odbiorca to
odrzucił**, cytat z rejestru znalezisk: *„Wariant 1 pozostaje niedostępny"*.

**Nie wolno wpisać `PASS` ani `TECHNICAL_REGRESSION_PASS`. Nie wolno też wprowadzić tego
wariantu POD INNĄ NAZWĄ** — `REGRESSION_VERIFIED`, `TECH_PASS`, `MACHINE_PASS`,
`PARTIAL_PASS` ani żaden inny napis, który znaczy „technicznie sprawdzone, przelot właściciela
pominięty". Nazwa nie była problemem sama w sobie; problemem było, że **nie domykała
definicji bramki**.

**Dopuszczalne nowe stany** to wyłącznie takie, które **nazywają ZAKRES dowodu i jego
GRANICĘ** — na przykład stan częściowy z jawnie wypisanym otwartym długiem, albo
`NOT_PROVEN / OWNER_RETEST_PENDING` z rozszerzonym, konkretnym uzasadnieniem („brakuje
dokładnie X"). Jeżeli uważasz, że wiersz zasługuje na mocniejszy stan — **piszesz to jako
PROPOZYCJĘ w raporcie, z gotowym tekstem wiersza, i zostawiasz decyzję odbiorcy.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- **16 z 16** wierszy `G19` = `NOT_PROVEN / OWNER_RETEST_PENDING`;
- `fee24bddb0` jest przodkiem `HEAD`, dystans **615** commitów;
- mianownik dryfu: **106** plików, **90** bez testów; rozbicie **1 / 7 / 2 / 2 / 91 / 2**;
- kubełki 335: **A=7, B=0, C=9**;
- `day307-crossorg-read-flight.pg.test.ts` **istnieje**, przypadek pary izolacyjnej
  w okolicy wiersza **214**, cel mutacji w `TaskController.ts` w okolicy wiersza **2692**;
- trzy pliki czterech czerwieni Bloku 1 istnieją i są **terenem dyżuru 349**;
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.** Rozbieżność wobec liczb dyżuru 335 (543/104/89) **jest
oczekiwana i jest sensem tego dyżuru** — nie zgłaszaj jej jako błędu instrukcji.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**` | **TYLKO ODCZYT** — schemat jest kontraktem produktu; jeżeli test się o niego rozbija, przestarzały jest test | Cytat wiersza schematu + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Dowodem ścieżki jest `ApiGateway.getInstance().initializeRoutes(app)` (`Z22`), z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**`, `server/src/controllers/**` | **TYLKO ODCZYT** — ten dyżur MIERZY i MUTUJE tymczasowo dla dowodu, nie zmienia produktu trwale. Każda mutacja jest cofana przez `cp` i `git diff` po cofnięciu ma być **pusty** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) — także `auth.middleware.ts` i `mfaEnrollmentToken.middleware.ts` | Brief |
| **Produkt UI (mianownik G19)** | `src/components/standard/**`, `src/components/shared/**`, `src/components/ui/**`, `src/index.css`, `tailwind.config.js` | **TYLKO ODCZYT.** To są pliki, których zmiana wywołała całą bramkę; ich dotknięcie unieważnia pomiar | Opis w raporcie z `plik:linia` |
| **Testy — istniejące** | `src/components/{standard,shared,ui}/__tests__/**`, `server/src/middleware/__tests__/**`, sześć plików Bloku 3 z `evidence/g19/mianownik.md` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **dodawać** nowe przypadki. **Zakaz** zmiany progu, usuwania asercji i zawężania zakresu, żeby zzielenieć. Jeżeli test jest przestarzały wobec schematu — naprawiasz PAYLOAD testu i pokazujesz mutacyjnie, że nadal broni tego, co bronił | — |
| **Cztery czerwienie Bloku 1** | `src/components/shared/__tests__/{filterableTable.r04-2a,standardPreview.r03,tablePreviewGeometry.r03-2}.test.tsx` | **TYLKO ODCZYT — TEREN DYŻURU 349.** Odnotowujesz je jako granicę dowodu Bloku 1 i idziesz dalej | Wpis do raportu |
| **Seeder dyżuru 307** | `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` i jego seeder | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ**. Guard jest fail-closed na historyczne `6314/cx307` — obchodzisz to **KOPIĄ POZA REPO** (jak zrobił dyżur 335), zmieniając wyłącznie guard na swoje `6395/cx348`; **źródło w repo pozostaje niezmienione** | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Dowody** | `evidence/g19/day348/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Dowody dyżuru 335** | `evidence/g19/day335-*`, `evidence/g19/blok*.json`, `evidence/g19/mianownik.md`, `evidence/g19/*mutation*` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest baza porównania; nadpisanie unieważnia cały dyżur | — |
| **Inwentarz G19** | `docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 348" — historia z 03.09 zostaje nietknięta; sprawdź, że plik nie jest generowany | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G19`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**. **ZAKAZ `PASS`, `TECHNICAL_REGRESSION_PASS` i każdego synonimu.** Zakaz dotykania wierszy `G00`–`G18` i `G20` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY348_G19_PRZEMIAR_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `resultsInternalBetaVisibility.middleware.ts`, `server/src/routes/resultsVnext/__tests__/**`, wiersz `G15` (dyżur 347) · trzy pliki czterech czerwieni Bloku 1 i `day27{4,5,6}-*.pg.test.ts` w części „niestabilność" (dyżur 349) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersz `G16` (dyżur 350) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu (dyżury 343-346) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

★★ **Kolizja terenu z dyżurem 349 — rozstrzygnięta tutaj.** Cztery czerwienie Bloku 1
(`filterableTable.r04-2a`, `standardPreview.r03` ×2, `tablePreviewGeometry.r03-2`) oraz
niestabilność `day274`/`day275`/`day276` należą do **dyżuru 349**. Ty je **URUCHAMIASZ**
(bo są w mianowniku G19) i **zapisujesz wynik**, ale **NIE naprawiasz** — w raporcie piszesz
wprost: „cztery czerwienie Bloku 1 i niestabilność Bloku 3 są przedmiotem dyżuru 349;
odnotowane jako granica dowodu". Jeżeli w trakcie Twojego przebiegu któryś z tych testów
zachowa się inaczej niż u 335 — **to jest cenna obserwacja i wpisujesz ją do raportu z pełną
nazwą przypadku**, nadal bez naprawy.

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
| 1 | stan 16 wierszy `G19` | `16 × NOT_PROVEN / OWNER_RETEST_PENDING` | komenda (1) z `§0.3` | TAK — czyta kolumnę statusu wszystkich 16 plików |
| 2 | dystans markera dowodu od `HEAD` | `615` commitów | komenda (2) z `§0.3` | TAK — **335 miał 543, bo mierzył na `1c4b5a5635`** |
| 3 | mianownik dryfu, razem | `106` plików | komenda (3) z `§0.3` | TAK — obejmuje dokładnie ścieżki, które G19 mierzy z definicji |
| 4 | mianownik dryfu, bez testów | `90` plików | komenda (3) z `§0.3` | TAK — filtr `__tests__|.test.|.spec.` |
| 5 | rozbicie per katalog | `1 / 7 / 2 / 2 / 91 / 2` | komenda (3) z `§0.3` | TAK — **suma ma się zgodzić ze 106, sprawdź to jawnie** |
| 6 | kubełki dyżuru 335 | `A=7, B=0, C=9` | komenda (5) z `§0.3` | TAK — czyta gotowy plik, nie liczy od nowa |
| 7 | Blok 1 na dzisiejszym markerze | 335 miał `131/127/4` | przebieg wariantem (C), `R3` | TAK — **podaj `numTotalTests`, nie tylko `numFailedTests`** |
| 8 | Blok 2 na dzisiejszym markerze | 335 miał `218/218/0` | przebieg jednostkowy, `R3` | TAK — **i wpisz wprost, że nie dowodzi realnego PG** |
| 9 | Blok 3 na dzisiejszym markerze | 335 miał `18/18` po naprawie payloadu | przebieg wariantem (B) na `cx348`, `R3` | TAK — **z roota daje 0 wykonanych i `exit 0`, co jest błędem komendy** |
| 10 | para izolacyjna `day307` | GREEN → mutacja RED → GREEN | `R3`, mutacja `TaskController.getUserWorkload` | TAK — **mutacja celuje w `AND organization_id = ?`, czyli w ZABEZPIECZENIE** |
| 11 | liczba podniesionych wierszy | — | `R5` | TAK — **ma się zgadzać z liczbą dowodów, jeden do jednego** |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY348_G19_PRZEMIAR_REPORT.md` ·
`evidence/g19/day348/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` **wyłącznie wiersz
`G19`, wyłącznie razem z dowodem w tym samym commicie** ·
`G19_INWENTARZ_OBOWIAZKOW_20260903.md` (sekcja dopisana) ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja) ·
naprawa PAYLOADU przestarzałego testu z Bloku 3 (tylko z dowodem mutacyjnym, że nadal broni
tego, co bronił) · nowe pliki testowe w `tests/` (`git add -f`, **nigdy pod `src/`**).

**JAWNIE NIE ZAPISZESZ:** `src/components/**` (produkt), `public/locales/**`,
`server/src/middleware/**`, `server/src/routes/**` i `server/src/controllers/**` trwale
(mutacje są cofane), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`, `evidence/g19/day335-*`, `evidence/g19/blok*.json`, `evidence/g15/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, trzy pliki czterech czerwieni Bloku 1,
wiersze `G00`–`G18` i `G20`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day348-g19-przemiar
git diff --name-only --cached | tee /private/tmp/cx-day348-g19-przemiar-artefakty/staged.txt
bash -c "grep -iE '^src/components/|^public/locales/|^server/src/middleware/|^server/src/controllers/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|evidence/g19/day335|evidence/g19/blok|evidence/g15/|PRZELOT_WLASCICIELA|filterableTable\.r04-2a|standardPreview\.r03|tablePreviewGeometry\.r03-2' /private/tmp/cx-day348-g19-przemiar-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — DWIE TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM commicie.**
Commit dotykający `MODULE_ACCEPTANCE.md` musi w tym samym `git show --stat` zawierać plik
dowodowy (`evidence/g19/day348/*`) albo plik testu, na który wiersz się powołuje.
**Wpis bez dowodu jest podstawą odrzucenia CAŁEGO dyżuru** — nie tej jednej pozycji, całego
dyżuru. **Liczba podniesionych wierszy ma się zgadzać z liczbą dowodów, jeden do jednego** —
jeden dowód nie podnosi trzech wierszy, chyba że pokazujesz, że mianownik tych trzech wierszy
jest identyczny (dyżur 335 udowodnił to dla czterech późnych kotwic — `cmp` exit 0 — więc
takie uzasadnienie jest możliwe, ale musi być pokazane, nie założone).

**(2) Odrzuconego wariantu nie wprowadzasz pod inną nazwą.** `PASS`,
`TECHNICAL_REGRESSION_PASS` i każdy synonim znaczący „technicznie sprawdzone, przelot
właściciela pominięty" są zakazane. Uważasz, że wiersz zasługuje na mocniejszy stan →
**PROPOZYCJA w raporcie, z gotowym tekstem wiersza**, decyzja należy do odbiorcy.

**Wymagany dowód:** dwa zdania w raporcie, że przeczytałeś obie zasady, plus `git show --stat`
każdego commita dotykającego macierzy. **Bez commita — to jest warunek, nie pozycja.**

## R1 — PRZEMIAR DRYFU NA BIEŻĄCYM MARKERZE, IMIENNIE (rdzeń)

1. Uruchom komendy (2) i (3) z `§0.3`. Do raportu idą: liczba commitów, liczba plików razem,
   bez testów, i rozbicie per katalog. **Nie przepisujesz liczb dyżuru 335 — liczysz swoje.**
2. **Wypisz listę z NAZWY** do `evidence/g19/day348/dryf-<marker>.md`, pogrupowaną po
   katalogach. „Dziewięćdziesiąt jeden plików tras" bez nazw nie jest wynikiem.
3. **Zrób różnicę wobec listy dyżuru 335** (`evidence/g19/day335-dryf.md`): **które pliki
   doszły**, a które ewentualnie zniknęły. To jest jedyny sposób, żeby pokazać tempo wzrostu
   mianownika — i to jest dowód pod pytanie z `R6`.
4. **Odpowiedz liczbą na pytanie: ile z tych plików ma JAKIKOLWIEK test?** Dyżur 335
   policzył „89 bez testów"; policz to sam i pokaż komendę.

**Wymagany dowód:** liczby z `§0.3` · plik `dryf-<marker>.md` z imienną listą · różnica wobec
listy 335 z nazwami plików, które doszły · liczba plików bez pokrycia z komendą.
**Commit po `R1`.**

## R2 — REWIZJA KUBEŁKÓW `A`/`B`/`C` NA DZISIEJSZYM STANIE (rdzeń)

Dyżur 335 przypisał kubełki na markerze `1c4b5a5635`. **Sprawdzasz, czy nadal są prawdziwe —
i to jest praca, nie formalność.**

Trzy kubełki, dosłownie:

- **`A` — dowód maszynowy:** lukę da się zamknąć testem, który sam uruchomisz, z dowodem
  mutacyjnym. 335 przypisał tu **7 modułów**: `01`, `04`, `05`, `06`, `08`, `11`, `13`.
- **`B` — brak realnego łańcucha:** 335 dał tu **0** i uzasadnił, że instrukcja przydziela
  lokalny RealPG i wymaga realnego `ApiGateway`/JWT. **Sprawdź, czy Twoje warunki są takie
  same** — jeżeli nie, kubełek `B` może być niepusty i to jest znalezisko.
- **`C` — wymaga właściciela:** renderowanie na realnym rekordzie, język PL/EN, treść.
  335 dał tu **9 modułów**.

Dla **każdego z 16 wierszy** produkujesz: kubełek · **imienne uzasadnienie w JEDNYM zdaniu** ·
czy kubełek zmienił się wobec 335 i dlaczego.

★ **Nie zakładaj, że podział 335 jest poprawny. Obalenie go jest sukcesem dyżuru** — na
przykład jeżeli któryś moduł `C` da się jednak domknąć maszynowo, albo któryś moduł `A` ma
lukę, której nie da się zamknąć testem.

**Wymagany dowód:** tabela 16 wierszy z kubełkiem, uzasadnieniem i kolumną „zmiana wobec 335".
**Commit po `R2`.**

## R3 — WYKONANIE CAŁEGO KUBEŁKA MASZYNOWEGO Z MUTACJĄ (rdzeń)

**To jest pozycja, w której dyżur produkuje dowód, a nie tylko go opisuje.**

1. **Postaw kontener** `cx-day348-pg` na porcie `6395`, baza `cx348`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Odtwórz trzy bloki na dzisiejszym markerze** — Blok 1 wariantem (C), Blok 2
   jednostkowo, Blok 3 wariantem (B) z cwd `server/`. `--retry=0`, `--reporter=json`.
   **Podaj `numTotalTests` dla każdego.** Przebieg z zerem wykonanych przypadków kończy się
   `exit 0` i **nie jest pomiarem** — to zdarzyło się dyżurowi 335 przy pierwszej próbie
   Bloku 3 z roota, i słusznie zostało odrzucone jako błąd komendy.
3. **Odtwórz parę izolacyjną `day307` na swojej bazie**: seeder jest fail-closed na
   historyczne `6314/cx307` — robisz **kopię poza repo**, zmieniasz wyłącznie guard na swoje
   `6395/cx348`, **źródła w repo NIE dotykasz**. Wynik: obcy `404`, właściciel `200` na
   **tym samym `userId`** — **para, nie symetryczna odmowa**.
4. **Dowód mutacyjny celujący w ZABEZPIECZENIE** (`Z32`): usuń `AND organization_id = ?`
   z prechecku w `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts`,
   okolice wiersza 2692), po kopii przez `cp` do `SCRATCH` → test ma **zaczerwienić się**
   (`expected 200 to be 404`); przywróć przez `cp` (nigdy `git stash`, `Z27`) → **zzielenieć**;
   `git diff -- server/src/controllers/TaskController.ts` po przywróceniu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
5. **Wykonaj RESZTĘ kubełka `A`** — moduły `04`, `05`, `06`, `11`, `13`. Dla każdego:
   który konkretny test/kontrakt zamyka lukę · uruchomienie z `numTotalTests` · **dowód
   mutacyjny celujący w zabezpieczenie, nie w mechanizm**. Jeżeli dla któregoś modułu takiego
   testu nie ma — **to jest wynik**: piszesz „kubełek `A` był przypisany błędnie, brakuje
   kontraktu X" i produkujesz **czerwony kontrakt testowy** (`it('KONTRAKT DLA DYŻURU 348 — …')`
   z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) w `tests/`, z `git add -f`.
6. **Cztery czerwienie Bloku 1 i niestabilność `day274`/`day275`/`day276`** — uruchamiasz,
   zapisujesz wynik z pełnymi nazwami, **nie naprawiasz**. Teren dyżuru 349.
7. **Sprzątanie:** `docker rm -fv cx-day348-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po.

**Wymagany dowód:** wyniki trzech bloków z `numTotalTests` · para izolacyjna z dwoma kodami
odpowiedzi · dowód mutacyjny w obie strony z pustym `git diff` · dla każdego z 5 pozostałych
modułów kubełka `A` albo wykonany dowód, albo czerwony kontrakt z briefem · wynik obu
przebiegów migracji · `df -h /` przed i po. **Commit po `R3`.**

## R4 — ORZECZENIE PER WIERSZ: CO DOKŁADNIE BRAKUJE

Tabela **16 wierszy**. Każdy z: modułem · kubełkiem po rewizji `R2` · **co konkretnie zostało
udowodnione w `R3`** (z nazwą przypadku i ścieżką artefaktu) · **czego dokładnie brakuje,
żeby ten wiersz się podniósł** · **kto to zrobi** (maszyna / właściciel / osobne zlecenie).

★★ **Zdanie „przelot właściciela pozostaje wymagany", powtórzone 16 razy, NIE JEST
orzeczeniem.** Wymagam konkretu per wiersz — na przykład: *„brakuje pary izolacyjnej dla
istniejącego obiektu `X` na trasie `Y`; test do napisania, mutacja w `plik:linia`"* albo
*„brakuje wyłącznie oczu właściciela na realnym rekordzie `Z` — wszystko maszynowe zamknięte,
dowód w `evidence/g19/day348/…`"*.

**Wymagany dowód:** tabela 16 wierszy z czterema kolumnami · zbiorcze liczby: ile wierszy jest
domkniętych maszynowo, ile czeka wyłącznie na właściciela, ile ma realną lukę.
**Commit po `R4`.**

## R5 — PODNIESIENIE WIERSZY, KTÓRE MAJĄ DOWÓD

1. Dla **każdego** wiersza, który `R4` uznał za domknięty w zakresie maszynowym — przygotuj
   **gotowy tekst wiersza**, który **nazywa zakres dowodu i jego granicę** i **nie jest**
   `PASS` ani synonimem odrzuconego wariantu.
2. **Wpis i dowód idą JEDNYM commitem** (`R0`). W `git show --stat` tego commita musi być
   plik dowodowy albo plik testu.
3. **Policz i zapisz:** ile wierszy podniosłeś, ile dowodów załączyłeś. **Te dwie liczby mają
   być równe** — albo masz wyjaśnić, dlaczego jeden dowód uzasadnia więcej niż jeden wiersz
   (dopuszczalne wyłącznie z pokazaniem, że mianownik tych wierszy jest identyczny).
4. **Jeżeli nie podnosisz żadnego wiersza — to też jest wynik**, i wtedy raport musi zawierać
   zdanie: *„zero wierszy podniesionych, bo …"* z konkretnym powodem per kubełek. Dyżur 335
   tak zrobił i miał rację; powtórzenie tego z LEPSZYM uzasadnieniem i świeższym pomiarem
   jest pełnowartościowe.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód" · dwie zgodne liczby. **Commit po `R5`.**

## R6 — RAPORT I PYTANIE ROZSTRZYGALNE DO WŁAŚCICIELA

Raport zawiera: przemiar dryfu z `R1` (z różnicą wobec 335) · zrewidowaną tabelę kubełków
z `R2` · wyniki trzech bloków i całego kubełka maszynowego z `R3`, z `numTotalTests` ·
tabelę 16 wierszy z `R4` · listę podniesionych wierszy z dowodami z `R5` · listę rozbieżności
wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy
akapit `§0.2e` dla każdego uruchomionego pakietu · deklarację `Z30`.

★★ **Osobna, obowiązkowa sekcja: „PYTANIE O KOTWICĘ POMIARU G19".** To jest główny produkt
myślowy tego dyżuru. Bramka mierzy „obowiązki regresji po późniejszych zmianach", a jej
mianownik urósł ze **104 do 106** plików w jeden dzień, przy dystansie, który urósł z **543
do 615** commitów. Postaw pytanie **rozstrzygalne („tak"/„nie")**, na przykład:

> *„Czy G19 ma być mierzona wobec markera odbioru modułu (wiersz `G18`), czy wobec bieżącego
> `HEAD`? Jeżeli wobec `HEAD` — bramka nie domknie się, dopóki linia się rusza, i wtedy
> potrzebujemy zamrożenia daty pomiaru."*

**Nie rozstrzygasz tego sam i nie zmieniasz definicji bramki po cichu.** Sekcja jest
obowiązkowa; jeżeli uważasz, że kotwica jest postawiona dobrze — piszesz to wprost
z uzasadnieniem.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Każdy z 16 wierszy `G19` ma przypisany kubełek (dowód maszynowy / wymaga właściciela /
realna luka); kubełek maszynowy jest WYKONANY z dowodem mutacyjnym celującym w zabezpieczenie;
a liczba podniesionych wierszy zgadza się z liczbą załączonych dowodów.**

Odbiorca odrzuci dyżur, w którym wiersz zmienił stan bez dowodu w tym samym commicie;
w którym pojawił się `PASS`, `TECHNICAL_REGRESSION_PASS` albo jego synonim; w którym izolacja
została „udowodniona" symetryczną odmową; albo w którym przepisano liczby dyżuru 335 zamiast
zmierzyć własne.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „dryf przemierzony na bieżącym
markerze (N commitów, M plików), kubełki zrewidowane, kubełek maszynowy wykonany dla k z 7
modułów, zero wierszy podniesionych, bo …" — **jest pełnowartościowym wynikiem, nawet jeśli
ani jeden wiersz nie zmienił stanu.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Podnieś wiersze" vs „zakaz `PASS`/`TECHNICAL_REGRESSION_PASS`" | `R0` (2) i `R5` punkt 1: podnosisz do stanu, który **nazywa zakres dowodu i granicę**; mocniejszy stan jest PROPOZYCJĄ dla odbiorcy |
| „Wykonaj kubełek maszynowy" vs „nie naprawiaj produktu" | `R3` punkty 4 i 5: mutacja jest **tymczasowa i cofana przez `cp`**, `git diff` po cofnięciu pusty; brak testu = **czerwony kontrakt**, nie naprawa produktu |
| „Uruchom cztery czerwienie Bloku 1" vs „to teren dyżuru 349" | Akapit pod tabelą licencji i `R3` punkt 6: **uruchamiasz i zapisujesz, nie naprawiasz**; obserwacja odmiennego zachowania jest cenna i idzie do raportu |
| „Seeder 307 jest fail-closed na cudze porty" vs `Z7` (Twoje porty wyłączne) | Tabela licencji i `R3` punkt 3: obejście przez **kopię POZA repo**, wyłącznie guard, źródło w repo nietknięte — dokładnie tak, jak zrobił dyżur 335 |
| „Nie przepisuj cudzych liczb" vs „instrukcja podaje liczby 335" | `R1` punkt 1 i „Zmierz moje liczby sam": liczby 335 są podane **jako punkt odniesienia do RÓŻNICY**, nie do przepisania; rozbieżność jest oczekiwana |
| „Jeden dowód = jeden wiersz" vs „cztery kotwice mają identyczny mianownik" | `R0` (1) i `R5` punkt 3: jeden dowód może uzasadnić więcej wierszy **tylko z pokazaniem** identyczności mianownika (`cmp` exit 0), nigdy z założenia |
| „`Z12` middleware nietykalne" vs „mutacja dowodowa" | `R3` punkt 4: mutacja trafia w `server/src/controllers/TaskController.ts`, **nie w middleware**; middleware pozostaje nietykalne w obie strony |
| „Zmierz Blok 2" vs „Blok 2 nie dowodzi realnego PG" | `SCIEZKI` i tabela mianowników wiersz 8: mierzysz **i wpisujesz granicę wprost** — pomiar jednostkowy jest wynikiem, o ile nie udaje dowodu zapisu |
| „Bramka ma się domknąć" vs „mianownik rośnie" | `R6`: to jest **pytanie do właściciela**, nie decyzja wykonawcy; zmiana definicji bramki po cichu jest zawężeniem kryterium |
| „Zero nowych dokumentów" (`Z13`) vs „dopisek do inwentarza i pliki dowodowe" | Tabela licencji: inwentarz i rejestr znalezisk to **AKTUALIZACJE istniejących**, `evidence/g19/day348/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` punkt 4: kopia przez `cp` do `SCRATCH`; `git diff` po cofnięciu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — sześć plików `evidence/g19/day335-*` i `mianownik.md`, inwentarz G19, `day307-crossorg-read-flight.pg.test.ts`, `TaskController.ts`, trzy pliki czerwieni Bloku 1 sprawdzone; `evidence/g19/day348/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-6 i 12 zmierzone przy wydaniu na markerze; wiersze 7-9 podane jako liczby dyżuru 335 z jawną etykietą źródła |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · kontroler · serwis/repozytorium · middleware · UI mianownika · testy istniejące · czerwienie Bloku 1 · seeder 307 · infrastruktura testów · dowody · dowody 335 · inwentarz · macierz · rejestr · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`, `R2` i `R4` nie dotykają kodu; `R3` uruchamia istniejące pakiety i mutuje wyłącznie tymczasowo; `R5` dotyka wyłącznie macierzy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6395/5535 wolne (`lsof` przy wydaniu), brak kontenera `cx-day348-pg`, brak gałęzi `codex/day348-*` i worktree; 347/349/350 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533 i rozłączny temat; kolizja z 349 rozstrzygnięta imiennie w treści |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: bramka nie domyka się z definicji, powtórzenie 335 nie jest wynikiem, symetryczna odmowa udaje izolację, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
