# Final Implementation Contract — Mindmap (Position 12/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: UX budowania jest dramat; porównać z konkurencją; komplet przycisków; zadania do AI i AI buduje.
- **Primary users**: konsultanci/PMO (ideation, strukturyzacja).
- **Success metric**: mindmap builder jest kompletny (narzędzia + flow), a AI współbuduje w modelu propose→review.

## 2. Scope
### 2.1 In-scope
- Komplet narzędzi budowania + sensowny UX.
- AI co-building (bez zgadywania i bez silent edits).

### 2.2 Out-of-scope / non-goals
- Kopiowanie UI vendorów 1:1.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md`
- Readiness: `docs/product/MINDMAP_V8_READINESS_AUDIT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Miro` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Miro (mind map object model + import/co-building patterns)**:
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/docs/mind-maps.html` (Mind map (Experimental): CRUD mind maps; “represent and interact with complex structures”; import/export).
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/docs/create-mind-map-from-csv.html` (Create mind map from CSV: import → auto-create mind map on board).
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/docs/websdk-reference-mindmap-node.html` (MindmapNode: root + child creation; node content).
  - `Softs/0 Miro/Miiro doc.zip :: Miiro doc/developers.miro.com/reference/create-mindmap-nodes-experimental.html` (Create mind map node: root/child structure; API contract posture).
- **Adjacents in same Softs family** (dla “tool completeness”, jeśli mapka współistnieje z diagramami):
  - `Softs/0 Miro/Excalidraw.zip` (whiteboard-style primitives; useful as a “minimal toolbelt” reference).
  - `Softs/0 Miro/Mermaid.zip` (text-to-diagram mindset; useful for AI “generate structure” flows).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “spokojny, kompletny builder + przewidywalny model gałęzi”, nie “pełna Miro parity”.**

- **Mind map as a first-class structure (Miro)**:
  - Root + child nodes są jawne; node content jest edytowalne i stabilne.
  - Struktura wspiera duże mapy bez utraty orientacji (nawigacja, fokus, “gdzie jestem”).
- **Import/transform workflows (Miro CSV import)**:
  - Import danych → wygenerowanie struktury mapy jako kontrolowany workflow (preview → apply).
  - Export/readback jest możliwy bez gubienia semantyki gałęzi.
- **Tool completeness for core loop**:
  - Dodawanie node’ów, zmiana hierarchii (reparent), collapse/expand, szybka edycja treści.
  - Zoom/pan/fit-to-content, undo/redo, multi-select, drag-and-drop bez “interaction anxiety”.
- **AI co-building as governed proposals**:
  - AI generuje/modyfikuje mapę jako propozycję (diff/preview) → user akceptuje; brak silent edits.
  - AI potrafi: rozwinąć gałąź, zwinąć/reorganizować, wygenerować mapę z briefu.
- **Trust boundaries (Wave1 doctrine)**:
  - Użytkownik rozumie co zmieniło się po operacji (manualnej lub AI); stany są spójne.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md` + readiness `MINDMAP_V8_READINESS_AUDIT.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Interaction calmness | smooth branch creation/navigation | “interaction calmness trails benchmark” | Uspokoić core loop: selection/navigation/branch ops (bez frustracji) | P0 |
| Branch-state trust | operations are understandable | “branch-work trust not strong enough” | Ujednolicić semantykę branch state + readback “what changed” | P0 |
| Collaboration confidence | helpers feel additive | “collaboration confidence later” | Dodać bounded collab/copilot cues bez destabilizacji | P1 |
| Builder tool completeness | no missing buttons | “tool set incomplete / UX dramatic” | Domknąć minimalny toolbelt buildera (bez pełnej whiteboard parity) | P0 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- User potrafi zbudować mapę bez braków narzędzi; AI potrafi wygenerować i modyfikować strukturę jako propozycję.
- Core loop jest “calm”: brak sytuacji, gdzie user traci orientację po operacji.
- AI proposals są reviewable (preview/diff) i audytowalne.

### 5.2 Tests
- Integracyjne: create root → add children → reparent → collapse/expand → undo/redo → export/readback.
- Regression: duża mapa (stress) → selection/navigation stabilne; brak “znikających” gałęzi.
- Contract tests: AI proposal payload → preview → accept/reject → state spójny.

### 5.3 Staging proof checklist
- Demo: manual build (od zera) + reorganizacja gałęzi + export/readback.
- Demo: AI “zrób mindmap z briefu” → preview → accept → dalsza ręczna edycja bez glitchy.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (readiness/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P12-A — Calm interaction canon + scope approval
- **Goal**: calm core loop (selection/navigation/branch ops), bez “Miro parity”.
- **Inputs required**: decyzje o minimalnym toolbelt + branch-state semantics.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “what changed” cues spisane.
- **Evidence**: scope approval + linkowane benchmarki.

#### P12-B — Builder toolbelt + state trust closure
- **Goal**: domknąć minimalny toolbelt + stabilny state/readback.
- **Acceptance**: duże mapy nie glitchują; AI proposals są reviewable (preview/diff).
- **Evidence**: stress/regression + staging demo (manual + AI).

#### P12-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

### 8.2 Rollout strategy
- Najpierw core loop + toolbelt, potem bounded collab cues (P1).

### 8.3 Rollback plan
- Wyłącz AI co-building; zachowaj odczyt i edycję manualną; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak spokojnego core loop (produkt nieużywalny).
- Ryzyko: brak “state trust” po operacjach (user traci orientację).
- Decyzje: minimalny zakres export/readback i jego semantyka.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P12-A |  |  |  |  |  |
| P12-B |  |  |  |  |  |
| P12-C |  |  |  |  |  |

