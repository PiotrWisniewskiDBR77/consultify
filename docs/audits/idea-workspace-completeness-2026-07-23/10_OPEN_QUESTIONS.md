# 10 — Pytania otwarte (do decyzji właściciela / do weryfikacji live)

**Data:** 2026-07-23. Podzielone na: (A) decyzje kierunkowe właściciela, (B) do weryfikacji na żywej aplikacji, (C) do doprecyzowania w kodzie.

## A. Decyzje kierunkowe (blokują finalny standard)

| # | Pytanie | Dlaczego istotne | Opcje |
|---|---|---|---|
| A1 | **Table: legacy czy platform P15 jest docelowy?** | Standard nie może opisać obu; różne menu/paski/zachowania | (a) P15 docelowy, deprecjonuj legacy · (b) legacy docelowy, wytnij P15 · (c) hybryda z jasną granicą |
| A2 | **Kanon prawego panelu — SPEC-A czy własny?** | Determinuje co pod 5 ikonami + czy dodać Powiązania/Komentarze | (a) dojdź do SPEC-A (Akcje·Właściwości·Powiązania·Komentarze·Historia/AI) · (b) zostań przy Problem·Status·Inspektor·Convert·Zdrowie |
| A3 | **Czy „Convert" ma być JEDNYM mechanizmem?** | Dziś 3 różne (workspace/M05/martwy) z rozjazdem targetów | ujednolicić na jeden serwis konwersji |
| A4 | **Zakres „Convert element/branch/selection"** | Dziś MM zawsze konwertuje całą gałąź mimo nazwy „element" | zdefiniować co znaczy każdy scope i wyrównać |
| A5 | **Czy `promote()` ma oznaczać całą ideę?** | Dziś tak, nawet dla konwersji fragmentu → utrata śladu | zdecydować: promocja per-idea vs per-fragment |
| A6 | **Realtime: ujednolicić 3 kanały?** | WebSocket + Socket.IO + REST-polling równolegle | jeden kanał vs świadomy podział z granicą |
| A7 | **Persystencja Whiteboardu** — migrować na `useWorkspaceGraphRuntime`? | Jedyny tool poza wspólnym silnikiem | migrować vs zostawić z udokumentowanym powodem |

## B. Do weryfikacji na żywej aplikacji (czysty przebieg, bez równoległych sesji)

| # | Pytanie | Jak sprawdzić |
|---|---|---|
| B1 | Czy moduły P15 (Data/Forms/Interfaces/Models/Workflow + Tools) realnie działają? | otworzyć tabelę z `usePlatform=ON` (potrzebna migracja/baza platformowa) i przeklikać |
| B2 | Czy snapshot importu łapie stan przed czy po nadpisaniu? | zaimportować draw.io, otworzyć Historię, sprawdzić czy da się cofnąć do stanu sprzed |
| B3 | Czy AI „dla zaznaczenia" scopuje backend do zaznaczenia? | zaznaczyć 2 z N węzłów, odpalić AI, sprawdzić payload/wynik |
| B4 | Co realnie robi „AI transform to table/mind map" na Whiteboardzie? | odpalić, sprawdzić czy tworzy nowy artefakt czy karteczki na tym samym płótnie |
| B5 | Czy prezencja Table (P15) się dubluje (REST-polling + Socket.IO)? | otworzyć tabelę P15 w 2 kartach, obserwować kanały prezencji |
| B6 | Czy „usePlatform" jest gdziekolwiek ON dla realnych tabel na demo? | zapytać bazę o platform-bases z rekordami dla realnych userów |

## C. Do doprecyzowania w kodzie (mniejsze, ale warte)

| # | Pytanie |
|---|---|
| C1 | Które z martwych endpointów (cluster/outcome, `v8/mindmap/*`, `develop` SSE, `export-csv`, facilitacja end/outcomes) usunąć, a które dokończyć? |
| C2 | Kod bez UI (`tbl_autofill/refresh/link`, `wb_group/distribute`, `IdeaCanvasDiscovery`, typy `kpi_badge/score/progress/summary`) — zachować/podłączyć/usunąć? Każdy ma potencjalny sens biznesowy (patrz plik 08). |
| C3 | Martwe eventy (`idea-workspace-add-edge`/`-link-artifact`/`-votes-update`/`-outcomes-changed`/`-apply-theme`) — dopiąć listenery czy usunąć nadawców? |
| C4 | Czy `AI_PROPOSAL_ENABLED` / `HARD_DISABLE_METADATA_FIRST` (kill-switche na sztywno) mają zostać, czy przejść na flagi? |
| C5 | Brakujące tłumaczenia PL: `collaboration.*` (baner realtime po ang.), „Lane N", diakrytyki w `whiteboardInteractionGrammar.ts`. |
| C6 | Menu kontekstowe krawędzi: MM ma, Process ma tylko styl-popover, Whiteboard nic — ujednolicić? |
| C7 | „Zdrowie mapy" liczone klientowo (`MapHealthScore`) mimo istniejącego endpointu `v8/mindmap/health` — który jest źródłem prawdy? |

---

**Uwaga metodyczna:** cały audyt to analiza kodu + wcześniejsza weryfikacja powierzchni (część live). Sekcja B wymaga jednego spokojnego przebiegu na żywej aplikacji BEZ równoległych sesji agentów — w tej sesji równoległe audyty powodowały samoczynne przełączanie narzędzia na obiektach testowych, co zakłócało weryfikację.
