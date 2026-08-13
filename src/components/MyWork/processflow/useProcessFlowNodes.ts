/**
 * useProcessFlowNodes — Extracted node CRUD, lane management, and selection
 * for the Process Flow component.
 */
import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

import type { LaneOpOutcome } from '@/actions/quickActionAck';
import i18n from '@/i18n';

import {
  checkProcessFlowNodeCap,
  PROCESS_FLOW_NODE_LIMIT,
  PROCESS_FLOW_NODE_WARN_THRESHOLD,
} from './nodeCap';

/**
 * `isPl` is threaded explicitly through this hook's opts (same pattern as
 * `useProcessFlowAIProposal.ts`'s `tr()`), not read from global i18next
 * state, so the message language stays deterministic per-call.
 */
function tr(isPl: boolean, key: string, defaultValue: string, vars?: Record<string, unknown>): string {
  return i18n.t(`myWorkIdeas.processFlowTool.${key}`, defaultValue, {
    lng: isPl ? 'pl' : 'en',
    ...vars,
  });
}

export interface Lane {
  id: string;
  label: string;
  color: string;
  /** F5a A3: swimlane collapsed — its nodes are hidden and the band shrinks. */
  collapsed?: boolean;
  /** F5a A3: user-resized lane band height (px). Falls back to LANE_HEIGHT. */
  height?: number;
  /** F5a A3: reserved for horizontal lane sizing (vertical-lane layouts). */
  width?: number;
}

export interface UseProcessFlowNodesOpts {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  lanes: Lane[];
  setLanes: React.Dispatch<React.SetStateAction<Lane[]>>;
  locked: boolean;
  isPl: boolean;
  pushUndo: () => void;
  onNodeDetail?: ((nodeId: string, data: any) => void) | undefined;
  /**
   * Optional callback fired with the ids of deleted nodes. Previously wired
   * to useProcessFlowCRUD (V8 mirror persistence); that hook was removed as
   * dead code (M07/F1, DP-7) since the V8 process-flow routes were cut. Kept
   * as a generic extension point — no current caller passes it.
   */
  onNodesDeleted?: ((nodeIds: string[]) => void) | undefined;
  /** Injected confirm for bulk deletes (≥2 nodes). Returns true = proceed. */
  confirmBulkDelete?: (count: number) => Promise<boolean>;
  /**
   * G4-LANE-DELETE (2026-08-10/11): fired when `handleLaneDelete` REFUSES —
   * currently only the last-remaining-lane case — instead of silently doing
   * nothing. Previously `if (locked || lanes.length <= 1) return;` was the
   * whole guard: no toast, no signal, nothing (`useProcessFlowNodes.ts:293`,
   * flagged as a known gap in `idea.lane.pf_delete`'s Teresa description in
   * `processFlowActions.ts`). The UI delete button is hidden once
   * `laneCount <= 1` (`LaneSystem.tsx:287`), so a human never hits this path
   * — but Teresa's Action Registry receiver (`deleteLane` on the
   * `idea-workspace-quick-action` bus, `useProcessFlowQuickActions.ts:337-339`)
   * calls this handler directly with an explicit `laneId` and got a false
   * `{ ok: true }` back with zero effect. Caller (`IdeaProcessFlowTool.tsx`)
   * shows this via `toast.error` with a real i18n key
   * (`myWorkIdeas.processFlowTool.cannotDeleteLastLane`) — kept as an
   * injected callback (same shape as `confirmBulkDelete` above) so this hook
   * stays free of `useTranslation`.
   */
  onLaneDeleteBlocked?: (laneId: string) => void;
  /**
   * M07 F3 realtime emission. Optional so this hook stays usable without a
   * collab layer (tests, single-user). Each fires AFTER local state is set.
   */
  collab?: {
    broadcastNodeRemove?: (ids: string[]) => void;
    broadcastEdgeRemove?: (ids: string[]) => void;
    broadcastOps?: (ops: Array<{ op: string; data: any }>) => void;
    broadcastLanes?: (lanes: Lane[], nodeUpdates?: Node[]) => void;
  };
}

export function useProcessFlowNodes(opts: UseProcessFlowNodesOpts) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    lanes,
    setLanes,
    locked,
    isPl,
    pushUndo,
    onNodeDetail,
    onNodesDeleted,
    confirmBulkDelete,
    onLaneDeleteBlocked,
    collab,
  } = opts;

  // G4-PF-GUARDRAIL: node-count cap, checked before paste/duplicate mutate
  // `nodes`. Mirrors the guard in IdeaProcessFlowTool.tsx (same nodeCap.ts
  // decision function) — see that file's own comment for the full
  // rationale. Checks the RESULTING count so a large paste/duplicate can't
  // land past the ceiling in one step.
  const guardAddNodes = useCallback(
    (addCount: number): boolean => {
      const cap = checkProcessFlowNodeCap(nodes.length, addCount);
      if (!cap.allowed) {
        toast.error(
          tr(
            isPl,
            'nodeLimitReached',
            `Step limit reached (${PROCESS_FLOW_NODE_LIMIT} maximum). Please delete some steps or split the process into multiple flows.`,
            { limit: PROCESS_FLOW_NODE_LIMIT }
          ),
          { duration: 3000 }
        );
        return false;
      }
      if (cap.shouldWarn) {
        toast(
          tr(
            isPl,
            'nodeLimitWarning',
            `You are approaching the step limit (${PROCESS_FLOW_NODE_WARN_THRESHOLD} steps). Consider splitting into multiple flows.`,
            { warn: PROCESS_FLOW_NODE_WARN_THRESHOLD }
          ),
          { icon: '⚠️', duration: 3000 }
        );
      }
      return true;
    },
    [nodes, isPl]
  );

  const deleteSelected = useCallback(async () => {
    if (locked) return;
    // P1-4: liczylo WYLACZNIE wezly, wiec przy zaznaczonej samej krawedzi
    // funkcja wychodzila na `selectedCount === 0` i Delete nie robil NIC —
    // cichy brak reakcji na widocznej akcji. Krawedz to tez element.
    const zaznaczoneWezly = nodes.filter((n: Node) => n.selected).length;
    const zaznaczoneKrawedzie = edges.filter((e: Edge) => e.selected).length;
    const selectedCount = zaznaczoneWezly + zaznaczoneKrawedzie;
    if (selectedCount === 0) return;
    if (selectedCount >= 2 && confirmBulkDelete) {
      const ok = await confirmBulkDelete(selectedCount);
      if (!ok) return;
    }
    pushUndo();
    let removedNodeIds: Set<string>;
    setNodes((prev: Node[]) => {
      removedNodeIds = new Set(prev.filter((n: Node) => n.selected).map((n: Node) => n.id));
      if (removedNodeIds.size) onNodesDeleted?.(Array.from(removedNodeIds));
      return prev.filter((n: Node) => !n.selected);
    });
    const removedEdgeIds: string[] = [];
    setEdges((prev: Edge[]) =>
      prev.filter((e: Edge) => {
        const keep =
          !e.selected && !removedNodeIds!.has(e.source) && !removedNodeIds!.has(e.target);
        if (!keep) removedEdgeIds.push(e.id);
        return keep;
      })
    );
    // F3: emit removed edges then nodes as one batch (edges first so peers drop
    // dangling connectors before their endpoints disappear).
    const removedNodeIdList = Array.from(removedNodeIds!);
    if (removedEdgeIds.length > 0 || removedNodeIdList.length > 0) {
      collab?.broadcastOps?.([
        ...removedEdgeIds.map((id) => ({ op: 'remove_edge', data: { id } })),
        ...removedNodeIdList.map((id) => ({ op: 'remove_node', data: { id } })),
      ]);
    }
  }, [
    locked,
    nodes,
    edges,
    confirmBulkDelete,
    onNodesDeleted,
    pushUndo,
    setEdges,
    setNodes,
    collab,
  ]);

  /**
   * Wkleja podane wezly (z krawedziami miedzy nimi) jako NOWE elementy.
   * Wspolna mechanika dla „Duplikuj" i „Wklej" — rozni je tylko zrodlo:
   * duplikat bierze aktualne zaznaczenie, wklejenie bierze schowek.
   */
  const wstawKopie = useCallback(
    (zrodloweWezly: Node[], zrodloweKrawedzie: Edge[], przesuniecie: { x: number; y: number }) => {
      if (locked) return;
      if (zrodloweWezly.length === 0) return;
      if (!guardAddNodes(zrodloweWezly.length)) return;
      pushUndo();

      const idMap = new Map<string, string>();
      const zrodloweId = new Set(zrodloweWezly.map((node) => node.id));

      const newNodes: Node[] = zrodloweWezly.map((n) => {
        const newId = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          position: { x: n.position.x + przesuniecie.x, y: n.position.y + przesuniecie.y },
          selected: false,
          data: {
            ...n.data,
            onLabelChange: (next: string) => {
              setNodes((nds: Node[]) =>
                nds.map((nd: Node) =>
                  nd.id === newId ? { ...nd, data: { ...nd.data, label: next } } : nd
                )
              );
            },
            onNodeDetail: onNodeDetail || undefined,
          },
        };
      });

      const newEdges: Edge[] = zrodloweKrawedzie
        .filter((edge) => zrodloweId.has(edge.source) && zrodloweId.has(edge.target))
        .map((edge) => ({
          ...edge,
          id: `pf-edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
          selected: false,
        }));

      setNodes((prev) => [...prev, ...newNodes]);
      if (newEdges.length > 0) setEdges((prev) => [...prev, ...newEdges]);
      collab?.broadcastOps?.([
        ...newNodes.map((n) => ({ op: 'add_node', data: n })),
        ...newEdges.map((e) => ({ op: 'add_edge', data: e })),
      ]);
    },
    [locked, guardAddNodes, onNodeDetail, pushUndo, setEdges, setNodes, collab]
  );

  /**
   * Schowek narzedzia. Trzymany w ref, bo ma przezyc rerender, ale NIE ma byc
   * stanem — jego zmiana niczego nie przerysowuje.
   */
  const schowekRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });

  /**
   * Kopiuje podany zbior wezlow do schowka. Zwraca ich liczbe.
   * Wspolny rdzen dla „kopiuj zaznaczenie" i „kopiuj wezel spod menu".
   */
  const kopiujWezly = useCallback(
    (doKopiowania: Node[]) => {
      if (doKopiowania.length === 0) return 0;
      const ids = new Set(doKopiowania.map((n) => n.id));
      schowekRef.current = {
        nodes: doKopiowania.map((n) => ({ ...n, selected: false })),
        edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
      };
      return doKopiowania.length;
    },
    [edges]
  );

  const copySelected = useCallback(
    () => kopiujWezly(nodes.filter((n) => n.selected)),
    [kopiujWezly, nodes]
  );

  /**
   * Kopiuje konkretny wezel po id — dla menu kontekstowego, ktore otwiera sie na
   * wezle BEZ zaznaczania go (prawy klik nie zaznacza). Bez tego „Kopiuj" w menu
   * elementu kopiowalo puste zaznaczenie i schowek zostawal pusty.
   */
  const copyNodeById = useCallback(
    (nodeId: string) => {
      const wezel = nodes.find((n) => n.id === nodeId);
      return wezel ? kopiujWezly([wezel]) : 0;
    },
    [kopiujWezly, nodes]
  );

  /** Ile elementow czeka w schowku — powierzchnie pytaja o to, zeby wyszarzyc „Wklej". */
  const clipboardCount = useCallback(() => schowekRef.current.nodes.length, []);

  const pasteClipboard = useCallback(() => {
    const { nodes: skopiowane, edges: skopiowaneKrawedzie } = schowekRef.current;
    if (skopiowane.length === 0) return 0;
    wstawKopie(skopiowane, skopiowaneKrawedzie, { x: 40, y: 40 });
    return skopiowane.length;
  }, [wstawKopie]);

  const duplicateSelected = useCallback(() => {
    if (locked) return;
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    if (!guardAddNodes(selected.length)) return;
    pushUndo();

    const idMap = new Map<string, string>();
    const selectedIds = new Set(selected.map((node) => node.id));

    const newNodes: Node[] = selected.map((n) => {
      const newId = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        selected: false,
        data: {
          ...n.data,
          onLabelChange: (next: string) => {
            setNodes((nds: Node[]) =>
              nds.map((nd: Node) =>
                nd.id === newId ? { ...nd, data: { ...nd.data, label: next } } : nd
              )
            );
          },
          onNodeDetail: onNodeDetail || undefined,
        },
      };
    });
    const newEdges: Edge[] = edges
      .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
      .map((edge) => ({
        ...edge,
        id: `pf-edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
        selected: false,
      }));

    setNodes((prev) => [...prev, ...newNodes]);
    if (newEdges.length > 0) {
      setEdges((prev) => [...prev, ...newEdges]);
    }
    // F3: emit the duplicated nodes + edges as one batch.
    collab?.broadcastOps?.([
      ...newNodes.map((n) => ({ op: 'add_node', data: n })),
      ...newEdges.map((e) => ({ op: 'add_edge', data: e })),
    ]);
  }, [edges, guardAddNodes, locked, nodes, onNodeDetail, pushUndo, setEdges, setNodes, collab]);

  // ── RISK-30 (S5-TERESA, 2026-08-12): tory raportują WYNIK ────────────────
  // Wszystkie handlery toru zwracają dziś `LaneOpOutcome` zamiast `void`.
  // Powód: każdy z nich miał ciche `return` (blokada, ostatni tor, nieznany
  // `laneId`, tor już skrajny), a rejestr akcji — nie widząc ich — meldował
  // Teresie sukces operacji, która się nie odbyła (RISK-30). Zwrócona
  // wartość wraca szyną potwierdzeń do `runLaneParamCallback`.
  //
  // Decyzje mechaniczne przy tej zmianie:
  //  • Odmowę wyliczamy z DOMKNIĘCIA `lanes`, nie ze środka `setLanes(prev
  //    => …)`. Aktualizator biegnie w fazie renderu, więc jego wynik nie
  //    może zdążyć na `return` — a wynik wyliczony gdzie indziej niż
  //    wykonana mutacja to znowu „raport bez pokrycia". Dlatego decyzja I
  //    zapis czytają JEDNO źródło (`lanes`), dokładnie jak `handleLaneDelete`
  //    robił to już wcześniej. Ryzyko nieaktualnego domknięcia = to samo, co
  //    `handleLaneDelete` niósł od 2026-08-10, nie nowe.
  //  • `collab?.broadcastLanes?.()` wychodzi POZA aktualizator stanu (był
  //    efektem ubocznym w funkcji czystej — w StrictMode mógł nadać dwa razy).
  //  • Sygnatury propów w `LaneSystem.tsx` (`onRename`/`onDelete`/…) są typu
  //    `=> void`; TypeScript przyjmuje funkcję zwracającą wartość tam, gdzie
  //    oczekiwany jest `void`, więc KOMPONENT I TOAST SĄ NIETKNIĘTE.
  const handleLaneRename = useCallback(
    (laneId: string, next: string): LaneOpOutcome => {
      if (locked) return { ok: false, reason: 'locked' };
      if (!lanes.some((l) => l.id === laneId)) return { ok: false, reason: 'unknown_lane' };
      pushUndo();
      setLanes((prev: Lane[]) => {
        const nextLanes = prev.map((l: Lane) => (l.id === laneId ? { ...l, label: next } : l));
        collab?.broadcastLanes?.(nextLanes);
        return nextLanes;
      });
      return { ok: true };
    },
    [locked, lanes, pushUndo, setLanes, collab]
  );

  const handleLaneDelete = useCallback(
    (laneId: string): LaneOpOutcome => {
      if (locked) return { ok: false, reason: 'locked' };
      // G4-LANE-DELETE: the last remaining lane can't be deleted (a Process
      // Flow with zero lanes is not a valid state — there'd be nowhere for
      // existing/new nodes to live). REFUSE VISIBLY instead of the previous
      // silent `return` — the UI already hides the delete button in this
      // state (`LaneSystem.tsx:287`, `laneCount > 1`), but Teresa's Action
      // Registry receiver can still call this handler directly with an
      // explicit `laneId` and must not get a false "done".
      //
      // RISK-30: kolejność sprawdzeń CELOWO zostawiona bez zmian — „ostatni
      // tor" PRZED „nieznany tor". Gdyby odwrócić, wywołanie z nieistniejącym
      // `laneId` przy jednym torze przestałoby pokazywać toast, który dziś
      // pokazuje. Odmowa i tak nie jest sukcesem, więc nic nie tracimy.
      if (lanes.length <= 1) {
        onLaneDeleteBlocked?.(laneId);
        return { ok: false, reason: 'last_lane' };
      }
      if (!lanes.some((l) => l.id === laneId)) return { ok: false, reason: 'unknown_lane' };
      pushUndo();
      const fallbackLane = lanes.find((l) => l.id !== laneId) || lanes[0];
      const reassigned: Node[] = [];
      setNodes((prev) =>
        prev.map((n) => {
          if (n.data?.laneId !== laneId) return n;
          const nextNode = {
            ...n,
            data: {
              ...n.data,
              laneId: fallbackLane.id,
              laneColor: fallbackLane.color,
            },
          };
          reassigned.push(nextNode);
          return nextNode;
        })
      );
      const nextLanes = lanes.filter((l) => l.id !== laneId);
      setLanes(nextLanes);
      // F3: lane removal + node reassignment as ONE batch (update_lanes carries
      // the new Lane[]; the reassigned nodes ride as update_node[]).
      collab?.broadcastLanes?.(nextLanes, reassigned);
      return { ok: true };
    },
    [locked, lanes, pushUndo, setLanes, setNodes, collab, onLaneDeleteBlocked]
  );

  const handleLaneColorChange = useCallback(
    (laneId: string, color: string): LaneOpOutcome => {
      if (locked) return { ok: false, reason: 'locked' };
      if (!lanes.some((l) => l.id === laneId)) return { ok: false, reason: 'unknown_lane' };
      pushUndo();
      const recolored: Node[] = [];
      let nextLanes: Lane[] = lanes;
      setLanes((prev) => {
        nextLanes = prev.map((l) => (l.id === laneId ? { ...l, color } : l));
        return nextLanes;
      });
      setNodes((prev) =>
        prev.map((n) => {
          if (n.data?.laneId !== laneId) return n;
          const nextNode = { ...n, data: { ...n.data, laneColor: color } };
          recolored.push(nextNode);
          return nextNode;
        })
      );
      // F3: lane color + affected node laneColor as one batch.
      collab?.broadcastLanes?.(nextLanes, recolored);
      return { ok: true };
    },
    [locked, lanes, pushUndo, setLanes, setNodes, collab]
  );

  const handleLaneMoveUp = useCallback(
    (laneId: string): LaneOpOutcome => {
      if (locked) return { ok: false, reason: 'locked' };
      const idx = lanes.findIndex((l) => l.id === laneId);
      if (idx < 0) return { ok: false, reason: 'unknown_lane' };
      if (idx === 0) return { ok: false, reason: 'already_first' };
      pushUndo();
      const next = [...lanes];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      setLanes(next);
      collab?.broadcastLanes?.(next);
      return { ok: true };
    },
    [locked, lanes, pushUndo, setLanes, collab]
  );

  const handleLaneMoveDown = useCallback(
    (laneId: string): LaneOpOutcome => {
      if (locked) return { ok: false, reason: 'locked' };
      const idx = lanes.findIndex((l) => l.id === laneId);
      if (idx < 0) return { ok: false, reason: 'unknown_lane' };
      if (idx >= lanes.length - 1) return { ok: false, reason: 'already_last' };
      pushUndo();
      const next = [...lanes];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setLanes(next);
      collab?.broadcastLanes?.(next);
      return { ok: true };
    },
    [locked, lanes, pushUndo, setLanes, collab]
  );

  return {
    deleteSelected,
    duplicateSelected,
    copySelected,
    copyNodeById,
    pasteClipboard,
    clipboardCount,
    handleLaneRename,
    handleLaneDelete,
    handleLaneColorChange,
    handleLaneMoveUp,
    handleLaneMoveDown,
  };
}
