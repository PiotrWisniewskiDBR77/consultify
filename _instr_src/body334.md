## Po co ten dyżur istnieje

Bramka **G20 — „zero otwartych P0/P1"** jest jedyną bramką macierzy odbioru, która **we
wszystkich 16 modułach stoi na `NOT_STARTED`**. Nie dlatego, że nie ma narzędzia — narzędzie
jest gotowe i maszynowe. Dlatego, że **piętnaście obiektów nie ma rozstrzygnięcia.**

**Stan zastany, zmierzony na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:**

- `scripts/dev/p0p1-licznik-e1.mjs` kończy się **kodem 1** przy `BLOKUJE > 0`, wypisuje na
  `stderr` liczbę i ścieżkę rejestru;
- jest wołany z CI jako `npm run check:p0p1-e1`, w zadaniu `lint-typecheck` pliku
  `.github/workflows/test-suite.yml`, a checkout tego zadania ma **`fetch-depth: 0`**
  (naprawa dowiedziona parą klonów w dyżurze 328 — **nie powtarzasz jej**);
- mianownik **121**, rozkład **`NAPRAWIONE 30 · ZAMKNIETE_DEC 18 · ODLOZONE_DEC 58
  · W_BUDOWIE 0 · BLOKUJE 15`**; arytmetyka `30 + 18 + 58 + 0 + 15 = 121` domyka się;
- wszystkie 15 pozycji `BLOKUJE` mają powód **`NIEROZSTRZYGNIETE`**, zero
  `BRAK_SHA_DLA_NAPRAWIONE`;
- `gitShaState()` **odróżnia commit funkcyjny od migawki** — commit z tematem `checkpoint …`
  **sam wpada do `BLOKUJE`** (to jest produkt dyżuru 328; **zmierz to komendą (5), zanim
  cokolwiek na tym oprzesz** — jeżeli mechanizmu nie ma, moja teza jest obalona i to jest
  cenniejszy wynik niż wykonanie planu).

**Dlaczego bramka jeszcze nie jest domknięta.** Bo `BLOKUJE = 15`, a każda z tych piętnastu
pozycji jest **obiektem bez rozstrzygnięcia**. Bramka nie zamknie się od żadnej zmiany
narzędzia — zamknie się dopiero wtedy, gdy każda pozycja dostanie **obiekt**: SHA realnej
naprawy albo decyzję właściciela obejmującą ją **imiennie**.

## ★ Zmierz moje liczby sam — pełna, imienna lista 15 pozycji

Twierdzę, że `node scripts/dev/p0p1-licznik-e1.mjs` na markerze wypisuje dokładnie te
piętnaście pozycji, wszystkie z powodem `NIEROZSTRZYGNIETE`:

| # | Pozycja | Powód zapisany w rejestrze |
| --- | --- | --- |
| 1 | `ASM-OWN-001` | `DEC-2026-09-03-367` nakazuje realizację TERAZ, ale brak SHA wykonania biblioteki metodyk |
| 2 | `ASM-OWN-002` | `DEC-2026-09-03-367` nakazuje realizację TERAZ, ale brak SHA zmiany kolumn katalogu |
| 3 | `EXE-OWN-003` | brak odzyskanego lokalnego seeda i SHA danych przeglądowych Execution |
| 4 | `EXE-OWN-005` | brak SHA pending checkpoint z nawigacją Menu 3 i powrotem do listy |
| 5 | `FIN-OWN-001` | runtime `d8561ed5c2` nie jest jednoznacznym SHA naprawy |
| 6 | `INI-OWN-001` | brak kompletnej fikstury 11 inicjatyw i dowodu przeglądarkowego jej pól lifecycle |
| 7 | `INT-INIT-AI-OBS-001` | brak osiągalnego wołacza `fill-section` i dowodu z realnym providerem AI |
| 8 | `MYW-CAL-REC-002` | decyzje wyznaczają kierunek, ale brak SHA rozszerzenia schematu spotkania |
| 9 | `MYW-CAL-REC-003` | `DEC-222` pozostawia wdrożenie otwarte; brak SHA UI dołączania artefaktu |
| 10 | `MYW-CV-REC-001` | checkpoint `af75a84e37` obejmuje 156 plików i nie izoluje zmiany Vault table/preview |
| 11 | `MYW-CV-REC-002` | źródło opisuje stan istniejący bez SHA naprawy |
| 12 | `MYW-DEC-REC-001` | checkpoint `4a36e8a745` obejmuje 82 pliki i nie izoluje zmiany Decisions list |
| 13 | `MYWORK-DEC-OWN-001` | checkpoint `4a36e8a745` jest tylko wspólną migawką dla `MYW-DEC-REC-001` |
| 14 | `RES-OWN-003` | brak licencjonowanego writera i cold readbacku 4 KPI / 3 OKR / 3 ROI z PostgreSQL |
| 15 | `RES-OWN-004` | źródło mówi „pre-existing" bez SHA naprawy |

**Wypisz swoją listę komendą (2) z `§0.3` i porównaj wiersz po wierszu. Rozbieżność jest
wynikiem, nie błędem — zapisz ją w „Korektach wobec instrukcji".**

Twierdzę dodatkowo:

- mianownik **121**, rozkład **30 / 18 / 58 / 0**, `BLOKUJE` **15**, kod wyjścia **1**;
- `git diff` na `REJESTR_P0P1_BLOKUJACE_G20.md` po uruchomieniu licznika jest **pusty**;
- `e4dc14df6e` (*feat(day293): continue inherited methodology library WIP*) **jest przodkiem
  `HEAD`**, wszedł merge'em `cc8f0b1999` w ramach dyżuru 329, dotyka **6 plików**, w tym
  `src/components/assessment/library/AssessmentLibraryTab.tsx` **+361 / −144**;
- `ASM-OWN-003` ma w rejestrze `ZAMKNIETE_DEC` na `DEC-2026-09-03-364`, a `ASM-OWN-003[OF]`
  ma `ODLOZONE_DEC` na `DEC-2026-08-27-147` **i tej samej** `DEC-2026-09-03-364`;
- `DEC-2026-09-03-364` w `OWNER_DECISION_LEDGER_2026-08-24.md` brzmi: właściciel
  **„PO BRAMKACH (fala 2)"**, a pozycja jest wpisana do `docs/program/FALA_2_PO_STAGINGU.md`.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WEJŚCIE · PARSER · KLASYFIKATOR · RENDER · BRAMKA CI · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Wejście: rozliczenie korpusu** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_20260903.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Rozstrzygnięcie idzie do raportu i do rejestru, nigdy do dokumentu wejściowego |
| **Wejście: decyzje korpusu** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_DECYZJE_20260903.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: decyzje właściciela** | `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To są słowa właściciela | jak wyżej |
| **Wejście: fala 2** | `docs/program/FALA_2_PO_STAGINGU.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: rejestr decyzji** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie, z cytatem obu wersji |
| **Walidator / parser / klasyfikator** | `scripts/dev/p0p1-licznik-e1.mjs` — funkcje wejścia (czytanie 5 dokumentów), parser wierszy korpusu, `gitShaState()`, tabela `DAY320_RESOLUTIONS`, render rejestru, kod wyjścia | **★ PEŁNA LICENCJA** w zakresie `R2`–`R4`. Zmiana `DAY320_RESOLUTIONS` wyłącznie w kierunku **mocniejszego dowodu** (SHA funkcyjny zamiast migawki, albo przeklasyfikowanie z `DEC`). **Zmiana semantyki werdyktów wymaga wiersza w tabeli decyzji raportu** | — |
| **Bezpiecznik narzędzia (testy)** | `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | **★ PEŁNA LICENCJA**: wolno **dodawać** przypadki. Istniejące wolno zmienić **wyłącznie razem z jawnie opisaną zmianą kontraktu** — usunięcie asercji bez takiego wpisu = odrzucenie pozycji | — |
| **Repozytorium / wyjście: rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | **★ PEŁNA LICENCJA — ale WYŁĄCZNIE jako PRODUKT SKRYPTU.** Ręczna edycja zakazana; jedyny dopuszczalny sposób zmiany to uruchomienie skryptu | — |
| **Wołacz `npm`** | `package.json`, sekcja `scripts`, wpis `check:p0p1-e1` | **★ WĄSKA LICENCJA:** wyłącznie ten jeden wpis. Zakaz zmiany zależności, wersji Node i pozostałych skryptów | Czerwony kontrakt + brief |
| **Bramka CI** | `.github/workflows/test-suite.yml`, krok `P0/P1 E1 zero-blockers gate (G20)` w zadaniu `lint-typecheck` | **★ WĄSKA LICENCJA:** wyłącznie **wzmocnienie tego jednego kroku** (jawniejszy komunikat, jawny komentarz). **Zakaz** zmiany wyzwalaczy, uprawnień, wersji Node, pozostałych kroków i tworzenia nowego workflow. **Zakaz `continue-on-error`, warunku `if:` wygaszającego krok i progu tolerancji** | Czerwony kontrakt + brief |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, wiersz `G20` | **TYLKO ODCZYT — ZAKAZ ZAPISU.** Wiersz przepisuje odbiorca po weryfikacji Twojego raportu | Raport podaje **gotowy tekst wiersza** `G20` do wklejenia, z liczbą i komendą — jako propozycję, nie jako zmianę |
| **Materiał dowodowy: biblioteka metodyk** | `src/components/assessment/library/AssessmentLibraryTab.tsx`, `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/library/__tests__/AssessmentLibraryTab.canon.test.tsx` | **TYLKO ODCZYT** — czytasz je, żeby rozstrzygnąć `ASM-OWN-001`/`002`, nie żeby je zmieniać | Wpis do raportu: co ten kod robi i czy pokrywa treść `DEC-353`/`DEC-367` |
| **Materiał dowodowy: trasy Oceny i Wyników** | `server/src/routes/method-core.routes.ts`, `server/src/services/results/**` | **TYLKO ODCZYT** | jak wyżej |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA istniejącego wiersza** albo dopisanie jednego nowego — dopisujesz stan, nie kasujesz historii | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY334_G20_PIETNASCIE_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R5` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` wiersze `G15`/`G19` (dyżury 335, 336) · `src/components/MyWork/**`, `dev-render/**` (dyżur 337) · `src/**`, `server/src/**` (**ten dyżur NIE ZMIENIA PRODUKTU**) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c` I `Z39`

**(1) Wariant (C), bez kontenera.** Licznik nie dotyka bazy danych. Pracujesz w wariancie
(C) (`RUN_DB_TESTS=0 MOCK_DB=true`), **kontenera `cx-day334-pg` nie stawiasz**. Porty
`6370`/`5510` pozostają zarezerwowane niezależnie od tego, czy ich użyjesz. W raporcie
piszesz jednym zdaniem, że baza nie była potrzebna, i **nie udajesz dowodu bazodanowego**.
Dowód `§0.2b` (b) zastępujesz zdaniem o braku bazy dyżuru — to jest pełny dowód `Z30` przy
braku kontenera.

**(2) Wariant (B) nie ma zastosowania.** Pakiet testowy licznika używa runnera `node:test`.
Właściwa komenda to `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`.
Uruchomienie przez `vitest` odda `No test files found`, **a to NIE jest `PASS`**.

**(3) `Z39` kontra „potwierdź w CI".** `Z39` zabrania uruchamiania realnych workflow, a
`test-suite.yml` i tak reaguje wyłącznie na gałęzie `main`, `develop`, `Londyn`, `demo` —
nasza linia to `grafika/m03-20260902`, więc **workflow nigdy się nie uruchomi przed
scaleniem**. Dyżur 328 udowodnił naprawę `fetch-depth` parą klonów offline. **Nie powtarzasz
tego pomiaru** — cytujesz go i idziesz dalej. Jeżeli chcesz go potwierdzić, robisz to
**dopiero po `R2`**, jako pozycję nadprogramową, i kasujesz klony po pomiarze
(`df -h /` przed i po; program stracił dobę na dysku zjedzonym przez klony).

## ★★ WARUNKI WSPÓLNE SERII — kontrola braku szkody ubocznej

Ten dyżur **nie zmienia ani jednego pliku w `src/` i `server/src/`**. Poniższe mierzysz
**PRZED pierwszym commitem i PO ostatnim**, i obie pary liczb wpisujesz do raportu:

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
| 1 | kod wyjścia licznika przy `BLOKUJE > 0` | `1` | `node scripts/dev/p0p1-licznik-e1.mjs >/dev/null 2>&1; echo $?` | TAK — **bez potoku**, potok gubi kod wyjścia |
| 2 | pozycje `BLOKUJE` i ich powody | `15`, wszystkie `NIEROZSTRZYGNIETE` | komenda (2) z `§0.3` | TAK — grupuje po kolumnie „powód", nie po samej liczbie |
| 3 | mianownik korpusu | `121` | `node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null \| grep -c '^\| `'` | TAK |
| 4 | rozkład pozostałych werdyktów | `30 / 18 / 58 / 0` | komenda (3) z `§0.3` | TAK — suma z wierszem 2 daje 121, **sprawdź to jawnie** |
| 5 | czy rejestr w repo jest identyczny z generowanym | `git diff` pusty | `git diff --stat -- …/REJESTR_P0P1_BLOKUJACE_G20.md` po uruchomieniu | TAK |
| 6 | czy `gitShaState()` odróżnia migawkę od commita funkcyjnego | mechanizm **obecny** | komenda (5) z `§0.3` | TAK — czyta **temat** commita, nie samo jego istnienie |
| 7 | czy `e4dc14df6e` leży na `HEAD` | **TAK**, przodek | `git merge-base --is-ancestor e4dc14df6e HEAD; echo $?` | TAK |
| 8 | zasięg zmiany biblioteki metodyk | 6 plików, `AssessmentLibraryTab.tsx` +361/−144 | `git show --stat e4dc14df6e` | TAK — pokazuje, czy diff DOTYKA obiektu pozycji |
| 9 | werdykty pary `ASM-OWN-003` / `[OF]` | `ZAMKNIETE_DEC` kontra `ODLOZONE_DEC` | komenda (6) z `§0.3` | TAK |
| 10 | brzmienie `DEC-2026-09-03-364` | „PO BRAMKACH (fala 2)" | `grep -n 'DEC-2026-09-03-364' …/OWNER_DECISION_LEDGER_2026-08-24.md` | TAK — cytat, nie parafraza |
| 11 | testy pakietu licznika | wszystkie PASS, 0 fail | `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | TAK — runner `node:test`, **nie** `vitest` |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:** `scripts/dev/p0p1-licznik-e1.mjs` ·
`scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` (**wyłącznie jako
produkt skryptu**) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY334_G20_PIETNASCIE_REPORT.md`.

**Zapisujesz WARUNKOWO:** `.github/workflows/test-suite.yml` i `package.json` — wyłącznie
w zakresie wąskiej licencji z tabeli · `docs/program/REJESTR_ZNALEZISK_20260903.md`
(jeden wiersz, dopisany).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` (macierz odbioru — także wiersz `G20`),
pięciu dokumentów wejściowych licznika, `dev-render/**`,
`src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` (teren dyżuru 337),
`evidence/g19/**` (teren dyżuru 335), `evidence/g15/**` (teren dyżuru 336).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day334-g20-pietnascie
git diff --name-only --cached | tee /private/tmp/cx-day334-g20-pietnascie-artefakty/staged.txt
bash -c "grep -iE '^src/|^server/src/|^server/migrations/|MODULE_ACCEPTANCE|ROZLICZENIE_P0P1|DECYZJE_WLASCICIELA|FALA_2_PO_STAGINGU|OWNER_DECISION_LEDGER|dev-render/|controlEnumeration|evidence/g19|evidence/g15' /private/tmp/cx-day334-g20-pietnascie-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R1 — POMIAR WEJŚCIOWY I IMIENNA LISTA (pierwsza pozycja)

1. Uruchom komendy (1)–(3) z `§0.3`. Do raportu idzie: **kod wyjścia**, liczba `BLOKUJE`,
   mianownik, rozkład czterech pozostałych werdyktów, **i jawnie policzona suma**.
2. **Wypisz swoją listę 15 pozycji** i porównaj z tabelą z tej instrukcji, wiersz po
   wierszu. Każda rozbieżność (inna pozycja, inny powód, inna liczba) idzie do „Korekt
   wobec instrukcji" **z komendą**.
3. Sprawdź `git diff` na rejestrze po uruchomieniu. **Niepusty diff bez Twojej zmiany jest
   ZNALEZISKIEM** — znaczy, że rejestr w repo rozjechał się z tym, co produkuje skrypt.
4. Uruchom pakiet bezpiecznika (`node --test`). Liczba testów i wynik do raportu.

**Wymagany dowód:** pięć liczb z komendami, tabela porównawcza 15 pozycji, stan `git diff`,
wynik pakietu. **Commit po `R1`.**

## R2 — PIĘTNAŚCIE POZYCJI: OBIEKT ROZSTRZYGNIĘCIA, NIE INNY KUBEŁEK (rdzeń)

**To jest ta pozycja, dla której dyżur istnieje.** Dla **każdej** z 15 pozycji produkujesz
wiersz tabeli z **jednym z czterech** rozstrzygnięć:

- **SHA naprawy znaleziony** — cytujesz SHA, pokazujesz `git cat-file -e <sha>^{commit}`,
  `git merge-base --is-ancestor <sha> HEAD`, **temat commita** i **`git show --stat <sha>`**.
  ★ Wiersz jest ważny **tylko wtedy, gdy `--stat` pokazuje, że diff DOTYKA obiektu pozycji**.
  Temat w rodzaju `checkpoint …` **nie jest** dowodem naprawy — i narzędzie już to widzi.
- **`DEC` właściciela obejmuje pozycję** — cytujesz identyfikator `DEC-…` **istniejący
  w `OWNER_DECISION_LEDGER_2026-08-24.md`** i **cytujesz zdanie**, z którego wynika, że
  pozycja jest objęta **imiennie**. Sam numer bez zdania nie wystarczy; „rodzina R-N" bez
  wymienienia identyfikatora pozycji też nie.
- **pozycja jest realnie otwarta** — zostaje `BLOKUJE`, ale z **opisem, czego brakuje do
  rozstrzygnięcia**, i jednym zdaniem: „czego konkretnie mi zabrakło, żeby rozstrzygnąć
  samodzielnie". **Wiersz bez tego zdania liczy się jako nierozstrzygnięty.**
- **`DO DECYZJI WŁAŚCICIELA`** — gdy rozstrzygnięcie jest decyzją produktową, nie pomiarem.
  Wtedy formułujesz **jedno konkretne pytanie**, na które da się odpowiedzieć „tak"/„nie",
  a nie opis problemu.

**Dwa tropy, które daję z góry — sprawdź je, nie przyjmuj:**

1. **`ASM-OWN-001` i `ASM-OWN-002`.** Oba stoją na `DEC-2026-09-03-367` („R-4 — Ocena:
   biblioteka metodyk i katalog, właściciel **TAK, teraz**"), zgodnej z `DEC-2026-09-03-353`
   (B2 — lista kolumn biblioteki: *Nazwa metodyki · Obszar · Opis w jednym zdaniu · Liczba
   pytań · Czas trwania · Status · Ostatnio użyta*; podgląd: pełny opis + lista osi +
   przycisk „Rozpocznij ocenę"). Biblioteka metodyk **została scalona** dyżurem 329
   (gałąź `codex/day293-…`, lokalny ref `e4dc14df6e`, merge `cc8f0b1999`).
   **Sprawdź, czy scalony kod realizuje treść `DEC-353`** — otwórz
   `AssessmentLibraryTab.tsx` i porównaj **kolumny i zawartość podglądu z listą z decyzji,
   pozycja po pozycji**. Jeżeli tak: `ASM-OWN-001` i/lub `ASM-OWN-002` dostają SHA
   `e4dc14df6e` jako SHA naprawy. Jeżeli częściowo: **wypisz, czego brakuje imiennie**
   i pozycja zostaje otwarta z tym opisem. ★ „Plik został zmieniony" **nie jest** dowodem —
   dowodem jest zgodność treści z decyzją.
2. **`MYW-CV-REC-001`, `MYW-DEC-REC-001`, `MYWORK-DEC-OWN-001`** stoją dziś na migawkach
   `af75a84e37` (156 plików) i `4a36e8a745` (82 pliki, użyty **dwukrotnie**). Dla każdej:
   albo **znajdujesz commit funkcyjny**, którego `--stat` dotyka Vault table/preview
   względnie listy Decisions (szukaj w historii tych ścieżek, nie w historii migawki),
   albo pozycja **zostaje otwarta** z opisem braku.

**★★ ZAKAZ NADRZĘDNY TEJ POZYCJI.** Nie wolno obniżyć liczby `BLOKUJE` przez **przeniesienie
pozycji do innego kubełka** bez rozstrzygnięcia obiektu. Liczba, która spadła bez obiektu,
mierzy rozjazd dwóch liczników, a nie stan produktu — program ma ten kształt zapisany
imiennie („dwa rejestry — licznik mierzy rozjazd"). **Spadek liczby bez tabeli rozstrzygnięć
= odrzucenie całego dyżuru.**

**Wymagany dowód:** tabela **15 wierszy**, każdy z komendą i jej wynikiem; nowa liczba
`BLOKUJE` z komendą i kodem wyjścia; imienna lista pozycji, które **zostały** otwarte, każda
z powodem i ze zdaniem „czego mi zabrakło"; osobna lista pozycji `DO DECYZJI WŁAŚCICIELA`
sformułowanych jako **pytania rozstrzygalne**. **Commit po `R2`.**

## R3 — SPRZECZNOŚĆ `ASM-OWN-003` KONTRA `ASM-OWN-003[OF]` (rdzeń)

Dwie pozycje tej samej rodziny mają **różne werdykty na tej samej decyzji właściciela**:

- `ASM-OWN-003` → `ZAMKNIETE_DEC`, źródło `DEC-2026-09-03-364`;
- `ASM-OWN-003[OF]` → `ODLOZONE_DEC`, źródła `DEC-2026-08-27-147` **i** `DEC-2026-09-03-364`.

A `DEC-2026-09-03-364` mówi wprost: właściciel **„PO BRAMKACH (fala 2)"**, i pozycja jest
wpisana do `FALA_2_PO_STAGINGU.md`. **„Po bramkach" to odłożenie, nie zamknięcie.**
Co najmniej jedna z tych dwóch klasyfikacji jest dziś fałszywa.

1. **Ustal, skąd bierze się różnica** — czy z reguły w kodzie licznika, czy z różnych
   wpisów w dokumentach wejściowych. Cytuj **linię kodu albo linię dokumentu**, nie wrażenie.
2. **Rozstrzygnij, który werdykt jest poprawny**, i **napraw regułę, nie wpis** — jeżeli
   przyczyną jest kod, poprawiasz kod; jeżeli przyczyną jest dokument wejściowy, **nie
   dotykasz dokumentu** (to słowa właściciela), tylko opisujesz rozjazd w raporcie
   i w rejestrze znalezisk.
3. **Sprawdź RODZINĘ, nie tylko tę parę.** Program ma zmierzony kształt „zlecenie obejmuje
   rodzinę": praca per zgłoszenie daje „poprawne w 2 z 3". **Wypisz wszystkie pozycje
   korpusu, które mają bliźniaka z sufiksem `[OF]`**, i pokaż ich pary werdyktów. Jeżeli
   znajdziesz kolejne rozbieżne pary — rozstrzygasz je tak samo.
4. **Dowód mutacyjny celujący w ZABEZPIECZENIE.** Po naprawie reguły: podstaw wpis, który
   PRZED naprawą przechodził jako `ZAMKNIETE_DEC` na decyzji odkładającej, i pokaż, że
   **po naprawie** licznik go **widzi** jako `ODLOZONE_DEC` (albo `BLOKUJE`). Mutacja
   odwrotna: **usuń naprawioną regułę** i pokaż, że nowy test **czerwieni się**.
   Cofasz przez `cp` do `/private/tmp/cx-day334-g20-pietnascie-scratch` (`Z27`), **nigdy
   `git stash`**; `git diff` po cofnięciu **pusty**.

**Wymagany dowód:** cytat obu wierszy rejestru, cytat zdania decyzji, wskazanie przyczyny
z `plik:linia`, tabela **wszystkich** par `X` / `X[OF]` z werdyktami, mutacja w obie strony
z pełną nazwą czerwonego testu (`Z37`), `git diff` po cofnięciu (pusty). **Commit po `R3`.**

## R4 — BEZPIECZNIK: MIGAWKA NIE JEST NAPRAWĄ

Niezależnie od tego, jak rozstrzygniesz pozycje z `R2`, **kontrakt „commit »checkpoint« nie
jest dowodem naprawy" ma być zabezpieczony testem**, a nie tylko regułą w kodzie.

1. Sprawdź komendą (5) z `§0.3`, **czy rozróżnienie w ogóle istnieje** w `gitShaState()`.
   ★ Jeżeli **nie istnieje** — moja teza jest **obalona**, zapisujesz to w „Korektach wobec
   instrukcji", **dobudowujesz rozróżnienie** i to staje się głównym produktem tej pozycji.
2. Dodaj do pakietu przypadek, który wstrzykuje (przez `options.shaCheck` albo równoważny
   punkt wstrzyknięcia — **bez dotykania git-a**) commit o temacie `checkpoint …` i wymusza,
   że werdykt **nie jest** `NAPRAWIONE`.
3. **Mutacja celuje w zabezpieczenie:** usuń gałąź kodu odpowiadającą za rozróżnienie
   i pokaż, że **nowy test czerwieni się**, podając jego **pełną nazwę**. Cofasz przez `cp`.
   ★ Test, który przechodzi zarówno przed, jak i po usunięciu zabezpieczenia, **nie broni
   niczego** — to jest kształt „test scenariusza nie broni zabezpieczenia" i jest podstawą
   odrzucenia pozycji.

**Wymagany dowód:** wynik komendy (5), nowy test, mutacja w obie strony z pełną nazwą
czerwonego przypadku, `git diff` po cofnięciu (pusty), liczba testów pakietu przed i po.
**Commit po `R4`.**

## R5 — RAPORT

Raport zawiera:

- **stan PRZED/PO**: kod wyjścia, `BLOKUJE`, mianownik, rozkład werdyktów, `git diff` na
  rejestrze;
- **tabelę 15 rozstrzygnięć** z `R2`, każde z komendą i wynikiem;
- **imienną listę pozycji, które zostały otwarte**, z powodem i ze zdaniem „czego mi
  zabrakło, żeby rozstrzygnąć samodzielnie";
- **osobną listę pytań `DO DECYZJI WŁAŚCICIELA`**, każde sformułowane tak, że da się na nie
  odpowiedzieć „tak"/„nie" — **nie opis problemu**;
- **rozstrzygnięcie `R3`** z tabelą wszystkich par `X` / `X[OF]`;
- **tabelę decyzji**: co zmieniłeś w regule klasyfikacji i dlaczego (bez tej tabeli zmiana
  semantyki jest niedopuszczalna);
- **wszystkie dowody mutacyjne dosłownie**, z pełnymi nazwami czerwonych testów;
- **gotowy tekst wiersza `G20`** do wklejenia do `MODULE_ACCEPTANCE.md` — jako propozycję
  dla odbiorcy, z liczbą i komendą; **sam wiersza NIE wpisujesz**;
- listę rozbieżności wobec liczb tej instrukcji;
- **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"**;
- obowiązkowy **akapit `§0.2e`** dla każdego uruchomionego pakietu: która z pułapek go
  dotyczy, jak ją wyłączyłeś i co dowodzi, że wyłączyłeś. Dla licznika dopuszczalne
  „nie dotyczy" **z komendą pokazującą, że dany strażnik nie leży na ścieżce**.

★ **Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest on
GENEROWANY przez skrypt:** `bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Dopisek do pliku
generowanego znika przy następnym przebiegu — i program ma ten kształt zapisany.

**Commit po `R5`.**

## Próg odbioru

**Bramka G20 kończy się `exit 0`** — albo raport **imiennie** wyjaśnia, **które pozycje
i dlaczego** nie dają się rozstrzygnąć bez decyzji właściciela, i dla każdej takiej pozycji
zawiera **jedno rozstrzygalne pytanie**, a nie zgadywanie.

Zdanie „G20 zamknięta" postawione na liczbie, która spadła przez przeniesienie pozycji do
innego kubełka, **nie jest warte nic** i jest podstawą odrzucenia całego dyżuru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „piętnaście pozycji dostało
obiekt rozstrzygnięcia, z czego N zamknięte SHA-mi funkcyjnymi, M decyzjami cytowanymi
imiennie, K zostało otwartych z opisem braku i pytaniem do właściciela; sprzeczność
`ASM-OWN-003` rozstrzygnięta i zabezpieczona testem; migawka nie przechodzi już jako
naprawa" — **jest pełnowartościowym wynikiem, nawet jeśli `BLOKUJE > 0`.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Domknij bramkę G20" vs „zakaz przenoszenia pozycji do innego kubełka" | `R2`, zakaz nadrzędny: liczba spada **wyłącznie** przez rozstrzygnięcie obiektu; próg odbioru dopuszcza `BLOKUJE > 0` z listą pytań |
| „Bramka ma być zielona" vs „`BLOKUJE = 15` dziś" | Tabela licencji, wiersz „Bramka CI": bramka **ma dziś prawo być czerwona**; zakaz `continue-on-error`, `if:` i progu tolerancji |
| „Rozstrzygnij `ASM-OWN-003`" vs „`OWNER_DECISION_LEDGER` jest TYLKO DO ODCZYTU" | `R3` punkt 2: naprawiasz **regułę w kodzie**, a rozjazd dokumentu opisujesz w raporcie i rejestrze znalezisk — dokumentu nie dotykasz |
| „Nie zmieniasz semantyki werdyktów" vs „`R3`/`R4` zmieniają klasyfikację" | Tabela licencji, wiersz „Walidator": zmiana semantyki **wymaga wiersza w tabeli decyzji raportu** — i taki wiersz jest w `R3` i `R5` wymagany wprost |
| „`e4dc14df6e` domyka `ASM-OWN-001`" vs „nie przyjmuj tez z instrukcji" | `R2` trop 1: to jest **teza do sprawdzenia**, dowodem jest zgodność treści kodu z `DEC-353`, nie sam fakt scalenia; obalenie tezy jest sukcesem |
| „Potwierdź bramkę w CI" vs `Z39` i filtr gałęzi workflow | Sekcja „ROZSTRZYGNIĘCIE… (3)": dowód offline z dyżuru 328 **cytujesz**, realnego workflow **nie wywołujesz** |
| „`§0.2c` (A) każe postawić kontener" vs „licznik nie dotyka bazy" | Sekcja „ROZSTRZYGNIĘCIE… (1)": wiążący wariant **(C)**; porty i kontener zostają zarezerwowane i nieużyte |
| „`§0.2c` (B) każe uruchomić pakiet przez `vitest`" vs „pakiet chodzi pod `node --test`" | Sekcja „ROZSTRZYGNIĘCIE… (2)": wiążąca komenda `node --test`; `No test files found` **nie jest** `PASS` |
| „Wpisz wynik do macierzy G20" vs „`MODULE_ACCEPTANCE.md` TYLKO DO ODCZYTU" | Tabela licencji, wiersz „Macierz odbioru": produkujesz **gotowy tekst wiersza w raporcie**, wpisuje go odbiorca |
| „Zero nowych dokumentów" (`Z13`) vs „wiersz w rejestrze znalezisk" | Tabela licencji: to jest **AKTUALIZACJA istniejącego** dokumentu, dopisywana, nigdy nadpisywana; nowy dokument jest dokładnie jeden — raport `R5` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` i `R4`: stan odkładasz przez `cp` do katalogu scratch **poza repo**, wracasz przez `cp`; `git diff` po cofnięciu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — sprawdzone na markerze; jedyny nowy plik to raport `R5` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1–4 i 7–11 zmierzone przy wydaniu |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — wejście · parser · klasyfikator · bezpiecznik · repozytorium/rejestr · wołacz npm · bramka CI · macierz odbioru; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`–`R4` nie wymagają `auth.middleware.ts` ani `Gateway.ts`; `test-suite.yml` i `package.json` mają wąską, imienną licencję |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6370/5510 wolne, brak kontenera `cx-day334-pg`, brak gałęzi i worktree; 335/336/337 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: nadpisywanie rejestru, potok gubiący kod wyjścia, `vitest` kontra `node --test`, migawka przechodząca `cat-file`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
