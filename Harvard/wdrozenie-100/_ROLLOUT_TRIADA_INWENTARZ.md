# ROLLOUT TRIADY — INWENTARZ REALNEGO PODŁĄCZENIA (SSOT)

Data utworzenia: 2026-07-26 · Źródło: audyt runtime na `origin/demo` (`de00f85741`), grep importów,
uruchomione bramki. **Ten plik wcześniej NIE ISTNIAŁ** — referencje do niego (m.in.
`_PLAN_SESJI_68a-e_TOOLS_ARTEFAKT.md:76`) wskazywały phantom-dokument, a status „KOMPLETNY"
krążył bez nośnika. Od dziś to jest żywy inwentarz; aktualizuj przy każdej migracji ekranu.

## ⚠️ NAJWAŻNIEJSZE USTALENIE (2026-07-26)

Standard triady jest **realny dla StandardTable i StandardPreview (częściowo), a NIE dla
StandardModuleBar**. Osiem kluczowych hubów buduje własne paski Menu 1/2/3 z tokenów
`shared/ModuleMenu3.tsx` — wizualnie zbieżne, ale zmiana kontraktu w `StandardModuleBar`
NIE propaguje. Realny SSOT menu w runtime = tokeny `MENU_1/2/3_*` z `ModuleMenu3.tsx`.

## 1. PODŁĄCZENIE per moduł (stan 2026-07-26)

Legenda: Bar=StandardModuleBar · T=StandardTable · P=StandardPreview · ✗=własna implementacja

| Moduł / ekran | Bar | T | P | Dowód |
|---|---|---|---|---|
| MyWork / Projects (`MyProjects.tsx:37`) | ✓ | ✓ | ✓ | jedyny pełny komplet triady |
| MyWork / Tasks (`MyTasksListContent.tsx:69,1257`) | ✗ | ✓ (flaga, default ON) | ręczne strefy | stara bespoke `<table>` żyje w gałęzi OFF |
| MyWork / Decisions (`DecisionsPanelContent.tsx:37`) | ✗ | ✓ | ✗ (`DecisionPreviewPanel`) | |
| MyWork / Inbox (`InboxContent.tsx:119`) | ✗ | ✓ (flaga) | ✗ | |
| MyWork / Ideas — LISTA (`IdeasTableContent.tsx`) | ✗ | **✗ surowy `<table>`** | overlay flagą | dualizm: artefakt `IdeaTableTool` MA StandardTable |
| MyWork / Notebook (`NotebookLibraryContent.tsx:28`) | ✗ | ✓ | — | |
| Assessment (`AssessmentHub.tsx`, `AssessmentTable.tsx:16`) | ✓ | ✓ | ✓ | wzorcowy moduł |
| Interview (`InterviewHub.tsx:96`) | ✗ | ✓ | ✗ (5 własnych preview) | `QuestionsList.tsx:913` surowa tabela |
| Initiatives (`InitiativesHub.tsx`) | ✗ | ✓ | ✗ (`InitiativePreviewV3`) | importuje StandardPreview, nie renderuje |
| Execution (`ExecutionHub.tsx:68`) | ✗ | ✓ | ✗ | `RolloutTab.tsx` surowa tabela |
| Results (`ResultsHub.tsx:28`) | ✗ | ✓ | ✗ | `ResultsInitiativesView.tsx:493` + `ResultsKPITable` surowe |
| Finance (`FinanceHub.tsx`) | ✗ | ✓ | ✗ (`FinancePreviewPanel`) | |
| Materiały / Vault (`ClientDocumentsVault.tsx:28`) | ✓ | ✓ (`VaultSafesTable.tsx:25`) | — | |
| Audits (`AuditsHub.tsx`) | ✗ | ✓ | ✓/✗ | |
| Meeting (`MeetingHub.tsx`) | ✗ | ✓ | ✓/✗ | |
| Reports&Presentations (4 taby) | częściowo | ✓ | ✓ | Outputs ma Bar |
| Admin/SuperAdmin (~40 widoków) | 3 widoki | ✓ | 3 widoki | ModelCatalog=komplet |
| Portfolio (`PortfolioListView.tsx:399`) | ✗ | **✗ surowa** | ✗ | własna persistencja kolumn |

## 2. ZNANE NARUSZENIA STRUKTURALNE (do migracji — kolejność wg wpływu)

1. **MyWork/Ideas lista** — surowy `<table>` obok artefaktu na StandardTable (dwie różne tabele
   Idei u klienta). Największy dysonans w jednym bycie.
2. **Results** — `ResultsInitiativesView.tsx:493`, `ResultsKPITable.tsx` surowe mimo huba na T.
3. **Interview/QuestionsList.tsx:913**, **Execution/RolloutTab.tsx**, **Portfolio** — surowe listy.
4. **StandardModuleBar w 8 hubach** — patrz ustalenie wyżej; wymaga decyzji wizualnej Piotra
   (zmiana potencjalnie widoczna) → pozycja odbiorowa, nie auto-migracja.

## 3. BRAMKI (stan realny 2026-07-26)

- `check-list-canon.sh` — ratchet z baseline **414 naruszeń w 161 plikach** (2026-07-24).
  ZIELONA = „dług nie rośnie", NIE „zgodne z kanonem". Migracja ekranu = ręczne odchudzenie baseline.
- `§27-exempt` (doktryna Tabela≠Excel) w **140 plikach** — furtka legalna, ale szeroka;
  przy odbiorze ekranu sprawdzaj, czy wyjątek jest zasadny (archetyp Excel), nie nawykowy.
- `check-triada.sh` — TYLKO kolory crimson, nie struktura. Na czystym drzewie skanuje 0 plików
  („sprawdzono 0" ≠ czysto). Naprawa przenośności macOS: gałąź `fix/bramki-nie-klamia`.

## 4. PROTOKÓŁ AKTUALIZACJI

Po każdej migracji ekranu na standard: (1) zaktualizuj wiersz tabeli §1, (2) odchudź baseline
list-canon o wpisy pliku, (3) dopisz linijkę do dziennika poniżej.

## 5. DZIENNIK

- 2026-07-26 — utworzenie inwentarza z audytu runtime (sesja standard+weryfikacja); stan zastany
  jak wyżej; phantom-status „KOMPLETNY" unieważniony.
