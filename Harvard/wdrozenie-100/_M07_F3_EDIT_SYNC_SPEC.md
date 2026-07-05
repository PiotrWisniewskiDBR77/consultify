# M07 F3 — SPEC: Realtime edit-sync dla Process Flow
**Autor logiki:** Fable 5 (orkiestrator M07) · 2026-07-04 · **Wykonawca:** agent Opus (fala F3)
**Wsad:** dossier kontraktowe collab (zwiad F3-grunt 2026-07-04) · Baza: gałąź `feat/m07-finisz` (po F1)

## Kontekst i ustalenia wiążące
- Jedyny działający wzorzec E2E: **Whiteboard** (`src/components/MyWork/whiteboard/useWhiteboardCollab.ts`) — send + apply + echo-guard `applyingRemoteRef` + dedup po id + selektywna emisja (position tylko przy `dragging === false`). Mind Map NIE jest wzorcem (jego `broadcastGraphPatch` ma 0 call-sites — martwy).
- Serwer (`server/src/gateways/ideaCollabWs.gateway.ts:527-551`) relayuje `operations` 1:1 bez walidacji → można bezpiecznie rozszerzyć słownik operacji, konsumentem będzie tylko Process Flow (pokój = ideaId, a idea PF renderuje się tylko w PF).
- Kanał WS i autosave REST (`useIdeaMapSync`, `baseVersion`/409/`globalIdeaVersions`) są rozprzęgnięte — projekt musi jawnie zarządzać stykiem.
- Mechanizmu full-sync NIE używamy (martwy end-to-end; peer-relay bez fallbacku do DB). Źródłem prawdy przy dołączeniu pozostaje hydratacja REST (`GET /my-ideas/:id/map`).

## Architektura: hook `useProcessFlowCollab`
Nowy plik `src/components/MyWork/processflow/useProcessFlowCollab.ts`, wzorowany 1:1 na `useWhiteboardCollab`, z rozszerzeniami PF. Sygnatura:
```ts
useProcessFlowCollab({ currentUserId, setNodes, setEdges, setLanes, markRemoteChange }): {
  registerCollabSend,            // → CollaborationOverlay onRegisterSend
  applyingRemoteRef,             // echo-guard
  broadcastNodeChanges,          // z onNodesChange: update_node TYLKO na dragging===false; remove_node
  broadcastEdgeChanges,          // remove_edge
  broadcastNodeAdd, broadcastNodeUpdate, broadcastEdgeAdd, broadcastEdgeUpdate,
  broadcastLanes,                // NOWE: op 'update_lanes'
  broadcastSnapshot,             // NOWE: op 'graph_snapshot'
  onSessionState,                // → CollaborationOverlay onSessionStateChange (locki)
  lockedByOthers: Set<nodeId>,
}
```

## Słownik operacji (rozszerzenie kontraktu graph_patch)
Istniejące (jak Whiteboard): `add_node`, `remove_node`, `update_node`, `add_edge`, `remove_edge`, `update_edge`.
Nowe, PF-only:
1. **`update_lanes`** — `data: { lanes: Lane[] }` — pełna podmiana tablicy lanes (lanes są małe; pełna podmiana = idempotencja i brak konfliktów porządku). Zmiany `laneId` dotkniętych węzłów (np. przy delete lane) jadą w TYM SAMYM patchu jako `update_node[]` — jeden batch = spójny stan.
2. **`graph_snapshot`** — `data: { nodes, edges, lanes }` — pełna podmiana stanu. Używany dla operacji masowych: **undo/redo** (przywraca cały snapshot), **dagre auto-layout** (zmienia pozycje wszystkich węzłów), **AI-apply** (batch propozycji). Zasada progu: operacja dotykająca > 10 węzłów lub nie-diffowalna → `graph_snapshot`; inaczej operacje granularne.

## Mapowanie handlerów PF → emisja (IdeaProcessFlowTool.tsx)
| Handler (linie wg stanu przed F1 — zweryfikuj po F1) | Emisja |
|---|---|
| `onNodesChange` :842 (position po zakończeniu drag; cross-lane drag → laneId w data) | `update_node` |
| `onNodesChange` remove / `deleteSelected` | `remove_node[]` (+`remove_edge[]` dotkniętych) |
| `onConnect` :1053 | `add_edge` |
| `addNode` :1078, `acceptGhostNode` :1578 | `add_node` |
| `handleEdgeLabelChange` :757, `handleEdgeConditionChange` :770 | `update_edge` |
| `insertBetween` :1190, `splitPath` :1250 | batch: `add_node`+`remove_edge`+`add_edge[]` |
| `handleSaveMetrics` :1349 | `update_node` |
| lane ops (`addLane` :1303, rename/delete/color/reorder w `useProcessFlowNodes.ts:116-193`) | `update_lanes` (+`update_node[]` przy delete) |
| `duplicateSelected` | `add_node[]`+`add_edge[]` |
| `undo`/`redo`, `handleAutoLayout` :1494, AI-apply | `graph_snapshot` |

## Odbiór (handler `idea-collab-graph-patch`)
- Podwójny echo-guard: filtr `detail.userId === currentUser.id` ORAZ `applyingRemoteRef` na czas aplikacji.
- Idempotencja jak Whiteboard: `add_*` z dedupem po id; `update_*` merge po id; `remove_*` filter.
- `update_lanes`: `setLanes(data.lanes)`. `graph_snapshot`: pełna podmiana nodes/edges/lanes + **push do undo-stacka jako pojedynczy krok** (żeby lokalny użytkownik mógł cofnąć cudzą masową zmianę świadomie — bez tego undo po cudzym snapshotcie robi chaos).

## Styk z autosave (decyzja wiążąca)
**Zdalny patch NIE triggeruje autosave odbiorcy.** Autor zmiany sam ją persystuje przez swój `useIdeaMapSync`. Implementacja: `lastChangeOriginRef: 'local' | 'remote'` — handler odbioru ustawia `'remote'` przed mutacją stanu; efekt `queueSync` (obecnie :1626-1629) pomija sync gdy origin `'remote'` i resetuje do `'local'`. Bez tego dwóch klientów dubluje zapisy pod rozjechanymi `baseVersion` (self-heal 409 to złagodzi, ale nie ma powodu generować konfliktów).
Znane ograniczenie (akceptowane w v1, odnotować w kodzie): jeśli odbiorca po cudzym patchu zrobi własną edycję, jego autosave wyśle stan łączony pod swoim `baseVersion` — to zgodne z semantyką last-writer-wins bloba i identyczne z zachowaniem Whiteboard.

## Locki (miękkie)
`onSessionStateChange` przestaje być no-opem: trzymaj `lockedByOthers = Set(nodeId)` (z `sessionState.lockedNodes` minus własne). Węzeł zablokowany przez innego: `draggable: false`, blokada edycji etykiety/metryk, wizualnie subtelna obwódka + avatar (kolorystyka wyłącznie tokenami `var(--c-*)`; ZERO nowych kolorów — protokół akceptacji wizualnej Piotra). Serwer locków nie egzekwuje przy `graph_patch` (advisory) — to świadomie akceptowane.

## Obsługa błędów kanału
- `error/DEMO_READ_ONLY` → nie emituj patchy (tryb read-only demo), UI bez zmian (edycja lokalna i tak jest zablokowana `locked`).
- `close(4403)` / reconnect → po odzyskaniu połączenia NIE rób full-sync przez WS; wykonaj re-hydratację REST (`GET /map`) tylko jeśli `lastActivity` innych userów wskazuje aktywność w czasie rozłączenia — w v1 wystarczy prosty re-fetch po reconnect.

## Testy (obowiązkowe, w tests/ z git add -f)
1. `tests/unit/mywork/processFlowCollab.test.ts`: budowa patchy per handler (w tym batch insertBetween), echo-guard, dedup/idempotencja, update_lanes z reassignmentem laneId, graph_snapshot + undo-step, suppression autosave przy origin remote.
2. Rozszerzyć `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` o relay `update_lanes`/`graph_snapshot` (serwer przekazuje 1:1).
3. E2E dwuklienckie (Playwright, wzór z m09/multiplayer): klient A dodaje węzeł → widzi go klient B; lane rename propaguje; undo A propaguje snapshot do B.

## Poza zakresem F3 (nie ruszać)
- Naprawa martwego `broadcastGraphPatch` Mind Mapy (własność agenta M06 — zasygnalizowane orkiestratorowi nadrzędnemu).
- Egzekwowanie locków po stronie serwera, walidacja operations na gatewayu, CRDT/OT — świadomie poza v1.
- P5 (migracja na externalRuntime) — osobna fala, PO F3.
