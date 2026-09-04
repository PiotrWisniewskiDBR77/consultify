## Po co ten dyżur istnieje

Dyżur 346 (scalony, `3f84abd809`) naprawił **żywą ścieżkę** raportu Oceny. Przed nim raport
drukował klientowi „Kompletność `100%` · Obszary ocenione `39/39` · Wiarygodność `Wysoka`" przy
**siedmiu odpowiedziach na trzydzieści dziewięć obszarów**. Przyczyną był jeden warunek:

```
(s) => s && (Number(s.actual) > 0 || Number(s.target) > 0)
```

**Cel jest wpisany przez paczkę metodyki dla KAŻDEGO z 39 obszarów.** Alternatywa sprawia więc, że
licznik zawsze zrówna się z mianownikiem — niezależnie od tego, ile odpowiedzi naprawdę padło.
Po naprawie 346 oba pliki modelu liczą `Number(s.actual) > 0`, a sesja 7/39 daje 18%
i etykietę „Niewystarczająca"; sesja 39/39 dalej daje 100% i „Wysoka".

**Ta naprawa jest jednak lokalna.** Ta sama formuła żyje dalej poza modelem raportu — i tam
`target` znowu podnosi licznik. To jest dokładnie kształt „naprawa per-wywołanie odrasta":
defekt zalatany w jednym miejscu wraca po tygodniach w kilkunastu plikach, jako „nowy".

### ★ Co robi ten dyżur

Nie kolejną łatkę. **Jedną definicję kompletności**, rozprowadzoną po wszystkich miejscach, które
tę liczbę wyliczają, z **dowodem mutacyjnym osobno dla każdego miejsca**. Po tym dyżurze
przywrócenie alternatywy `|| target > 0` w dowolnym z tych miejsc ma **zaczerwienić test**.

---

## ★ Sprostowanie zlecenia — co mój pomiar na markerze skorygował

Zlecenie, z którego powstała ta instrukcja, mówiło o **czterech miejscach**:
`server/src/services/report/drdVizAdapter.ts:81` i `:121`, `src/services/drdVizAdapter.ts:58`
oraz `server/src/routes/assessment/assessment-hub.routes.ts:63,76,80`.
**Zmierzyłem to na markerze i zlecenie było nieścisłe w czterech punktach:**

1. **`src/services/drdVizAdapter.ts` — warunek stoi w wierszu `59`, nie `58`.**
2. **Ten sam plik ma DRUGIE takie miejsce, w wierszu `105`** (wariant „z osi",
   `buildDRDVisualizationDataFromAxes`), którego zlecenie nie widziało. Serwerowy bliźniak ma
   analogiczną parę: `:81` i `:121`.
3. **`assessment-hub.routes.ts:63` nie używa `actual`/`target`, tylko
   `data.achievedLevel > 0 || data.targetLevel > 0`** — ten sam kształt pod innymi nazwami pól.
   Wyszukiwanie po literale `actual` go **nie znajdzie**; szukaj po **kształcie
   „coś-tam > 0 `||` coś-tam > 0"**, nie po nazwie pola.
4. **Rdzeń to więc SIEDEM miejsc w TRZECH plikach, nie cztery.** A cały grep tego kształtu
   w `server/src/` i `src/` daje u mnie **jedenaście trafień w jedenastu plikach** — pozostałe
   cztery (`src/components/assessment/drd/drdAnswersAdapter.ts:76`,
   `src/components/assessment/tools/SIRIForm.tsx:143`,
   `src/components/assessment/tools/DRDForm.tsx:107`,
   `src/components/assessment/reports/AssessmentReportVisualizations.tsx:332`,
   `src/services/report/assessmentReportDataAdapter.ts:119`) **mogą liczyć coś zupełnie innego**
   niż kompletność (np. „czy wykres ma w ogóle sygnał"). **Twoim zadaniem jest je sklasyfikować,
   a nie zmienić hurtem.** Zmiana miejsca, które NIE liczy kompletności, jest regresją.

**Piąty punkt — sprostowanie do wpisania w raport, bo zmienia wagę defektu, a nie jego istnienie.**
Konsumenci błędnej liczby z adaptera **frontowego** — `DRDReportTemplate.tsx` (kafel
„Assessment completion {{completion}}%") i `src/components/assessment/ReportEditor.tsx` — są dziś
**`unreachable`** (sprawdziłem `scripts/dev/reachability-from-root.mjs`; sprawdź sam, komenda 7).
**To jest MINA, nie żywe kłamstwo.** Nie strasz w raporcie klienta czymś, czego klient dziś nie
widzi. **Ale naprawiasz to i tak** — mina rozbraja się przed podłączeniem, nie po nim.

**Szósty punkt, przeciwny:** trasa `/api/assessments` **JEST żywa**. Zamontowana w
`server/src/Gateway.ts:1110`, ma **trzech wołaczy frontowych**
(`Api.get('/assessments')` w `MyWork/TaskDetailView.tsx:1669`,
`MyWork/DecisionDetailView.tsx:4930`, `Initiatives/InitiativeDocumentView.tsx:3962`).
Tam oś liczy się jako zrobiona z samego celu **dzisiaj**.

**Siódmy punkt — sprostowanie, którego zlecenie nie zawierało, a które chroni Cię przed fałszywym
alarmem:** model raportu bierze z adaptera **wyłącznie `viz.dimensions`**
(`server/src/services/report/drdReportModel.ts:274`, `src/services/report/drdReportModel.ts:303`).
**Zepsuty `completionPercent` adaptera NIE cofa naprawy dyżuru 346.** Sprawdź to komendą 4, zanim
napiszesz, że raport klienta znowu kłamie.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Twierdzę: kształt „`X > 0 || Y > 0`" ma w `server/src/` i `src/` **11** trafień; rdzeń dyżuru to
**7** miejsc w **3** plikach; obszarów metodyki DRD jest **39**; oba pliki modelu raportu liczą już
`Number(s.actual) > 0` i mają po **0** wystąpień alternatywy; `viz.completionPercent` ma
w modelach raportu **0** wystąpień; trasa `/api/assessments` jest zamontowana w **jednym** miejscu
(`Gateway.ts:1110`) i ma **3** wołaczy frontowych; `computeProgressFields` jest wołana z **3**
miejsc w swoim pliku; `DRDReportTemplate.tsx` i `ReportEditor.tsx` mają klasyfikację
**`unreachable`**, a `src/services/drdVizAdapter.ts` i `AssessmentReportVisualizations.tsx` —
**`app`**; liście `public/locales/pl/translation.json` = **35199**, `en` = **33066**.

**Każdą z tych liczb policz sam, u siebie, na swojej bazie. Przepisanie mojej liczby jest
zawyżeniem i podstawą odrzucenia raportu (`Z24`).** Wszystkie grepy uruchamiaj przez
`bash -c "…"` — `grep --include` w `zsh` zwraca pustkę zamiast wyniku, a **pustka nie jest
wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało**.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · ADAPTER · TESTY

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **definicja — serwer (NOWY)** | `server/src/services/report/assessmentCompleteness.ts` (**NOWY**) | **★ PEŁNA LICENCJA.** Jedno źródło prawdy dla drzewa serwerowego: co liczy się jako „obszar z odpowiedzią" i jak z tego powstaje procent | — |
| **definicja — front (NOWY)** | `src/services/assessmentCompleteness.ts` (**NOWY**) | **★ PEŁNA LICENCJA.** Bliźniak frontowy o **identycznym zachowaniu**; parytet broniony kontraktem z `R2` | — |
| **adapter wizualizacji — serwer** | `server/src/services/report/drdVizAdapter.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE dwa miejsca liczenia (`:81`, `:121`) i ich zastąpienie wywołaniem wspólnej definicji.** ZAKAZ zmiany kształtu zwracanego obiektu, kolorów osi, `maxLevel` i mapowania kluczy | Gotowy diff w bloku kodu, **nienałożony**, + brief: promień rażenia, co widzi klient przed i po |
| **adapter wizualizacji — front** | `src/services/drdVizAdapter.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE dwa miejsca liczenia (`:59`, `:105`).** ★ To jest **bliźniak, nie kopia zapasowa** — naprawa jednego drzewa bez drugiego zostawia kłamstwo w drugim, dokładnie jak przed dyżurem 346 | Gotowy diff nienałożony + brief |
| **trasa listy ocen** | `server/src/routes/assessment/assessment-hub.routes.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE ciało funkcji `computeProgressFields` (ok. 42-105).** **ZAKAZ dodawania, usuwania i przenoszenia tras** (plik ma 7 tras), zakaz zmiany kształtu odpowiedzi poza polem `progress`/`completedAxes`, zakaz zdejmowania `@ts-nocheck` | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA**, oznaczony `it('KONTRAKT DLA DYŻURU 351 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **konsumenci nieosiągalni** | `src/components/assessment/reports/templates/DRDReportTemplate.tsx`, `src/components/assessment/ReportEditor.tsx` | **★ WĄSKA LICENCJA: WYŁĄCZNIE poprawność liczby i jej etykiety.** **ZAKAZ dopisania im wołacza produkcyjnego i zmiany osiągalności** (`Z11`, `Z40`) — odsłonięcie ekranu bez akceptu właściciela jest odrzuceniem pozycji | Opis w raporcie z dowodem plik:linia + gotowy diff nienałożony |
| **warstwa wizualizacji** | `src/components/assessment/reports/AssessmentReportVisualizations.tsx` | **★ WĄSKA LICENCJA: WYŁĄCZNIE etykieta i podpis kafla „Completion" (ok. 176-187)**, jeżeli poprawna liczba wymaga innego napisu (np. rozdzielenia „obszarów z odpowiedzią" od „obszarów z celem"). **ZAKAZ usunięcia kafla** — ukrycie metryki nie jest naprawą. ★ Wiersz `:332` (`hasSignal`) **prawdopodobnie NIE liczy kompletności** — sklasyfikuj go w `R1`, zanim ruszysz | Gotowy diff nienałożony + brief |
| **modele raportu (naprawa 346)** | `server/src/services/report/drdReportModel.ts`, `src/services/report/drdReportModel.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE zastąpienie literału `(s) => s && Number(s.actual) > 0` wywołaniem wspólnej definicji, przy IDENTYCZNYM zachowaniu.** ZAKAZ zmiany progów `confidenceLabel`, sekcji raportu i skal osi (`Z40`) | Zostawiasz literał i opisujesz w raporcie, dlaczego wspólna definicja go nie obejmuje |
| **kandydaci do klasyfikacji** | `src/components/assessment/drd/drdAnswersAdapter.ts`, `src/components/assessment/tools/SIRIForm.tsx`, `src/components/assessment/tools/DRDForm.tsx`, `src/services/report/assessmentReportDataAdapter.ts` | **TYLKO ODCZYT DO CZASU KLASYFIKACJI W `R1`.** Jeżeli `R1` udowodni, że liczą **kompletność** — licencja rozszerza się do wąskiej, jak wyżej. Jeżeli liczą co innego — **zostawiasz je nietknięte i piszesz dlaczego** | Wpis w raporcie: plik, linia, co ta liczba naprawdę znaczy, dowód |
| **struktura metodyki** | `server/src/data/drdStructure.ts`, `src/services/drdStructure.ts` | **TYLKO ODCZYT** — `getTotalAreaCount()` jest poprawne; problem jest w liczniku, nie w mianowniku | Errata w raporcie |
| **flagi ujawniania** | `src/utils/drdReportFlag.ts`, bramka `drdHttpSourceOfTruthV1` w `useFeatureFlags.ts` | **TYLKO ODCZYT. ZAKAZ zmiany wartości domyślnej** (`Z10`, `Z11`) | Errata w raporcie |
| **walidator (NOWE pliki)** | `tests/unit/report/**`, `tests/unit/assessment/**`, `server/src/services/report/__tests__/**`, `server/src/routes/__tests__/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **★ NOWE PLIKI TESTOWE dla warstwy frontowej kładziesz w `tests/`, NIGDY pod `src/`** — plik testowy pod `src/` czerwieni `node scripts/dev/reachability-from-root.mjs --check-baseline` (zdarzyło się 04.09 trzy razy). `git add -f` obowiązkowo | — |
| **walidator (ZASTANE, dyżur 346)** | `tests/unit/report/day346.drdReportCompleteness.test.ts`, `server/src/services/report/__tests__/day346.fullSession39.gateway.pg.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących asercji (`Z40`) | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 351` |
| **dowody** | `evidence/licznik-kompletnosci-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f`. **★ Wszystkie wyniki `--reporter=json`, mutacje i wypisy inwentarza lądują TUTAJ, w repo** — 04.09 trzykrotnie trzeba było ratować dowody z katalogów tymczasowych. Katalog `ARTEFAKTY` jest roboczy; dowód jest w repo | — |
| **dowody dyżurów 339/346** | `evidence/silniki-raportu-oceny-20260904/**`, `evidence/raport-oceny-kompletnosc-20260904/**` | **TYLKO ODCZYT — CUDZE DOWODY** | Twoje artefakty idą do własnego katalogu |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji o pierwszej wolnej literze.** Zakaz kasowania i przeredagowywania sekcji zastanych | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY351_LICZNIK_KOMPLETNOSCI_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT — teren dyżuru 353** | Wpis do raportu: który wiersz Twoja praca dotyka i jaki dowód dostarczyłeś; **nie zmieniasz stanu** |
| **bramki i infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.husky/pre-commit`, `scripts/check-*.sh` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `src/components/standard/StandardPreview.tsx` i wołacze podglądu — **teren dyżuru 352**; `docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` i `evidence/g19/**` — **teren dyżuru 353**; `src/components/DiscoveryTools/**`, `src/toolPacks/**`, `src/components/Discovery/**` — **teren dyżuru 354** | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Inwentarz WSZYSTKICH miejsc formuły + klasyfikacja „kompletność / co innego" | TAK | NIE — dowód: inwentarz jest odczytem; `bash -c "grep -rn …"` nie dotyka żadnego pliku | bazowe | Imienna lista **każdego** trafienia kształtu `X > 0 \|\| Y > 0` z `plik:linia`, kolumną „co ta liczba znaczy" i werdyktem `KOMPLETNOŚĆ` / `INNE` + **własna liczba**; dla każdego `KOMPLETNOŚĆ` — czy jest osiągalny z korzenia | `bash -c "grep -rn 'actual > 0 \|\| \|current > 0 \|\| \|achievedLevel > 0 \|\| ' server/src/ src/"` + `node scripts/dev/reachability-from-root.mjs` | `docs(day351): inwentarz miejsc licznika kompletnosci (351 R1)` |
| R2 | **RDZEŃ: jedna definicja per drzewo + mutacja PER MIEJSCE** | TAK | NIE — dowód: `B.1` daje wąską licencję na każde miejsce z inwentarza | +1 test **na każde naprawione miejsce** | Wszystkie miejsca z werdyktem `KOMPLETNOŚĆ` wołają wspólną definicję; **kontrakt parytetu serwer↔front zielony**; **osobna mutacja na KAŻDE miejsce, każda RED**; testy dyżuru 346 dalej zielone | `npx vitest run tests/unit/report tests/unit/assessment --retry=0 --reporter=json --outputFile=…` + `npx vitest run server/src/services/report/__tests__ --config server/vitest.config.ts --retry=0 …` | `fix(assessment): jedna definicja kompletnosci zamiast siedmiu kopii (351 R2)` |
| R3 | **RDZEŃ: dowód na ŻYWEJ trasie `/api/assessments` na realnym PostgreSQL** | TAK | NIE — dowód: zmieniasz wyłącznie ciało `computeProgressFields`, nie montaż | +1 test PG | Kontener `cx-day351-pg` na `6410`, baza `cx351`, **dwa przebiegi migracji** (drugi bezbłędny i bez zmian); ocena DRD z **7 z 39** odpowiedziami i **zerową kolumną `completion_percent`**; trasa **nie** melduje osi jako zrobionej z samego celu; mutacja RED→GREEN z pustym `git diff` | `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres … npx vitest run server/src/routes/__tests__/day351.*.pg.test.ts --config server/vitest.config.ts --retry=0 …` | `fix(assessment-hub): postep osi liczony z odpowiedzi, nie z celow paczki (351 R3)` |
| R4 | Rozbrojenie miny: nieosiągalni konsumenci i kafel „Completion" | NIE | NIE | +1 test | `DRDReportTemplate.tsx` i `ReportEditor.tsx` dostają poprawną liczbę **bez** dopisania wołacza i **bez** zmiany osiągalności; etykieta kafla nie twierdzi więcej, niż wie; `reachability --check-baseline` dalej `exit 0` | `node scripts/dev/reachability-from-root.mjs --check-baseline; echo $?` | `fix(assessment): rozbroj mine kompletnosci w nieosiagalnych konsumentach (351 R4)` |
| R5 | Raport + jedna sekcja rejestru | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta**, tabela rozbieżności wobec liczb tej instrukcji | — | `docs(day351): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Pliki przekrojowe w promieniu tego dyżuru to `server/src/Gateway.ts`
> (montaż trasy) i `auth.middleware.ts` — **żadna pozycja ich nie zmienia**, bo naprawa siedzi
> w ciele funkcji, nie w montażu. Jeśli uznasz, że musi — produktem jest czerwony kontrakt
> + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Trafienia kształtu `X > 0 \|\| Y > 0` w `server/src/` + `src/`, bez testów | 11 | `bash -c "grep -rn 'actual > 0 \|\| \|actual) > 0 \|\| \|current > 0 \|\| \|achievedLevel > 0 \|\| ' server/src/ src/ --include=*.ts --include=*.tsx \| grep -v __tests__"` | TAK — **szukam po KSZTAŁCIE, nie po nazwie pola**; wariant `achievedLevel` nie ma słowa `actual` |
| 2 | Z tego: miejsca liczące **kompletność** (rdzeń) | 7 w 3 plikach | `bash -c "grep -n 'actual > 0 \|\| \|current > 0 \|\| \|achievedLevel > 0 \|\| ' server/src/services/report/drdVizAdapter.ts src/services/drdVizAdapter.ts server/src/routes/assessment/assessment-hub.routes.ts"` | TAK — **to jest mianownik pozycji `R2`**; jeśli Twój wyjdzie inny, obowiązuje Twój |
| 3 | Obszary metodyki DRD | 39 | `bash -c "grep -n 'getTotalAreaCount' server/src/data/drdStructure.ts"` + wywołanie funkcji | TAK — to mianownik kompletności |
| 4 | Wystąpienia alternatywy w OBU modelach raportu (po naprawie 346) | 0 | `bash -c "grep -c 'actual) > 0 \|\|' server/src/services/report/drdReportModel.ts src/services/report/drdReportModel.ts"` | TAK — **potwierdza, że 346 nie jest cofnięte**; jeśli > 0, masz regresję do zgłoszenia |
| 5 | Użycia `viz.completionPercent` w modelach raportu | 0 | `bash -c "grep -n 'viz\\.' server/src/services/report/drdReportModel.ts src/services/report/drdReportModel.ts"` | TAK — same `viz.dimensions`; **stąd wniosek, że adapter nie cofa naprawy 346** |
| 6 | Montaże trasy `/api/assessments` | 1 (`Gateway.ts:1110`) | `bash -c "grep -n 'assessmentHubRoutes' server/src/Gateway.ts"` | TAK — **trasa jest ŻYWA**, to nie jest mina |
| 7 | Wołacze frontowe `Api.get('/assessments')` | 3 | `bash -c "grep -rn \\"Api.get('/assessments')\\" src/ --include=*.tsx"` | TAK — mierzy realną konsumpcję, nie samo istnienie trasy |
| 8 | Wywołania `computeProgressFields` w jej pliku | 3 (`:158`, `:240`, `:352`) | `bash -c "grep -n 'computeProgressFields' server/src/routes/assessment/assessment-hub.routes.ts"` | TAK — jedna naprawa obsługuje trzy trasy |
| 9 | Klasyfikacja osiągalności czterech plików z promienia | `unreachable` / `unreachable` / `app` / `app` | `node scripts/dev/reachability-from-root.mjs` + filtr po `file` | TAK — rozdziela „minę" od „żywego kłamstwa" |
| 10 | Liście `translation.json` | pl 35199 / en 33066 | `node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/services/report/assessmentCompleteness.ts` | NOWY | R2 | ZEROWE |
| 2 | `src/services/assessmentCompleteness.ts` | NOWY | R2 | ZEROWE |
| 3 | `server/src/services/report/drdVizAdapter.ts` | ZASTANY | R2 | ŚREDNIE — konsumowany przez model raportu; **zmieniasz wyłącznie dwa miejsca liczenia** |
| 4 | `src/services/drdVizAdapter.ts` | ZASTANY | R2 | ŚREDNIE — bliźniak frontowy; **ta sama zmiana, ten sam commit** |
| 5 | `server/src/routes/assessment/assessment-hub.routes.ts` | ZASTANY | R3 | ★★ WYSOKIE — plik z `@ts-nocheck`, 7 tras; **wyłącznie ciało `computeProgressFields`** |
| 6 | `evidence/licznik-kompletnosci-20260904/**` | NOWY | R1/R2/R3 | ZEROWE — **twój** katalog dowodów |
| 7 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY351_LICZNIK_KOMPLETNOSCI_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/services/report/drdReportModel.ts`, `src/services/report/drdReportModel.ts` | R2 | Tylko jeśli wspólna definicja daje **identyczne** zachowanie; testy dyżuru 346 muszą pozostać zielone bez zmiany asercji |
| `src/components/assessment/reports/templates/DRDReportTemplate.tsx`, `src/components/assessment/ReportEditor.tsx` | R4 | Wyłącznie poprawność liczby i etykiety; **zero zmian osiągalności**, `reachability --check-baseline` dalej `exit 0` |
| `src/components/assessment/reports/AssessmentReportVisualizations.tsx` | R4 | Wyłącznie etykieta/podpis kafla „Completion"; kafel zostaje. Wiersz `:332` tylko jeśli `R1` udowodnił, że liczy kompletność |
| `src/components/assessment/drd/drdAnswersAdapter.ts`, `tools/SIRIForm.tsx`, `tools/DRDForm.tsx`, `src/services/report/assessmentReportDataAdapter.ts` | R2 | Wyłącznie po werdykcie `KOMPLETNOŚĆ` w `R1`, z uzasadnieniem w raporcie |
| `tests/unit/**`, `server/src/**/__tests__/**` (NOWE) | R2/R3/R4 | `git add -f`; test musi czerwienić się od mutacji **ZABEZPIECZENIA**, nie mechanizmu |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | R5 | Jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/Gateway.ts                                    — montaz tras, plik przekrojowy
server/src/middleware/auth.middleware.ts                 — bramka platformowa
server/src/middleware/orgContext.middleware.ts           — bramka platformowa
server/src/data/drdStructure.ts                          — mianownik jest poprawny
src/services/drdStructure.ts                             — jw.
src/utils/drdReportFlag.ts                               — flaga ujawniania, default OFF
tests/setup.ts, tests/helpers/**, tests/__mocks__/**     — Z18
vitest*.config.ts, server/vitest.config*.ts              — Z18
.husky/pre-commit, scripts/check-*.sh                    — bramki, Z18
docs/program/waves/WAVE_03_ACCEPTANCE/modules/**         — macierz odbioru, teren dyzuru 353
evidence/g19/**                                          — teren dyzuru 353
evidence/silniki-raportu-oceny-20260904/**               — CUDZE dowody (dyzur 339)
evidence/raport-oceny-kompletnosc-20260904/**            — CUDZE dowody (dyzur 346)
src/components/standard/StandardPreview.tsx              — teren dyzuru 352
src/components/DiscoveryTools/**, src/toolPacks/**       — teren dyzuru 354
src/components/Discovery/**                              — teren dyzuru 354
server/migrations/**                                     — przedzial NIEPRZYDZIELONY
public/locales/**                                        — ten dyzur nie dodaje kluczy
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6410 | `lsof -nP -iTCP:6410 -sTCP:LISTEN` → puste (zmierzone przy pisaniu instrukcji na markerze `c0f690bae3`) |
| Port harnessu | 5550 | `lsof -nP -iTCP:5550 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day351-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day351` → brak |
| Nazwa bazy | `cx351` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | `ls server/migrations/` — nie tworzysz tam nic; potrzeba migracji = **STOP MERYTORYCZNY z briefem** |
| Gałąź | `codex/day351-licznik-kompletnosci-20260904` | nie istnieje na `github-backup` (sprawdzone) |
| Worktree | `/private/tmp/cx-day351-licznik-kompletnosci` | nie istnieje (sprawdzone) |
| Flagi funkcyjne | **ŻADNA NOWA.** Zastane w promieniu: `isDrdReportEnabled` (OFF), `drdHttpSourceOfTruthV1` (OFF) | `bash -c "grep -rn 'VITE_.*DRD' .env* docker-compose* railway* 2>/dev/null"` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day351-licznik-kompletnosci
git diff --name-only --cached | tee /private/tmp/cx-day351-licznik-kompletnosci-artefakty/staged.txt
grep -iE 'Gateway\.ts|auth\.middleware|orgContext\.middleware|drdStructure|drdReportFlag|tests/setup|tests/helpers|tests/__mocks__|vitest.*config|\.husky/|scripts/check-|waves/WAVE_03_ACCEPTANCE/modules/|evidence/g19/|evidence/silniki-raportu-oceny|evidence/raport-oceny-kompletnosc|standard/StandardPreview|components/DiscoveryTools/|toolPacks/|components/Discovery/|server/migrations/|public/locales/' \
  /private/tmp/cx-day351-licznik-kompletnosci-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ oba adaptery maja isc RAZEM — naprawa jednego drzewa zostawia klamstwo w drugim:
git diff --name-only --cached | grep -c 'drdVizAdapter.ts'
#   oczekiwane przy commicie R2: 2

# ★ NOWY plik testowy pod src/ czerwieni bezpiecznik osiagalnosci:
git diff --name-only --cached --diff-filter=A | grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' \
  && echo "★★ NOWY TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"

# ★ dowody MAJA byc w repo, nie w katalogu tymczasowym:
git diff --name-only --cached | grep -c '^evidence/licznik-kompletnosci-20260904/'
#   oczekiwane przy commitach R1/R2/R3: co najmniej 1
```

---

## R1 — INWENTARZ WSZYSTKICH MIEJSC I KLASYFIKACJA

**Ta pozycja niczego nie naprawia.** Ma zamienić cztery liczby ze zlecenia na **Twój własny,
kompletny inwentarz** i rozstrzygnąć, które z tych miejsc liczą **kompletność**, a które co innego.

**(a) Grep po KSZTAŁCIE, nie po nazwie pola.** Wariant `achievedLevel > 0 || targetLevel > 0`
(`assessment-hub.routes.ts:63`) nie zawiera słowa `actual` — wyszukiwanie po nazwie pola go zgubi.
Podaj **swoją** liczbę trafień i swój wzorzec.

**(b) Tabela inwentarza.** Dla każdego trafienia: `plik:linia` · fragment kodu · **co ta liczba
naprawdę znaczy** (jedno zdanie) · werdykt `KOMPLETNOŚĆ` / `INNE` z uzasadnieniem · klasyfikacja
osiągalności pliku z `scripts/dev/reachability-from-root.mjs`.

**★ Werdykt `INNE` jest tak samo cenny jak `KOMPLETNOŚĆ`.** Przykład, który sam widzę i którego
nie rozstrzygam za Ciebie: `AssessmentReportVisualizations.tsx:332` liczy
`chartData.filter((d) => d.current > 0 || d.target > 0).length >= 3` i nazywa się `hasSignal` —
to wygląda na pytanie „czy wykres ma w ogóle co narysować", a nie na kompletność oceny. Zmiana
takiego miejsca byłaby **regresją**, nie naprawą.

**(c) Osobno wypisz, które miejsca są ŻYWE, a które są MINĄ.** Kryterium: klasyfikacja
osiągalności **konsumenta liczby**, nie samego pliku. `src/services/drdVizAdapter.ts` ma
klasyfikację `app`, ale jego `completionPercent` konsumują wyłącznie dwa pliki `unreachable` —
i to jest **mina**. Napisz to dokładnie tak; nie zamieniaj miny w alarm ani alarmu w minę.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: JEDNA DEFINICJA PER DRZEWO, MUTACJA PER MIEJSCE

**To jest powód, dla którego ten dyżur istnieje.** Nie chodzi o siedem łatek, tylko o to, żeby
ósmego wystąpienia nie dało się napisać przez przypadek.

Wymagania, w kolejności rozstrzygającej:

1. **Jedna definicja per drzewo.** `server/src/services/report/assessmentCompleteness.ts`
   i `src/services/assessmentCompleteness.ts`. Serwer i front **nie mogą importować się
   nawzajem w produkcji** — dlatego „jedna definicja" znaczy tu **jedno źródło na drzewo**,
   a nie jeden plik dla obu. Definicja odpowiada na jedno pytanie: *co liczy się jako obszar
   z odpowiedzią* — i **cel wpisany przez paczkę metodyki nią nie jest**.
2. **Kontrakt parytetu.** Nowy test w `tests/` importuje **obie** definicje i na tym samym
   zestawie danych żąda **identycznego wyniku**. To jest bezpiecznik przeciwko rozjazdowi
   bliźniaków — tej samej klasy błędu, którą dyżur 346 musiał naprawiać w dwóch plikach naraz.
3. **Wszystkie miejsca z werdyktem `KOMPLETNOŚĆ` wołają wspólną definicję.** Żadne z nich nie
   ma prawa zostać z własnym literałem.
4. **Jeżeli „obszar z celem" warto pokazać — pokazujesz go jako OSOBNĄ liczbę z własną etykietą**,
   nigdy jako kompletność.
5. **Naprawa dyżuru 346 nie zmienia zachowania.** Zastąpienie literału wywołaniem jest dozwolone
   **tylko** wtedy, gdy testy 346 pozostają zielone bez dotknięcia ich asercji.

**Dowód wymagany, w tej kolejności:**

- **inwentarz z `R1` przebiegnięty ponownie**: zero miejsc z werdyktem `KOMPLETNOŚĆ`, które nie
  wołają wspólnej definicji;
- **na danych 7 z 39**: żadne z tych miejsc nie zwraca kompletu — podaj wartość **z każdego
  miejsca osobno**, nie jedną zbiorczą;
- **na danych 39 z 39**: każde zwraca komplet — czyli poprawka **nie psuje pełnej sesji**;
- **★★ MUTACJA PER MIEJSCE.** Dla **każdego** naprawionego miejsca osobno: przywróć w nim
  alternatywę `|| target > 0` (albo `|| targetLevel > 0`) → test **CZERWONY**; cofnij przez `cp`
  z kopii w `SCRATCH` (`Z27`, **nigdy `git stash`**) → **ZIELONY**; `git diff` po cofnięciu
  **pusty**. **Jedna mutacja „reprezentatywna" nie wystarcza** — mutacja, która czerwieni test
  z jednego miejsca, a przechodzi z drugiego, dowodzi, że drugie nie jest bronione;
- **mutacja kontrolna na kontrakcie parytetu**: zmień definicję **tylko w jednym drzewie** →
  kontrakt parytetu ma **CZERWIENIĆ**. Jeżeli przechodzi, Twój parytet nie jest bezpiecznikiem.

★ **Dowód mutacyjny ma celować w ZABEZPIECZENIE, nie w mechanizm** (`Z32`). Test, który czerwieni
się od byle zmiany w adapterze, ale nie od przywrócenia alternatywy, **nie broni niczego**.

Prawo zatrzymania po tej pozycji.

## R3 — RDZEŃ: DOWÓD NA ŻYWEJ TRASIE, NA REALNYM POSTGRESQL

**Dlaczego to jest rdzeń, a nie dodatek.** `/api/assessments` jest zamontowana w `Gateway.ts:1110`
i ma trzech wołaczy frontowych. To jedyne miejsce w promieniu tego dyżuru, gdzie defekt jest
**żywy dzisiaj**, a nie miną na przyszłość.

Wymagania:

1. **Kontener `cx-day351-pg` na porcie `6410`, baza `cx351`**, obraz `pgvector/pgvector:pg16`
   (`postgres:15` **nie przechodzi migracji** — brak rozszerzenia `vector`). **Dwa przebiegi
   migracji**, drugi bezbłędny i bez zmian (idempotencja). Oba logi do `evidence/`.
2. **★★ Test musi trafić w przypadek, w którym derywacja osi ma znaczenie.**
   `computeProgressFields` zwiera obliczenie: `if (completionPercent > 0) { progress = completionPercent; }`
   stoi **przed** gałęzią liczącą `completedAxes`. Jeżeli zasiejesz ocenę z niezerową kolumną
   `completion_percent`, **zmierzysz kolumnę, a nie licznik** — i Twój test przejdzie z całkiem
   innego powodu, niż myślisz. Sprawdź to komendą 6 i napisz w raporcie, jak zapewniłeś warunek.
3. **Sesja z odpowiedziami na 7 z 39 obszarów** założona na **Twojej** bazie i **Twoim** porcie,
   nigdy na demo, staging ani produkcji (`Z9`, `Z28`). Dane demo są twarzą produktu — po pomiarze
   `docker rm -fv cx-day351-pg` (bez `-v` wolumen zostaje), a w raporcie identyfikator oceny
   i sposób jej zasiania.
4. **Para asercji, nie pojedyncza liczba:** przy 7 z 39 trasa raportuje niepełny postęp
   **oraz** przy 39 z 39 raportuje pełny. Sam „niepełny" nie odróżnia naprawy od wygaszenia
   funkcji — to jest kształt „zamknięte przez wygaszenie".
5. **Dowód mutacyjny wycelowany w zabezpieczenie**: przywróć alternatywę w `computeProgressFields`
   → **CZERWONY**; cofnij przez `cp` → **ZIELONY**; `git diff` po cofnięciu **pusty**.
6. **`@ts-nocheck` w pierwszej linii pliku trasy** znaczy, że kompilator nie złapie Twojego błędu
   typu. **Dowodem poprawności jest wyłącznie przelot testowy**, nigdy „tsc przeszło".

**Jeżeli nie zdołasz zasiać oceny na realnym PG** — to jest **STOP MERYTORYCZNY z briefem**,
pełnowartościowy wynik pozycji: opisujesz, czego zabrakło, i podajesz, ile pracy potrzeba.
**Nie zastępujesz tego testem na atrapie bazy z adnotacją „przybliżenie"** — atrapa
(`Database.ts:686`) zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` i nie jest
dowodem czegokolwiek o zapisie.

Prawo zatrzymania po tej pozycji.

## R4 — ROZBROJENIE MINY: NIEOSIĄGALNI KONSUMENCI I KAFEL „COMPLETION"

**Zacznij od sprostowania, nie od kodu.** `DRDReportTemplate.tsx` i `ReportEditor.tsx` są dziś
`unreachable` — **klient tej liczby nie widzi**. Zweryfikuj to sam (`B.3`, wiersz 9) i zapisz
wynik. Nie strasz w raporcie kłamstwem, którego nikt nie czyta.

Produkty pozycji:

1. **Poprawna liczba w obu komponentach** — przez wspólną definicję z `R2`, nie przez własny
   literał.
2. **Etykieta, która nie twierdzi więcej, niż wie.** Kafel „Completion" zostaje na miejscu;
   jeżeli poprawna liczba wymaga innego podpisu (np. rozdzielenia „obszarów z odpowiedzią" od
   „obszarów z celem") — zmieniasz podpis. **Usunięcie kafla nie jest naprawą** (`Z40`).
3. **★ Zero zmian osiągalności.** Nie dopisujesz wołacza, nie rejestrujesz trasy, nie zdejmujesz
   flagi. To byłoby odsłonięcie ekranu bez akceptu właściciela (`Z11`), a właściciel **nigdy nie
   jest pierwszym testerem wizualnym**. Dowód: `node scripts/dev/reachability-from-root.mjs
   --check-baseline` dalej `exit 0`, a klasyfikacja obu plików dalej `unreachable`.
4. **Jedno zdanie w raporcie**: co dokładnie zobaczy klient **w dniu, w którym ktoś te komponenty
   podłączy** — przed Twoją zmianą i po niej.

Prawo zatrzymania po tej pozycji.

## R5 — RAPORT I JEDNA SEKCJA REJESTRU

Struktura `§R.2`. Obowiązkowo:

- **tabela inwentarza z `R1`** w całości, z werdyktami `KOMPLETNOŚĆ`/`INNE` i uzasadnieniem
  każdego `INNE`;
- **wartości z KAŻDEGO naprawionego miejsca osobno**, przed i po, na danych 7/39 i 39/39;
- **wszystkie dowody mutacyjne z `R2` i `R3` dosłownie**, z komendami i wynikami, oraz pustymi
  `git diff` po cofnięciach;
- **wyniki obu przebiegów migracji** i `df -h /` przed i po;
- **tabela rozbieżności wobec liczb tej instrukcji** — każda liczba, którą Twój pomiar obalił;
- obowiązkowy akapit `§0.2e` dla **każdego** uruchomionego pakietu: która z pułapek (a)–(e) go
  dotyczy, jak ją wyłączyłeś i co dowodzi, że wyłączyłeś;
- deklaracja `Z30`;
- sekcja **TWIERDZENIA NIEZWERYFIKOWANE** **niepusta**. Wymień w niej co najmniej: zachowanie
  ekranu Oceny po włączeniu flagi `isDrdReportEnabled` (flagi nie włączasz), zachowanie
  `DRDReportTemplate.tsx` po jego podłączeniu (nie podłączasz), oraz to, czy kolumna
  `completion_percent` w bazie demo jest zerowa dla realnych ocen (bazy demo nie dotykasz).

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R5`.**

## Próg odbioru

**Istnieje jedna definicja kompletności per drzewo; każde miejsce, które `R1` uznał za liczące
kompletność, ją woła; KAŻDE takie miejsce ma WŁASNY dowód mutacyjny w kolorze RED; a żywa trasa
`/api/assessments` udowodniona jest na realnym PostgreSQL parą asercji 7/39 i 39/39.**

Odbiorca odrzuci dyżur, w którym: mutacja jest jedna „reprezentatywna" zamiast jednej na miejsce;
kafel „Completion" został usunięty zamiast poprawiony; testy dyżuru 346 zostały osłabione albo
przepisane; nieosiągalny komponent został podłączony; dowód zapisu stoi na atrapie bazy; albo
przepisano moje liczby zamiast zmierzyć własne.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 rozpoczęte, R4-R5 nietknięte"
jest pełnowartościowym wynikiem — o ile R1 stoi na własnym inwentarzu, a R2 na mutacji **per
miejsce**.

**Odwrotna kolejność — inwentarz i raport zrobione, a licznik dalej w siedmiu kopiach — jest
podstawą odrzucenia.** Opisanie defektu nie jest jego naprawą.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| „Jedna definicja" **vs** „serwer i front to osobne drzewa, które nie mogą się importować" | `R2` punkt 1 i 2 — **jedno źródło na drzewo plus kontrakt parytetu w teście**; ta sprzeczność jest pozorna i tu jest rozstrzygnięta wprost |
| „Napraw wszystkie miejsca formuły" **vs** „zmiana miejsca, które liczy co innego, jest regresją" | `R1` punkt (b) — najpierw **klasyfikacja z werdyktem**, dopiero potem naprawa; werdykt `INNE` jest wynikiem, nie uchyleniem się |
| Zakaz `Z40` „nie cofasz naprawy 346" **vs** `R2` dotyka obu plików modelu raportu | `B.1` wiersz „modele raportu" i `R2` punkt 5 — wolno **wyłącznie** zastąpić literał wywołaniem o **identycznym** zachowaniu, przy zielonych i nietkniętych testach 346 |
| Zakaz `Z11` „nie odsłaniasz ekranu bez akceptu" **vs** `R4` naprawia dwa komponenty ekranowe | `R4` punkt 3 — naprawiasz **liczbę**, nie osiągalność; dowodem jest `reachability --check-baseline` `exit 0` i niezmieniona klasyfikacja `unreachable` |
| Zakaz `Z40` „nie ukrywasz metryki" **vs** „etykieta ma nie twierdzić więcej, niż wie" | `R4` punkt 2 — zmieniasz **podpis**, kafel zostaje; usunięcie kafla jest odrzuceniem pozycji |
| Zakaz `Z17` „nic poza zakresem" **vs** trasa `/api/assessments` jest plikiem z siedmioma trasami | `B.1` wiersz „trasa listy ocen" — licencja obejmuje **wyłącznie ciało `computeProgressFields`**; montaż, liczba tras i `@ts-nocheck` pozostają nietknięte |
| „Dowód na realnym PG" **vs** `Z9` „żadnej bazy poza własnym kontenerem" | `R3` punkt 3 — sesję zakładasz na `cx351` na porcie `6410`, po pomiarze `docker rm -fv`; demo, staging i produkcja są poza zasięgiem |
| „Test ma być zielony" **vs** zakaz osłabiania asercji (`Z40`) | `R3` punkt 6 i `Próg odbioru` — zielony **z właściwego powodu**; `@ts-nocheck` sprawia, że „tsc przeszło" nie jest dowodem niczego |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R1`/`R2`/`R3` piszą pliki dowodowe | `Z13` (pole „jedyny inny dokument") — `evidence/licznik-kompletnosci-20260904/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R5` |
| „Dowody commituj do repo" **vs** `Z13` „zrzuty i pliki wynikowe NIE wchodzą do repo" | `B.1` wiersz „dowody" — **ta instrukcja daje jawną licencję na `evidence/licznik-kompletnosci-20260904/` z `git add -f`**; 04.09 trzykrotnie trzeba było ratować dowody z katalogów tymczasowych, więc tu licencja jest silniejsza od reguły ogólnej |
| „Cofaj mutacje" **vs** `Z27` (zakaz `git stash`) | `R2` i `R3` — kopia przez `cp` do `SCRATCH`; `git diff` po cofnięciu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `c0f690bae3`; zero `BRAK`. Trzy pliki oznaczone `NOWY`: dwie definicje i katalog dowodów |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziesięć wierszy; **cztery liczby ze zlecenia obalone własnym pomiarem** i wypisane w „Sprostowaniu" |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (diff · brief · kontrakt · errata · opis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; naprawa siedzi w ciałach funkcji, `Gateway.ts` pozostaje nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (352, 353, 354 oraz starsze 343-350) | TAK — `B.4.4`; porty 6410/5550 zmierzone jako wolne, kontener i gałąź nie istnieją. ★ Instrukcje 355-358 pisze równolegle inny autor — dlatego `Z7` zaostrzony: port zajęty = STOP całości, nigdy podmiana numeru |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi (pięć) | TAK — `§0.2d` osiemnaście punktów + `§0.2e` punkt (e) z pięcioma pułapkami tego dyżuru |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK; każdy cytat pracy dyżuru 346 ma SHA commita albo ścieżkę pliku |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
