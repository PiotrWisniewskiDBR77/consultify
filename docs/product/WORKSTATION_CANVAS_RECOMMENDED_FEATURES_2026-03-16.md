## Workstation Canvas — rekomendowane funkcje do dodania (Mind map / Whiteboard / Process flow)

> **Data:** 2026-03-16  
> **Zakres:** domknięcie **3 canvas workstations**: `mindmap`, `whiteboard`, `process_flow`  
> **Poza zakresem:** Table Platform (uznajemy „w pracy”)

### Założenia priorytetyzacji
- **P0**: funkcje, które blokują „produkcyjne” użycie canvasu lub są oczekiwanym standardem (Miro-klasa).
- **P1**: funkcje, które znacząco zwiększają wartość i adopcję, ale można bez nich działać.
- **P2**: funkcje „nice-to-have”, które robią różnicę w UX / polish / enterprise.

---

## 1) Cross-canvas (wspólne dla 3 workstation)

### P0 — Canvas primitives & ergonomia
- **Biblioteka obiektów na canvas**: `shape`, `sticky_note`, `text`, `image` (min. URL + upload).  
  - **Dlaczego**: Whiteboard i Process Flow bez kształtów/notesów nie domykają podstawowych przypadków użycia.
- **Frames/Sections** (kontenery) + „present mode” na frame’ach (slajdy).  
  - **Dlaczego**: to najprostszy sposób na „porządek” i prezentacje jak w Miro.
- **Warstwy (z-order)** + „bring to front / send to back”.  
  - **Dlaczego**: bez tego obiekty nachodzą na siebie i edycja jest frustrująca.
- **Snap-to-grid + guides + align/distribute** dla multi-select.  
  - **Dlaczego**: Process Flow wymaga precyzji, a Whiteboard „czystości”.
- **Komentarze/Discussion anchored do canvas** (pin w przestrzeni + wątek).  
  - **Dlaczego**: to jest podstawowy „collab primitive” na canvasie.
- **Export do clipboard**: PNG/SVG/JSON + opcje exportu (tło, dark-mode).  
  - **Dlaczego**: consulting workflow (deck/doc) i szybkie dzielenie się fragmentem canvas.
- **Hand tool + tool-lock** (zostaw narzędzie aktywne po użyciu) jako standard ergonomii.  
  - **Dlaczego**: bez tego rysowanie i nawigacja są „klikaniowe” i męczące.

### P1 — Collaboration primitives (Miro-like)
- **Timer** (warsztatowy) + szybkie presety (5/10/15/30 min).  
- **Voting / dot voting** (zliczanie, limit głosów na osobę, wyniki na canvasie).  
- **Session / facilitation mode**: prowadzący, dołączanie, „follow facilitator”, blokady edycji w sesji.

### P1 — Extensibility & input
- **Drag & drop** z panelu bocznego na canvas (np. elementy szablonu, karty, assety).  
- **Custom actions** dla zaznaczenia (prawy klik → akcje kontekstowe, limit + uprawnienia).

### P2 — Sharing / embedding
- **Tryb „share link view/comment/edit”** dla canvas (spójnie z resztą aplikacji).  
- **Live embed** (iframe) dla publicznego lub partnerowego wglądu (kontrolowane uprawnieniami).

---

## 2) Mind map — funkcje warte dodania

### P0
- **Tematy/stylowanie per gałąź**: font size, border style, fill opacity (minimum zestaw), presets „themes”.  
  - **Dlaczego**: w mindmapie szybko rośnie „gęstość” i bez wyróżnień spada czytelność.
- **Outline view** (drzewo w panelu) + szybka nawigacja (search, jump-to-node).  
  - **Dlaczego**: przy 100+ węzłach praca „tylko na canvasie” jest wolna.

### P1
- **Branch direction / side control** (lewa/prawa strona od root, auto-balance).  
- **Mindmap CSV import** (Miro-style: ścieżki kolumnami) + eksport CSV.  
- **Import z Mermaid Mindmap** (wklej DSL → mindmap) jako szybki entry-point obok OPML/XMind.  
- **Backlinks / cross-link explorer** (lista relacji + „go to”).

### P2
- **Per-node mini-preview** (np. pierwsze 2 linie notatki / evidence count) jako opcjonalny overlay.
- **History / diff na mapie** (co się zmieniło od ostatniego review) wprost na canvasie.

---

## 3) Whiteboard — funkcje warte dodania

### P0
- **Sticky notes (kolory, rozmiary, podstawowe style)** + szybkie tworzenie (hotkeys).  
- **Pen / highlighter** (minimalny freehand) + gumka.  
  - **Dlaczego**: bez tego „whiteboard” jest tylko canvasem bez whiteboardowych zachowań.
- **Image tool** (wstawianie obrazów) jako element bazowy whiteboardu.  
- **Affinity clustering**: grupowanie notesów + automatyczne układanie w siatce (manual + AI-assisted).  

### P1
- **Templates dla warsztatów**: retro, impact/effort, journey map, brainstorm, lightning decision jam.  
- **Quick facilitation tools**: timer + voting + „lock/unlock board” dla uczestników.
- **Asset library**: ikony, strzałki, proste komponenty (badge, callout, legend).

### P2
- **Import z obrazów** (np. wklej screenshot → auto-detekcja sticky/shape jako sugestia AI).
- **Export jako „board pack”** (PNG/PDF + metadane + linki).

---

## 4) Process flow — funkcje warte dodania

### P0
- **BPMN 2.0 core** (minimum): start/end, task, gateway (exclusive/parallel), sequence flow, lanes/pools.  
  - **Dlaczego**: bez lanes/gateways nie zrobimy realnych procesów enterprise.
- **Walidacja diagramu** (podstawowe reguły): brak start, dangling flows, nieobsłużone gatewaye, puste etykiety.  
- **Routing i auto-layout „flow aware”** (czytelne łamanie, unikanie kolizji, reroute na przesunięcie węzła).

### P1
- **Swimlane metrics**: czas, owner, system, „handoff count” (nawet jeśli to tylko atrybuty).  
- **Linkowanie kroków do artefaktów**: task/initiative/table record/automation/runbook.  
- **Import/Export BPMN** (round-trip), plus export SVG/PNG/PDF.
- **Import z Mermaid Flowchart** (wklej DSL → diagram) jako szybki entry-point obok BPMN.  

### P2
- **Simulation / what-if** (prosty kalkulator): sumaryczny lead time, bottlenecks po tagach.  
- **Versioning + diff** (porównanie dwóch wersji procesu w UI).
- **Import z Mermaid**: `sequenceDiagram` + `stateDiagram-v2` (wklej DSL → diagram) jako opcjonalny tryb dla klientów IT/enterprise.

---

## 5) Minimalny „Definition of Done” dla 3 workstation canvas

### Must-have (żeby uznać „domknięte”)
- **Whiteboard**: sticky notes + shapes + pen + clustering + export (PNG/PDF).
- **Process flow**: BPMN core + lanes + walidacja + BPMN import/export + stabilny layout.
- **Mind map**: outline + search/jump + CSV import/export + themes (min. style presets).
- **Cross-canvas**: frames/sections + z-order + align/snap + anchored comments + timer/voting (wspólne narzędzia warsztatowe).

### Nice-to-have (dla Miro-class polish)
- Session/facilitation mode, live embed, custom actions, asset library, simulation/diff.

