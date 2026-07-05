# M07 F5a — Edge UX (Lucidchart-grade) — QA run 2026-07-04

Wykonawca: Opus (F5a). Gałąź `feat/m07-finisz` (worktree `agent-a4140c9776c425306`).

## Zakres zrealizowany (F5a)

- **A1 — Routing ortogonalny + waypointy.** Nowa czysta, DOM-free funkcja
  `routeOrthogonal(source, target, { waypoints, sourceBox, targetBox, offset })`
  w `src/components/MyWork/processflow/edgeRouting.ts` (L/Z-routing z mid-gutterem
  i odsunięciem od bbox). `FlowEdgeComponent` renderuje ścieżkę ortogonalną, gdy
  `data.orthogonal===true` lub gdy istnieją waypointy; w przeciwnym razie zostaje
  domyślny smooth-step (zero regresji istniejących przepływów). Waypointy: dodanie
  przez double-click na krawędzi, przeciąganie uchwytu, usuwanie przez double-click
  uchwytu; zapis w `edge.data.waypoints[]` — persystencja przez istniejący blob
  (warstwa zapisu F4 NIETKNIĘTA).
- **A2 — Typy krawędzi.** `data.edgeKind ∈ {sequence, conditional, message}` jako
  wariant `FlowEdgeComponent` (message = statyczna kreskowana; sequence/conditional
  = animowana). NIE przywrócono usuniętego osobnego `MessageFlowEdge`. Selektor typu
  + przełącznik routingu ortogonalnego dodane do `ProcessFlowPropertiesPanel` (PL/EN).
- **A3 — Lane resize/collapse.** Stan w `lanes[].{collapsed,width,height}`
  (rozszerzony typ `Lane`). Pure reducer `laneState.ts` (toggle/setHeight/layout/
  visibility). Nagłówek toru ma ikonę collapse (chevron) w `LaneSystem`; dolna
  krawędź pasa = uchwyt zmiany wysokości (pointer-drag). Zwinięty tor chowa swoje
  węzły (`displayNodes` filtruje przez `isNodeInCollapsedLane`) i kurczy pasmo.

## ZRZUTY — brak (uczciwe odnotowanie)

Nie dostarczono żywych zrzutów. Powód: worktree nie ma własnego bezpiecznego
środowiska dev, a root `.env.local` (`DATABASE_URL`) celuje w PROD **centerbeam**
(`centerbeam.proxy.rlwy.net`). Zgodnie z regułą "Prod caution" oraz zleceniem
NIE uruchamiano serwera, który podłączyłby backend do produkcji. Brak `launch.json`
w worktree. Preview innej sesji działa na innym folderze i nie odwzorowuje tych
zmian.

**Dowód zastępczy = testy jednostkowe renderu/logiki (zielone):**
- `tests/unit/mywork/edgeRouting.test.ts` — 12/12: L/Z, straight H/V, waypointy
  (kolejność + zachowanie wierzchołka), determinizm, clearance bbox, helpery.
- `tests/unit/mywork/laneState.test.ts` — 17/17: collapse toggle (immutable),
  setHeight (clamp/round/izolacja), layout kumulacyjny z collapse/resize,
  widoczność węzła w zwiniętym torze.

Pełny pakiet `tests/unit/mywork/` + `processflow/`: **208 passed**; jedyny
niepowodzenie na poziomie *suite* = `myWorkMainContentLayout.test.ts`
(resolucja `highlight.js/lib/core` — znany, niezwiązany z F5a).

`npm run type-check`: 0 NOWYCH błędów w M07/processflow; 8 błędów pre-istniejących
poza zakresem (Economics x4, InitiativesHub, IdeaRecommendationMap x2,
NotebookContent) — bez zmian względem bazy F4.

## Do żywej weryfikacji (bramka R6 u Piotra)

Zrzuty do zrobienia na bezpiecznym środowisku (staging/local non-prod):
krawędź ortogonalna z waypointem; 3 typy krawędzi obok siebie; tor zwinięty
i rozwinięty; przełącznik routingu w panelu właściwości.
