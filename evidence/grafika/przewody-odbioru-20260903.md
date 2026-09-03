# Przewody odbioru — naprawa 5 ekranów (2026-09-03)

Zlecenie: audyt `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`
(sekcje ROZJAZD/REPLIKA) wykazał, że pięć ZATWIERDZONYCH przez właściciela ekranów
montowało w harnessie dev-render coś innego, niż dostaje realny użytkownik.
Zadanie: przepiąć harness na realny komponent, zmierzyć różnicę, wyrównać PRODUKT
do zatwierdzonego wyglądu, udowodnić zrzutem.

Gałąź: `agent/przewody-harness-20260903` (worktree `/private/tmp/ag-przewody`, baza `/private/tmp/m03` @ `e9cf286c73`).
Zrzuty PO: `/private/tmp/ag-przewody-artefakty/final2/przewody-odbioru-20260903/`
(10 plików: 5 ekranów × light/dark, 1440 px, pl; a11y = **0 naruszeń** na wszystkich 10).
Narzędzie: `scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5337`.

---

## 1. `assessment-list` — REPLIKA → realny Hub

**Było**: `dev-render/screens/assessment-list.tsx` sam sklejał `StandardModuleBar` +
`StandardTable` z lokalną tablicą `MOCK_ROWS` i lokalnymi handlerami. Plik NIE importował
`AssessmentHub` w ogóle.

**Realny komponent**: `src/components/assessment/AssessmentHub.tsx`, montowany przez
`src/routes/AppRoutes.tsx:2301` — `<Route index element={<AssessmentHub />} />` pod
`/assessment`; zakładka `processes` (`FIVE_SURFACES_TAB_IDS`, AssessmentHub.tsx:368).

**Różnice PRZED (realny ekran vs zatwierdzony zrzut)**
1. Menu 2 CTA po angielsku: **„New Assessment"** (zatwierdzony zrzut miał „Nowa ocena").
2. Pigułka statusu w podglądzie: surowy enum **„APPROVED"**, gdy tabela obok pokazywała
   „Zatwierdzone" — dwa napisy na jeden stan, jeden ekran.
3. Menu 2 ma pięć pigułek powierzchni (Biblioteka/Procesy/Wnioski/Raporty/Inicjatywy),
   replika miała wymyślone „Wszystkie/Moje/Szablony" — realny układ jest bogatszy, nie gorszy.
4. Menu 3 (chipy statusu z licznikami), kebab wiersza, checkboxy, `StandardPreview` z
   sekcjami AI/Powiązania/Co dalej — wszystko realne, replika miała tylko część.

**Naprawy w produkcie**
- `AssessmentHub.getNewItemLabel()` → `t('assessment.hub.newAssessment' | 'newReport' | 'newInitiative')`
  (+ nowe klucze pl/en).
- `GridView newItemLabel="New Assessment"` → ten sam klucz.
- Trzy bloki `meta.pills` podglądu (processes / reports / initiatives): `String(selectedRow.status)`
  → `statusChipLabel(status, t)` — to samo źródło etykiety, z którego korzysta
  `EntityStatusChip` w tabeli.

**PO**: `assessment-list__PO__pl__1440__{light,dark}.png` — „Nowa ocena", pigułka
„Zatwierdzone", a11y 0.

---

## 2. `drd-library-entry` — REPLIKA → realny Hub, zakładka „Biblioteka"

**Było**: harness sam składał `StandardModuleBar` + `StandardTable` + `StandardPreview`
z JEDNYM wymyślonym wierszem DRD. Uwaga właściciela z 2026-09-02 („nie ma żadnego podglądu;
kolumny nie są wystarczające… Do powtórki") dotyczyła więc przyrządu, nie produktu.

**Realny komponent**: `AssessmentHub initialTab="library"` → `AssessmentLibraryTab`
(`src/components/assessment/library/AssessmentLibraryTab.tsx:2075` w `renderContent`,
`if (activeTab === 'library') return <AssessmentLibraryTab />`). Katalog pięciu metodyk
(DRD włączone, SIRI/ADMA/CMMI/LEAN jako jawnie wyłączone wiersze z powodem — TRIADA C3),
własny `StandardTable` + `StandardPreview` z tabelą właściwości.

**Różnice PRZED**
1. Realny ekran MA podgląd i sześć kolumn — obie uwagi właściciela są odpowiedzią samego produktu.
2. Menu 3: cały rząd chipów statusu ocen (Szkic/W przeglądzie/Zatwierdzony/…) renderował się
   z licznikiem **0** przy każdej pozycji — `statusCounts` w AssessmentHub nie ma gałęzi dla
   zakładki `library`. Licznik, który zawsze pokazuje zero, kłamie o zawartości ekranu.
3. Po przełączeniu na chipy informacyjne zostało „Biblioteka **0**" — `currentData` też nie ma
   gałęzi `library` (katalog żyje w `AssessmentLibraryTab`).
4. Przycisk akcji w podglądzie: **„Uruchom assessment"** — pół zdania po polsku, pół po angielsku.

**Naprawy w produkcie**
- `AssessmentHub`: `hubMenu3Chips` — na zakładce `library` chipy statusu ustępują chipom
  informacyjnym (wzorzec, który ten rząd kopiuje — `DiscoveryToolsHub` — włącza je tylko
  na zakładkach NIE-Library; warunek był pominięty przy przenoszeniu).
- `AssessmentHub`: badge chipa „nazwa zakładki" → `null` na `library` (brak liczby jest
  uczciwy, zero nie jest).
- `AssessmentLibraryTab.tsx:536`: „Uruchom assessment" → **„Uruchom ocenę"**.

**PO**: `drd-library-entry__PO__pl__1440__{light,dark}.png` — a11y 0.

---

## 3. `assessment-reports-table` — ROZJAZD (martwy komponent) → realny Hub, zakładka „Raporty"

**Było**: harness montował `src/components/assessment/ReportsTable.tsx`.
Dowód martwoty (2026-09-03, worktree `ag-przewody`):

```
$ git grep -n -w ReportsTable -- src/ | grep -v 'src/components/assessment/ReportsTable.tsx'
src/components/Reports/ImportReportModal.tsx:11:            (komentarz)
src/components/assessment/manage/InitiativesManagementPanel.tsx:300:  (komentarz)
src/components/assessment/manage/ReportsManagementPanel.tsx:102: (komentarz)
src/components/assessment/manage/TeamManagementPanel.tsx:671:    (komentarz)
src/components/assessment/manage/WorkflowStagesTable.tsx:11:      (komentarz)
src/components/shared/ModuleHub/FilterableTable.tsx:273,1676         (komentarze)
```
Zero importów, zero JSX. Żaden użytkownik tej tabeli nie widział.

**Realny komponent**: `AssessmentHub initialTab="reports"` — `renderContent` case `'reports'`
(AssessmentHub.tsx:2247), dane z `Api.getAssessmentReports()` + `Api.listReportImports()`
(AssessmentHub.tsx:651-653).

**Różnice PRZED**
1. **Kolumna „Status" PUSTA we wszystkich wierszach.** Przyczyna zmierzona w kodzie:
   kolumna deklaruje `render`, który dla wiersza NIE-importowanego robił `return undefined`
   (AssessmentHub.tsx, case `'reports'`), a `FilterableTable.tsx:1696` używa fallbacku
   `column.id === 'status' → <EntityStatusChip>` **wyłącznie** gdy kolumna nie ma `render`.
   Efekt: każdy raport z Report Buildera (czyli wszystkie poza importami PDF) miał pustą
   komórkę statusu. Zatwierdzony zrzut (martwy `ReportsTable`) miał tam pigułki.
2. Menu 2 po angielsku: **„Upload PDF"**, **„New Report"**.
3. Pigułka statusu w podglądzie: **„APPROVED"** zamiast „Zatwierdzone".
4. Komunikat błędu podglądu po angielsku: **„Report not found or could not be loaded."**
   (jedyny angielski napis w polskim panelu; widoczny zawsze, gdy `/assessment-reports/:id/full`
   nie odpowie).

**Naprawy w produkcie**
- Kolumna Status (reports): `return undefined` → `return <EntityStatusChip status={row.status} />`.
- „Upload PDF" + `title` → `t('assessment.hub.uploadPdf' / 'uploadPdfTooltip')`.
- „New Report" → `t('assessment.hub.newReport')`.
- Pigułka podglądu → `statusChipLabel` (wspólna naprawa z §1).
- `ReportSlideOverContent`: komunikat → `t('assessment.hub.reportPreview.notFound')`.

**PO**: `assessment-reports-table__PO__pl__1440__{light,dark}.png` — kolumna Status pełna
(Zatwierdzone / Wykorzystane / Finalne / Szkic / Czeka na zgodę), „Wgraj PDF", „Nowy raport",
a11y 0.

---

## 4. `assessment-initiatives-table` — ROZJAZD (martwy komponent) → realny Hub, zakładka „Inicjatywy"

**Było**: harness montował `src/components/assessment/InitiativesTable.tsx`.
Dowód martwoty:

```
$ git grep -n -w InitiativesTable -- src/ | grep -v 'src/components/assessment/InitiativesTable.tsx'
src/components/assessment/manage/TeamManagementPanel.tsx:671:  (komentarz)
src/components/assessment/manage/WorkflowStagesTable.tsx:11:    (komentarz)
src/components/shared/ModuleHub/FilterableTable.tsx:273,1676      (komentarze)
```
`docs/program/grafika/status.json` przyznawał to wprost w polu `gdzie`
(„To NIE jest ekran dostępny w aplikacji… to dowód/stanowisko testowe") — a ekran mimo to
poszedł do odbioru i dostał ocenę A.

**Realny komponent**: `AssessmentHub initialTab="initiatives"` — `renderContent` case
`'initiatives'`, dane z `Api.get('/initiatives?source=assessment')` (AssessmentHub.tsx:652)
filtrowane przez `isAssessmentModuleInitiative` (AssessmentHub.tsx:335 — wiersz bez
`sourceType`/`sourceId` jest odrzucany). Kolumny: wspólny `createInitiativeRegisterColumns()`
(`src/components/Initiatives/initiativeRegisterColumns.shared.ts:73`), ten sam kontrakt co
w module Inicjatyw i w panelu Manage (test `day274-jedna-kolumnistyka`).

**Różnice PRZED**
1. Kolumna „Cykl życia" po angielsku: **DRAFT / PLANNING / REVIEW / EXECUTING / APPROVED**,
   obok polskich chipów Menu 3 („Szkic", „Oczekuje na przegląd").
   Przyczyna: `INITIATIVE_LIFECYCLE_LABELS` zna WYŁĄCZNIE kanoniczny cykl 14-stanowy
   (REGISTERED_DRAFT/DEFINING/…), a AssessmentHub karmi te kolumny LEGACY słownikiem
   z `mapInitiativeApiStatus` (AssessmentHub.tsx:313). Dwa słowniki, jeden zestaw kolumn.
2. Kolumny „Następne działanie" i „Oczekiwany efekt": angielskie **„UNKNOWN"** w pięciu
   wierszach, obok polskiego „Pewność: Nieznana".
3. Menu 2 CTA: **„New Initiative"**.
4. Pigułka priorytetu w podglądzie: surowy **„critical"** (słownik
   `assessment.hub.table.priorityLevel.*` istniał w pl i en — nikt go tu nie wołał).

**Naprawy w produkcie**
- `initiativeRegisterProjection.ts`: **dopisek addytywny** do `INITIATIVE_LIFECYCLE_LABELS`
  o 10 statusów legacy (DRAFT/PENDING_REVIEW/REVIEW/PROMOTED/PLANNING/APPROVED/EXECUTING/
  BLOCKED/DONE/TRACKING). Żaden istniejący klucz się nie zmienia; brzmienie 1:1 z
  `initiativeStatus.*` w `public/locales/pl/translation.json`, więc jeden status = jeden napis
  w całej aplikacji.
- `initiativeRegisterColumns.shared.ts`: fallback `'UNKNOWN'` → `'—'` w `nextAction`
  i `expectedImpact` (kanon tabel: pusta komórka to „—", nie angielskie słowo).
- `AssessmentHub`: CTA → `t('assessment.hub.newInitiative')`; pigułka priorytetu →
  `t('assessment.hub.table.priorityLevel.<lower>')`.

**PO**: `assessment-initiatives-table__PO__pl__1440__{light,dark}.png` — „Nowa inicjatywa",
statusy Szkic/Planowanie/W przeglądzie/W realizacji/Zaakceptowana, „—" zamiast UNKNOWN,
pigułki „Szkic" + „Pilny", a11y 0.

---

## 5. `audyty-drd-report` — ROZJAZD (hub niezamontowany) → realny `AuditsMethodHub`

**Było**: wariant domyślny (`list`) montował `src/components/Audit/AuditsHub.tsx`.
Kod samego modułu mówi wprost (`src/components/Audit/method/AuditsMethodHub.tsx:10`):

> „Dawny równoległy `AuditsHub` nad `/api/audit` nie jest już mounted; jego write endpoints
> pozostają wycofane po stronie serwera."

`git grep -n -w AuditsHub -- src/` poza definicją zwraca WYŁĄCZNIE testy
(`src/components/Audit/__tests__/AuditsHub.test.tsx`, `AuditsHub.drdReportTab.test.tsx`).
Zero wołaczy w `AppRoutes`.

**Realny komponent**: `src/components/Audit/method/AuditsMethodHub.tsx`, montowany pod
`/audit-programs` (`src/routes/AppRoutes.tsx:1678-1686`); zakładka `reports`
(`AuditsMethodHub.tsx:530` → `AuditReportsTab`).
Wariant `report` montuje `DRDAuditReportView` — ten sam komponent, który montuje realna trasa
`/audit-programs/drd-report/:reportId` (`DRDAuditReportRoute`, AppRoutes.tsx:801-806) po
przejściu bramki `isDrdReportEnabled()` (domyślnie OFF → przekierowanie na `/audit-programs`).
Harness ustawia `localStorage['ff.drdReport']='1'`, czyli DOKŁADNIE ten przełącznik, którego
używa bramka — nie omija jej, tylko ją włącza.

**Różnice PRZED**
1. Ekran pokazywał zestawienie z martwego huba nad wycofanym `/api/audit`.
   Realny `AuditReportsTab` czyta `/api/audits/**` (`auditsMethodApi.ts`) i ma inne kolumny:
   Tytuł · Rodzaj · Wersja · Status · Język · Odbiorca · Poufność · Publikacja.
2. Uwaga właściciela („to nie wygląda jak pełna tabela… muszą być raporty na pełną szerokość")
   — realny ekran jest pełnoszerokościowy z podglądem po prawej.
3. Naruszenie kontrastu (axe, motyw jasny, 1 węzeł): podtytuł wiersza w kolumnie „Tytuł"
   (`text-c-text-muted`, #64748b, 11 px) na tle ZAZNACZONEGO wiersza (`bg-state-selected`,
   #ebecec) dawał 4,02:1 przy progu AA 4,5:1. Na tle niezaznaczonym przechodził, więc defekt
   ujawniał się dopiero po kliknięciu wiersza.

**Naprawy w produkcie**
- `AuditReportsTab.tsx:226`: `text-c-text-muted` → `text-c-text-secondary` (ten sam rejestr
  wizualny o stopień ciemniejszy; zdaje w obu stanach wiersza).

**PO**: `audyty-drd-report__PO__pl__1440__{light,dark}.png` — 0 błędów konsoli, a11y 0.

---

## Czego NIE udało się zamknąć (i dlaczego)

1. **Nazwy sesji DRD: „DRD · sess-drd"** (`assessment-list`). `methodSessionToAssessment`
   (AssessmentHub.tsx:264) buduje nazwę jako `DRD · <8 pierwszych znaków id>`, bo kontrakt
   `MethodSession` (`src/method-core/contracts/session.ts:135`) **nie ma pola nazwy**.
   Zatwierdzony zrzut miał ludzkie nazwy („DBR77 · Digital Readiness Diagnosis"), których
   realny użytkownik nie zobaczy. Naprawa wymaga pola po stronie kernela/serwera — poza
   zakresem dyżuru. Zgłoszone do decyzji nadzorcy.
2. **Szerokość kolumn**: nagłówek „ZAKTUALIZOWANO"/„OCZEKIWANY EFEKT" ucinany, chipy statusu
   w Audytach ucinane („Zastąpi…", „Opubli…"), nazwa inicjatywy ucinana przy dużej ilości
   wolnego miejsca po prawej. To znana rodzina defektu wspólnego silnika tabel
   (`FilterableTable`), wpisana w `status.json` jako wyjątek i naprawiana osobno
   (gałąź `FilterableTable.columnWidth` w repo głównym). Nie ruszałem, żeby nie kolidować.
3. **Surowe enumy w tekście „Szczegóły" podglądu** („Status: APPROVED. Priorytet: critical.
   Wpływ: high."). Buduje je `src/components/assessment/assessmentPreviewDetails.ts`, który
   z założenia zapisuje „wyłącznie fakty zapisane w rekordzie" i przyjmuje `lang`, nie `t`.
   Lokalizacja wymaga zmiany kontraktu tego pliku (5 powierzchni) — zgłaszam, nie robię
   przy okazji.
4. **`--rozwin-sekcje=1` na ekranach listowych**: narzędzie zrzutowe traktuje lejki filtrów
   i kebaby wierszy jako „zwinięte sekcje", klika je i w efekcie GUBI otwarty podgląd oraz
   rząd Menu 3 (zmierzone: przebieg `ocena-1` vs `ocena-2` tego samego commitu). Zrzuty
   odbiorowe zrobiłem bez tej flagi, z `--a11y=1`; a11y liczone na tym samym DOM-ie
   (po kliknięciu wiersza, z otwartym podglądem).

## Martwe komponenty — do decyzji nadzorcy (NIE usuwam sam)

| Plik | Dowód | Uwaga |
|---|---|---|
| `src/components/assessment/InitiativesTable.tsx` | `git grep -w InitiativesTable -- src/` → tylko definicja + 4 komentarze | 700+ linii, migrowane na `StandardTable` w §27-todo batch2 — praca włożona w komponent bez wołacza |
| `src/components/assessment/ReportsTable.tsx` | `git grep -w ReportsTable -- src/` → tylko definicja + 7 komentarzy | jw. |
| `src/components/Audit/AuditsHub.tsx` | `git grep -w AuditsHub -- src/` → tylko definicja + 2 pliki testów; `AuditsMethodHub.tsx:10` mówi „nie jest już mounted" | ma własne testy, które przejdą po usunięciu produktu — pułapka „zielone testy martwego kodu" |

Po usunięciu któregokolwiek trzeba usunąć też jego testy, w przeciwnym razie zostaje
zestaw testów pilnujący kodu, którego nikt nie renderuje.
