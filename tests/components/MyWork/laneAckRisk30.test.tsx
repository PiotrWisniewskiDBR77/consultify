/**
 * RISK-30 — POTWIERDZENIE SKORELOWANE dla akcji `scope: 'lane_frame'`
 * (S5-TERESA, 2026-08-12).
 *
 * CO DOWODZI TEN PLIK
 * `runLaneParamCallback` kończyło się BEZWARUNKOWYM `{ ok: true }`: dyspozycja
 * przez `window.dispatchEvent` jest wystrzel-i-zapomnij, więc rejestr nie miał
 * jak zobaczyć, że `handleLaneDelete` ODMÓWIŁ na jedynym pozostałym torze.
 * Człowiek widział poprawny toast z odmową, a odpowiedź Teresy brzmiała jak
 * sukces.
 *
 * DLACZEGO HANDLERY SĄ PRAWDZIWE, A NIE ZAMOCKOWANE
 * Pięć z sześciu operacji (rename · move_up · move_down · color · delete)
 * biegnie tutaj przez PRODUKCYJNY `useProcessFlowNodes`, nad prawdziwym stanem
 * `useState`. Mock zwracający `{ ok: true }` dowodziłby wyłącznie tego, że mock
 * zwraca to, co mu kazano — czyli dokładnie nic. Szósta (toggle_collapse)
 * mieszka w `IdeaProcessFlowTool.tsx`; jej odpowiednik w tym harnessie jest
 * WIERNYM ODWZOROWANIEM produkcyjnego ciała (ta sama kolejność sprawdzeń,
 * ta sama `toggleLaneCollapsed`) — zaznaczone wprost, bo to jedyne miejsce w
 * tym pliku, gdzie nie mierzymy produkcyjnej funkcji.
 */
import { act, render } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runIdeaAction, type ActionContext } from '@/actions/ideaActionRegistry';
import {
  deferQuickActionAck,
  pendingQuickActionAckCount,
  QUICK_ACTION_ACK_TIMEOUT_MS,
  type LaneOpOutcome,
} from '@/actions/quickActionAck';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { toggleLaneCollapsed } from '@/components/MyWork/processflow/laneState';
import {
  useProcessFlowNodes,
  type Lane,
} from '@/components/MyWork/processflow/useProcessFlowNodes';
import { useProcessFlowQuickActions } from '@/components/MyWork/processflow/useProcessFlowQuickActions';

const THREE_LANES: Lane[] = [
  { id: 'lane-1', label: 'Intake', color: '#e0e7ff' },
  { id: 'lane-2', label: 'Review', color: '#fee2e2' },
  { id: 'lane-3', label: 'Done', color: '#dcfce7' },
];

type Probe = {
  lanes: Lane[];
  blocked: string[];
};

const probe: Probe = { lanes: [], blocked: [] };

/**
 * Harness montuje PRODUKCYJNE hooki. `locked` i `initialLanes` sterują
 * scenariuszem; `onLaneDeleteBlocked` liczy odmowy, żeby udowodnić, że
 * ludzki kanał (toast) NIE ZNIKNĄŁ przy okazji naprawy kanału modelu.
 */
const Harness: React.FC<{ initialLanes: Lane[]; locked?: boolean }> = ({
  initialLanes,
  locked = false,
}) => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [lanes, setLanes] = useState<Lane[]>(initialLanes);

  probe.lanes = lanes;

  const laneHandlers = useProcessFlowNodes({
    nodes,
    edges,
    setNodes,
    setEdges,
    lanes,
    setLanes,
    locked,
    isPl: false,
    pushUndo: () => {},
    onLaneDeleteBlocked: (laneId: string) => {
      probe.blocked.push(laneId);
    },
  });

  // ODWZOROWANIE `handleLaneToggleCollapse` z `IdeaProcessFlowTool.tsx`
  // (jedyny z sześciu handlerów, który nie mieszka w `useProcessFlowNodes`).
  const toggleLaneCollapse = (laneId: string): LaneOpOutcome => {
    if (locked) return { ok: false, reason: 'locked' };
    if (!lanes.some((l) => l.id === laneId)) return { ok: false, reason: 'unknown_lane' };
    setLanes((prev) => toggleLaneCollapsed(prev, laneId));
    return { ok: true };
  };

  useProcessFlowQuickActions({
    open: true,
    ideaId: 'idea-1',
    isPl: false,
    nodes,
    handlers: {
      addNode: vi.fn(),
      insertAutomationTrigger: vi.fn(),
      addLane: vi.fn(),
      insertBetween: vi.fn(),
      splitPath: vi.fn(),
      deleteSelected: vi.fn(),
      duplicateSelected: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      openMetricsEditor: vi.fn(),
      runSavingsAnalysis: vi.fn(),
      createFromPrompt: vi.fn(),
      runProcessCoach: vi.fn(),
      renameLane: laneHandlers.handleLaneRename,
      moveLaneUp: laneHandlers.handleLaneMoveUp,
      moveLaneDown: laneHandlers.handleLaneMoveDown,
      setLaneColor: laneHandlers.handleLaneColorChange,
      toggleLaneCollapse,
      deleteLane: laneHandlers.handleLaneDelete,
    },
    setters: { setFlowMode: vi.fn(), setSemanticKit: vi.fn(), setNodes } as any,
  });

  return null;
};

function teresaCtx(params?: Record<string, unknown>): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'process_flow',
    selection: EMPTY_SELECTION,
    surface: 'panel',
    source: 'teresa',
    ...(params ? { params } : {}),
  };
}

/** Parametry wymagane przez poszczególne akcje (rename/color biorą drugi argument). */
const SIX_LANE_ACTIONS: Array<{ id: string; runtime: string; extra?: Record<string, unknown> }> = [
  { id: 'idea.lane.pf_rename', runtime: 'pf_lane_rename', extra: { label: 'Nowa nazwa' } },
  { id: 'idea.lane.pf_move_up', runtime: 'pf_lane_move_up' },
  { id: 'idea.lane.pf_move_down', runtime: 'pf_lane_move_down' },
  { id: 'idea.lane.pf_color', runtime: 'pf_lane_color', extra: { color: '#dbeafe' } },
  { id: 'idea.lane.pf_toggle_collapse', runtime: 'pf_lane_toggle_collapse' },
  { id: 'idea.lane.pf_delete', runtime: 'pf_lane_delete' },
];

beforeEach(() => {
  probe.lanes = [];
  probe.blocked = [];
});

afterEach(() => {
  // Rejestr obietnic nie ma prawa przeciekać między testami — wyciek oznaczałby
  // zegar trzymany w nieskończoność (dokładnie ten „wisi", którego zakazuje DoD).
  expect(pendingQuickActionAckCount()).toBe(0);
});

describe('RISK-30 · przypadek 1 — SUKCES: potwierdzenie odzwierciedla realne wykonanie', () => {
  it('usuwa istniejący tor przy 3 torach → ok:true, confirmed:true, tor NAPRAWDĘ znika', async () => {
    render(<Harness initialLanes={THREE_LANES} />);

    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', teresaCtx({ laneId: 'lane-2' }))
    );

    expect(result.ok).toBe(true);
    expect(result.confirmed).toBe(true);
    // Dowód, że to nie jest „potwierdzenie dostarczenia": stan naprawdę się zmienił.
    expect(probe.lanes.map((l) => l.id)).toEqual(['lane-1', 'lane-3']);
    expect(probe.blocked).toEqual([]);
  });
});

describe('RISK-30 · przypadek 2 — ODMOWA: ostatni tor', () => {
  it('odmawia z powodem „last_lane"; ok:false, confirmed:false, toast dla człowieka ZACHOWANY', async () => {
    render(<Harness initialLanes={[{ id: 'lane-solo', label: 'Jedyny', color: '#eee' }]} />);

    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', teresaCtx({ laneId: 'lane-solo' }))
    );

    // TO jest defekt, który zamykamy: kiedyś tu było `ok === true`.
    expect(result.ok).toBe(false);
    expect(result.confirmed).toBe(false);
    expect((result.data as any)?.reason).toBe('last_lane');
    // Powód użyteczny dla modelu, nie samo „false".
    expect(result.message).toMatch(/jedyny pozostały tor/i);
    // Ścieżka odpowiedzi Teresy NIE MOŻE czytać się jak sukces.
    expect(result.message).not.toMatch(/^Usunąłem/i);
    // Kanał ludzki nietknięty — `onLaneDeleteBlocked` (→ toast.error) zadziałał.
    expect(probe.blocked).toEqual(['lane-solo']);
    // I nic się nie usunęło.
    expect(probe.lanes.map((l) => l.id)).toEqual(['lane-solo']);
  });

  it('odmawia na zablokowanej Idei z powodem „locked" — dla WSZYSTKICH SZEŚCIU akcji', async () => {
    render(<Harness initialLanes={THREE_LANES} locked />);

    for (const action of SIX_LANE_ACTIONS) {
      const result = await act(async () =>
        runIdeaAction(action.id, teresaCtx({ laneId: 'lane-2', ...(action.extra || {}) }))
      );
      expect(result.ok, `${action.id} musi odmówić na zablokowanej Idei`).toBe(false);
      expect(result.confirmed, action.id).toBe(false);
      expect((result.data as any)?.reason, action.id).toBe('locked');
    }
    expect(probe.lanes).toEqual(THREE_LANES);
  });
});

describe('RISK-30 · przypadek 3 — LIMIT CZASU / BRAK ODBIORNIKA', () => {
  it('bez zamontowanego odbiornika: rozstrzyga NATYCHMIAST jako no_receiver — nie wisi i nie kłamie', async () => {
    // Świadomie NIE renderujemy harnessu: nikt nie słucha szyny.
    const started = Date.now();
    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', teresaCtx({ laneId: 'lane-2' }))
    );
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(false);
    expect(result.confirmed).toBe(false);
    expect((result.data as any)?.reason).toBe('no_receiver');
    expect(result.message).toMatch(/NIE MAM POTWIERDZENIA/);
    // Odróżnialne od odmowy: inny powód, inny komunikat.
    expect(result.message).not.toMatch(/jedyny pozostały tor/i);
    // Brak odbiornika jest wykrywany synchronicznie — żadnego czekania 1500 ms.
    expect(elapsed).toBeLessThan(QUICK_ACTION_ACK_TIMEOUT_MS);
  });

  it('odbiornik zapowiedział odpowiedź (deferAck) i zamilkł: po budżecie 1500 ms → no_receiver, bez zawieszenia', async () => {
    vi.useFakeTimers();
    // Odbiornik, który zgłasza odroczenie i NIGDY nie odpowiada.
    const silent = (e: Event) => {
      const ackId = (e as CustomEvent).detail?.ackId;
      deferQuickActionAck(ackId);
    };
    window.addEventListener('idea-workspace-quick-action', silent);
    try {
      let settled: any = null;
      const p = runIdeaAction('idea.lane.pf_delete', teresaCtx({ laneId: 'lane-2' })).then((r) => {
        settled = r;
        return r;
      });

      // Przed upływem budżetu obietnica NIE jest rozstrzygnięta…
      await vi.advanceTimersByTimeAsync(QUICK_ACTION_ACK_TIMEOUT_MS - 50);
      expect(settled).toBeNull();

      // …a po jego upływie kończy się ODRÓŻNIALNYM wynikiem, nie zawisa.
      await vi.advanceTimersByTimeAsync(100);
      const result = await p;
      expect(result.ok).toBe(false);
      expect(result.confirmed).toBe(false);
      expect((result.data as any)?.reason).toBe('no_receiver');
    } finally {
      window.removeEventListener('idea-workspace-quick-action', silent);
      vi.useRealTimers();
    }
  });
});

describe('RISK-30 · przypadek 4 — ZŁY laneId', () => {
  it('laneId poprawny formalnie, przechodzi OBA istniejące strażniki, ale NIE ISTNIEJE → unknown_lane, nigdy sukces', async () => {
    render(<Harness initialLanes={THREE_LANES} />);

    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', teresaCtx({ laneId: 'lane-NIE-ISTNIEJE' }))
    );

    expect(result.ok).toBe(false);
    expect(result.confirmed).toBe(false);
    expect((result.data as any)?.reason).toBe('unknown_lane');

    // ★ Dowód, że NIE mierzymy przedistniejących wczesnych `return`-ów ★
    // Strażnik 1 (brak `laneId`) NIE zadziałał — jego komunikat brzmi inaczej:
    expect(result.message).not.toMatch(/podaj `laneId`/);
    // Strażnik 2 (brak wpisu w RUNTIME_LANE_ACTION_MAPS) NIE zadziałał —
    // dotarliśmy do dyspozycji, więc `runtime` jest rozwiązany:
    expect((result.data as any)?.runtime).toBe('pf_lane_delete');

    // Stan nietknięty.
    expect(probe.lanes.map((l) => l.id)).toEqual(['lane-1', 'lane-2', 'lane-3']);
  });

  it('dla przedistniejącego strażnika (BRAK laneId) zachowanie się NIE ZMIENIŁO', async () => {
    render(<Harness initialLanes={THREE_LANES} />);
    const result = await act(async () => runIdeaAction('idea.lane.pf_delete', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/torze/);
    expect((result.data as any)?.runtime).toBeUndefined();
  });
});

describe('RISK-30 · POKRYCIE: wszystkie SZEŚĆ akcji lane_frame, nie tylko delete', () => {
  it.each(SIX_LANE_ACTIONS)(
    '$id — sukces na istniejącym torze daje confirmed:true i właściwy runtime',
    async ({ id, runtime, extra }) => {
      render(<Harness initialLanes={THREE_LANES} />);

      const result = await act(async () =>
        runIdeaAction(id, teresaCtx({ laneId: 'lane-2', ...(extra || {}) }))
      );

      expect(result.ok).toBe(true);
      expect(result.confirmed).toBe(true);
      expect((result.data as any)?.runtime).toBe(runtime);
    }
  );

  it.each(SIX_LANE_ACTIONS)(
    '$id — nieistniejący tor NIGDY nie melduje sukcesu',
    async ({ id, runtime, extra }) => {
      render(<Harness initialLanes={THREE_LANES} />);

      const result = await act(async () =>
        runIdeaAction(id, teresaCtx({ laneId: 'lane-WIDMO', ...(extra || {}) }))
      );

      expect(result.ok).toBe(false);
      expect(result.confirmed).toBe(false);
      expect((result.data as any)?.reason).toBe('unknown_lane');
      expect((result.data as any)?.runtime).toBe(runtime);
    }
  );

  it.each(SIX_LANE_ACTIONS)(
    '$id — bez odbiornika NIGDY nie melduje sukcesu',
    async ({ id, extra }) => {
      // Harness NIE renderowany.
      const result = await act(async () =>
        runIdeaAction(id, teresaCtx({ laneId: 'lane-2', ...(extra || {}) }))
      );
      expect(result.ok).toBe(false);
      expect(result.confirmed).toBe(false);
      expect((result.data as any)?.reason).toBe('no_receiver');
    }
  );

  it('skrajne pozycje: move_up na pierwszym i move_down na ostatnim to ODMOWY z własnymi powodami', async () => {
    render(<Harness initialLanes={THREE_LANES} />);

    const up = await act(async () =>
      runIdeaAction('idea.lane.pf_move_up', teresaCtx({ laneId: 'lane-1' }))
    );
    expect(up.ok).toBe(false);
    expect((up.data as any)?.reason).toBe('already_first');

    const down = await act(async () =>
      runIdeaAction('idea.lane.pf_move_down', teresaCtx({ laneId: 'lane-3' }))
    );
    expect(down.ok).toBe(false);
    expect((down.data as any)?.reason).toBe('already_last');

    expect(probe.lanes.map((l) => l.id)).toEqual(['lane-1', 'lane-2', 'lane-3']);
  });

  it('brakujący parametr operacji (rename bez label, color bez color) → missing_param, nie sukces', async () => {
    render(<Harness initialLanes={THREE_LANES} />);

    const rename = await act(async () =>
      runIdeaAction('idea.lane.pf_rename', teresaCtx({ laneId: 'lane-2' }))
    );
    expect(rename.ok).toBe(false);
    expect((rename.data as any)?.reason).toBe('missing_param');

    const color = await act(async () =>
      runIdeaAction('idea.lane.pf_color', teresaCtx({ laneId: 'lane-2' }))
    );
    expect(color.ok).toBe(false);
    expect((color.data as any)?.reason).toBe('missing_param');
  });
});

describe('RISK-30 · ścieżka UI (GRUPA B) — druga niepotwierdzona gałąź tej samej funkcji', () => {
  it('domknięcie UI zwracające ODMOWĘ nie jest już raportowane jako sukces', async () => {
    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', {
        ideaId: 'idea-1',
        tool: 'process_flow',
        selection: EMPTY_SELECTION,
        surface: 'inline',
        source: 'ui',
        params: { laneId: 'lane-solo', run: (): LaneOpOutcome => ({ ok: false, reason: 'last_lane' }) },
      })
    );

    expect(result.ok).toBe(false);
    expect(result.confirmed).toBe(false);
    expect((result.data as any)?.reason).toBe('last_lane');
  });

  it('domknięcie UI zwracające `void` (niezmigrowany wywołujący) — ok:true BEZ REGRESJI, ale confirmed:false', async () => {
    const run = vi.fn();
    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', {
        ideaId: 'idea-1',
        tool: 'process_flow',
        selection: EMPTY_SELECTION,
        surface: 'inline',
        source: 'ui',
        params: { run },
      })
    );

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    // Uczciwie: wysłane, ale NIC tego nie potwierdziło.
    expect(result.confirmed).toBe(false);
  });
});
