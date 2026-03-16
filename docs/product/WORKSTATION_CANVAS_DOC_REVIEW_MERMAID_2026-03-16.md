## Workstation Canvas — analiza paczki Mermaid (wnioski pod Mind map / Process flow)

> **Data:** 2026-03-16  
> **Źródło:** `knowledge/Miro/Mermaid.zip` (zrzut `mermaid.js.org`)  
> **Cel:** doprecyzować „braki” i najbardziej opłacalne funkcje do domknięcia 3 workstation canvas: `mindmap`, `whiteboard`, `process_flow`

---

## 1) Co Mermaid realnie daje nam jako „inspirację” produktową

### 1.1 Mindmap DSL (import do `mindmap`)
Mermaid ma **dedykowaną składnię mindmap**, opartą o:
- **indentation jako hierarchię** (outline → drzewo),
- **kształty węzłów** w stylu flowchart (przykłady z dokumentacji):  
  - square: `id[I am a square]`  
  - rounded square: `id(I am a rounded square)`  
  - circle: `id((I am a circle))`  
  - bang: `id))I am a bang((`  
  - cloud: `id)I am a cloud(`  
  - hexagon: `id{{I am a hexagon}}`  
  - default shape: zwykła linia tekstu
- **ikony** jako wiersz `::icon(...)` (w dokumentacji: `::icon(fa fa-book)`, `::icon(mdi mdi-skull-outline)`).

**Wniosek dla Consultify**:
- **Import „Mermaid mindmap”** to tani sposób na „paste → mindmap” (obok CSV/OPML/XMind).  
- Dodatkowo, Mermaid potwierdza sens **shape presets / themes** (nawet jeśli finalnie nie kopiujemy 1:1 delimiterów).

---

### 1.2 Flowchart DSL (import do `process_flow`)
Mermaid `flowchart` wnosi kilka bardzo praktycznych elementów:
- **Subgraph** jako grupowanie/sekcja (`subgraph one ... end`) + możliwość nadawania tytułu.
- **Direction per graph i per subgraph**: `LR/RL/TB/BT` (w tym nested directions).
- **Interakcje kliknięcia**:
  - `click A callback "Tooltip..."` (JS callback),
  - `click B "https://..." "Tooltip..."` / `href ... _blank` (link).  
  - W dokumentacji jest też informacja, że to zależy od `securityLevel` (strict vs loose).
- **Animacja krawędzi** (flowchart v2): przykłady pokazują edge id `e1@` oraz konfig `e1@{ animate: true }` / `animation: fast`, a także wariant przez `classDef` + `class e1 animate`.

**Wniosek dla Consultify**:
- Import Flowchart jako „szybki entry” jest uzasadniony (już na liście rekomendacji).  
- Dodatkowo: **subgraph → Frames/Sections** jest bardzo naturalnym mapowaniem.

---

### 1.3 Sequence Diagram DSL (opcjonalny import do `process_flow`)
Mermaid `sequenceDiagram` jest „procesowe” w innym sensie (interakcje systemów/aktorów) i wspiera:
- `participant` i `actor`
- **typy uczestników** przez adnotację `@{ "type": ... }` (w docs: `boundary`, `control`, `entity`, `database`, `collections`, `queue`, …)
- `activate` / `deactivate` (lifelines)
- `Note over Alice,John: ...`
- bloki sterujące: `loop`, `alt/else`, `opt`, `par/and`, `critical/option` (wszystko widoczne w docs jako przykłady)

**Wniosek dla Consultify**:
- Możemy dodać import **Mermaid Sequence** jako P2/P1 (zależnie od strategii `process_flow`: BPMN vs „diagram studio”).

---

### 1.4 State Diagram DSL (opcjonalny import do `process_flow`)
Mermaid `stateDiagram-v2` wspiera:
- start/stop `[*]`
- przejścia `A --> B`
- opisy stanów `state "..." as s2` oraz `s2 : ...`
- **composite states** (`state X { ... }`) z zagnieżdżeniami

**Wniosek dla Consultify**:
- Import State Diagram to dobry P2 dla klientów „enterprise IT / governance”, gdzie proces bywa modelowany jako automaty stanów.

---

### 1.5 Layout engine jako feature (ELK)
W dokumentacji Mermaid jest przykład wyboru layoutu przez frontmatter:

```yaml
config:
  layout: elk
```

**Wniosek dla Consultify**:
- Dla `process_flow` (i częściowo `mindmap`) warto rozważyć **ELK-based auto-layout / routing** jako docelowy „flow aware layout” (nasz P0), bo to jest sprawdzony kierunek w ekosystemie.

---

## 2) Delta do naszej listy rekomendacji (co dopisać/zmienić)

### Dopisać
- **Mind map (P1)**: import Mermaid Mindmap (paste DSL → map).
- **Process flow (P2)**: import Mermaid Sequence Diagram oraz State Diagram.
- **Cross-canvas (P1)**: „clickable nodes/steps” jako spójna funkcja linkowania (Mermaid pokazuje, że to jest standard).

### Bez zmian (potwierdzone)
- Frames/Sections, align/snap, z-order, export, i flow-aware auto-layout to nadal fundament domknięcia workstation canvas.

