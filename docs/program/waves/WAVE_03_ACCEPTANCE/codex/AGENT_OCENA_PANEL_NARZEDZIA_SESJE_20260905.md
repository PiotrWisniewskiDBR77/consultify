# Agent — Ocena (panel) i Narzędzia (sesje), 05.09.2026

Gałąź: `agent/ocena-panel-narzedzia-sesje-20260905` (baza `6350362f35`, linia m03).
Wejście: pomiar na żywo `evidence/odbior-zywo-20260905/05-ocena/` i `04-narzedzia/`.
Zrzuty PO: `evidence/ocena-narzedzia-20260905/` (jasny motyw, 1440, własny vite na :3077,
kopia `.env.local` z m03 → API do stagingu). Proces zatrzymany po PID.

## Tabela: defekt → przyczyna → naprawa → test

| # | Defekt (z pomiaru) | Zmierzona przyczyna | Naprawa | Test + dowód mutacyjny | SHA |
|---|---|---|---|---|---|
| 1 | Panel „Zarządzanie" (5 zakładek) jest w DOM, ale renderuje się **poza ekranem** (`top` = wysokość okna: 900 przy 900, 1600 przy 1600), nie da się doscrollować. Dotyczy `assessment-manage-panel`, `-reports-panel`, `-initiatives-panel`. | Pasy rozwijane (panel AI · ład korporacyjny · Info) mieszkały **wewnątrz kompaktowego nagłówka** — dziecka flex-column z `min-height:auto`. Gdy pas ładu urósł ponad wysokość okna, nagłówek nie mógł się skurczyć, siostrzany region edytora (`flex-1`) dostawał zero wysokości i startował dokładnie na dolnej krawędzi okna. Nic w łańcuchu nie przewijało. | Pasy przeniesione do własnego pasa ograniczonego do `max-h-[45vh]` z własnym przewijaniem; nagłówek `shrink-0`; region edytora `flex-1 min-h-0`. | `tests/components/assessment/AssessmentSessionEditorView.managePanelViewport.test.tsx` (2). Mutacje: usunięcie `min-h-0` → 1 czerwony; usunięcie limitu 45vh / powrót pasów do nagłówka → 2 czerwone. | `18840efb25` |
| 2 | Panel jakości (`assessment-quality-review-panel`): brak trzech kafli (Kompletność / Śr. poziom osiągnięty / Pokrycie dowodami); w ich miejscu „Ocena dostępna tylko dla assessmentów DRD." **na rekordzie DRD**. | Zmierzone na danych właściciela (`GET /api/v8/assessment/dbr77-assess-001`): wiersz ma `assessment_type = "MATURITY"` i `framework_type = "DRD"`. Router v8 rozstrzygał framework **wyłącznie po `assessment_type`**, więc oddawał `scoring: null`, a klient nie miał czego narysować. Reszta aplikacji rozstrzyga to jako `COALESCE(framework_type, assessment_type)` (assessment-hub.routes.ts). Kafle były w kodzie od dawna. | **Rodzina**: cztery miejsca routera (lista, `GET/:id`, `PUT/:id`, `GET/:id/evidence`) idą teraz przez jeden `isDrdAssessmentRow` (nowy `server/src/routes/v8/assessmentFramework.ts`); dwa wąskie SELECTy dociągają `framework_type`. Komunikat zastępczy przestał twierdzić, że rekord DRD nie jest DRD. | `server/src/routes/v8/__tests__/assessmentFramework.test.ts` (4) + `tests/components/assessment/AssessmentQualityReviewPanel.tiles.test.tsx` (2). Mutacje: wycięcie gałęzi `framework_type` → 2 czerwone; wycięcie bloku kafli → 1 czerwony. | `c0b9e684dd` |
| 3a | Tabela biblioteki (`assessment-five-surfaces`): siedem kolumn zamiast czterech z obrazu, brak kolumny DZIAŁANIA z „Uruchom". | `AssessmentLibraryTab` deklarował 7 kolumn opisowych, a „Uruchom" istniało tylko w kebabie wiersza. Dodatkowo komponent **zasiewał** do `localStorage` klucz `filterableTable.cols.assessment.hub.library` z `visibility` = wszystko widoczne — `FilterableTable` czyta ten klucz PRZED domyślkami kolumn, więc unieważniał każdą deklarację domyślnej widoczności (zmierzone na żywo: po dodaniu `defaultVisible` tabela DALEJ rysowała osiem kolumn). | Nowy, addytywny `TableColumn.defaultVisible` w `FilterableTable`; kolumna DZIAŁANIA z przyciskiem „Uruchom" (ten sam `handleStart`, ta sama bramka `canStartRow` — planowane metodyki mają go wyszarzonego); statusy nazwane jak na obrazie („Rdzeń metody" / „Planowane"); zasiew usunięty. | `src/components/assessment/library/__tests__/AssessmentLibraryTab.canon.test.tsx` (7, w tym kontrakt kolumn i brak zasiewu). Mutacje: ignorowanie `defaultVisible` → 1 czerwony; usunięcie kolumny DZIAŁANIA → 3 czerwone. | `964b33d05a` + poprawka zasiewu |
| 3b | Lista ocen (`assessment-list`): brak kolumn JEDNOSTKA, WYNIK, PEWNOŚĆ; etykiety inne niż na obrazie. | `overall_score` i `confidence_avg` **istnieją w bazie** (lista to `SELECT *`), ale nie docierały do wiersza w `currentData`, więc nie dało się ich pokazać. | Kolumny WYNIK i PEWNOŚĆ z realnych pól (brak wartości = „—", nie zero); etykiety NAZWA OCENY / WŁAŚCICIEL / AKTUALIZACJA; TYP schodzi do pstryczka. | `tests/components/assessment/AssessmentHub.columnsFromApprovedImage.test.tsx` (3). | `964b33d05a` |
| 3c | `drd-library-entry`: `/assessment/drd` ląduje na Bibliotece, lista nie zawężona do DRD. | Trasy frameworkowe renderowały **gołe** `<AssessmentHub />` (AppRoutes.tsx), więc hub schodził na domyślną zakładkę „Biblioteka" i nie znał metodyki. | `/assessment/{drd,siri,adma,cmmi,lean}` podają `initialTab="processes"` i nowy `frameworkFilter`; lista sesji filtruje się do metodyki. | Trzeci przypadek w `AssessmentHub.columnsFromApprovedImage.test.tsx`. Mutacja: wyłączenie filtra → 1 czerwony. | `964b33d05a` |
| 5 | 29 „zatwierdzonych" sesji narzędzi otwiera **angielski widok awaryjny z surowym JSON-em**. | Zmierzone w `server/src/routes/my-work.routes.ts:782` `createMyWorkToolSession`: konwersja pomysłu/notatki w Mojej Pracy zapisuje wiersz `tool_sessions` z `tool_type='MYWORK'`, `status='APPROVED'`, `completion_percent=100`, `name="MyWork idea: …"`. To **nie są sesje narzędzi**, tylko ślady pochodzenia. `MYWORK` nie jest w `DEDICATED_TOOL_TYPES`, więc hub spadał na `GenericToolDocumentView`. Drugie kłamstwo w tym samym miejscu: `transformToolSession` dla nieznanego typu po cichu ustawiał kod **`SWT`** — stąd „29 sesji typu SWT". Potwierdzone na żywo: `/api/tools?limit=100` → 65 wierszy `MYWORK`. | Nowy `MyWorkTraceDocumentView` — czytelny polski stan z prawdziwych danych (`answers.origin/source/summary`) + link do źródła, bez atrap i bez JSON-a; reguły w `toolSessionKinds.ts`; nieznany typ pokazuje kod z prawdziwego `tool_type` (MYWORK → MYWO); `GenericToolDocumentView` (ostatnia deska ratunku) mówi po polsku. | `tests/components/DiscoveryTools/MyWorkTraceDocumentView.test.tsx` (4) + `toolSessionKinds.test.ts` (4). Mutacje: powrót do 'SWT' → 2 czerwone; MYWORK nierozpoznawany → 3 czerwone; JSON z powrotem w widoku → 1 czerwony. | `004fb9b41b` |
| 6 | `tools-swot-report`: nie dało się dojść do raportu SWOT z realnej sesji. | Renderer **istnieje** (`renderToolReport` → `ToolReportView`; „Renderer 1.0.0" z obrazu to `REPORT_RENDERER_VERSION`), listuje go `ToolOutputsPanel`. Ale `ToolOutputsPanel` był renderowany **wyłącznie w `ToolWorkspace`**, hub otwiera sesję przez `ToolDocumentView`, a `<ToolWorkspace>` występuje już tylko w `OperationalToolsView`, którego **nie ma w `AppRoutes.tsx`**. Czyli z realnej sesji nie było do raportu żadnej trasy — dług integracyjny, nie brak funkcji. | `ToolDocumentView` renderuje ten sam read-only panel pod tą samą bramką (`APPROVED` + id sesji). | `tests/components/DiscoveryTools/ToolDocumentView.swotReportWiring.test.ts` (4). Mutacja: usunięcie bloku panelu → 1 czerwony. | `82a775a90d` |
| 7 | `tools-sesja-wyjscie`: kebab sesji ma tylko „Skopiuj kod obiektu" i „Kopiuj link" — bez pauzy i zakończenia. | `NModeHeader` ma już prop `extraOverflowItems`; `ToolDocumentView` po prostu go nie używał. Wyjść dało się tylko strzałką „<" albo chipem „Lista". | Pozycja „Wyjdź z sesji" (ten sam `onBack`) przez nową fabrykę `toolSessionOverflowItems.ts`. | `tests/components/DiscoveryTools/ToolDocumentView.sessionExit.test.tsx` (5). Mutacje: zmiana id pozycji → czerwony; `NModeHeader` ignoruje `extraOverflowItems` → czerwony; odpięcie fabryki → czerwony. | `dfc47b1b93` |

## Czego ŚWIADOMIE nie zrobiłem (i dlaczego)

1. **Defekt 4 — chipy statusu na Bibliotece: NIE ZMIENIŁEM.** Zlecenie mówi „mają być chipy
   statusu z obrazu". Zatwierdzony obraz
   (`evidence/grafika/218-piec-rodzin/PO__assessment-five-surfaces__light.png`) faktycznie
   pokazuje siedem chipów statusu — **wszystkie z licznikiem 0**. W kodzie stoi komentarz
   z 2026-09-03 opisujący, że ten rząd usunięto właśnie dlatego: `statusCounts` nie ma gałęzi
   dla Biblioteki, więc licznik ZAWSZE pokazywał zero, a metodyki nie mają statusów
   assessmentu (mają `active`/`draft`, nie Szkic/W przeglądzie/Zatwierdzony). Przywrócenie
   chipów z obrazu = przywrócenie znanego kłamstwa licznika; zmapowanie 2 statusów metodyki
   na 7 statusów oceny = atrapa. **Decyzja należy do właściciela**: albo obraz jest
   nieaktualny, albo trzeba dać Bibliotece własny, prawdziwy zestaw chipów.
   Plik: `src/components/assessment/AssessmentHub.tsx` (`libraryFilterChips`, ~1660-1710).

2. **Kolumna JEDNOSTKA (defekt 3b) — nie dodana.** Na obrazie niesie „Logistics BU",
   „Grupa — Zarząd", „Sales BU". Tabela `assessments` nie ma **żadnego** pola jednostki
   organizacyjnej (`GET /api/v8/assessment/:id` zwraca tylko `organization_id` i `project_id`).
   Zbudowanie tej kolumny wymaga najpierw pola w danych.

3. **POSTĘP zostaje widoczny**, choć obrazu nie ma — na jego miejscu jest właśnie JEDNOSTKA,
   a postęp jest liczony serwerowo i pilnowany testem regresji.

4. **„Wstrzymaj sesję" (defekt 7) — nie dodane.** `src/domain/toolStatus.ts` ma dziewięć
   stanów sesji narzędzia i **ani jednego wstrzymanego**. Backend nie ma czego zapisać, więc
   taka pozycja byłaby przyciskiem bez skutku.

5. **„Zakończ/Finalizuj" nie dublowane w kebabie** — stoją w Menu 3 i w prawym panelu AKCJE;
   kanon Menu 1 traktuje powtórzenie akcji z innego menu jako defekt (D-01).

## Znaleziska poboczne (do rejestru, nie naprawiane tutaj)

- **Zastany czerwony test**: `tests/components/assessment/AssessmentHub.processes-completion.test.tsx`
  był CZERWONY 3/3 już na bazie `6350362f35` (atrapa `AssessmentLibraryTab` nie oddawała
  `METHODOLOGY_CATALOG`). Zmierzone na odłączonym worktree bazy, nie zgadnięte. Naprawione —
  regresja postępu znów jest faktycznie pilnowana.
- **`mapApiFramework` też zgaduje**: dla `type = 'MATURITY'` / `'READINESS'` wraca `'DRD'`
  **fallbackiem**, nie rozstrzygnięciem. Wychodzi poprawnie tylko dlatego, że te dwa rekordy
  właściciela faktycznie mają `framework_type = 'DRD'`. Ta sama rodzina co defekt 2, ale po
  stronie klienta — lista nie wystawia `framework_type`.
- **Rozjazd z pomiarem rundy 2 (04-narzedzia)**: tamten wpis podaje „ToolWorkspace.tsx:829
  renderuje `<ToolOutputsPanel>`" jako żywy łańcuch. Zmierzone: `<ToolWorkspace>` występuje
  w JSX **tylko** w `OperationalToolsView`, którego nie ma w `AppRoutes.tsx`
  (`DiscoveryToolsHub` importuje `ToolWorkspace`, ale nigdy go nie renderuje — martwy import).
  Ten łańcuch był nieosiągalny; stąd naprawa w `ToolDocumentView`.
- **Dysk**: w trakcie pracy `/` spadł do 341 MB wolnego (37 GB w `/private/tmp/fz118-hardprobe.wwMEDi`,
  15 GB w `/private/tmp/claude-501`); jedna komenda padła na „no space left on device", a plik
  `/private/tmp/odbior-auth/auth.json` zniknął i wrócił dopiero po cudzym ponownym logowaniu.

## Zrzuty PO (evidence/ocena-narzedzia-20260905/)

| Plik | Co pokazuje |
|---|---|
| `ocena-panel-zarzadzanie-PO.png` | Panel „Zarządzanie" z pięcioma zakładkami **w widocznym obszarze** (defekt 1) |
| `ocena-panel-raporty-PO.png`, `ocena-panel-inicjatywy-PO.png` | Ten sam panel, pozostałe dwa ekrany z pomiaru |
| `ocena-biblioteka-kolumny-PO.png` | Biblioteka: METODYKA \| OBSZAR \| STATUS \| DZIAŁANIA z „Uruchom", statusy „Rdzeń metody"/„Planowane" (defekt 3a) |
| `ocena-lista-kolumny-PO.png` | Lista ocen: NAZWA OCENY \| STATUS \| WYNIK \| PEWNOŚĆ \| WŁAŚCICIEL \| POSTĘP \| AKTUALIZACJA (defekt 3b) |
| `ocena-drd-wejscie-PO.png` | `/assessment/drd` ląduje na Procesach, lista bez sesji SIRI (defekt 3c) |
| `ocena-panel-jakosci-PO.png` | Panel jakości: uczciwy komunikat zamiast „tylko dla assessmentów DRD" (defekt 2, część kliencka) |
| `narzedzia-mywork-slad-PO.png` | Sesja `76fd1361-…` — ta sama, która dawała angielski JSON — otwiera polski „Ślad pochodzenia · Pomysł" ze streszczeniem i linkiem do źródła (defekt 5) |
| `narzedzia-lista-typ-MYWO-PO.png` | Kolumna TYP: wiersze MyWork jako `MYWO`, nie `SWT` (defekt 5, druga połowa) |

### Czego zrzuty NIE pokazują — uczciwie

- **Trzy kafle panelu jakości (defekt 2)**: lokalny frontend proxuje `/api` do **stagingu**,
  który wciąż ma STARY backend. Poprawka jest po stronie serwera, więc na zrzucie widać
  wyłącznie zmianę kliencką (komunikat). Kafle wymagają wdrożenia `assessmentFramework.ts`.
- **Kebab „Wyjdź z sesji" (defekt 7)**: nie udało się otworzyć karty sesji z tego harnessu —
  parametr `docId` gubi się przy wejściu z URL, a dwuklik w wiersz nie zadziałał (dołożyłem
  do własnej kopii `zrzut.mjs` opcję `--dwuklik`, ale karta i tak nie weszła). Naprawa jest
  pokryta trzema mutacjami, zrzutu PO brak.
- **Raport SWOT (defekt 6)**: w bazie właściciela **nie ma ani jednego zatwierdzonego Outputu**
  (`/api/tool-outputs` → puste, wszystkie 20 sesji SWOT w DRAFT), więc panel jest pusty
  z definicji. Przewód jest, wejścia danych brak — to osobna sprawa (runda 2 pomiaru wskazuje
  502 na zapisie szkicu AI jako blokadę).

## Higiena

- Commit per defekt, autor Piotr. Zero `git push`, zero `git stash`, zero `pkill`.
- Testy uruchamiane wyłącznie na wskazanych plikach; kompilacja per plik przez `esbuild`.
- Nowe pliki w `tests/` dodane przez `git add -f`.
- Własny vite (:3077) zatrzymany po PID; `.env.local` usunięty z worktree po zrzutach.
- Nie dotykałem plików macierzy DRD (`DRDMatrixGrid`, `DRDMatrixReadOnly`, `drdReportModel`,
  `DRDAssessmentEditor`, `AssessmentReportContractView`).
- Do bazy stagingu wyłącznie GET (token czytany programowo z `ODBIOR_AUTH_STATE`,
  nigdy nie wypisany).
