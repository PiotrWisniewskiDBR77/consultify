## Workstation Canvas — analiza paczki Obsidian (wnioski pod linkowanie, „graph”, canvas UX)

> **Data:** 2026-03-16  
> **Źródło:** `knowledge/Miro/added/Obsidian.zip` (zrzut `docs.obsidian.md` + assety Publish)  
> **Cel:** wyłapać wzorce, które zwiększają „knowledge workflow” wokół 3 canvas: `mindmap`, `whiteboard`, `process_flow`

---

## 1) Co realnie zawiera paczka
Ta paczka to w dużej mierze **developer docs** (API / CSS variables / plugin-y), a nie „user guide”. Mimo tego widać kilka ważnych wzorców produktowych, które warto przenieść do Consultify.

---

## 2) Wzorce, które warto skopiować (produktowo)

### 2.1 Backlinks jako stały element każdego artefaktu
W renderze stron widać sekcję **„Links to this page”** (backlinks) jako standardowy blok.

**Implikacja dla Consultify**:
- Każdy artefakt (mindmap/whiteboard/process_flow) powinien mieć:
  - **Backlinks** (kto linkuje do mnie) + „go to”.
- To wspiera consulting workflow: „skąd to się wzięło” i „co to napędza”.

---

### 2.2 Interactive Graph + „Global Graph”
W UI jest „Interactive graph” oraz przycisk „Global Graph”.
W CSS variables dla graph są rozróżnione m.in.:
- node resolved vs unresolved,
- node tag,
- node attachment.

**Implikacja dla Consultify**:
- Dodać (P2/P1) **globalny knowledge graph** łączący:
  - canvasy, notes, evidence, tabele/rekordy, załączniki, tagi,
  - oraz koncept **„unresolved links”** (dangling references) jako sygnał jakości.

---

### 2.3 Canvas: dot-grid + „card palette” jako ergonomia
W CSS variables canvas są m.in.:
- `--canvas-dot-pattern` (kropkowane tło),
- `--canvas-color-1..6` (paleta kolorów kart),
- `--canvas-background`.

**Implikacja dla Consultify**:
- Whiteboard powinien mieć „whiteboard feel” nie tylko przez narzędzia, ale też przez:
  - **dot-grid background** (toggle),
  - **spójną paletę kolorów sticky/card**.

---

### 2.4 Viewport/virtualization jako warunek skali
Developer docs tłumaczą „viewport” (renderuj tylko to co widać) jako powód, że edytor znosi miliony linii.

**Implikacja dla Consultify**:
- Przy dużych canvasach to analogicznie oznacza:
  - render budget / virtualization (np. nodes outside viewport),
  - throttle dla heavy operacji (snap, collision, auto-layout),
  - podział na „model state” vs „render state”.

---

## 3) Delta do naszej listy rekomendacji (propozycja)
- **Cross-canvas (P1/P2)**:
  - Backlinks per artefakt + „global graph”.
- **Whiteboard (P1/P2)**:
  - dot-grid toggle + card palette.
- **Cross-canvas (P1/P2, techniczne)**:
  - viewport-aware rendering / perf guardrails dla dużych canvasów.

