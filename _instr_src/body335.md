## Po co ten dyżur istnieje

Bramka **G19 — „Later-change regression obligations resolved"** ma **16 wierszy i wszystkie
stoją na `NOT_PROVEN / OWNER_RETEST_PENDING`**. Nie dlatego, że nikt nic pod nią nie zrobił —
pracy pomiarowej jest bardzo dużo i leży w `evidence/g19/`. Dlatego, że **dowód nie domyka
definicji**, a próba domknięcia go **nazwą wariantu** (`TECHNICAL_REGRESSION_PASS`) została
przez odbiorcę **jawnie odrzucona**: „Wariant 1 pozostaje niedostępny; obowiązuje
`NOT_PROVEN / OWNER_RETEST_PENDING`" (odbiór dyżuru 290, §2.5). **Tej decyzji nie odwracasz.**

**Definicja operacyjna bramki**, zapisana w `G19_INWENTARZ_OBOWIAZKOW_20260903.md` i wiążąca
dla tego dyżuru:

> G19 modułu M jest zamknięte wtedy i tylko wtedy, gdy dla KAŻDEGO pliku w zadeklarowanym
> zbiorze powierzchni współdzielonych, który zmienił się między SHA odbioru modułu M (`G18`)
> a zamrożonym markerem finalnym, istnieje dowód wykonany NA TYM MARKERZE, że powierzchnia
> modułu M dalej zachowuje się zgodnie z tym, co właściciel odebrał — osobno dla warstwy
> wizualnej i osobno dla warstwy serwerowej — a plik bez żadnego z tych dwóch dowodów jest
> **wypisany z nazwy jako otwarty dług**.

**★★ I tu jest rzecz, której nikt dotąd nie policzył.** Cały dowód G19 został wykonany na
**zamrożonym markerze `fee24bddb0`**. Dziś `HEAD` jest **544 commity dalej**. Na dokładnie
tych ścieżkach współdzielonych, które definicja wymienia, zmieniły się od tamtego pomiaru
**104 pliki** (89 bez testów: 77 serwerowych, 10 UI, 2 słowniki). Znalezisko `G19-Z3`
z inwentarza mówi „`git diff --name-only fee24bddb0 HEAD -- <ścieżki współdzielone>` → **0
plików**" — i to **było prawdą**, kiedy `HEAD` był praktycznie równy `fee24bddb0`.
**Dziś jest fałszem.** Bramka, która mierzy „obowiązki po późniejszych zmianach", mierzy
dziś przeszłość.

**★ Drugi trop, przeciwny w wymowie.** Dziura zapisana w dowodzie jako **GRANICA** —
„sondy NIE obejmują dostępu obcej organizacji do **istniejącego** obiektu właściciela"
(`evidence/g19/przelot-http.md`) — mogła zostać **zamknięta później**, przez dyżur 307:
`server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` jest przelotem
**parowanym** (obcy **i** właściciel) i zawiera przypadek
`denies foreign workload lookup while the owner reads the seeded task`. Dyżur 307 został
odebrany jako **GOTOWE (z zastrzeżeniami)** i jego commity (`8865552775`, `bdf71ee7f1`)
leżą na `HEAD`. **Sprawdź to, zanim zbudujesz cokolwiek od zera** — najtańszy dowód to ten,
który już istnieje i trzeba go tylko znaleźć i podpiąć.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:

- **16/16** wierszy `G19` = `NOT_PROVEN / OWNER_RETEST_PENDING`; zero `PASS`, zero
  `PARTIAL_PASS`;
- `fee24bddb0` **jest przodkiem** `HEAD`; między nimi **544 commity**;
- na ścieżkach współdzielonych: **104 pliki**, **89** bez testów, **10** w `src/`,
  **77** serwerowych bez testów, **2** słowniki;
- 16 kotwic `G18` redukuje się do **sześciu różnych SHA** i **trzech** różnych zbiorów zmian:
  `316bce9dd9` → 49 plików (moduły `01`, `08`), `08775ced65` → 30 plików (10 modułów),
  cztery późne SHA (`85dfe6c3e2`, `4d402fcfc8` ×2, `97c8293786`, `075735c395`) → 28 plików;
  zbiór 28-plikowy jest **podzbiorem** 49-plikowego;
- `day307-crossorg-read-flight.pg.test.ts` **istnieje na `HEAD`** i zawiera przypadek
  parowany z asercją `404` dla obcego przy równoczesnym odczycie właściciela;
- stan dowodów G19 na `fee24bddb0`: Blok 1 (18 plików podglądu/tabeli, wspólny dla wszystkich
  16 modułów) **127/131**, cztery czerwienie oznaczone jako ZASTANE; Blok 2 (middleware)
  **225/225** plus nowy `mfaEnrollmentToken.middleware.test.ts` **7/7** z mutacją na czerwono;
  Blok 3 (kontrakty tras 03.09, realny PostgreSQL) **16/18**, dwie czerwienie = przestarzały
  payload testu `day277-decyzje-zapis` wobec pola `escalation`; przelot HTTP **12/12** tras;
  `initiativesExecutionRuntime.dropdown` **2/2** z dowodem mutacyjnym;
- liście słowników: **pl 35198**, **en 33065**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schemat** | `server/src/schemas/**` — w szczególności `ReplaceDecisionEnhancementsSchema` (pole `escalation`, ok. wiersz 220) | **TYLKO ODCZYT.** Schemat jest kontraktem produktu; przestarzały jest **test**, nie schemat | Cytat wiersza schematu w raporcie + poprawiony payload testu |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa" w tym dyżurze znaczy: realne żądanie HTTP przez realny `ApiGateway.getInstance().initializeRoutes(app)` z podpisanym JWT, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**` (77 plików zmienionych po markerze G19) | **TYLKO ODCZYT** — chyba że dowód mutacyjny wykaże REALNĄ dziurę izolacji; wtedy naprawa jest dozwolona, w osobnym commicie, z dowodem w obie strony | Wpis do raportu: plik, linia, brakujący dowód, rekomendacja jako diff **nienałożony** |
| **Middleware (model uprawnień)** | `server/src/middleware/auth.middleware.ts`, `mfaEnrollmentToken.middleware.ts`, `requireAudit*`, `appErrorMapper.ts` | **NIETYKALNE DO ZAPISU** (`Z12`) — wolno WOŁAĆ w dowodzie. Wyjątek jak wyżej: realna dziura, osobny commit, mutacja w obie strony | Brief + czerwony kontrakt |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Powierzchnia współdzielona UI** | `src/components/standard/**`, `src/components/shared/**`, `src/components/ui/**`, `src/index.css`, `tailwind.config.js` | **TYLKO ODCZYT.** Ten dyżur MIERZY tę powierzchnię, nie przebudowuje jej | Wpis do raportu z `plik:linia` |
| **Słowniki** | `public/locales/{pl,en}/translation.json` | **TYLKO ODCZYT** — liście **nie mogą zmaleć** (`pl 35198`, `en 33065`) | — |
| **Testy — istniejące dowody G19** | `server/src/routes/__tests__/day290-g19-http-flight.pg.test.ts`, `day307-crossorg-read-flight.pg.test.ts`, `day277-decyzje-zapis.pg.test.ts`, `initiativesExecutionRuntime.dropdown.pg.test.ts`, `server/src/middleware/__tests__/mfaEnrollmentToken.middleware.test.ts` | **★ WĄSKA LICENCJA:** wolno **dodawać** przypadki i **naprawiać przestarzały payload** wobec schematu. **Zakaz** obniżania progu, usuwania asercji i zawężania zakresu, żeby zzielenieć — każda zmiana istniejącej asercji wymaga dowodu mutacyjnego, że test nadal broni tego, co bronił | — |
| **Testy — nowe** | nowy plik pod `server/src/routes/__tests__/` z prefiksem `day335-` | **★ PEŁNA LICENCJA** — wyłącznie realny PostgreSQL i realny `ApiGateway`. Nowe pliki w `tests/` wymagają `git add -f` | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Dowody** | `evidence/g19/**` | **★ PEŁNA LICENCJA na DOPISYWANIE.** Nowe pliki dowodowe pod `evidence/g19/day335-*`; **zakaz nadpisywania i kasowania istniejących** — to jest ślad poprzedniego pomiaru | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G19`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**. **ZAKAZ wpisania `PASS` i `TECHNICAL_REGRESSION_PASS`.** Zakaz dotykania wierszy `G00`–`G18` i `G20` | — |
| **Inwentarz G19** | `docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 335" — oryginalne zdania zostają, obok staje sprostowanie z datą i komendą. **Zakaz nadpisywania** znaleziska `G19-Z3` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jeden wiersz, dopisany | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY335_G19_REGRESJA_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md`, wiersz `G20` (dyżur 334) · wiersz `G15` i `evidence/g15/**` (dyżur 336) · `src/components/MyWork/**`, `dev-render/**` (dyżur 337) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
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
| 1 | wiersze `G19` w stanie `NOT_PROVEN` | `16` z `16` | komenda (1) z `§0.3` | TAK — czyta kolumnę statusu wszystkich 16 plików |
| 2 | commity między markerem dowodu a `HEAD` | `544` | komenda (2) z `§0.3` | TAK |
| 3 | **pliki współdzielone zmienione PO markerze dowodu** | `104` | komenda (3) z `§0.3` | TAK — **te same ścieżki, które definicja G19 wymienia** |
| 4 | z tego bez plików testowych | `89` | `grep -vcE '__tests__\|\.test\.'` na wyniku (3) | TAK |
| 5 | z tego UI / serwer bez testów | `10` / `77` | `grep -cE '^src/'` i dopełnienie | TAK |
| 6 | różne kotwice `G18` i zbiory zmian | `6` SHA → `3` zbiory (49 / 30 / 28) | komenda (4) z `§0.3` + `git diff --stat <SHA> HEAD -- <ścieżki>` | TAK — **sprawdź podzbiorowość sam**, nie przyjmuj jej |
| 7 | czy przelot parowany 307 istnieje na `HEAD` | **TAK** | komenda (5) z `§0.3` | TAK — czyta treść przypadku, nie samą nazwę pliku |
| 8 | Blok 1 (podgląd/tabela, wspólny) | `127/131`, 4 czerwienie | uruchomienie bloku 1 z `--retry=0 --reporter=json` | TAK |
| 9 | Blok 3 (kontrakty tras, realny PG) | `16/18`, 2 czerwienie | uruchomienie bloku 3 na `cx335` | TAK |
| 10 | liczba WYKONANYCH przypadków w każdym przebiegu | — | pole `numTotalTests` z raportu JSON | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |
| 11 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:** `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY335_G19_REGRESJA_REPORT.md` ·
`evidence/g19/day335-*` (nowe pliki dowodowe).

**Zapisujesz WARUNKOWO:** nowy plik testu `server/src/routes/__tests__/day335-*.pg.test.ts` ·
poprawiony payload `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` **wyłącznie wiersz
`G19`, wyłącznie razem z dowodem w tym samym commicie** ·
`docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` (sekcja
dopisana) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz) · pliki
`server/src/routes/**` lub `server/src/middleware/**` **tylko** przy udowodnionej mutacyjnie
realnej dziurze izolacji.

**JAWNIE NIE ZAPISZESZ:** `src/**` (powierzchnia współdzielona jest tu MIERZONA, nie
zmieniana), `public/locales/**`, `server/src/schemas/**`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `.github/workflows/**`, `server/migrations/**`,
`scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md`, wiersze `G00`–`G18`
i `G20` macierzy, `dev-render/**`, `src/components/MyWork/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day335-g19-regresja
git diff --name-only --cached | tee /private/tmp/cx-day335-g19-regresja-artefakty/staged.txt
bash -c "grep -iE '^src/|^public/locales/|^server/src/schemas/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|p0p1-licznik|REJESTR_P0P1|dev-render/|components/MyWork' /private/tmp/cx-day335-g19-regresja-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TWARDA ZASADA TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**Wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM commicie.**

Konkretnie: commit, który dotyka `MODULE_ACCEPTANCE.md`, **musi** w tym samym `git show
--stat` zawierać co najmniej jeden plik dowodowy (`evidence/g19/day335-*`) albo plik testu,
na który ten wiersz się powołuje. **Wpis bez dowodu jest podstawą odrzucenia całego dyżuru** —
nie tej jednej pozycji, całego dyżuru.

**Nie wolno wpisać `PASS` ani `TECHNICAL_REGRESSION_PASS`.** Dopuszczalne nowe stany to
wyłącznie takie, które **nazywają zakres dowodu i jego granicę** (np.
`NOT_PROVEN / OWNER_RETEST_PENDING` z rozszerzonym uzasadnieniem, albo stan częściowy z jawnie
wypisanym otwartym długiem). Jeżeli uważasz, że wiersz zasługuje na mocniejszy stan — **piszesz
to jako PROPOZYCJĘ w raporcie**, z gotowym tekstem wiersza, i zostawiasz decyzję odbiorcy.

**Wymagany dowód:** jedno zdanie w raporcie, że przeczytałeś tę zasadę, plus `git show --stat`
każdego commita dotykającego macierzy. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DRYF: ILE POWIERZCHNI WSPÓŁDZIELONEJ ZMIENIŁO SIĘ PO MARKERZE DOWODU (rdzeń)

1. Uruchom komendy (2) i (3) z `§0.3`. Do raportu idą: liczba commitów, liczba plików razem,
   bez testów, UI, serwer.
2. **Rozbij listę na kategorie** i podaj każdą z nazwy (nie „kilka plików tras"):
   słowniki · `src/components/shared` · `src/components/ui` · `src/index.css` ·
   `server/src/middleware` · `server/src/routes`.
3. **Dopisz sprostowanie do inwentarza** — sekcja „Aktualizacja dyżuru 335" w
   `G19_INWENTARZ_OBOWIAZKOW_20260903.md`, **obok** znaleziska `G19-Z3`, nigdy zamiast niego:
   oryginalne zdanie („0 plików") zostaje, obok staje data, komenda i nowa liczba.
   ★ **Zanim dopiszesz — sprawdź, czy ten plik nie jest GENEROWANY przez skrypt:**
   `bash -c "grep -rl 'G19_INWENTARZ_OBOWIAZKOW' scripts/"`. Jeżeli jest — dopisek idzie do
   raportu, a do generatora idzie brief.
4. **Odpowiedz na pytanie, które z tego wynika, i zapisz odpowiedź jako wynik:** czy dowód
   wykonany na `fee24bddb0` zachowuje ważność wobec `HEAD`? Jeżeli nie — **to jest główne
   ustalenie tego dyżuru** i wchodzi do wszystkich 16 wierszy.

**Wymagany dowód:** pięć liczb z komendami, lista plików z podziałem na kategorie (w
`evidence/g19/day335-dryf.md`), `git diff` dopisku do inwentarza. **Commit po `R1`.**

## R2 — PODZIAŁ 16 WIERSZY NA TRZY KUBEŁKI, WIERSZ PO WIERSZU (rdzeń)

Dla **każdego z 16 modułów** produkujesz wiersz tabeli z przypisaniem do **jednego z trzech
kubełków** i z **imiennym uzasadnieniem**:

- **(A) BRAK SCENARIUSZA — da się wykonać maszynowo.** Dowód nie istnieje, ale nic nie stoi
  na przeszkodzie, żeby powstał w tym dyżurze: brakujący przypadek testowy, nieuruchomiony
  blok, niepodpięty dowód z późniejszego dyżuru.
- **(B) BRAK REALNEGO ŁAŃCUCHA.** Dowód wymaga realnego `ApiGateway` + podpisanego JWT +
  realnego PostgreSQL, a dotąd mierzono go atrapą albo w ogóle. **★ Uwaga:** to NIE jest
  automatycznie „niewykonalne" — masz do dyspozycji kontener `cx-day335-pg` na porcie `6371`.
  Do (B) trafia tylko to, czego **nie da się** zmierzyć w tym dyżurze (np. zależność od
  stagingu albo od realnego providera zewnętrznego), z **nazwaniem przeszkody**.
- **(C) BRAK OCZU WŁAŚCICIELA.** Dowód z natury wymaga człowieka: język (D-a3), warunkowe
  renderowanie (D-a4), sensowność treści, przelot po stagingu na realnych danych z otwarciem
  **realnego rekordu z listy** (`DEC-2026-09-03-346`: odbiór na fiksturze pokazowej nie jest
  odbiorem).

**★ Zanim podzielisz — rozstrzygnij strukturę.** Inwentarz twierdzi (`G19-Z2`), że
**obowiązek jest JEDEN, nie szesnaście**: 16 kotwic redukuje się do trzech zbiorów, a zbiór
28-plikowy jest podzbiorem 49-plikowego. **Sprawdź to sam** komendą (4) i `git diff --stat`.
Jeżeli teza się potwierdza, Twoja tabela ma **16 wierszy, ale trzy różne mianowniki** — i to
zapisujesz wprost, bo to zmienia koszt zamknięcia bramki o rząd wielkości. Jeżeli się **nie**
potwierdza — to jest obalenie i **cenniejszy wynik niż plan**.

**Wymagany dowód:** tabela 16 wierszy (moduł · kotwica `G18` · mianownik · kubełek ·
uzasadnienie z nazwy), plus osobna tabela trzech zbiorów zmian z dowodem podzbiorowości albo
jej obalenia. **Commit po `R2`.**

## R3 — WYKONANIE KUBEŁKA (A), W TYM PARA IZOLACYJNA CROSS-ORG (rdzeń)

**To jest pozycja, w której dyżur produkuje dowód, a nie tylko go opisuje.**

1. **Najpierw zinwentaryzuj to, co JUŻ ISTNIEJE.** Uruchom komendę (5) z `§0.3` i przeczytaj
   `day307-crossorg-read-flight.pg.test.ts` w całości. Odpowiedz w raporcie na pytanie:
   **czy ten test zamyka granicę zapisaną w `evidence/g19/przelot-http.md`?** Jeżeli tak —
   podpinasz go jako dowód i **nie budujesz drugiego**; jeżeli częściowo — wypisujesz
   imiennie, czego brakuje. ★ Program ma zmierzony kształt „biblioteka bez wywołania" i jego
   odwrotność: dowód, który istnieje, ale nikt go nie podpiął pod bramkę.
2. **Uruchom Blok 1, Blok 2 i Blok 3 na `HEAD`** (nie na `fee24bddb0`), z `--retry=0`
   i `--reporter=json --outputFile=`. **Podaj liczbę WYKONANYCH przypadków**, nie tylko
   liczbę porażek — przebieg z zerem wykonanych kończy się `exit 0` i nie jest dowodem.
3. **Para izolacyjna cross-org na ISTNIEJĄCYM obiekcie.** Jeżeli punkt 1 wykaże, że dziura
   nadal jest otwarta, budujesz **nowy** test `server/src/routes/__tests__/day335-*.pg.test.ts`
   przez realny `ApiGateway`, z **dwoma** podpisanymi JWT z **dwóch** organizacji.
   Dowód musi mieć **OBIE połowy w jednym przebiegu**:
   - **obcy NIE widzi** konkretnego, **zaseedowanego, istniejącego** obiektu właściciela
     (kod odpowiedzi zapisany);
   - **właściciel TEN SAM obiekt widzi** (kod odpowiedzi i identyfikator zapisany).

   ★★ **Symetryczna odmowa (`404/404`) nie jest dowodem izolacji** — jest dowodem, że
   obiektu nie ma, czyli że funkcja jest wygaszona dla wszystkich. To jest zmierzony kształt
   „zamknięte przez wygaszenie" i wystąpił w tym programie trzykrotnie jednego dnia.
   ★ Równie ważne: `200/200` **bywa poprawne**, gdy trasa jest listą własnej organizacji —
   wtedy dowodem izolacji jest **brak identyfikatorów właściciela w treści odpowiedzi obcego**,
   nie kod HTTP. Tak właśnie jest zapisane w `evidence/g19/przelot-http.md` i tego kształtu
   nie „naprawiasz" na `403`.
4. **DOWÓD MUTACYJNY CELUJĄCY W ZABEZPIECZENIE.** Usuń warunek organizacji w zapytaniu, które
   broni tego obiektu (kopia przez `cp` do katalogu scratch **poza repo**, `Z27` — **nigdy
   `git stash`**), i pokaż, że **obcy zaczyna widzieć obiekt właściciela**, a Twój nowy test
   **czerwieni się**. Przywróć przez `cp`; `git diff` po przywróceniu **pusty**.
   ★ Test, który przechodzi zarówno przed, jak i po usunięciu zabezpieczenia, **nie broni
   niczego** — to kształt „test scenariusza nie broni zabezpieczenia" i jest podstawą
   odrzucenia pozycji.
5. **Zdanie „działa" ma cenę.** Każde takie zdanie w raporcie ma obok siebie: metodę, ścieżkę,
   kod odpowiedzi i ścieżkę do surowego logu w `evidence/g19/day335-*`.

**Wymagany dowód:** werdykt o teście 307 (zamyka / częściowo / nie), trzy bloki uruchomione na
`HEAD` z liczbą wykonanych przypadków, para izolacyjna z dwoma kodami odpowiedzi, mutacja
w obie strony z pełną nazwą czerwonego przypadku (`Z37`), `git diff` po przywróceniu (pusty).
**Commit po `R3`.**

## R4 — CZERWIENIE: KLASA ORZECZONA, NIE ZAMILCZANA

1. **Dwie czerwienie Bloku 3** (`day277-decyzje-zapis` wobec pola `escalation`). Sprawdź
   `ReplaceDecisionEnhancementsSchema` — pole jest **nullable, ale nieopcjonalne**. Jeżeli
   potwierdzisz, że przestarzały jest **test**, a nie schemat: **naprawiasz payload testu**
   i pokazujesz mutacyjnie, że test **nadal broni tego, co bronił** (usuń pole z payloadu →
   test ma się czerwienić z komunikatem walidatora, nie przechodzić). ★ **Zakaz naprawiania
   tego przez `.optional()` w schemacie** — schemat jest kontraktem produktu.
2. **Cztery czerwienie Bloku 1.** Dziś opisane jako ZASTANE, ale **bez pary bazowej na
   `HEAD`**. Orzeknij klasę dla każdej z nazwy: `ZASTANA` (czerwieni się także na bazie
   sprzed zmiany) czy `NOWA`. ★ **Baza pomiaru musi się kompilować** — zanim nazwiesz coś
   „zastanym", sprawdź `esbuild` na plikach czerwonych i na ich bazie; `Transform failed`
   jest **błędem komendy**, nie wynikiem, a przebieg, który wykonał zero przypadków, nie jest
   bazą.
3. **Wypisz otwarty dług z nazwy.** Definicja G19 wymaga tego wprost: plik bez żadnego
   z dwóch dowodów ma być **wymieniony imiennie**. Lista idzie do `evidence/g19/day335-dlug.md`
   i do raportu.

**Wymagany dowód:** stan Bloku 3 przed i po naprawie payloadu z mutacją, tabela czterech
czerwieni Bloku 1 z klasą i komendą bazową, imienna lista otwartego długu. **Commit po `R4`.**

## R5 — PAKIET DO PRZELOTU WŁAŚCICIELA (kubełek C)

Dla wierszy, które trafiły do kubełka **(C)**, produkujesz **pakiet do przelotu** — nie wpis
`PASS`. Pakiet ma być na tyle konkretny, żeby właściciel mógł go wykonać bez pytań:

- **co otworzyć** — moduł, ekran, i **realny rekord z listy**, nie fikstura pokazowa
  (`DEC-2026-09-03-346`); podaj, jak taki rekord rozpoznać;
- **co kliknąć** — kolejność kroków, po jednym zdaniu na krok;
- **czego szukać** — konkretne rzeczy, które mogły się zepsuć od odbioru modułu, wynikające
  z **Twojej** listy z `R1`: zmienione napisy (słowniki), zmienione komponenty współdzielone
  (`NModeLeftNav`, formularze, `ErrorState`, `HelpButton`), zmienione trasy;
- **co jest sygnałem porażki** — sformułowane tak, żeby dało się odpowiedzieć „tak"/„nie";
- **czego pakiet NIE obejmuje** — jawna granica, żeby przelot nie był brany za dowód czegoś,
  czego nie dotknął.

Pakiet zapisujesz w `evidence/g19/day335-pakiet-przelotu.md` i **streszczasz w raporcie**.

**Wymagany dowód:** pakiet z podziałem na 16 modułów (albo na trzy grupy kotwic, jeżeli `R2`
potwierdzi, że mianowniki są trzy), z jawną granicą. **Commit po `R5`.**

## R6 — RAPORT

Raport zawiera: stan PRZED/PO wszystkich 16 wierszy · **liczby dryfu z `R1`** i odpowiedź na
pytanie o ważność dowodu z `fee24bddb0` · **tabelę 16 wierszy z kubełkami** z `R2` ·
werdykt o teście 307 i wyniki trzech bloków na `HEAD` z **liczbą wykonanych przypadków** ·
parę izolacyjną z dwoma kodami odpowiedzi · **wszystkie dowody mutacyjne dosłownie**
z pełnymi nazwami czerwonych przypadków · imienną listę otwartego długu · pakiet przelotu ·
**gotowy tekst wiersza `G19`** dla każdego modułu, którego stan proponujesz zmienić, wraz
z SHA commita, w którym leży dowód · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy **akapit `§0.2e`** dla
każdego uruchomionego pakietu.

**Commit po `R6`.**

## Próg odbioru

**Każdy z 16 wierszy `G19` ma przypisany kubełek z imiennym uzasadnieniem, kubełek maszynowy
jest WYKONANY z dowodem mutacyjnym celującym w zabezpieczenie, a każda zmiana stanu wiersza
leży w tym samym commicie co jej dowód.** Wpis bez dowodu — choćby jeden — jest podstawą
odrzucenia całego dyżuru. `PASS` i `TECHNICAL_REGRESSION_PASS` nie są dopuszczalnymi stanami.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „mianownik G19 urósł o N
plików po markerze dowodu, 16 wierszy rozłożone na trzy kubełki (A: k, B: l, C: m), kubełek
A wykonany z parą izolacyjną i mutacją, kubełek C ma pakiet przelotu, otwarty dług wypisany
imiennie" — **jest pełnowartościowym wynikiem, nawet jeśli ani jeden wiersz nie zmienił
stanu.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Przepchnij bramkę G19" vs „zakaz wpisania `PASS`" | Próg odbioru i `R0`: produktem jest **rozłożenie na kubełki + wykonanie maszynowego**, nie zielony wiersz; wiersz może pozostać `NOT_PROVEN` i dyżur jest odebrany |
| „Odbiorca odrzucił `TECHNICAL_REGRESSION_PASS`" vs „wykonaj regresję maszynowo" | `R3`: wykonujesz **dowód**, ale nie nadajesz mu nazwy odrzuconego wariantu; nazwa nie była problemem sama w sobie — problemem było, że nie domykała definicji |
| „Zmierz dryf na `HEAD`" vs „dowód G19 jest na `fee24bddb0`" | `R1` punkt 4: to jest **pytanie do rozstrzygnięcia**, a odpowiedź jest głównym ustaleniem; nie „naprawiasz" markera, tylko nazywasz konsekwencję |
| „Nie zmieniasz `server/src/routes/**`" vs „napraw dziurę izolacji, jeśli ją znajdziesz" | Tabela licencji, wiersze „Kontroler" i „Middleware": naprawa jest dozwolona **wyłącznie** przy udowodnionej mutacyjnie realnej dziurze, w osobnym commicie, z dowodem w obie strony |
| „Napraw dwie czerwienie Bloku 3" vs „zakaz obniżania asercji, żeby zzielenieć" | `R4` punkt 1: naprawiasz **payload testu**, nie schemat i nie asercję; mutacja ma pokazać, że test nadal broni |
| „`200` dla obcej organizacji jest podejrzane" vs „`200/200` bywa poprawne" | `R3` punkt 3: kryterium to **brak identyfikatorów właściciela w treści**, nie kod HTTP; kształt zapisany w `evidence/g19/przelot-http.md` i **nie naprawiasz go na `403`** |
| „Dowód ma być na realnym PostgreSQL" vs „`§0.2c` (C) mockuje bazę" | Sekcja `SCIEZKI`: Blok 1 idzie wariantem (C), Bloki 2-3 i wszystkie dowody izolacji wariantem (B) na `cx335`; **atrapa nie jest dowodem zapisu** (`Database.ts:686`) |
| „Zero nowych dokumentów" (`Z13`) vs „dopisek do inwentarza i pliki dowodowe" | Tabela licencji: inwentarz i rejestr znalezisk to **AKTUALIZACJE istniejących**, `evidence/g19/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` punkt 4 i `R4`: kopia przez `cp` do katalogu scratch poza repo; `git diff` po przywróceniu ma być pusty |
| „Wpisz wynik do 16 wierszy" vs „obowiązek jest jeden, nie szesnaście" | `R2`: tabela ma 16 wierszy, ale **trzy mianowniki**; jeżeli teza `G19-Z2` się potwierdzi, jeden przebieg dowodowy obsługuje wszystkie 16 — i to zapisujesz wprost |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `day307-crossorg-read-flight.pg.test.ts`, `day277-decyzje-zapis.pg.test.ts`, `evidence/g19/**`, inwentarz G19 sprawdzone na markerze; jedyny nowy dokument rejestrowy to raport `R6` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy; wiersze 1–7 i 11 zmierzone przy wydaniu |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator/schemat · trasa/montaż · kontroler · middleware · serwis/repozytorium · UI współdzielone · słowniki · testy istniejące i nowe · bezpieczniki · dowody · macierz odbioru · inwentarz; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`, `R2`, `R5` nie dotykają kodu; `R3`/`R4` wołają `ApiGateway` i middleware bez ich zmieniania, a wyjątek naprawczy jest imienny i warunkowy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6371/5511 wolne, brak kontenera `cx-day335-pg`, brak gałęzi i worktree; 334/336/337 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: symetryczna odmowa, poprawne `200/200`, atrapa bazy kłamiąca o zapisie, `NODE_ENV=test` bez `RUN_DB_TESTS`, `runIf`/`skipIf` dające `exit 0` przy zerze wykonanych, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
