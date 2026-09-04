## Po co ten dyżur istnieje

Dyżur 331 wyprodukował wniosek, który brzmiał jak poważne znalezisko produktowe —
**„bezimienny widoczny przycisk filtra zatrzymał uczciwy pomiar mianownika"** — i zdążył
przenieść go **dopiskiem do trwałego raportu 295**. Wniosek był **w całości artefaktem
przyrządu**. Dyżur został odrzucony jednym rozstrzygającym powodem:

> commit `2ac619e988` wpisał do kontraktu enumeracji **stałe innego ekranu** — `unique 27 /
> menus 5 / sha 3864b45…` należą do **listy** Idei (`idea-table`), a mierzone miało być
> **narzędzie tabeli** (`idea-table-timeline-stuck`).

**Pomiar odbiorcy dla właściwego ekranu, trzy stabilne przebiegi na harnessie:**
**base 86 · unique 82 · menus 3 · sha256 `2ccdd150…` · ZERO kontrolek bez nazwy dostępnej.**
Po wpisaniu **tych** wartości test jest zielony **łącznie z bramką a11y**.

**★★ Mechanizm fałszu — zapamiętaj go, bo to jest sedno tego dyżuru.**
Sonda pomiarowa to `expect.poll(async () => (await visibleControls(page)).length, { timeout:
30_000 }).toBeGreaterThanOrEqual(expected.minimumBase)`. **Próg minimalny spełnia się, zanim
render się skończy**: przy 200 ms strona ma **1** kontrolkę, dopiero od ok. 800 ms ma **86**.
Sonda zwalniała w połowie renderu, a wszystko, co po niej następowało — inwentarz, hash,
bramka a11y — liczyło się na niepełnym DOM-ie. **Przyrząd kłamał, a wniosek z niego trafił
do dokumentu.**

**★ Co jest już zrobione i czego NIE powtarzasz.** Dwa dowody z dyżuru 331 zostały uratowane
cherry-pickiem, potwierdzone mutacyjnie przez odbiorcę i **leżą na `HEAD`**:

- `85ca28cb28` — dowód konfliktu strony notatnika przez realny `ApiGateway` (kod
  `NOTEBOOK_PAGE_CONFLICT` na produkcyjnej `server/src/routes/v8/my-work.routes.ts`);
- `f3b8f89941` — dowód mutacyjny warunku tenantowego `save()` w
  `server/src/services/report/methodSessionReportMetadataService.ts`.

**★ Co pozostaje otwarte z dyżuru 295 i czego 331 nie ruszył.** Enumeracja dowodzi **efektu**
tylko dla **12 z 226** sygnatur (**5,3%**). Odbiorca 295 pokazał to mutacyjnie: wypatroszenie
`onClick` istniejącej kontrolki (`IdeaTableTool.tsx:2311`, etykieta bez zmian) **zostawia hash
bez zmian i test zielony**. Dodanie nowej martwej kontrolki do menu — **też zielony**.
Dzisiejszy bezpiecznik jest **inwentarzem sygnatur DOM plus drutem ostrzegawczym na hashu**,
a nie dowodem, że cokolwiek działa.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:

- kontrakt ma **cztery** wpisy: `whiteboard-canvas` 45 / 53 / 2, `mindmap-canvas` 57 / 65 / 2,
  `processflow-canvas` 63 / 81 / 3, `idea-table` 21 / 27 / 5 (sha `3864b454…`); suma
  `unique` = **226**;
- **`2ac619e988` NIE jest przodkiem `HEAD`** — kontrakt na linii integracyjnej **nie został
  skażony**; historia pliku kontraktu to jeden commit, `2fd3e38eeb`;
- **fałszywy dopisek do raportu 295 również NIE JEST na `HEAD`** — `grep` po „Dopisek dyżuru
  331" i po „bezimienn" w
  `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md`
  nie znajduje **nic**; historia tego pliku kończy się na `1dc4b60f54`. Dopisek żyje wyłącznie
  na niescalonej gałęzi `codex/day331-mojapraca-i-silnik-20260904`.
  **★ To jest rozbieżność wobec zlecenia**, które mówiło o wycofaniu wpisu z dokumentu
  trwałego — i zapisuję ją tutaj wprost, żebyś nie dopisywał sprostowania do dokumentu,
  w którym nie ma czego prostować. **Zmierz to sam i zapisz swój wynik**;
- `85ca28cb28` i `f3b8f89941` **są przodkami `HEAD`**;
- ekran `idea-table-timeline-stuck` montuje `IdeaMapWorkspace` z `initialTool="table"`;
  ekran `idea-table` montuje `IdeaTableScreen`, a jego etykieta w rejestrze mówi o „pełnym
  obiekcie: lista + podgląd";
- sonda używa `toBeGreaterThanOrEqual(expected.minimumBase)` z `timeout: 30_000`; blok jest
  za `describe.runIf(Boolean(HARNESS_URL))`; bramka a11y to
  `expect(base.every(({ name }) => name.length > 0)).toBe(true)`;
- liście słowników: **pl 35198**, **en 33065**.

**Liczby pomiaru odbiorcy (`base 86 / unique 82 / menus 3 / sha256 `2ccdd150…``) są dla
Ciebie KONTROLĄ, nie źródłem.** Pełny hash bierzesz **wyłącznie z własnych trzech stabilnych
przebiegów**. Jeżeli Twój pomiar nie zgadza się z prefiksem — **zapisujesz rozbieżność i NIE
dopasowujesz pomiaru do liczby**. Dokładnie za to odrzucono dyżur 331.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: PRZYRZĄD · EKRAN HARNESSU · REJESTR EKRANÓW · PRODUKT · KONTRAKT · DOWODY · DOKUMENTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Przyrząd (sonda + kontrakt)** | `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | **★ PEŁNA LICENCJA** w zakresie `R1`, `R2`, `R4`: stabilizacja sondy, dodanie wpisu dla właściwego ekranu, dobudowa dowodu efektu. **Zakaz osłabienia bramki a11y** (`każda kontrolka ma niepustą nazwę`) — nie zamieniasz jej na ostrzeżenie, `expect.soft` ani warunek. **Zakaz `--retry` innego niż `0`** | — |
| **Ekran harnessu — właściwy** | `dev-render/screens/idea-table-timeline-stuck.tsx` | **★ WĄSKA LICENCJA:** wolno dołożyć **atrybut identyfikujący** potrzebny do stabilnego pomiaru (np. znacznik gotowości renderu). **Zakaz zmiany `initialTool`, zakaz podmiany montowanego komponentu** | Brief |
| **Ekran harnessu — lista** | `dev-render/screens/idea-table.tsx` | **TYLKO ODCZYT.** To jest LISTA Idei i jej wpis w kontrakcie (`27 / 5 / 3864b454…`) jest **poprawny dla niej** — nie kasujesz go i nie „poprawiasz" | Opis w raporcie |
| **Rejestr ekranów harnessu** | `dev-render/main.tsx` | **★ WĄSKA LICENCJA:** wyłącznie etykieta wpisu `idea-table-timeline-stuck`, jeżeli `R2` wykaże, że myli. **Zakaz dodawania i usuwania ekranów** | Brief |
| **Produkt — narzędzie tabeli** | `src/components/MyWork/IdeaTableTool.tsx` | **TYLKO ODCZYT w tym dyżurze** — chyba że `R2` albo `R4` wykaże **realny** defekt dostępności (kontrolka bez nazwy) albo **realnie martwą** kontrolkę; wtedy naprawa jest dozwolona, w osobnym commicie, z dowodem mutacyjnym w obie strony | Wpis do tabeli MARTWE: `plik:linia`, etykieta, brak efektu, rekomendacja jako diff **nienałożony** |
| **Produkt — trzy siostrzane narzędzia Idei** | `src/components/MyWork/**` (mind map, whiteboard, process flow) | **TYLKO ODCZYT** — ich wpisy w kontrakcie są dziś poprawne i ich nie ruszasz | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Warstwa serwerowa** | `server/**` w całości | **TYLKO ODCZYT — ZAKAZ ZAPISU.** Dwa dowody z 331 są na `HEAD`; ten dyżur ich nie powtarza i nie ulepsza | Opis w raporcie |
| **Dowody** | `evidence/day337/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie** — surowe wyjścia JSON, logi trzech przebiegów, zapis pomiaru czasowego z `R1` | — |
| **Raport 295** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md` | **★ WĄSKA LICENCJA WARUNKOWA:** sprostowanie **dopisane, nigdy nadpisane** — i **wyłącznie jeżeli `R3` zmierzy, że fałszywe twierdzenie na `HEAD` FAKTYCZNIE JEST**. Jeżeli go nie ma, **nie dotykasz pliku** | Zapis w raporcie: „pozycja bezprzedmiotowa", z komendą |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jeden wiersz, dopisany | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY337_IDEE_ENUMERACJA_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT — ZAKAZ ZAPISU.** Ten dyżur produkuje dowód, który dopiero wejdzie do bramki; wiersza nie dotykasz | Raport podaje, do której bramki dowód należy |
| **Cudze tereny** | `scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md` (dyżur 334) · `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` (dyżur 335) · `evidence/g15/**`, `REJESTR_G15_SAMOKONTROLA_20260903.md` (dyżur 336) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c`

**Wariant (C), bez kontenera.** Ten dyżur nie dotyka bazy danych. Pracujesz w wariancie (C)
(`RUN_DB_TESTS=0 MOCK_DB=true`), **kontenera `cx-day337-pg` nie stawiasz**; port `6373`
i nazwa kontenera pozostają zarezerwowane i nieużyte. W raporcie piszesz jednym zdaniem, że
baza nie była potrzebna, i **nie udajesz dowodu bazodanowego**. Dowód `§0.2b` (b) zastępujesz
zdaniem o braku bazy dyżuru — to jest pełny dowód `Z30` przy braku kontenera.

**Harness `dev-render`** uruchamiasz na **swoim** porcie `5513`:

```bash
cd "$WT"
npx vite --config dev-render/vite.config.ts --port 5513 --strictPort &
HARNESS_PID=$!
echo "HARNESS_PID=$HARNESS_PID" | tee /private/tmp/cx-day337-idee-enumeracja-artefakty/harness.pid
# ★ Na koniec zabijasz WYLACZNIE ten PID: kill "$HARNESS_PID".
# ★ ZAKAZ `pkill node` / `pkill vite` — na sasiednich portach zyja harnessy dyzurow 334-336.
```

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
| 1 | wpisy kontraktu i suma `unique` | 4 wpisy, suma `226` | komenda (1) z `§0.3` | TAK |
| 2 | czy fałszywy commit 331 jest na `HEAD` | **NIE** | komenda (2) z `§0.3` | TAK — `merge-base --is-ancestor`, nie sam `git log` |
| 3 | czy fałszywy dopisek jest w raporcie 295 na `HEAD` | **NIE** (zero trafień) | komenda (3) z `§0.3` | TAK — **`grep` przez `bash -c`**, bo w `zsh` bywa pusty przez `--include` |
| 4 | ekran właściwy kontra lista | `initialTool="table"` kontra `IdeaTableScreen` | komenda (4) z `§0.3` | TAK — czyta montowany komponent, nie nazwę wpisu |
| 5 | **liczba kontrolek w funkcji czasu** | `200 ms → 1`, `800 ms → 86` | pomiar z `R1` punkt 1 | TAK — **to jest dowód, że stara sonda zwalniała za wcześnie** |
| 6 | `base` właściwego ekranu, po stabilizacji | `86` | trzy przebiegi z `R2` | TAK |
| 7 | `unique` właściwego ekranu | `82` | jw. | TAK |
| 8 | `menus` właściwego ekranu | `3` | jw. | TAK |
| 9 | `sha256` sygnatur właściwego ekranu | prefiks `2ccdd150…`; **pełną wartość bierzesz z własnego pomiaru** | jw. | TAK |
| 10 | kontrolki bez nazwy dostępnej | `0` | bramka a11y w tym samym przebiegu | TAK |
| 11 | liczba WYKONANYCH przypadków testu | — | pole `numTotalTests` z JSON-a | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |
| 12 | sygnatury z dowiedzionym EFEKTEM | `12` z `226` (5,3%) | komenda (7) z `§0.3` + Twój pomiar po `R4` | TAK |
| 13 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` ·
`evidence/day337/**` (nowy katalog) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY337_IDEE_ENUMERACJA_REPORT.md`.

**Zapisujesz WARUNKOWO:** `dev-render/screens/idea-table-timeline-stuck.tsx` (wyłącznie
znacznik gotowości renderu) · `dev-render/main.tsx` (wyłącznie etykieta jednego wpisu) ·
`src/components/MyWork/IdeaTableTool.tsx` (**tylko** przy udowodnionym mutacyjnie realnym
defekcie a11y albo martwej kontrolce, osobny commit) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md`
(**tylko** jeżeli `R3` zmierzy obecność fałszywego twierdzenia) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz).

**JAWNIE NIE ZAPISZESZ:** `server/**`, `dev-render/screens/idea-table.tsx`, `tests/setup.ts`,
`tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `.github/workflows/**`,
`server/migrations/**`, `public/locales/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` (macierz odbioru), `scripts/dev/p0p1-licznik-e1.mjs`,
`REJESTR_P0P1_BLOKUJACE_G20.md`, `evidence/g15/**`, `evidence/g19/**`,
`G19_INWENTARZ_OBOWIAZKOW_20260903.md`, `REJESTR_G15_SAMOKONTROLA_20260903.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day337-idee-enumeracja
git diff --name-only --cached | tee /private/tmp/cx-day337-idee-enumeracja-artefakty/staged.txt
bash -c "grep -iE '^server/|idea-table\.tsx|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^public/locales/|MODULE_ACCEPTANCE|p0p1-licznik|REJESTR_P0P1|evidence/g15|evidence/g19|G19_INWENTARZ|REJESTR_G15' /private/tmp/cx-day337-idee-enumeracja-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — POTWIERDŹ, ŻE LINIA JEST CZYSTA (pierwsza pozycja, przed czymkolwiek)

1. Uruchom komendy (1), (2), (3) i (6) z `§0.3`.
2. Zapisz w raporcie **cztery odpowiedzi**: czy kontrakt na `HEAD` jest nieskażony; czy
   `2ac619e988` jest przodkiem; czy fałszywy dopisek jest w raporcie 295; czy oba uratowane
   commity leżą na `HEAD`.
3. ★ **Jeżeli którakolwiek odpowiedź różni się od mojej — to jest wynik, nie przeszkoda.**
   Zapisz rozbieżność w „Korektach wobec instrukcji" z komendą i idź dalej.

**Wymagany dowód:** cztery odpowiedzi z komendami. **Commit po `R0`** (może być pusty
w plikach kodu — wtedy commit obejmuje sam plik postępu i wpis w raporcie).

## R1 — STABILIZACJA SONDY (rdzeń — PRZED jakimkolwiek pomiarem)

**Nie mierzysz niczego, dopóki sonda nie jest stabilna.** Pomiar na sondzie zwalniającej
w połowie renderu jest artefaktem przyrządu, nie wynikiem — i to dokładnie ten błąd
wyprodukował fałszywe znalezisko 331.

1. **Udowodnij defekt sondy liczbą.** Uruchom harness, załaduj
   `?screen=idea-table-timeline-stuck&lang=pl&theme=light` i policz widoczne kontrolki
   **w funkcji czasu**: przy ok. 200 ms, 400 ms, 800 ms, 1500 ms, 3000 ms. Zapisz krzywą
   w `evidence/day337/sonda-krzywa.md`. **Moje liczby: 200 ms → 1, od ok. 800 ms → 86** —
   zmierz swoje.
2. **Przepisz sondę na warunek KOŃCOWY.** Ma czekać na **stabilizację**, nie na próg:
   liczba widocznych kontrolek jest **identyczna w N kolejnych próbkach** (N i odstęp
   dobierasz z krzywej z punktu 1 i **uzasadniasz liczbą**), a dopiero potem zapada pomiar.
   ★ **Próg minimalny nie może pozostać jedynym warunkiem zwolnienia sondy.** Jeżeli
   zostawiasz `minimumBase` jako dodatkowy bezpiecznik — pisz to wprost i uzasadnij.
3. **DOWÓD MUTACYJNY CELUJĄCY W SONDĘ.** Wstrzyknij do ekranu harnessu opóźnienie renderu
   (kopia pliku przez `cp` do katalogu scratch **poza repo**, `Z27` — **nigdy `git stash`**)
   i pokaż, że:
   - **stara** sonda przy tym opóźnieniu **przechodzi z zaniżonym mianownikiem**;
   - **nowa** sonda **czeka** i mierzy pełny mianownik albo **czerwieni się** z jawnym
     komunikatem o niestabilności.

   Przywróć przez `cp`; `git diff` po przywróceniu **pusty**.
4. **Trzy przebiegi na dowód stabilności.** Ta sama komenda, trzy razy, wyniki do
   `evidence/day337/`. Jeżeli trzy przebiegi dają różne liczby — **to jest wynik**
   („przyrząd niestabilny"), a nie powód do wybrania najładniejszej liczby.

**Wymagany dowód:** krzywa czasowa z liczbami, diff nowej sondy, mutacja w obie strony
z pełną nazwą czerwonego przypadku (`Z37`), trzy przebiegi z identycznym wynikiem, `git diff`
po przywróceniu (pusty). **Commit po `R1`.**

## R2 — POMIAR WŁAŚCIWEGO EKRANU I WPIS DO KONTRAKTU (rdzeń)

1. **Zmierz `idea-table-timeline-stuck`** ustabilizowaną sondą, **trzy razy**, z zapisem
   `--reporter=json --outputFile=`. Do raportu idą **cztery liczby i hash**: `base`,
   `unique`, `menus`, liczba kontrolek bez nazwy dostępnej, `sha256`.
   **Moje liczby kontrolne: 86 / 82 / 3 / 0, sha `2ccdd150…`.**
2. **Wpisz do kontraktu WŁASNE liczby.** ★★ **Pełny hash bierzesz wyłącznie z własnego
   pomiaru.** Jeżeli nie zgadza się z prefiksem `2ccdd150` — **zapisujesz rozbieżność i NIE
   dopasowujesz pomiaru do liczby**. To jest ten sam błąd, za który odrzucono 331, tylko
   w drugą stronę.
3. **Rozstrzygnij relację obu wpisów i zapisz decyzję.** Wpis `idea-table` (`27 / 5 /
   3864b454…`) jest **poprawny dla listy Idei** i **nie jest błędem sam w sobie** — błędem
   było branie go za narzędzie tabeli. Rozstrzygasz jedno z dwojga i **uzasadniasz**:
   - kontrakt ma **pięć** wpisów (cztery dotychczasowe + narzędzie tabeli), a suma `unique`
     rośnie z 226 do Twojej nowej liczby; albo
   - wpis listy zostaje **przemianowany na jednoznaczny** (żeby nikt więcej nie pomylił
     listy z narzędziem), a narzędzie dostaje własny wpis.

   **Podaj nową sumę `unique` i nazwij ją wprost jako nowy mianownik.**
4. **DOWÓD MUTACYJNY CELUJĄCY W BRAMKĘ a11y.** Dodaj tymczasowo do narzędzia kontrolkę
   **bez nazwy dostępnej** (przez `cp`, poza repo) i pokaż, że test **czerwieni się** na
   `expect(base.every(({ name }) => name.length > 0)).toBe(true)`. Przywróć przez `cp`.
   ★ Bez tego dowodu zdanie „ZERO kontrolek bez nazwy" jest twierdzeniem, nie pomiarem —
   bramka, która nigdy nie zaświeciła na czerwono, nie jest bramką.

**Wymagany dowód:** trzy przebiegi z identycznymi liczbami, diff kontraktu, uzasadnienie
decyzji z punktu 3, nowa suma `unique`, mutacja a11y w obie strony, `git diff` po przywróceniu
(pusty). **Commit po `R2`.**

## R3 — ŚLAD PO FAŁSZYWYM TWIERDZENIU: NAJPIERW ZMIERZ, CZY JEST

1. **Zmierz** komendą (3) z `§0.3`, czy dopisek („bezimienny widoczny przycisk filtra
   zatrzymał uczciwy pomiar mianownika") jest w
   `CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md` **na `HEAD`**. **Moja liczba: NIE MA GO** —
   żyje wyłącznie na niescalonej gałęzi `codex/day331-mojapraca-i-silnik-20260904`.
2. **Jeżeli go NIE MA** — pozycja jest **bezprzedmiotowa**, i to jest **wynik**: piszesz
   w raporcie, że fałszywe twierdzenie **nigdy nie dotarło na linię integracyjną**,
   z komendą i z `git log` na tym pliku. **Nie dopisujesz niczego „na wszelki wypadek"** —
   dopisek do dokumentu, w którym nie ma czego prostować, tworzy drugi rejestr tej samej
   rzeczy.
3. **Jeżeli JEST** — dopisujesz sprostowanie **OBOK, nigdy zamiast**: oryginalne zdanie
   zostaje, obok staje data, cytat obu wersji, komenda pomiarowa i **wyjaśnienie mechanizmu**
   (sonda zwalniająca przed końcem renderu — z Twoją krzywą z `R1`).
   ★ **Zanim dopiszesz — sprawdź, czy plik nie jest GENEROWANY przez skrypt:**
   `bash -c "grep -rl 'CODEX_DAY295' scripts/"`. Jeżeli jest — dopisek idzie do raportu,
   a do generatora idzie brief.
4. **Sprawdź RODZINĘ, nie tylko ten jeden plik.** Wypisz **wszystkie** miejsca w `docs/`
   i `evidence/` na `HEAD`, w których pojawia się twierdzenie o bezimiennej kontrolce
   blokującej mianownik — praca per zgłoszenie daje „poprawne w 2 z 3".
5. **Jeden wiersz w rejestrze znalezisk**: mechanizm („próg minimalny w `expect.poll`
   zwalnia sondę w połowie renderu; wniosek z takiej sondy jest artefaktem przyrządu"),
   bo to jest wzorzec, który wróci w innych pomiarach.

**Wymagany dowód:** wynik pomiaru z punktu 1 z komendą i kodem wyjścia; albo `git diff`
sprostowania, albo jednoznaczne zdanie „pozycja bezprzedmiotowa" z dowodem; lista rodziny
z punktu 4; wiersz rejestru znalezisk. **Commit po `R3`.**

## R4 — DOWÓD EFEKTU ZAMIAST INWENTARZA SYGNATUR (12 z 226)

Dzisiejszy bezpiecznik dowodzi **efektu** tylko dla wyzwalaczy menu
(`expect(openedMenus).toBe(expected.menus)`) — **12 kontrolek na 226 sygnatur, 5,3%**.
Reszta to inwentarz DOM plus hash: **wypatroszenie handlera nie czerwieni testu**.

1. **Odtwórz MUTACJĘ B** odbiorcy: zamień `onClick: () => setShowConnectorWizard(true)`
   w `IdeaTableTool.tsx:2311` na pusty handler (etykieta bez zmian), przez `cp` poza repo.
   Potwierdź, że **dzisiejszy** test pozostaje **zielony**. To jest punkt wyjścia.
2. **Dobuduj dowód efektu** — wybierz jeden z dwóch kierunków i **uzasadnij wybór**:
   - **kontrakt efektu**: dla kontrolek, których efekt da się zaobserwować w DOM (otwarcie
     dialogu, zmiana stanu widoku, pojawienie się panelu), test klika i sprawdza **skutek**,
     nie tylko obecność; albo
   - **jawna tabela MARTWE**: dla kontrolek, których efektu **nie da się** dowieść tym
     przyrządem, wypisujesz je z `plik:linia` i etykietą do `evidence/day337/martwe.md` —
     **z nazwy, nie liczbą zbiorczą**.

   ★ **Instrukcja 295 żądała dowodu ALBO wpisu do tabeli MARTWE dla KAŻDEJ kontrolki.**
   Zdanie „MARTWE: brak w dowiedzionym zakresie interakcji menu" jest formalnie prawdziwe
   i praktycznie puste — **nie powtarzaj tego kształtu**.
3. **DOWÓD MUTACYJNY CELUJĄCY W NOWY BEZPIECZNIK.** Po dobudowie: powtórz MUTACJĘ B
   i pokaż, że **teraz test się czerwieni**, z pełną nazwą przypadku (`Z37`). Przywróć przez
   `cp`; `git diff` po przywróceniu **pusty**.
   ★ Bezpiecznik, który przechodzi zarówno przed, jak i po wypatroszeniu handlera, **nie
   broni niczego**.
4. **Podaj nową liczbę pokrycia**: ile sygnatur ma dziś dowiedziony efekt, z nowego
   mianownika. Jeżeli liczba nadal jest mała — **napisz ją uczciwie**; częściowy wzrost
   z dowodem jest wynikiem, deklaracja pełnego pokrycia bez mutacji nie jest.

**Wymagany dowód:** wynik MUTACJI B przed i po, diff dobudowy, tabela MARTWE albo kontrakty
efektu, nowa liczba pokrycia z mianownikiem, `git diff` po przywróceniu (pusty).
**Commit po `R4`.**

## R5 — RAPORT

Raport zawiera: cztery odpowiedzi z `R0` · **krzywą czasową sondy** i diff stabilizacji
z `R1` · **trzy przebiegi pomiaru** właściwego ekranu z `R2` (`base`, `unique`, `menus`,
kontrolki bez nazwy, **pełny `sha256`**) · decyzję o relacji obu wpisów kontraktu i **nową
sumę `unique`** · wynik pomiaru z `R3` i jednoznaczne stwierdzenie, czy sprostowanie było
potrzebne · **nową liczbę pokrycia efektu** z `R4` · **wszystkie dowody mutacyjne dosłownie**
(sonda, a11y, MUTACJA B) z pełnymi nazwami czerwonych przypadków · **liczbę WYKONANYCH
przypadków** w każdym przebiegu · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy **akapit `§0.2e`** dla
każdego uruchomionego pakietu (dla tego dyżuru istotne są pułapki: `describe.runIf` dający
`exit 0` przy zerze wykonanych, oraz `vitest` z roota bez configu).

Osobno, jednym zdaniem: **do której bramki macierzy ten dowód należy** i **czego jeszcze
brakuje**, żeby dało się go tam wpisać. Wiersza macierzy **nie dotykasz**.

**Commit po `R5`.**

## Próg odbioru

**Sonda mierzy warunek końcowy, nie próg minimalny, i ma to udowodnione krzywą czasową oraz
mutacją; kontrakt niesie liczby WŁASNEGO pomiaru właściwego ekranu, potwierdzone trzema
identycznymi przebiegami; bramka a11y ma dowód, że potrafi zaświecić na czerwono; ślad po
fałszywym twierdzeniu jest zmierzony, a sprostowanie dopisane TYLKO tam, gdzie fałsz
faktycznie jest.**

Liczba wpisana do kontraktu bez własnego, trzykrotnie powtórzonego pomiaru — **nawet jeżeli
zgadza się z tą instrukcją** — jest podstawą odrzucenia dyżuru. To jest dokładnie ten błąd,
za który odrzucono 331.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „sonda ustabilizowana
i udowodniona krzywą 200 ms → N kontra 800 ms → M; właściwy ekran zmierzony trzykrotnie,
kontrakt niesie moje liczby; bramka a11y udowodniona mutacyjnie; fałszywe twierdzenie
zmierzone — jest / nie ma go na `HEAD`" — **jest pełnowartościowym wynikiem, nawet jeżeli
`R4` zostanie nietknięte.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Wpisz `base 86 / unique 82 / menus 3 / sha 2ccdd150…`" vs „nie przepisuj cudzych liczb" | `R2` punkt 2 i próg odbioru: liczby z instrukcji są **kontrolą**, źródłem są Twoje trzy przebiegi; rozbieżność zapisujesz, nie dopasowujesz |
| „Wycofaj fałszywy wpis z trwałego dokumentu" vs „na `HEAD` tego wpisu nie ma" | `R3` punkty 1–2: **najpierw mierzysz**; brak wpisu czyni pozycję bezprzedmiotową i **to jest wynik**, nie porażka; rozbieżność wobec zlecenia jest zapisana w „Zmierz moje liczby sam" |
| „Zmierz mianownik" vs „nie mierz na niestabilnej sondzie" | Kolejność `R1` przed `R2`, zapisana wprost jako warunek pozycji rdzenia |
| „Wpis `idea-table` jest błędny" vs „lista Idei to prawdziwy ekran" | `R2` punkt 3: wpis listy jest **poprawny dla listy**; błędem było branie go za narzędzie — dlatego rozstrzygasz relację, a nie kasujesz wpis |
| „Nie zmieniasz produktu" vs „napraw kontrolkę bez nazwy, jeśli ją znajdziesz" | Tabela licencji, wiersz „Produkt — narzędzie tabeli": naprawa **wyłącznie** przy udowodnionym mutacyjnie realnym defekcie, w osobnym commicie |
| „Bramka a11y ma być zielona" vs „bramka ma umieć zaświecić na czerwono" | `R2` punkt 4: zieleń dowodzisz pomiarem, zdolność do czerwieni — mutacją; jedno bez drugiego nie jest bramką |
| „Powtórz dowody z 331" vs „`85ca28cb28` i `f3b8f89941` są na `HEAD`" | `R0` punkt 1 (komenda (6)) i tabela licencji, wiersz „Warstwa serwerowa": potwierdzasz komendą i **nie powtarzasz** |
| „`§0.2c` (A) każe postawić kontener" vs „ten dyżur nie dotyka bazy" | Sekcja „ROZSTRZYGNIĘCIE WOBEC `§0.2c`": wiążący wariant **(C)**; port i kontener zarezerwowane i nieużyte |
| „Zabij harness po pracy" vs „zakaz `pkill`" | Sekcja z komendą harnessu: zapisujesz `$!` do pliku i zabijasz **wyłącznie własny PID**; na sąsiednich portach żyją harnessy dyżurów 334-336 |
| „Zero nowych dokumentów" (`Z13`) vs „pliki dowodowe i wiersz rejestru" | Tabela licencji: `evidence/day337/` to **ślad**, rejestr znalezisk to **AKTUALIZACJA**; nowy dokument rejestrowy jest dokładnie jeden — raport `R5` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R1`, `R2`, `R4`: kopia przez `cp` do katalogu scratch poza repo; `git diff` po przywróceniu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par, w tym **sprzeczność zlecenia ze stanem `HEAD`** (fałszywy dopisek) rozstrzygnięta na korzyść pomiaru |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — kontrakt, oba ekrany harnessu, `IdeaTableTool.tsx`, raport 295, odbiór 295/297/298, test 331 sprawdzone na markerze; `evidence/day337/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 13 wierszy; wiersze 1–4 i 13 zmierzone przy wydaniu, wiersze 5–10 są **liczbami odbiorcy podanymi jako kontrola**, co jest zapisane wprost |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — przyrząd · ekran właściwy · ekran listy · rejestr ekranów · produkt narzędzia · produkt siostrzany · bezpieczniki · serwer · dowody · raport 295 · rejestr znalezisk · raport dyżuru · macierz odbioru; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R0`–`R4` nie wymagają `auth.middleware.ts` ani `Gateway.ts`; `dev-render/main.tsx` i ekran harnessu mają **wąską, imienną licencję** |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6373/5513 wolne, brak kontenera `cx-day337-pg`, brak gałęzi i worktree; 334/335/336 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony; **zakaz `pkill` zapisany imiennie**, bo rodzeństwo trzyma harnessy na sąsiednich portach |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: próg minimalny w `expect.poll`, `describe.runIf` dający `exit 0` przy zerze wykonanych, pomylenie listy z narzędziem, hash jako drut ostrzegawczy, niestabilność między przebiegami, doraźny skrypt obok kanonicznego, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
