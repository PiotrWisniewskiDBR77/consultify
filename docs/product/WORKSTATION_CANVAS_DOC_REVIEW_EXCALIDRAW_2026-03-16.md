## Workstation Canvas — analiza paczki Excalidraw (wnioski pod Whiteboard / Process flow)

> **Data:** 2026-03-16  
> **Źródło:** `knowledge/Miro/Excalidraw.zip` (zrzut `docs.excalidraw.com` + assety)  
> **Cel:** doprecyzować luki i „must-haves” dla 3 workstation canvas: `mindmap`, `whiteboard`, `process_flow`

---

## 1) Najważniejsze elementy Excalidraw (z perspektywy naszego scope)

### 1.1 Frames jako podstawowy „porządek” na canvas
- Excalidraw traktuje **frames** jako kontenery, a edytor/renderer opiera się na poprawnym **porządkowaniu elementów**: najpierw children, potem frame (ważne dla clipping i performance).
- W praktyce: frames to fundament dla „sekcji”, prezentacji, warsztatów, i ogarniania dużych tablic.

**Implikacja dla Consultify**:
- Nasz backlog „Frames/Sections + present mode” to **P0** (nie tylko UX — to też ułatwia optymalizację renderingu i selekcji).

---

### 1.2 Export jako produktowa funkcja (nie tylko „zrzut”)
Excalidraw ma pierwszorzędne „export utilities”, w tym:
- **`exportToCanvas`** (render do `<canvas>`),
- **`exportToBlob`** (PNG/JPEG/WebP),
- **`exportToSvg`**,
- **`exportToClipboard`** (PNG/SVG/JSON),
- parametry exportu w `appState`: `exportBackground`, `viewBackgroundColor`, `exportWithDarkMode`, `exportEmbedScene`.

**Implikacja dla Consultify**:
- Dla workstation canvas warto dodać **export do clipboard (PNG/SVG/JSON)** i opcje „background/dark mode/embedded scene” jako polish P0/P1.

---

### 1.3 Tooling: freehand + eraser + hand tool + image
Z UI (widoczne w doc pages) widać typowy zestaw narzędzi „whiteboardowych”:
- selection, rectangle, diamond, ellipse,
- arrow/line,
- **freedraw (pen)**,
- **eraser**,
- **hand tool (panning)**,
- **insert image**,
- „lock tool” (zostaw narzędzie aktywne po narysowaniu).

**Implikacja dla Consultify**:
- Dla `whiteboard` i `process_flow` zestaw narzędzi: **pen + eraser + hand + basic shapes + arrows + image** powinien być traktowany jako P0.

---

### 1.4 Import „Process Flow” z Mermaid (bardzo pragmatyczny skrót)
Excalidraw posiada `@excalidraw/mermaid-to-excalidraw`, który działa w dwóch krokach:
- `parseMermaidToExcalidraw(mermaidSyntax)` → elementy w „skeleton format”
- `convertToExcalidrawElements(elements)` → w pełni kwalifikowane elementy sceny

Obsługa diagramów:
- **Flowchart**: rectangle/circle/diamond/arrows + **subgraphs** (grupowanie)
- Pozostałe typy Mermaid → fallback do obrazka
- Wiele shape’ów Mermaid fallbackuje do rectangle (ale to nadal szybki import)

**Implikacja dla Consultify**:
- Dla `process_flow` możemy dorzucić **Mermaid Flowchart import** jako P1 (albo P0, jeśli ma być najszybsza droga tworzenia flow).  
- To od razu daje: „wklej DSL → masz diagram”, bez ręcznego klikania 50 elementów.

---

## 2) Co to zmienia w naszej liście rekomendacji (delta)

### Dopisać / podbić priorytet
- **Cross-canvas (P0/P1)**:
  - Export do **clipboard**: PNG/SVG/JSON + opcje exportu (tło, dark-mode).
  - „Tool lock” (zostaw narzędzie aktywne po użyciu) + „hand tool” jako standard ergonomii.
- **Whiteboard (P0)**:
  - Eraser + image tool jako absolutny standard.
  - Library jako zasób elementów (spójny z „asset library” w rekomendacjach).
- **Process flow (P1)**:
  - Import Mermaid Flowchart (wklej → render) jako szybki entry-point.
  - Wsparcie dla subgraphs → naturalny odpowiednik frames/sections.

### Bez zmian (potwierdzone jako trafione)
- Frames/Sections, z-order, align/snap, pen/highlighter, shapes, comments anchored — to wszystko jest „core canvas”.

---

## 3) Najbardziej opłacalne implementacyjnie „quick wins”
Jeśli chcemy najszybciej podnieść odczucie „Miro/Excalidraw-class” bez dużych refactorów:
- **Mermaid Flowchart import** do `process_flow` (P1): szybka wartość dla użytkownika.
- **Clipboard export** (P0/P1): wspiera pracę consultingową (wklej do decka / doca).
- **Eraser + image tool** w `whiteboard` (P0): natychmiastowe „whiteboard feel”.

