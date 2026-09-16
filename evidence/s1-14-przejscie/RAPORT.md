# S1.14 — ręczne przejście Pomysły / Notatnik / Dokumenty

Data: 2026-09-15 CDT  
Użytkownik: Irina Lebedjuk  
Organizacja: Northwind  
Runtime pomiaru: `https://staging.consultify.ai`, linia przed M2 (`dcbd6c052a`)  
Gałąź naprawy: `codex/c-m2-manual-tools-20260915`

## Werdykt

**READY FOR CTO REVIEW v3, z jawnymi pozycjami NOT_TESTED/NOT_PROVEN.** Pełny spis kontrolek i wynik każdej pozycji znajduje się w `MANUAL_CLICK_MATRIX_V3.md`; bezpieczne kontrolki wywołano, a zapisujące/destrukcyjne pozycje zatrzymano zgodnie z późniejszym Wpisem 78. Paczka domyka brakujący przewód Dokument → Zadanie → Źródło: owner scoped API zwraca trwałe `sourceType/sourceId`, karta pokazuje `Document/Dokument`, a link źródła przekazuje dokładny UUID dokumentu. Testy celowane 14/14 i RealPG 1/1 przechodzą. Trzy zadania zapisane wcześniej przez lokalny frontend do API stagingu są jawnie przypisane do Northwind / Irina Lebedjuk wraz z UUID poniżej. Niezależny review przejął CTO; własny review nie jest deklarowany.

## Pomysły

| Przycisk / pozycja | Wynik na stagingu | Dowód / uwaga |
|---|---|---|
| Table / Grid | widoczny, przełącza układ | ekran Pomysły |
| New Idea | widoczny | nie tworzono dodatkowego rekordu |
| All / Spark / Growing / Shaping / Ready / Promoted | filtry widoczne | stan listy zmienia się zgodnie z etapem |
| Folder filter | widoczny | filtr listy |
| Sort / Filter / View settings | widoczne w StandardTable | kanoniczna tabela |
| Star | widoczny per wiersz | akcja wiersza |
| Stage | widoczny per wiersz | akcja wiersza |
| Open | działa | otwiera warsztat Mind Map z pełnym panelem i narzędziami |
| Process Flow | **błąd zachowania** | dla istniejącej karty otworzył URL i aktywny widok `mindmap`, nie Process Flow |
| AI Chat | działa | otwiera prawy panel Teresa z kontekstem i treścią pomysłu |
| AI Insights | działa | otwiera ten sam panel z kontekstem analizy; brak automatycznej wysyłki bez decyzji użytkownika |
| Initiative | **częściowo** | backend odpowiada, UI pokazuje tylko `Done`; brak nawigacji/readbacku obiektu |
| Tasks | **działa, 3/3** | utworzone: `Supplier quality early-warning signal between quarterly reviews`, `One changeover clock instead of three stopwatches`, `Retire the paper goods-in checklist at Wakefield` |
| Decision / Presentation / Report | **częściowo** | backend odpowiada, UI pokazuje tylko `Done`; brak nawigacji/readbacku utworzonego obiektu |
| Team Chat | działa | tworzy rozmowę i przechodzi do `/chat/<conversationId>` z wiadomością źródłową |
| Folder | disabled bez folderu | UI uczciwie pokazuje niedostępność |
| Open preview | działa | otwiera kanoniczny panel boczny z właściwościami i akcjami |
| Edit | działa | prowadzi do edytowalnego warsztatu idei |
| Delete | działa do bramki | otwiera potwierdzenie; nie zatwierdzano usunięcia |

Dowody: `screens/ideas-after-three-task-actions.png`, `screens/tasks-ideas-and-notebook-readback.png`, `screens/tasks-ideas-literal-readback.png`, `READBACK_9_TASKS.md`.

## Notatnik

### Lista notatników

| Przycisk / pozycja | Wynik |
|---|---|
| New notebook | widoczny |
| All / Personal / Organization | działające filtry zakresu |
| Notebook / Type / Notes / Updated | sortowanie widoczne |
| Context filter / View settings | widoczne |
| Open / Open preview / Edit / Delete | kebab wiersza zinwentaryzowany; usunięcia nie zatwierdzano |

### Wnętrze notatnika

| Przycisk / pozycja | Wynik na stagingu | Dowód / uwaga |
|---|---|---|
| New note / Notebooks / All / Inbox / Active / Search | widoczne i responsywne | utworzono stronę Blank page |
| Quick capture | widoczny | wymaga treści |
| All / Pinned / Recent / To review / Fresh / Orphaned | filtry widoczne |
| Blank page / Strategic observation / Risk analysis / Meeting notes | szablony widoczne | użyto Blank page |
| Add cover / icon / title / editor / Attachments | kontrolki edytora widoczne | tytuł zapisuje się i zasila zadanie |
| Block actions / Insert block below | widoczne | menu edytora |
| Slash: basic blocks (H1/H2/H3, listy, quote, callout, warning, toggle, divider, code) | menu otwiera się | zinwentaryzowane |
| Slash: Image / Date / 2 Columns / Table | menu otwiera się | zinwentaryzowane |
| Slash: AI Ask / Expand / Challenge / Next Steps | menu otwiera się | zinwentaryzowane |
| Slash: Create Task | **działa, 3/3** | `Prepare Monday operations review`, `Confirm Wakefield improvement owners`, `Publish steering group follow-up`; readback w backlinks i My Work Tasks |
| Slash: Create Decision / Save as Idea | aktywne | zinwentaryzowane |
| Note menu: Export / Version history / Sources & attachments / Verification & review / Share / Expand into document / Connection graph | aktywne | menu otwiera się, akcje zinwentaryzowane |
| Note menu: Initiative / Task / Decision | **disabled** | komunikat `Unavailable until the server can return a durable action receipt`; nie użyto tej ścieżki do dowodu Tasks |
| Note menu: Idea / Assessment / Report / Presentation / Ask AI / Delete | widoczne | Delete bez zatwierdzenia |

Dowody: `screens/notebook-three-task-readbacks.png`, `screens/tasks-ideas-and-notebook-readback.png`, `screens/tasks-nine-literal-readback.png`, `READBACK_9_TASKS.md`.

## Dokumenty

| Przycisk / pozycja | Wynik na stagingu | Dowód / uwaga |
|---|---|---|
| Project documents / My documents | działa | Project bez projektu pokazuje uczciwy empty state; My documents pokazuje 3 dokumenty |
| Upload | działa | dodano niesensytywny plik testowy `northwind-s1-14-source-note.txt`, status Ready, 1 chunk |
| Refresh document status | działa | zmienia czas ostatniego odświeżenia |
| Download | widoczny dla każdego dokumentu | zinwentaryzowany |
| Delete | widoczny dla każdego dokumentu | nie zatwierdzano usunięcia |
| Create task | **BRAK na stagingu; działa 3/3 na lokalnym kandydacie** | trzy przyciski pokazały `Task created`; readback My Work 23→26 |

Dokumenty widoczne w pomiarze: Northwind Programme Charter (Ready, 3 chunks), Line 3 Changeover WI (Ready, 2 chunks), `northwind-s1-14-source-note.txt` (Ready, 1 chunk). Utworzone zadania: `Review document: Northwind 2027 Operational Maturity - Programme Charter.docx`, `Review document: Standard Work Instruction WI-OPS-118 - Line 3 Changeover.docx`, `Review document: northwind-s1-14-source-note.txt`. Dowody: `screens/documents-three-ready-no-task-action.png`, `screens/local-candidate-documents-three-task-created.png`, `screens/local-candidate-document-tasks-readback.png`, `screens/tasks-nine-literal-readback.png`, `READBACK_9_TASKS.md`.

## Naprawa Dokumenty → zadanie

Zmiana v2/v3 obejmuje produkt, kontrakt API, i18n i testy:

- `DocumentSidePanel.tsx`: akcja `Create task`, pojedynczy lot, idempotency key, pochodzenie dokumentu, stan `Task created`, widoczny powód błędu.
- `public/locales/en/translation.json` i `public/locales/pl/translation.json`: EN first i polski odpowiednik.
- `DocumentSidePanel.uploadBlad.test.tsx`: dowód payloadu z `sourceType=document`, `sourceId`, idempotency key oraz widocznego potwierdzenia.
- `my-work.routes.ts`: owner scoped detail zwraca `sourceType/sourceId`.
- `TaskDetailView.tsx` + en/pl: czytelna etykieta Document/Dokument i istniejący link do dokładnego `sourceId`.
- testy route/UI/RealPG: trwały odczyt źródła oraz zachowanie linku.

Walidacja v3: targeted Vitest 14/14 PASS (DocumentSidePanel 6, owner scoped route 4, TaskDetailView 4), RealPG z `MOCK_DB=false` i acceptance config 1/1 PASS, JSON en/pl parse PASS, `git diff --check` PASS. TypeScript 5.8.3 jest wspólny przez symlink do `~/Developer/Consultify/node_modules`; czysta baza `dcbd6c052a` nie ukończyła front ani server TSC w twardym limicie 120 s (`TIMEOUT_120`, bez wiarygodnej liczby). Kandydat nie jest przedstawiany jako zielony TSC; wcześniejsze 194/27 pochodziło z innego przebiegu środowiskowego i nie służy jako porównanie delty.

## Przekazanie do M6

1. Naprawić `Process Flow` dla już otwartej karty: żądane `initialTool=process_flow` przegrywa dziś ze stanem istniejącego dokumentu i route wraca do `/workspace/mindmap`.
2. Zastąpić ogólne `Done` dla Initiative/Decision/Presentation/Report wynikiem, który pokazuje typ i identyfikator utworzonego obiektu oraz pozwala go otworzyć.
3. Po naprawie powtórzyć ten sam manualny przebieg na zintegrowanej linii i sprawdzić oba języki.
