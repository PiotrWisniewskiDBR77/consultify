## Workstation Canvas — analiza paczki Visio (wnioski pod Interop / enterprise import)

> **Data:** 2026-03-16  
> **Źródło:** `knowledge/Miro/added/Visio.zip` (snapshot `learn.microsoft.com`)  
> **Cel:** doprecyzować, co oznacza „VSDX interoperability” dla `process_flow` / `whiteboard` i jakie są ryzyka / scope.

---

## 1) Co realnie jest w paczce
W paczce jest w praktyce głównie snapshot `learn.microsoft.com`, a istotny dla nas fragment to:
- `Introduction to the Visio file format (.vsdx)` (`learn.microsoft.com/.../office/client-developer/visio/introduction-to-the-visio-file-formatvsdx`)

**Wniosek**: to jest dobry „high-level” opis podejścia (OPC + XML), ale nie jest to pełna specyfikacja do implementacji kompletnego importera VSDX.

---

## 2) Najważniejsze fakty z dokumentacji (praktyczne dla implementacji)

### 2.1 VSDX to OPC ZIP + XML (package parts + relationships)
VSDX używa **Open Packaging Conventions (OPC)**:
- plik `.vsdx` jest **ZIP containerem**,
- wewnątrz są **package parts** (XML, obrazki, zasoby),
- a struktura jest opisana przez **relationship parts** (`*.rels` w `_rels/`), które łączą „source → target”.

**Implikacja**: importer to w pierwszej kolejności parser ZIP + XML + relacji (bez automatyzacji Visio).

### 2.2 Rodzina formatów (ważne dla importu/bezpieczeństwa)
Dokument wymienia typy:
- `.vsdx` (drawing), `.vssx` (stencil), `.vstx` (template)
- macro-enabled: `.vsdm`, `.vssm`, `.vstm` (mogą zawierać VBA)

**Implikacja**:
- w P2 interopie celujemy w **import `.vsdx`** (opcjonalnie `.vssx`/`.vstx` jako biblioteki),
- pliki macro-enabled w UI powinniśmy **jawnie blokować lub importować w trybie “safe”** (domyślnie: reject) ze względu na ryzyko.

### 2.3 Model danych “ShapeSheet”: Cell/Row/Section
W VSDX (w porównaniu do starego `.vdx`) elementy ShapeSheet są ujednolicone:
- “singleton cells” są reprezentowane jako `<Cell ... N="PinX" ... />`,
- dane tabelaryczne idą przez `<Section N="Geometry" ...><Row ... T="LineTo">...<Cell N="X" .../></Row></Section>`.

**Implikacja**: mapowanie „kształt/connector” z Visio do naszego grafu będzie w praktyce mapowaniem z “Cell/Row/Section” na:
- **node geometry** (position/size),
- **style** (kolor/linia),
- **connector semantics** (source/target + routing — na start: uproszczone).

---

## 3) Delta do FINAL MASTER PLAN (co konkretnie dopisujemy)

### 3.1 Interop / VSDX — scope P2
W master plan doprecyzowujemy, że „VSDX import” oznacza:
- `VSDX (.vsdx)` jako ZIP(OPC) + XML importer,
- obsługa podstawowa: pages + shapes + connectors (mapa do `process_flow` / `whiteboard`),
- **reject** macro-enabled (`.vsdm/.vssm/.vstm`) jako domyślna polityka bezpieczeństwa.

### 3.2 Dalsze inspiracje (jeśli chcemy realny importer)
Jeśli będziemy implementować importer “serio”, ta paczka jest niewystarczająca — będziemy potrzebować pełniejszych źródeł (spec / biblioteki) do:
- nazw partów w paczce i ich roli (document/pages/masters),
- dokładnych zasad relacji i ID,
- mapowania konektorów i geometrii.

---

## 4) Minimalny plan implementacji (dla P2 interop)

### P2.1 Import `.vsdx` (MVP)
- **Wejście**: upload `.vsdx` → backend endpoint (lub client-side parse, ale preferowany backend dla bezpieczeństwa i limitów).
- **Parse**: ZIP open → list parts → XML parse → rels resolve.
- **Output**: `IdeaWorkspaceGraph` (nodes/edges/extensions) w formacie narzędzia docelowego (`process_flow` albo `whiteboard`).
- **Ograniczenia MVP**:
  - brak pełnej zgodności styli,
  - konektory: prosta linia + minimalne anchor points,
  - bez “advanced” Visio features.

### P2.2 Security / policy
- hard-block macro-enabled plików (`.vsdm/.vssm/.vstm`) na wejściu,
- log + audit event: “blocked import attempt”.

