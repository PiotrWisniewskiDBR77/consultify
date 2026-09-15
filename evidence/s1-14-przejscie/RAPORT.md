# S1.14 — ręczne przejście Pomysły / Notatnik / Dokumenty

Data: 2026-09-15 CDT  
Użytkownik: Irina Lebedjuk  
Organizacja: Northwind  
Runtime pomiaru: `https://staging.consultify.ai`, linia przed M2 (`dcbd6c052a`)  
Gałąź naprawy: `codex/c-m2-manual-tools-20260915`

## Werdykt

**E1 WIP.** Pomysły, Notatnik i Dokumenty dowodzą po trzy realne zadania z readbackiem na liście My Work. Dokumenty na bieżącym stagingu nie mają żadnej akcji tworzenia zadania. Paczka dodaje do każdego dokumentu akcję `Create task`, zapis przez kanoniczne `Api.createPersonalTask`, `sourceType=document`, `sourceId=<document id>`, idempotency key, stan powodzenia i widoczny błąd. Test komponentu: 3/3 PASS. Lokalny kandydat `dcbd6c052a` na porcie 4214, połączony wyłącznie przez proxy HTTP z API stagingu, utworzył trzy zadania z trzech dokumentów; My Work wzrosło 23→26 i pokazało wszystkie trzy tytuły.

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
| Open | pozycja Row actions | zinwentaryzowana |
| Process Flow | pozycja Row actions | zinwentaryzowana |
| AI Chat | pozycja Row actions | zinwentaryzowana |
| AI Insights | pozycja Row actions | zinwentaryzowana |
| Initiative | pozycja Row actions | zinwentaryzowana |
| Tasks | **działa, 3/3** | utworzone: `Supplier quality early-warning signal between quarterly reviews`, `One changeover clock instead of three stopwatches`, `Retire the paper goods-in checklist at Wakefield` |
| Decision / Team Chat / Presentation / Report | pozycje Row actions | zinwentaryzowane; brak dodatkowych mutacji w tym pomiarze |
| Folder | disabled bez folderu | UI uczciwie pokazuje niedostępność |
| Open preview / Edit | pozycje Row actions | zinwentaryzowane |
| Delete | pozycja Row actions | nie zatwierdzano usunięcia |

Dowody: `screens/ideas-after-three-task-actions.png`, `screens/tasks-ideas-and-notebook-readback.png`.

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

Dowody: `screens/notebook-three-task-readbacks.png`, `screens/tasks-ideas-and-notebook-readback.png`.

## Dokumenty

| Przycisk / pozycja | Wynik na stagingu | Dowód / uwaga |
|---|---|---|
| Project documents / My documents | działa | Project bez projektu pokazuje uczciwy empty state; My documents pokazuje 3 dokumenty |
| Upload | działa | dodano niesensytywny plik testowy `northwind-s1-14-source-note.txt`, status Ready, 1 chunk |
| Refresh document status | działa | zmienia czas ostatniego odświeżenia |
| Download | widoczny dla każdego dokumentu | zinwentaryzowany |
| Delete | widoczny dla każdego dokumentu | nie zatwierdzano usunięcia |
| Create task | **BRAK na stagingu; działa 3/3 na lokalnym kandydacie** | trzy przyciski pokazały `Task created`; readback My Work 23→26 |

Dokumenty widoczne w pomiarze: Northwind Programme Charter (Ready, 3 chunks), Line 3 Changeover WI (Ready, 2 chunks), `northwind-s1-14-source-note.txt` (Ready, 1 chunk). Utworzone zadania: `Review document: Northwind 2027 Operational Maturity - Programme Charter.docx`, `Review document: Standard Work Instruction WI-OPS-118 - Line 3 Changeover.docx`, `Review document: northwind-s1-14-source-note.txt`. Dowody: `screens/documents-three-ready-no-task-action.png`, `screens/local-candidate-documents-three-task-created.png`, `screens/local-candidate-document-tasks-readback.png`.

## Naprawa Dokumenty → zadanie

Zmiana obejmuje cztery pliki produktu/testu:

- `DocumentSidePanel.tsx`: akcja `Create task`, pojedynczy lot, idempotency key, pochodzenie dokumentu, stan `Task created`, widoczny powód błędu.
- `public/locales/en/translation.json` i `public/locales/pl/translation.json`: EN first i polski odpowiednik.
- `DocumentSidePanel.uploadBlad.test.tsx`: dowód payloadu z `sourceType=document`, `sourceId`, idempotency key oraz widocznego potwierdzenia.

Walidacja: targeted Vitest 3/3 PASS, JSON en/pl parse PASS, `git diff --check` PASS. Pełny front TSC w pierwszej próbie zakończył się kodem 134 wskutek wyczerpania pamięci przy równoległych paczkach; nie jest zaliczony i będzie powtórzony po zwolnieniu zasobów.

## Pozostała bramka

1. Dokończyć kliknięcia bez mutacji lub z anulowaniem potwierdzenia dla pozostałych zinwentaryzowanych pozycji i zapisać wynik `działa / nic / błąd / po polsku`.
2. Powtórzyć front TSC i porównać z liniowym limitem 177.
