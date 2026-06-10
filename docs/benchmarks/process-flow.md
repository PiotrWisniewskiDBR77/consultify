---
brief: process-flow
module: Ideas → Process Flow
sources: [developer.lucid.co (scrape 2026-03, SDK reference), Mermaid (mermaid.js.org, 2026-03), BPMN.io/Camunda (2026-03), draw.io/diagrams.net (2026-03), Microsoft Visio]
status: done
updated: 2026-06-09
---

# Benchmark: Process Flow (Ideas)

> Po co: ustalić feature-surface i model danych naszego Process Flow wobec liderów
> diagramowania procesów (Lucid, Visio, draw.io) i standardów (BPMN/Mermaid), żeby
> zbudować edytor flow/swimlane z auto-layoutem i AI-generacją — bez wynajdywania koła
> i spójny z modelem bindingów z `whiteboard.md` §3.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Lucidchart** | Enterprise diagramming + data-backed shapes, SDK/extensions | **Data-backed shapes** (kształt sterowany danymi) + **import z Mermaid** + auto-layout + BPMN library |
| **Mermaid** | Diagram-as-code, tekstowy DSL, open-source | „Diagram z tekstu" — `graph TD`, `flowchart`, `sequenceDiagram`; deterministyczny, wersjonowalny, idealny do AI-generacji |
| **BPMN.io / Camunda** | Standard BPMN 2.0, edytor + silnik wykonawczy | Pełna zgodność z **BPMN 2.0 XML** + bpmn-js (embeddable) + wykonywalne procesy (Zeebe) |
| **draw.io / diagrams.net** | Darmowy, uniwersalny edytor diagramów (mxGraph) | Bogate biblioteki kształtów + format **mxGraph XML**, zero-lock-in, embeddable |
| **Microsoft Visio** | Korporacyjny standard schematów, stencils | Stencils/master shapes + connection points + data-linked diagrams (Excel/Azure) |

Wniosek strategiczny: **Mermaid to nasz wzorzec warstwy AI/„diagram z tekstu"** (Teresa generuje DSL → render), **Lucid to wzorzec UX + modelu danych** (node/edge + data-backed shapes + extensions), **BPMN 2.0 to wzorzec semantyki procesu** (events/tasks/gateways/lanes), **draw.io/Visio to wzorzec biblioteki kształtów + connection points**.

## 2. Wzorce UX / IA (co działa)
Zrzuty produktowe **niedostępne** — podkatalogi `Softs/0 Diagramy/Lucid/.../docs` i `.../reference` oraz zipy w `0 Miro/added` są zablokowane przez macOS TCC po wstępnej inwentaryzacji (patrz Załączniki). Poniżej wzorce z mapy nav/SDK + wiedzy o narzędziach.

- **Diagram z tekstu (Mermaid):** użytkownik pisze `flowchart LR; A[Start]-->B{Decyzja}-->C[Koniec]` → natychmiastowy render → *dlaczego działa*: deterministyczne, wersjonowalne w git, generowalne przez LLM → *jak u nas*: Teresa zwraca Mermaid DSL, my renderujemy i pozwalamy „rozbić" na edytowalne node'y (jak Lucid `adddiagramfrommermaid`).
- **Auto-layout / re-flow:** Lucid/draw.io układają graf jednym kliknięciem (hierarchiczny, drzewo, ortogonalny) → *działa*, bo ręczne pozycjonowanie to 80% pracy → *u nas*: dagre/elkjs jako silnik layoutu po wygenerowaniu node'ów.
- **Swimlanes / pools (BPMN):** poziome/pionowe tory = kto wykonuje krok → *działa* dla procesów org → *u nas*: lane jako kontener-node, przypisany do roli/działu (mapuje na nasze role z RBAC).
- **Connection points / sticky edges (Visio, draw.io):** strzałka „przykleja się" do portu kształtu i podąża za nim → *działa* — to esencja diagramu procesu → *u nas*: **binding edge↔node** (ten sam model co `whiteboard.md` §3, nie luźne współrzędne).
- **Palette / shape library z kategoriami (BPMN, Visio stencils):** lewy panel z kształtami (event/task/gateway, flowchart standard) drag-na-kanwę → *u nas*: kuratorowany zestaw flowchart + BPMN-lite, nie 500 kształtów.
- **Quick-shape / proximity connect (Lucid):** najechanie na node pokazuje strzałki w 4 kierunkach → 1 klik tworzy połączony następny node → *najszybszy sposób budowy flow* → mocny kandydat do skopiowania.
- **Inline edycja etykiety + autosize:** dwuklik w node = edycja tekstu, node rośnie do treści → standard, must-have.

## 3. Model danych / architektura
Wspólny mianownik wszystkich pięciu narzędzi to **graf: node (kształt) + edge (połączenie)**, ale różnią się bogactwem:

- **Mermaid:** czysty tekstowy DSL → AST → SVG. Brak trwałego modelu obiektowego; źródłem prawdy jest *tekst*. → Dla nas: trzymać DSL jako jeden z reprezentacji (AI in/out, eksport), ale **nie jako SSOT edytora**.
- **BPMN 2.0:** XML z semantyką — `<task>`, `<exclusiveGateway>`, `<sequenceFlow>`, `<laneSet>`/`<lane>`, `<startEvent>`/`<endEvent>`. Każdy element ma typ semantyczny, nie tylko geometrię. → Dla nas: **typ semantyczny node'a** (krok / decyzja / start / koniec / podproces) to wartość — pozwala Teresie rozumować o procesie i liczyć metryki (liczba bramek, ścieżki).
- **draw.io (mxGraph):** `mxCell` z `vertex`/`edge`, `style` string, `mxGeometry`; edge ma `source`/`target` (id node'a) — twarde **bindingi po id**, nie po pozycji. → Dokładnie wzorzec, którego chcemy.
- **Lucid data-backed shapes:** kształt = widok na rekord danych (pola → tekst/kolor kształtu). SDK ma `data-backed-shapes`, `editor-extension-blocks/panels`, `adddiagramfrommermaid`, `application-collaborator-roles`. → Dla nas: node Process Flow może być **podpięty pod encję Consultify** (initiative/insight/process) — diagram jako żywy widok danych, nie martwy obrazek.

**Rekomendowany schemat (rekordowy, spójny z `whiteboard.md` §3):**
```
ProcessFlowDoc = store rekordów:
  Node { id, type: step|decision|start|end|subprocess|lane,
         label, x, y, w, h, style, dataRef?: {entity, id} }
  Edge { id, source: nodeId, target: nodeId, sourcePort?, targetPort?,
         label, kind: sequence|message|default }   // BINDING po id
  Lane { id, label, roleRef?, orientation }
```
→ Strzałki = bindingi po id (jak tldraw/draw.io), **nie** luźne współrzędne — inaczej padnie undo granularny, realtime-diff i auto-layout. Cały Ideas (Whiteboard / Process Flow / Mind Map / Table) dzieli ten model bindingów.

## 4. API / integracje (jeśli istotne)
- **Lucid Extension SDK** (z `reference/`): `editor-extensions`, `editor-extension-blocks`, `additionalpaneltabscallback`, `addmenuitem`, `addquickaction`, `addlinetextarea`, `adddiagramfrommermaid`, `access-scopes`, `application-collaborator-roles`. → Wzorzec: edytor jako platforma z **panelami/menu/quick-action rozszerzanymi przez kod** — tu wchodzi Teresa jako „blok" na kanwie (analogicznie do `AI integrations` z `whiteboard.md`).
- **Mermaid:** brak API serwerowego — biblioteka `mermaid` w przeglądarce (`mermaid.render`). Trywialne do osadzenia; ścieżka MVP dla AI-generacji.
- **BPMN:** `bpmn-js` (modeler/viewer) + import/eksport **BPMN 2.0 XML**; Camunda/Zeebe dla wykonania (poza naszym zakresem v1).
- **Eksport/import:** wszystkie liczą się z PNG/SVG + format natywny (Mermaid text, BPMN XML, mxGraph XML). → Dla nas: eksport SVG/PNG + Mermaid (round-trip z AI) na start; BPMN XML później.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy:** **„diagram z tekstu" (Mermaid)** jako warstwa AI — Teresa generuje/edytuje DSL, my renderujemy i pozwalamy rozbić na edytowalne node'y (wzorzec Lucid `adddiagramfrommermaid`). Najszybsza droga do AI-flow.
- ✅ **Kradniemy:** model **graf z bindingami po id** (draw.io/Visio sticky edges) + **typ semantyczny node'a** (BPMN) — spójny z `whiteboard.md` §3.
- ✅ **Kradniemy:** **auto-layout** (dagre/elkjs) + **proximity-connect / quick-shape** (Lucid) — to 80% szybkości budowy.
- ⚠️ **Adaptujemy:** **swimlanes/lanes** jako kontener-node przypięty do roli/działu (powiązanie z RBAC) — ale BPMN-lite, bez pełnej zgodności 2.0 w v1.
- ⚠️ **Adaptujemy:** **data-backed shapes** Lucid → node podpięty pod encję Consultify (initiative/insight/process) jako żywy widok; włączyć po ustabilizowaniu modelu danych.
- ❌ **Unikamy:** monolitycznego JSON-a całej kanwy (zabija undo/realtime) — j.w. w `whiteboard.md`.
- ❌ **Unikamy:** pełnej biblioteki 500+ kształtów Visio/draw.io — kuratorować zestaw (flowchart standard + BPMN-lite).
- ❌ **Unikamy:** czynienia Mermaid-text jedynym SSOT edytora — DSL to reprezentacja AI/eksport, nie model edycji (tekst gubi pozycje/style przy ręcznej pracy).

## 6. Otwarte pytania / do walidacji
- Silnik renderu: budujemy na wspólnym silniku Ideas (jak Whiteboard/tldraw) czy osobny graf-renderer (reactflow/elkjs)? Rozstrzygnąć łącznie z `whiteboard.md` (jeden pakiet bindingów dla całego Ideas).
- Zakres BPMN: BPMN-lite (5–6 typów node'a) wystarczy na v1, czy potrzebny round-trip BPMN 2.0 XML dla klientów enterprise?
- Auto-layout: dagre vs elkjs (elk lepszy dla swimlane/ortogonal, cięższy).
- Realtime: ten sam transport co reszta Ideas — patrz `realtime-collab.md` (Liveblocks vs tldraw-sync).
- Czy Mermaid round-trip (diagram → DSL → diagram) jest stabilny przy ręcznych edycjach pozycji, czy DSL tylko jako wejście?

## Załączniki
Surowe źródła (do usunięcia po akceptacji): `Softs/0 Diagramy/Lucid/` (developer.lucid.co — docs + reference SDK), `Softs/0 Miro/Mermaid.zip`, `Softs/0 Miro/added/{BPMN,camunda.,Drawio,Drawio 2,Visio,Lucid}.zip`.
**Uwaga (ograniczenie środowiska):** podkatalogi `Lucid/.../docs`, `.../reference` oraz zipy w `0 Miro/added` zostały **zablokowane przez macOS TCC po wstępnej inwentaryzacji** — odczyt treści/zrzutów niemożliwy w tej sesji. Brief oparty na: zinwentaryzowanej mapie nav + nazwach plików SDK Lucid (`data-backed-shapes`, `adddiagramfrommermaid`, `bpmn-shapes-reference`, `application-collaborator-roles`, `editor-extension-*`) + wiedzy o tych dobrze znanych narzędziach. **Zrzuty: brak (0)** — dociągnąć przy implementacji (lucidchart.com, mermaid.live, bpmn.io, app.diagrams.net).
