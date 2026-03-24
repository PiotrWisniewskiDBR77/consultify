## Workstation Canvas — analiza paczki tldraw (wnioski pod Whiteboard / cross‑canvas)

> **Data:** 2026-03-16  
> **Źródło:** `knowledge/Miro/added/Tldraw.zip` (snapshot `tldraw.dev`)  
> **Cel:** wyciągnąć “wzorce edytora” (kamera, tools, selection, snapping, clipboard, perf, collaboration) i przełożyć je na backlog dla `whiteboard` + prymitywy cross‑canvas.

---

## 1) Co realnie jest w paczce
Snapshot `tldraw.dev` z:
- `docs/editor.html` (overview `Editor` jako API),
- `sdk-features/*` (konkretne rozdziały: `camera`, `tools`, `selection`, `snapping`, `clipboard`, `performance`, `user-following`, itd.),
- `reference/tldraw/*` (API reference, gotowe “default*” utils).

**Wniosek**: to jest bardzo wartościowa paczka “produktowo‑architektoniczna” (nie tylko UI), bo pokazuje spójny model: **Editor API + state machine tools + camera + snapping + clipboard + perf**.

---

## 2) Najbardziej wartościowe wzorce (co kopiujemy jako “design constraints”)

### 2.1 Kamera jako 1st‑class obywatel
`camera` to nie tylko “pan/zoom”:
- stan: \(x,y,z\) (top‑left viewport w page coords + zoom),
- opcje input (wheel pan/zoom), zoom steps, lock,
- constraints/bounds + “fit” strategie,
- integracja z realtime: viewport following.

**Implikacja**: w naszych canvasach (whiteboard/mindmap/process_flow) kamera ma być jednolicie zarządzana (API + persist + follow).

### 2.2 Tools jako hierarchiczna state machine (a nie “if‑else w handlerach”)
`tools` są modelowane jako **StateNode** (root → tool → child states jak `idle/pointing/translating/resizing`).

**Implikacja**:
- “whiteboard feel” wynika głównie z poprawnej maszyny stanów (select/hand/draw/eraser) + spójnego event routing.
- łatwiej dodawać skomplikowane interakcje (resize/rotate/handle) bez chaosu.

### 2.3 Tool‑lock jako kluczowa ergonomia (P0)
Tldraw ma “tool lock” jako część systemu narzędzi: przy tworzeniu wielu elementów narzędzie nie resetuje się do select.

**Implikacja**: u nas to powinno być standardem cross‑canvas, nie “feature UI”.

### 2.4 Selection jako SSOT + “progressive select all”
Selection przechowuje listę `selectedShapeIds` jako **source of truth**.
W `selectAll()` występuje progresywne zachowanie (page → parent → …).

**Implikacja**: w naszych canvasach selection musi być stabilnym kontraktem (wspólny model + API), bo na nim wiszą: actions, clipboard, snapping, presence.

### 2.5 Snapping jako system (3 typy) + “handle snapping” pod konektory
Tldraw opisuje 3 typy snapping:
- bounds snapping (krawędzie/centra),
- handle snapping (końcówki do outline/points — idealne pod strzałki/konektory),
- gap snapping (równe odstępy).

**Implikacja**:
- `process_flow` i `whiteboard` powinny mieć przynajmniej bounds + handle snapping w P0/P1,
- handle snapping to fundament “ładnych strzałek”.

### 2.6 Clipboard jako pipeline (copy/cut/paste) z multi‑format + external content handlers
Clipboard w tldraw:
- serializuje content (shapes/bindings/assets/schema),
- dba o brak dangling bindings,
- przy paste: schema migration + ID remap + wybór parent (np. frame),
- zapisuje kilka formatów (HTML w `data-tldraw`, plain text),
- ma obsługę external content (image/file/url/text).

**Implikacja**:
- nasze “export/clipboard” powinno być pipeline’owe, a nie “na skróty”,
- potrzebujemy external content handlers (paste images/URLs → elementy).

### 2.7 Performance: viewport culling + index + LOD
Tldraw kładzie nacisk na:
- **viewport culling** (nie renderować poza viewport),
- spatial index dla widoczności,
- batched store updates,
- LOD (upraszczanie przy niskim zoom).

**Implikacja**: to jest klucz dla Whiteboard (10k elementów) i dla naszych “canvas blocks” w przyszłości.

### 2.8 Realtime: follow user viewport (facilitation)
`user-following` opisuje “follow facilitator” jako mechanizm kamery + interpolacji + page sync.

**Implikacja**: to jest P1 “facilitation mode” w naszym master planie (spójne z Yjs/Liveblocks patterns).

---

## 3) Delta do naszych SSOT‑ów

### 3.1 Master plan
Wzmacniamy sekcję whiteboard o konkretne wzorce: camera options/constraints, tool state machine, snapping (handle), clipboard pipeline, viewport culling.

### 3.2 Recommended features
Doprecyzowujemy:
- `Cross-canvas P0`: tool‑lock (już jest) + “camera jako API” + snapping system,
- `Whiteboard P0/P1`: handle snapping dla arrow, external paste handlers, perf: culling/LOD.

