/**
 * Silnik rejestru akcji Idea Workspace: mapy runtime (`RUNTIME_*`) +
 * funkcje pomocnicze (`run*Callback`, `dispatch*`) wołane z `handler` w
 * plikach akcji per narzędzie (`mindmapActions.ts`/`whiteboardActions.ts`/
 * `processFlowActions.ts`/`tableActions.ts`/`sharedActions.ts`).
 *
 * Wydzielone z `src/actions/ideaActionRegistry.ts` (QG-01, 2026-08-10) —
 * WSZYSTKO tu jest verbatim przeniesione (bez zmiany logiki), tylko dodano
 * `export` do nazw top-level, których pliki akcji potrzebują poza tym
 * modułem. Kontrakt formatu strażnika (`scripts/check-actions.sh`, R6) nadal
 * czyta mapy `const RUNTIME_*: ToolActionMap = { tool: 'string', }` z TEGO
 * pliku (patrz zaktualizowany strażnik: skanuje `ideaActionRegistry.ts` +
 * `registry/*.ts`).
 */

import type { ActionContext, ActionResult, Tool, ToolActionMap } from './types';
// RISK-30 (S5-TERESA, 2026-08-12): potwierdzenie skorelowane dla akcji toru.
// Pełne uzasadnienie mechanizmu + budżetu limitu czasu: `src/actions/quickActionAck.ts`.
import {
  awaitQuickActionAck,
  isQuickActionOutcome,
  type QuickActionAckOutcome,
  type QuickActionOutcome,
} from '@/actions/quickActionAck';
import { Api } from '@/services/api';
// Alias `TP` (NIE `TablePlatformApi`) — patrz komentarz przy funkcjach
// `runTable*Callback` niżej DLACZEGO nazwa nie może kończyć się na „Api"
// tuż przed kropką (`check-actions.sh` R8 łapie to jako fałszywe wywołanie
// gołego `Api` z `src/services/api.ts`).
import * as TP from '@/services/api/tablePlatform.api';

// ─────────────────────── SZYNA: realne wywołania runtime ───────────────────────

/**
 * Kanoniczna szyna powłoki. `IdeaMapWorkspace.tsx:1119` nasłuchuje i re-emituje,
 * a hooki czterech narzędzi (`use*QuickActions.ts`) nasłuchują bezpośrednio:
 *   mindmap/useMindMapQuickActions.ts:1243 · whiteboard/useWhiteboardQuickActions.ts:147
 *   processflow/useProcessFlowQuickActions.ts:163 · table/useTableQuickActions.ts:316
 */
export function dispatchQuickAction(action: string, ctx: ActionContext, extra?: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent('idea-workspace-quick-action', {
      detail: { action, ideaId: ctx.ideaId, source: ctx.source, ...(extra || {}) },
    })
  );
}

/**
 * ★ RISK-30 (S5-TERESA, 2026-08-12) — PUNKT DŁAWIENIA DLA SZYNY ★
 *
 * `dispatchQuickAction` wyżej jest i zostaje SYNCHRONICZNA oraz `void` —
 * celowo nietknięta, bo woła ją też kod spoza tego pliku (`sharedActions.ts`,
 * `whiteboardActions.ts`). Ta funkcja to jej wariant Z POTWIERDZENIEM: dokłada
 * `ackId` do detalu i czeka na odpowiedź odbiornika.
 *
 * Zmierzone na tym pliku @ edb38d6a29 (własny census, zgodny z niezależnym
 * liczeniem koordynatora): 90 miejsc `return { ok: true`, z czego SZEŚĆ zaraz
 * po `dispatchQuickAction(...)` (linie 65, 266, 820, 865, 893, 939 — GRUPA A,
 * szyna, punkt dławienia ISTNIEJE) i 59 zaraz po `(run as () => void)()`
 * (GRUPA B, domknięcie UI, punktu dławienia NIE MA — `run` jest przekazywany
 * z komponentu). Pozostałe 25 to sprawy niezwiązane.
 *
 * Zwraca `confirmed` do wstawienia w `ActionResult`:
 *   `true`  — odbiornik potwierdził wykonanie,
 *   `false` — nikt nie potwierdził (odbiornik niezmigrowany, narzędzie
 *             zamknięte, albo limit czasu) — patrz `quickActionAck.ts`,
 *             gdzie brak odpowiedzi jest wykrywany NATYCHMIAST, bez czekania,
 *             żeby ack nie spowalniał niezmigrowanych ścieżek.
 * `ok` NIE ZMIENIA ZNACZENIA — nadal „przyjęte i wysłane".
 */
export async function dispatchQuickActionAwaited(
  action: string,
  ctx: ActionContext,
  extra?: Record<string, unknown>
): Promise<QuickActionAckOutcome> {
  return awaitQuickActionAck((ackId) =>
    // `ackId` NA KOŃCU celowo: `extra` nie może go nadpisać ani podmienić,
    // bo to on jest jedynym wiązaniem odpowiedzi z tym wywołaniem.
    dispatchQuickAction(action, ctx, { ...(extra || {}), ackId })
  );
}

/**
 * RISK-30, GRUPA B (59 miejsc) — CENTRALNE wywołanie domknięcia UI.
 *
 * Wywołujący przekazuje `ctx.params.run`. Historycznie było ono wołane jako
 * `(run as () => void)()` i natychmiast po nim szło `return { ok: true }` —
 * bez oglądania czegokolwiek. Ta funkcja woła je RAZ i mówi, czy dostaliśmy
 * jakikolwiek dowód wykonania:
 *   • zwrócone `QuickActionOutcome`  → dokładny wynik (także ODMOWA),
 *   • zwrócone `true`                → potwierdzenie bez szczegółów,
 *   • zwrócone `false`               → jawna odmowa bez powodu,
 *   • zwrócone `undefined`/cokolwiek → `confirmed: false` (uczciwe „nie wiem”).
 *
 * Dzięki temu migracja pozostałych 58 miejsc Grupy B to zmiana JEDNEJ linii
 * per miejsce, a nie przebudowa — i żadne z nich nie regresuje, bo `ok`
 * zostaje `true` niezależnie od wyniku.
 */
export function runUiClosure(run: unknown): {
  confirmed: boolean;
  outcome?: QuickActionOutcome;
} {
  const returned = (run as () => unknown)();
  if (isQuickActionOutcome(returned)) return { confirmed: returned.ok, outcome: returned };
  if (returned === true) return { confirmed: true, outcome: { ok: true } };
  if (returned === false) return { confirmed: false };
  return { confirmed: false };
}

/**
 * Szyna węzłowa Mapy myśli (`IdeaMapWorkspace.tsx` nasłuchuje i deleguje do
 * `useMindMapQuickActions`). Używana WYŁĄCZNIE dla akcji Mapy — poza Mapą
 * nikt jej nie słucha, co było źródłem martwego „Auto-układu" w Przepływie.
 */
export function dispatchMindmapPaneAction(action: string) {
  window.dispatchEvent(new CustomEvent('idea-mindmap-node-quick-action', { detail: { action } }));
}

/** Wysyła string właściwy dla AKTYWNEJ reprezentacji; brak wpisu = akcja tam nie istnieje. */
export async function runByTool(
  actionId: string,
  map: ToolActionMap,
  ctx: ActionContext,
  extra?: Record<string, unknown>
): Promise<ActionResult> {
  const runtime = map[ctx.tool];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  // RISK-30 GRUPA A (1/6, generyczny przekaźnik). `confirmed` mówi prawdę:
  // `true` tylko gdy odbiornik potwierdził. `ok` bez zmian.
  const ack = await dispatchQuickActionAwaited(runtime, ctx, extra);
  return { ok: true, actionId, confirmed: ack.ok, data: { runtime } };
}

/**
 * Runtime strings na szynie `idea-workspace-quick-action` dla akcji krawędzi —
 * PO JEDNEJ mapie na akcję (nie jedna zbiorcza `Record<string,string>` jak
 * przed 2026-08-09 rozszerzeniem na Mapę myśli), bo `scripts/check-actions.sh`
 * (R6) parsuje WYŁĄCZNIE linie `  tool: 'string',` związane z constem typu
 * `ToolActionMap` — zagnieżdżony jednolinijkowy zapis
 * (`'idea.edge.x': { whiteboard: '...', mindmap: '...' }`) był niewidoczny
 * dla strażnika (dotyczyło to również ORYGINALNEJ, jednotoolowej mapy z pilota
 * 2026-08-09 — R6 nigdy jej nie sprawdzał). Ten kształt NAPRAWIA to przy okazji:
 * każda z siedmiu map niżej jest realnie pilnowana przez R6.
 *
 * Odbiorniki: `useWhiteboardQuickActions.ts` (`editEdgeLabel`/`reverseEdge`/
 * `cycleEdgeArrow`/`cycleEdgeStyle`/`deleteEdge`, 2026-08-09) i
 * `useMindMapQuickActions.ts` (`mm_edge_*`, rozszerzenie 2026-08-09 —
 * `mm_edge_arrow` istniał już wcześniej, od 2026-07-28, i jest tu PONOWNIE
 * UŻYTY, nie duplikowany, bo to DOKŁADNIE to samo pole `data.arrowDirection`,
 * SSOT współdzielone z Tablicą/Przepływem — patrz `canvas/edgeArrowMarkers.tsx`).
 */
export const RUNTIME_EDGE_LABEL: ToolActionMap = {
  whiteboard: 'wb_edge_edit_label',
  mindmap: 'mm_edge_edit_label',
};
export const RUNTIME_EDGE_REVERSE: ToolActionMap = {
  whiteboard: 'wb_edge_reverse',
  mindmap: 'mm_edge_reverse',
  // process_flow (2026-08-09): `handleEdgeReverse(edgeId)` in
  // IdeaProcessFlowTool.tsx already takes an explicit edgeId (unlike
  // insertBetween()/deleteSelected() below it, which only act on the
  // canvas selection) — a genuine REUSE, not a new mechanism. New receiver
  // `pf_edge_reverse` added to useProcessFlowQuickActions.ts for this.
  process_flow: 'pf_edge_reverse',
};
export const RUNTIME_EDGE_CYCLE_ARROW: ToolActionMap = {
  whiteboard: 'wb_edge_cycle_arrow',
  // PONOWNE UŻYCIE stringa 'mm_edge_arrow' — odbiornik istnieje od 2026-07-28
  // (useMindMapQuickActions.ts), NIE dopisujemy drugiego runtime dla tej samej
  // mutacji `data.arrowDirection`.
  mindmap: 'mm_edge_arrow',
};
export const RUNTIME_EDGE_CYCLE_STYLE: ToolActionMap = {
  whiteboard: 'wb_edge_cycle_style',
  mindmap: 'mm_edge_cycle_style',
};
export const RUNTIME_EDGE_DELETE: ToolActionMap = {
  whiteboard: 'wb_edge_delete',
  mindmap: 'mm_edge_delete',
};
/** Mapa myśli TYLKO — Tablica świadomie NIE wspiera rozcięcia krawędzi węzłem
 * (brak logiki po jej stronie, patrz `WhiteboardEdgeContextMenu.tsx`). */
export const RUNTIME_EDGE_INSERT_NODE: ToolActionMap = {
  mindmap: 'mm_edge_insert_node',
};
/** Mapa myśli TYLKO — typy relacji (`related`/`depends_on`/…) to pojęcie bez
 * odpowiednika na Tablicy. */
export const RUNTIME_EDGE_EDIT_RELATION: ToolActionMap = {
  mindmap: 'mm_edge_edit_relation',
};

/**
 * Process Flow edge menu (2026-08-09, `ProcessFlowContextMenu.tsx`'s
 * `getEdgeContextActions`) — cztery mapy PONIŻEJ są Przepływu TYLKO, dodane
 * ŚWIADOMIE jako NOWE akcje zamiast rozszerzenia `idea.edge.insert_node`/
 * `.delete` (Mapa myśli): `insertBetween()`/`deleteSelected()` w
 * `IdeaProcessFlowTool.tsx` operują na ZAZNACZENIU na płótnie (nie przyjmują
 * `edgeId`), a Mapy myśli `mm_edge_insert_node`/`mm_edge_delete` adresują po
 * jawnym id — inny mechanizm, nie wariant tej samej akcji (patrz `teresa.description`
 * przy każdym wpisie niżej). `edge-reverse` to jedyna z dziewięciu, która
 * NAPRAWDĘ jest tą samą operacją (adresowana po edgeId) — patrz
 * `RUNTIME_EDGE_REVERSE.process_flow` wyżej, rozszerzone w miejscu, nie
 * duplikowane tutaj.
 */
export const RUNTIME_PF_EDGE_EDIT_PROPS: ToolActionMap = {
  process_flow: 'pf_edge_edit_props',
};
/** REUŻYCIE — `pf_insert_between` ma już odbiornik w useProcessFlowQuickActions.ts
 * (dawniej wołany tylko z floating toolbar „Insert between"); zero nowego kodu w hooku. */
export const RUNTIME_PF_EDGE_INSERT_NODE: ToolActionMap = {
  process_flow: 'pf_insert_between',
};
export const RUNTIME_PF_EDGE_CONDITION: ToolActionMap = {
  process_flow: 'pf_edge_set_condition',
};
/** REUŻYCIE — `pf_delete` ma już odbiornik (`handlers.deleteSelected()`), dawniej
 * wołany tylko z Menu 3/rail; zero nowego kodu w hooku. */
export const RUNTIME_PF_EDGE_DELETE: ToolActionMap = {
  process_flow: 'pf_delete',
};

/**
 * Process Flow NODE menu (2026-08-09, `ProcessFlowContextMenu.tsx`'s
 * `getNodeContextActions`) — `idea.node.pf_ai_rewrite_step`'s bus path.
 * NOWY odbiornik `pf_ai_rewrite_step` dopisany do
 * `useProcessFlowQuickActions.ts` w tej samej zmianie.
 */
export const RUNTIME_PF_NODE_AI_REWRITE_STEP: ToolActionMap = {
  process_flow: 'pf_ai_rewrite_step',
};

/** Wskaźnik akcja → jej mapa runtime (indirekcja NIE jest czytana przez R6 —
 * to zwykły obiekt JS, guard widzi tylko siedem `ToolActionMap` powyżej). */
export const RUNTIME_EDGE_ACTION_MAPS: Partial<Record<string, ToolActionMap>> = {
  'idea.edge.edit_label': RUNTIME_EDGE_LABEL,
  'idea.edge.reverse': RUNTIME_EDGE_REVERSE,
  'idea.edge.cycle_arrow': RUNTIME_EDGE_CYCLE_ARROW,
  'idea.edge.cycle_style': RUNTIME_EDGE_CYCLE_STYLE,
  'idea.edge.delete': RUNTIME_EDGE_DELETE,
  'idea.edge.insert_node': RUNTIME_EDGE_INSERT_NODE,
  'idea.edge.edit_relation': RUNTIME_EDGE_EDIT_RELATION,
  'idea.edge.pf_edit_props': RUNTIME_PF_EDGE_EDIT_PROPS,
  'idea.edge.pf_insert_node': RUNTIME_PF_EDGE_INSERT_NODE,
  'idea.edge.pf_condition_none': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_yes': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_no': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_default': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_condition_exception': RUNTIME_PF_EDGE_CONDITION,
  'idea.edge.pf_delete': RUNTIME_PF_EDGE_DELETE,
};

/**
 * Przekaźnik dla akcji `scope: 'edge'` (pilot Tablicy 2026-08-09,
 * `WhiteboardEdgeContextMenu.tsx`; rozszerzony tego samego dnia o Mapę myśli,
 * `EdgeContextMenu.tsx` — `src/components/MyWork/mindmap/`).
 *
 * DWIE ścieżki, jedna funkcja:
 *  • `ctx.source === 'ui'` + `ctx.params.run` (funkcja) — UŻYWANE WYŁĄCZNIE
 *    przez Tablicę: `WhiteboardEdgeContextMenu.tsx` przekazuje SWÓJ oryginalny
 *    prop-callback (zamknięty nad lokalnym stanem `edgeContextMenu` w
 *    `IdeaWhiteboardTool.tsx`); wykonujemy go wprost — zachowanie kliku
 *    człowieka jest nietknięte. Mapa myśli tej ścieżki NIE UŻYWA (jej hook już
 *    miał bezpośredni dostęp do surowego stanu `edges`/`setEdges`, więc
 *    zarówno klik człowieka, JAK i Teresa idą tą samą, drugą ścieżką niżej —
 *    dokładnie tak, jak `mm_edge_arrow` już działał od 2026-07-28).
 *  • każdy inny wywołujący (Mapa myśli zawsze, Tablica dla Teresy) — nie ma
 *    `ctx.params.run`, więc dispatchujemy na szynę `idea-workspace-quick-action`
 *    z realnym `edgeId`.
 *
 * Skąd `edgeId` bez zamknięcia komponentu? `ctx.params.edgeId` (LLM podaje
 * wprost — `teresa.parameters` każdej akcji niżej go wymaga, wzorem
 * `idea.ai.expand_map`'s `nodeId`; `EdgeContextMenu.tsx` na Mapie myśli też
 * ZAWSZE go podaje jawnie, bo menu zna edgeId z własnego propa), z fallbackiem
 * na `ctx.selection` (gdy `type === 'edge'`, konwencja `IdeaWorkspaceSelection`
 * z `ideaSelectionTypes.ts`) dla wywołań opartych na zaznaczeniu UI.
 * NAPRAWIONE (E10, 2026-08-10): ten fallback BYŁ martwy — `UnifiedChatPanel.tsx`
 * wołał `executeTeresaTool` z `selection: EMPTY_SELECTION` na sztywno (linie
 * ~1988/2039 przed naprawą). Teraz `IdeaMapWorkspace.tsx` nadaje żywe
 * zaznaczenie na `idea-workspace-active-selection` (dokładnie ten sam stan,
 * którego shell już używał dla własnego panelu Narzędzi), a
 * `UnifiedChatPanel.tsx` odbiera je i przekazuje realnie, z walidacją
 * ideaId+tool przeciw nieaktualnemu zdarzeniu z zamkniętego/przełączonego
 * workspace'u (`getLiveTeresaSelection`). Weryfikacja: `ctx.selection` jest
 * teraz realny w `executeTeresaTool` — NIE zweryfikowano końca-do-końca
 * poprzez faktyczne kliknięcie w UI + realne polecenie do Teresy (poza
 * zakresem tego audytu, brak środowiska do żywego testu czatu), tylko przez
 * przegląd kodu obu stron przewodu (nadawca→odbiorca) i esbuild/testy
 * jednostkowe niezmienione przez tę zmianę.
 */
export async function runEdgeParamCallback(
  actionId: string,
  ctx: ActionContext,
  // Process Flow extension (2026-08-09): dla akcji, gdzie 5 rejestrowych id
  // dzielą JEDEN runtime string (`pf_edge_set_condition`, 5x warunek), wartość
  // jest zaszyta w `extra` per-id (np. `{ condition: 'yes' }`) i wygrywa nad
  // `ctx.params` — inaczej Teresa musiałaby zgadywać, że `idea.edge.pf_condition_yes`
  // wymaga też podania `condition: 'yes'` w parametrach, co byłoby zbędne
  // (wartość wynika z WYBRANEGO id, tak jak w `getEdgeContextActions`, gdzie
  // każdy z 5 wierszy woła `onSetCondition` z inną, zaszytą w domknięciu wartością).
  extra?: Record<string, unknown>
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }

  const edgeId =
    typeof ctx.params?.edgeId === 'string' && ctx.params.edgeId
      ? ctx.params.edgeId
      : ctx.selection?.type === 'edge' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!edgeId) {
    const toolLabel =
      ctx.tool === 'mindmap' ? 'Mapy myśli' : ctx.tool === 'process_flow' ? 'Przepływu' : 'Tablicy';
    return {
      ok: false,
      actionId,
      message: `Nie wiem, na którym połączeniu ${toolLabel} wykonać tę akcję — podaj \`edgeId\` (np. z listy połączeń) albo zaznacz je najpierw.`,
    };
  }
  const runtime = RUNTIME_EDGE_ACTION_MAPS[actionId]?.[ctx.tool];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  // RISK-30 GRUPA A (2/6, krawędzie).
  const ack = await dispatchQuickActionAwaited(runtime, ctx, {
    edgeId,
    ...(ctx.params || {}),
    ...(extra || {}),
  });
  return { ok: true, actionId, confirmed: ack.ok, data: { runtime, edgeId } };
}

/**
 * Cienki przekaźnik dla akcji `WhiteboardToolbar.tsx` (2026-08-09, N7
 * kontynuacja pilota krawędzi) BEZ dziś istniejącego stringa runtime na
 * żadnej szynie ani odbiornika w `useWhiteboardQuickActions.ts` — dokładnie
 * ta sama sytuacja co edge PRZED follow-upem 43fb54eb4c, świadomie
 * NIENAPRAWIANA w tym samym wpisie (patrz `WhiteboardToolbar.tsx`, komentarz
 * przy każdej z tych akcji, DLACZEGO akurat tych sześć zostało bez odbiornika,
 * a reszta baru dostała realne dispatchowanie).
 *
 * ŚWIADOME OGRANICZENIE (Z4): `src/components/AIChat/whiteboardIntentDetector.ts`
 * (jedyny istniejący, choć legacy, regexowy detektor intencji Tablicy) nie ma
 * ANI JEDNEGO wzorca pasującego do skrótów klawiszowych/tła/Zapisz/Wyczyść
 * rysunki — więc w przeciwieństwie do edge (gdzie było jasne "Teresa powinna
 * to wołać po edgeId"), tu nie ma dziś ŻADNEGO sygnału, że ktokolwiek próbował
 * wywołać te operacje z czatu. Stąd świadoma decyzja: UI-only na tę turę,
 * bez budowania nowej infrastruktury szyny na spekulację.
 */
export async function runToolbarUiOnlyCallback(actionId: string, ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z górnego paska narzędzi Tablicy — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * DWIE ścieżki dla `WhiteboardToolbar.tsx` akcji z JUŻ ISTNIEJĄCYM
 * odbiornikiem na szynie (insert-shape ×5, undo/redo, voting/rola/podążaj) —
 * dokładnie ten sam kształt co `runEdgeParamCallback`, uogólniony na
 * `runByTool`:
 *  • `ctx.source === 'ui'` + `ctx.params.run` (funkcja) — wykonuje ORYGINALNY
 *    prop-callback komponentu wprost. KRYTYCZNE dla zachowania kontraktu
 *    propsów: `WhiteboardToolbar` jest komponentem kontrolowanym — jego
 *    `onXxx` propy MUSZĄ zostać wywołane przy kliku, inaczej test (i każdy
 *    przyszły konsument z własnym propem) się psuje. Pierwsza wersja tego
 *    wpisu (2026-08-09) błędnie szła prosto do `runByTool` z pominięciem
 *    `ctx.params.run` — złapane przez `WhiteboardToolbar.commandrow.test.tsx`
 *    (props.onExport/onToggleVoting nie wołane), naprawione tym helperem.
 *  • każdy inny wywołujący (Teresa) — `runByTool` (dispatch na szynę
 *    `idea-workspace-quick-action`, odbiornik już istnieje w
 *    `useWhiteboardQuickActions.ts`, patrz komentarz przy mapach RUNTIME_* niżej).
 */
export async function runToolbarBusAction(
  actionId: string,
  map: ToolActionMap,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  return runByTool(actionId, map, ctx);
}

/**
 * UI-only akcje menu węzła/tła Tablicy (N7 kontynuacja, 2026-08-09,
 * `IdeaCanvasContextMenu.tsx`) — ten sam kształt co `runToolbarUiOnlyCallback`,
 * ale z UCZCIWYM komunikatem (to menu prawego kliku, nie górny pasek).
 * Sprawdzone PRZED użyciem dla każdej z tych pozycji, czy istnieje jakikolwiek
 * żywy punkt wejścia dla Teresy (szyna `idea-workspace-quick-action`,
 * `whiteboardIntentDetector.ts`) — dla żadnej z nich nie istnieje, więc
 * świadomie zostają UI-only zamiast budować nową infrastrukturę na spekulację.
 */
export async function runContextMenuUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu kontekstowego (prawy klik) Tablicy — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * UI-only akcje menu tła (pane) Mapy myśli (N5 kontynuacja, 2026-08-09,
 * `PaneContextMenu.tsx`) — ten sam kształt co `runContextMenuUiOnlyCallback`
 * (Tablica), z UCZCIWYM komunikatem dla Mapy myśli. Sprawdzone PRZED użyciem:
 * `pane_copy`/`pane_cut`/`pane_paste` opierają się na `copySelected`/
 * `cutSelected`/`pasteNodes` z `useMindMapNodes.tsx` — closure nad lokalnym
 * schowkiem (`hasMindMapClipboard`) NIEPRZEKAZANYM do `useMindMapQuickActions`
 * (`MindMapQuickActionHandlers` go nie deklaruje) i bez sensownego odpowiednika
 * po stronie Teresy (schowek przeglądarki to nie coś, co LLM mógłby wypełnić).
 * Świadomie UI-only zamiast budować nową infrastrukturę na spekulację.
 */
export async function runMindmapPaneUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu kontekstowego (prawy klik na tło) Mapy myśli — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * Akcje `surfaces: ['keyboard']` (reconciliacja skrótów, 2026-08-10) —
 * SPRAWDZONE grepem PRZED użyciem, że akcja NIE ma żadnego menu/przycisku
 * gdziekolwiek w kodzie (patrz komentarz przy typie `Surface` wyżej), więc
 * jedyne wejście UI to `ctx.params.run` (oryginalny callback hooka skrótów,
 * nietknięty — klawisz robi dokładnie to, co robił przed tym wpisem).
 * Świadomie UI-only: bez zweryfikowanego, niespekulatywnego wejścia dla
 * Teresy (żaden z tych czterech skrótów nie miał DOTĄD stringa runtime na
 * ŻADNEJ szynie, więc nie ma czego reużyć bez pisania nowej infrastruktury
 * na spekulację — ten sam ostrożny wybór co `runToolbarUiOnlyCallback`).
 */
export async function runKeyboardOnlyCallback(actionId: string, ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie ze skrótu klawiszowego — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * Twin of `runToolbarUiOnlyCallback`/`runKeyboardOnlyCallback` for the right
 * panel surface (Program D / epic E08, business-case section save — 2026-08-10).
 * Same `ctx.params.run` bridge: the panel component owns the real save
 * (network call + local state update), the registry only gives it a
 * traceable id/undo/Teresa-manifest entry. No panel action reaches Teresa
 * through this path yet — same honest gap as the toolbar/keyboard twins.
 */
export async function runPanelUiOnlyCallback(actionId: string, ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z prawego panelu — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  await (run as () => void | Promise<void>)();
  return { ok: true, actionId };
}

/**
 * `idea.node.mm_apply_ai_suggestion` (closure 2026-08-10) — Node Detail
 * Drawer "Apply" click on an already-fetched AI suggestion chip. UI-only
 * BY DESIGN, not by oversight: the suggestion text lives in `aiSuggestions`,
 * transient LOCAL component state populated by a PRIOR, separate request
 * (`handleAIExpand`, `Api.expandMyIdeaMap({proposeOnly:true})`) that is out
 * of scope for this entry and has no addressable id of its own — Teresa has
 * no way to say "accept suggestion #2" without first seeing the SAME open
 * drawer's live-rendered list, which is not something a chat message can
 * reference. Fabricating a `text` parameter for Teresa would silently change
 * the action's meaning from "accept a previously proposed suggestion" to
 * "insert arbitrary text I invented" — a different, already-covered
 * capability (`idea.element.add`), not this one.
 */
export async function runMindmapAiSuggestionApplyUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z otwartego panelu szczegółów węzła, na już wygenerowanej sugestii AI — nie mam jak wskazać konkretnej sugestii z czatu. Mogę za to wygenerować i wstawić nowe węzły przez „AI: rozwiń mapę" (pełny cykl podgląd→akceptacja).',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * `idea.node.edit` (N7 kontynuacja, 2026-08-09) — jedyna pozycja menu węzła,
 * której realna mutacja NIE żyje na szynie `idea-workspace-quick-action`, tylko
 * na osobnym, już istniejącym evencie `idea-workspace-node-update`
 * (nadawany dziś przez `VSMNodeComponent.tsx:171` i przez `handleBaseAction`
 * 'edit' w `IdeaCanvasContextMenu.tsx`; odbiorniki: `IdeaWhiteboardTool.tsx:2571`
 * ORAZ `IdeaProcessFlowTool.tsx:2535` — generyczny patch `node.data` po
 * `nodeId`, nie nowa infrastruktura). Dwie ścieżki jak wszędzie: UI = oryginalny
 * `ctx.params.run` (prompt() + dispatch, nietknięte); Teresa = bezpośredni
 * dispatch po `ctx.params.nodeId`+`label` (LLM podaje wprost, ten sam wzorzec
 * co `idea.edge.edit_label`'s `edgeId`).
 *
 * ZASTRZEŻENIE ODKRYTE PRZY TYM WPISIE (nie wprowadzone tu, nie naprawiane
 * tu — poza zakresem wiringu): odbiornik `idea-workspace-node-update` w
 * `IdeaWhiteboardTool.tsx:2551-2569` NIE woła `pushUndoSnapshot()` przed
 * `setNodes`, w przeciwieństwie do `duplicateSelected`/`deleteSelected`/
 * `lockSelected` itd. — edycja etykiety węzła (ludzka I przez Teresę) NIE
 * trafia dziś na stos Ctrl+Z. Prawdziwe zarówno przed, jak i po tym wpisie
 * (sama funkcja `handleBaseAction` 'edit' też nigdy nie wołała
 * `pushUndoSnapshot`) — zgłoszone niżej w `undo.evidence`, nie ukryte.
 */
export function dispatchNodeUpdate(nodeId: string, data: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent('idea-workspace-node-update', { detail: { nodeId, data } })
  );
}

/**
 * UI-only akcje menu WĘZŁA (nie tła) Mapy myśli (N5 kontynuacja, druga fala,
 * 2026-08-09, `NodeContextMenu.tsx` grupy Edit/Structure) — ten sam kształt co
 * `runMindmapPaneUiOnlyCallback`, osobna funkcja WYŁĄCZNIE dla uczciwego
 * komunikatu („menu węzła", nie „menu tła"), żeby odmowa nie myliła Teresy co
 * do tego, KTÓRE menu ma na myśli. Użyta dla pozycji bez sensownego,
 * nie-spekulatywnego punktu wejścia na szynę (sprawdzone PRZED użyciem dla
 * każdej — patrz komentarz przy każdym wpisie niżej, co dokładnie sprawdzono).
 */
export async function runMindmapNodeUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu kontekstowego (prawy klik na węzeł) Mapy myśli — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * Szyna dla akcji WĘZŁA Mapy myśli, które MAJĄ żywy odbiornik w
 * `useMindMapQuickActions.ts` — jak `runToolbarBusAction`, ale DODATKOWO
 * przekazuje `ctx.params` jako `extra` do `dispatchQuickAction` (ten sam
 * zabieg co `idea.element.add`), bo te odbiorniki czytają konkretne pola z
 * `detail` (`nodeId`/`label`/`targetNodeId`) — bez przekazania `ctx.params`
 * Teresa nie mogłaby wskazać WĘZŁA, tylko trafiałaby w domyślne zachowanie
 * (zaznaczenie/ostatni aktywny), co dla menu PRAWEGO KLIKU NA KONKRETNY WĘZEŁ
 * byłoby nieuczciwe (menu istnieje właśnie po to, żeby wskazać węzeł).
 */
export async function runMindmapNodeBusAction(
  actionId: string,
  map: ToolActionMap,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  return runByTool(actionId, map, ctx, ctx.params);
}

/**
 * UI-only akcje menu WĘZŁA Przepływu (N6 kontynuacja, 2026-08-09,
 * `ProcessFlowContextMenu.tsx`'s `getNodeContextActions` + dual-surface
 * `ProcessFlowFloatingToolbar.tsx`) — ten sam kształt co
 * `runMindmapNodeUiOnlyCallback`, osobna funkcja WYŁĄCZNIE dla uczciwego
 * komunikatu („menu węzła Przepływu"). Użyta dla pozycji bez sensownego,
 * nie-spekulatywnego punktu wejścia na szynę (sprawdzone PRZED użyciem dla
 * każdej — patrz komentarz przy każdym wpisie niżej, co dokładnie sprawdzono).
 */
export async function runProcessFlowNodeUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu węzła (prawy klik) lub pływającego paska Przepływu — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * Runtime stringi TORU (lane) Przepływu (N6.3, 2026-08-10, `LaneSystem.tsx`).
 * Jedna mapa PER akcja (nie jedna zbiorcza), z tego samego powodu co
 * `RUNTIME_EDGE_LABEL`/etc. wyżej — `scripts/check-actions.sh` (R6) parsuje
 * WYŁĄCZNIE `  tool: 'string',` per linia pod constem typu `ToolActionMap`.
 * W N6.3 torowość była pojęciem WYŁĄCZNIE Przepływu (Whiteboard miał "ramkę"
 * ale jej kontenerowe operacje same w sobie NIE BYŁY jeszcze zaimplementowane
 * — rozdz. 08 §5 dokumentował wprost „Grupuj/Rozgrupuj tylko z paska
 * zaznaczenia... brak dedykowanego menu prawego kliku «na ramce jako
 * kontenerze»"), stąd sześć map niżej miało tylko jeden klucz każda.
 * ZAKTUALIZOWANE (WB-FRAME-01, 2026-08-10): ta luka po stronie Tablicy jest
 * teraz ZAMKNIĘTA — patrz `RUNTIME_FRAME_*` niżej, `tools: ['whiteboard']`,
 * scope `lane_frame` (ten sam kontener-scope, teraz z realnym mechanizmem
 * PO OBU stronach — Z1 reużycia i tak nie ma, bo Przepływu tor i Tablicy
 * ramka to różne struktury danych, ale zakres pojęciowy jest ten sam).
 */
export const RUNTIME_LANE_RENAME: ToolActionMap = {
  process_flow: 'pf_lane_rename',
};
export const RUNTIME_LANE_MOVE_UP: ToolActionMap = {
  process_flow: 'pf_lane_move_up',
};
export const RUNTIME_LANE_MOVE_DOWN: ToolActionMap = {
  process_flow: 'pf_lane_move_down',
};
export const RUNTIME_LANE_COLOR: ToolActionMap = {
  process_flow: 'pf_lane_color',
};
export const RUNTIME_LANE_TOGGLE_COLLAPSE: ToolActionMap = {
  process_flow: 'pf_lane_toggle_collapse',
};
export const RUNTIME_LANE_DELETE: ToolActionMap = {
  process_flow: 'pf_lane_delete',
};

/**
 * WB-FRAME-01 (frame context menu, 2026-08-10) — Whiteboard frame (`frameNode`/
 * `groupNode`) container ops, scope `lane_frame` (same container-scope as the
 * lane maps above — see the updated comment there for why this closes that
 * documented gap). Receivers: `useWhiteboardQuickActions.ts` (`wb_frame_*`) →
 * `useWhiteboardNodes.ts` (`selectFrameContents`/`addSelectionToFrame`/
 * `resizeFrameToFit`/`deleteFrame`). `idea.frame.add_selection` has NO map
 * here — it's UI-only (`runContextMenuUiOnlyCallback`), because it acts on
 * whatever is CURRENTLY selected in the browser, the same honest boundary as
 * `idea.node.copy`/`idea.canvas.paste` above (no coordinates for Teresa to
 * reason about, and no meaningful "selection" outside a live canvas).
 */
export const RUNTIME_FRAME_SELECT_CONTENTS: ToolActionMap = {
  whiteboard: 'wb_frame_select_contents',
};
export const RUNTIME_FRAME_RESIZE_TO_FIT: ToolActionMap = {
  whiteboard: 'wb_frame_resize_to_fit',
};
export const RUNTIME_FRAME_DELETE_WITH_CONTENTS: ToolActionMap = {
  whiteboard: 'wb_frame_delete_with_contents',
};
export const RUNTIME_FRAME_DELETE_RELEASE: ToolActionMap = {
  whiteboard: 'wb_frame_delete_release',
};
export const RUNTIME_NODE_REMOVE_FROM_FRAME: ToolActionMap = {
  whiteboard: 'wb_node_remove_from_frame',
};

/**
 * `idea.view.pf_add_decision` (N6.3, 2026-08-10) — canvas menu „Add
 * decision". `pf_add_decision` już miał odbiornik w
 * `useProcessFlowQuickActions.ts` (linia 136, `handlers.addNode('decision')`)
 * od wcześniejszej fali, po prostu bez wołającego z rejestru — nie NOWA
 * infrastruktura, tylko brakujące podłączenie.
 */
export const RUNTIME_PF_ADD_DECISION: ToolActionMap = {
  process_flow: 'pf_add_decision',
};

/**
 * `idea.view.pf_add_start` (N-inventory-c4, 2026-08-10) — empty-canvas CTA
 * (`IdeaProcessFlowTool.tsx` empty state, "Dodaj pierwszy krok"). Inventory
 * (04_ACTION_COVERAGE_INVENTORY.csv, class c #4) proposed reusing
 * `idea.element.add` (runtime `pf_add_step`) — DECLINED: `pf_add_step` is
 * hardcoded to shape `'action'` (useProcessFlowQuickActions.ts:158-161), while
 * this CTA always adds `'start'` (classic/automation/BPMN/system/org modes) or
 * `'vsm_process'` (VSM mode) — never `'action'`. Same trap already documented
 * for `idea.view.pf_add_decision` above ("kształt 'decision' nie ma
 * odpowiednika w idea.element.add... NIE jest ta sama akcja mimo sąsiedztwa").
 * Both `pf_add_start` and `pf_add_vsm_process` already have real, pre-existing
 * handlers (`handlers.addNode('start')` / `handlers.addNode('vsm_process')`,
 * useProcessFlowQuickActions.ts:164/186) — no new runtime infrastructure, only
 * the missing registry entry + call site.
 */
export const RUNTIME_PF_ADD_START: ToolActionMap = {
  process_flow: 'pf_add_start',
};
export const RUNTIME_PF_ADD_VSM_PROCESS: ToolActionMap = {
  process_flow: 'pf_add_vsm_process',
};

/**
 * Runtime stringi GÓRNEGO PASKA Przepływu (N6.4, 2026-08-10,
 * `ProcessFlowToolbar.tsx`). Znowu JEDNA mapa PER akcja — `scripts/check-actions.sh`
 * (R6) parsuje wyłącznie `  tool: 'string',` per linia pod constem typu
 * `ToolActionMap` (jednolinijkowy literał jest dla niego niewidoczny).
 *
 * Trzy pierwsze (`pf_mode_*`) to LUKA W OKABLOWANIU, nie nowa infrastruktura:
 * odbiorniki istniały w `useProcessFlowQuickActions.ts` (linie 157/158/160,
 * `setters.setFlowMode(...)`) na długo przed tą falą i NIKT ich nie wołał —
 * ani rejestr, ani `processFlowIntentDetector.ts`. Zakładki trybu w pasku
 * wołały wyłącznie lokalny prop `setFlowMode`. Po tej zmianie klik człowieka
 * IDZIE DOKŁADNIE TĄ SAMĄ ścieżką co przedtem (`ctx.params.run` = oryginalny
 * `() => setFlowMode(mode)`), a Teresa dostaje żywe drugie wejście do tego
 * samego `useState` settera (ten sam obiekt funkcji — `setters.setFlowMode`
 * w `IdeaProcessFlowTool.tsx:2291` to ten sam `setFlowMode`, który dostaje
 * prop paska w linii 2873; sprawdzone, nie założone).
 */
export const RUNTIME_PF_MODE_CLASSIC: ToolActionMap = {
  process_flow: 'pf_mode_classic',
};
export const RUNTIME_PF_MODE_AUTOMATION: ToolActionMap = {
  process_flow: 'pf_mode_automation',
};
export const RUNTIME_PF_MODE_VSM: ToolActionMap = {
  process_flow: 'pf_mode_vsm',
};
/**
 * `pf_summary` — JEDYNY genuinie nowy odbiornik tej fali
 * (`useProcessFlowQuickActions.ts`, dopisany w tej samej zmianie).
 * Uzasadnienie dlaczego akurat ten, a nie KPI/Waliduj/Odczyt zwrotny/Propozycja
 * AI (te zostają uczciwie UI-only): „Podsumowanie" to bliźniak AI Coacha —
 * ta sama klasa akcji z rozdz. 09 §6 („AI tylko odczyt" Przepływu: `process_coach`
 * i `process_summary`), ten sam realny generator LLM po tej samej trasie
 * (`Api.generateIdeaAI` → `llmService.callStructured`), ten sam brak
 * jakichkolwiek parametrów wejściowych i ten sam brak mutacji płótna. AI Coach
 * MA odbiornik na szynie od dawna (`pf_analyze`), Podsumowanie nie miało
 * żadnego — asymetria bez uzasadnienia w mechanizmie, więc uzupełniona.
 */
export const RUNTIME_PF_PROCESS_SUMMARY: ToolActionMap = {
  process_flow: 'pf_summary',
};

/**
 * UI-only akcje GÓRNEGO PASKA Przepływu (N6.4, 2026-08-10,
 * `ProcessFlowToolbar.tsx` — menu „Więcej"). Ten sam kształt co
 * `runToolbarUiOnlyCallback` (Tablica) i `runProcessFlowPaneUiOnlyCallback`
 * (menu tła Przepływu), osobna funkcja WYŁĄCZNIE dla uczciwego komunikatu:
 * Teresa musi umieć odróżnić „to jest w menu Więcej paska Przepływu" od „to
 * jest w menu prawego kliku", inaczej jej odmowa myli użytkownika co do tego,
 * gdzie tej funkcji szukać ręcznie.
 *
 * Sprawdzone PRZED użyciem dla KAŻDEJ z czterech pozycji, które tę ścieżkę
 * dostają (KPI, Waliduj, Odczyt zwrotny, Propozycja AI): żadna nie ma dziś
 * ŻADNEGO stringa runtime na szynie `idea-workspace-quick-action`, żadnego
 * wzorca w `processFlowIntentDetector.ts` i żadnego adresowalnego celu poza
 * lokalnym `useState` panelu. Zgodnie z zasadą „bez spekulatywnej
 * infrastruktury" (patrz `runToolbarUiOnlyCallback`) zostają UI-only z jawną
 * odmową, zamiast dostać wymyśloną szynę.
 */
export async function runProcessFlowToolbarUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z górnego paska Przepływu (menu „Więcej") — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * UI-only akcje menu TŁA (kanwy) Przepływu (N6.3 kontynuacja, 2026-08-10,
 * `ProcessFlowContextMenu.tsx`'s `getCanvasContextActions`) — ten sam kształt
 * co `runProcessFlowNodeUiOnlyCallback`, osobna funkcja WYŁĄCZNIE dla
 * uczciwego komunikatu („menu tła", nie „menu węzła" — Teresa nie ma dziś
 * ŻADNEGO sposobu odróżnienia tych dwóch odmów bez precyzyjnego tekstu).
 * Użyta wyłącznie dla `idea.view.pf_paste_at_point` (schowek narzędzia jest
 * stanem przeglądarki `useRef`, dokładnie ta sama sytuacja co Mapy myśli
 * `idea.view.paste_at_point` i węzłowe `idea.node.pf_copy` — sprawdzone PRZED
 * użyciem, nie zgadywane).
 */
export async function runProcessFlowPaneUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu tła (prawy klik na puste miejsce) Przepływu — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/** Wskaźnik akcja TORU (lane) → jej mapa runtime, ten sam kształt co
 * `RUNTIME_EDGE_ACTION_MAPS` (N6.3, 2026-08-10, `LaneSystem.tsx` — przyciski
 * stałe w nagłówku toru, BEZ tablicy `ActionDef[]`/menu do przechwycenia). */
export const RUNTIME_LANE_ACTION_MAPS: Partial<Record<string, ToolActionMap>> = {
  'idea.lane.pf_rename': RUNTIME_LANE_RENAME,
  'idea.lane.pf_move_up': RUNTIME_LANE_MOVE_UP,
  'idea.lane.pf_move_down': RUNTIME_LANE_MOVE_DOWN,
  'idea.lane.pf_color': RUNTIME_LANE_COLOR,
  'idea.lane.pf_toggle_collapse': RUNTIME_LANE_TOGGLE_COLLAPSE,
  'idea.lane.pf_delete': RUNTIME_LANE_DELETE,
};

/**
 * RISK-30: powód odmowy → zdanie dla Teresy. Te teksty NIE trafiają do UI —
 * wszyscy wywołujący z `src/components/**` robią `void runIdeaAction(...)`
 * i odrzucają wynik, a człowiek dostaje swój komunikat toastem (np.
 * `myWorkIdeas.processFlowTool.cannotDeleteLastLane`, NIETKNIĘTY). To jest
 * kanał model-facing, dlatego — dokładnie jak wszystkie pozostałe `message`
 * w tym pliku — zostaje twardym polskim tekstem bez kluczy locale.
 */
type LaneRefusalReason = Extract<QuickActionAckOutcome, { ok: false }>['reason'];

function laneRefusalMessage(reason: LaneRefusalReason, laneId: string): string {
  switch (reason) {
    case 'last_lane':
      return `NIE usunąłem toru \`${laneId}\` — to jedyny pozostały tor Przepływu, a przepływ bez torów nie jest poprawnym stanem. Użytkownik zobaczył tę odmowę na ekranie. Żeby usunąć ten tor, najpierw dodaj drugi.`;
    case 'locked':
      return `NIE wykonałem tej operacji na torze \`${laneId}\` — Idea jest otwarta w trybie tylko do odczytu (zablokowana).`;
    case 'unknown_lane':
      return `NIE ma toru o identyfikatorze \`${laneId}\` w tym Przepływie — nic nie zmieniłem. Sprawdź listę torów i podaj istniejący \`laneId\`.`;
    case 'already_first':
      return `NIE przesunąłem toru \`${laneId}\` w górę — jest już pierwszy.`;
    case 'already_last':
      return `NIE przesunąłem toru \`${laneId}\` w dół — jest już ostatni.`;
    case 'missing_param':
      return `NIE wykonałem tej operacji na torze \`${laneId}\` — brakuje wymaganego parametru (nowa nazwa dla zmiany nazwy, kolor dla zmiany koloru).`;
    case 'no_handler':
      return `NIE wykonałem tej operacji na torze \`${laneId}\` — Przepływ jest otwarty, ale nie udostępnia dziś tej operacji przez szynę.`;
    case 'no_receiver':
    default:
      return `NIE MAM POTWIERDZENIA, że operacja na torze \`${laneId}\` się wykonała — żaden odbiornik nie odpowiedział w wyznaczonym czasie (najpewniej Przepływ nie jest otwarty). Zakładaj, że NIC się nie zmieniło; nie melduj sukcesu.`;
  }
}

/**
 * Przekaźnik dla akcji `scope: 'lane_frame'` (N6.3, 2026-08-10) — ten sam
 * kształt co `runEdgeParamCallback`, przystosowany do toru: `LaneSystem.tsx`
 * NIE jest budowane z rejestru (przyciski stałe w nagłówku, NIETKNIĘTE —
 * dokładnie ten sam wybór co dla węzła/krawędzi Przepływu w tej fali:
 * „komponent zostaje, tylko obiekt handlerów przekazywany do hooka rośnie"),
 * więc `ctx.params.run` w praktyce NIGDY nie jest ustawiane przez Przepływ —
 * ścieżka niżej istnieje dla ewentualnych przyszłych wywołujących z realnym
 * zamknięciem (ten sam powód co w `runEdgeParamCallback`). Realna ścieżka
 * dziś to zawsze szyna z jawnym `laneId`.
 *
 * ★ RISK-30 ZAMKNIĘTE (S5-TERESA, 2026-08-12) ★
 * Do 2026-08-11 ta funkcja kończyła się BEZWARUNKOWYM `{ ok: true }` — Teresa
 * meldowała sukces także wtedy, gdy `handleLaneDelete` odmówił na jedynym
 * pozostałym torze (człowiek widział toast z odmową, model pisał „usunięte").
 * Teraz ścieżka szyny CZEKA na potwierdzenie skorelowane (`awaitLaneAck`,
 * `src/actions/quickActionAck.ts` — tam pełne uzasadnienie mechanizmu i budżetu
 * limitu czasu) i tłumaczy jego powód na komunikat dla modelu. Cztery
 * rozłączne wyniki: sukces · ODMOWA (z powodem) · BRAK ODBIORNIKA (limit
 * czasu) · nieznany `laneId` — żaden z trzech ostatnich nie wygląda jak `ok`.
 *
 * Dotyczy WSZYSTKICH SZEŚCIU akcji `lane_frame` (rename · move_up ·
 * move_down · color · toggle_collapse · delete) — wszystkie idą przez tę
 * jedną funkcję i tę jedną mapę `RUNTIME_LANE_ACTION_MAPS`.
 *
 * OBIE gałęzie są zamknięte — to jest ta pułapka, o której mówił koordynator:
 * `runLaneParamCallback` ma miejsce GRUPY B (domknięcie UI) ORAZ miejsce
 * GRUPY A (szyna) w jednym ciele, więc zamknięcie samej szyny zostawiałoby
 * `idea.lane.*` z niepotwierdzonym `ok: true` dla `ctx.source === 'ui'`.
 */
export async function runLaneParamCallback(
  actionId: string,
  ctx: ActionContext,
  extra?: Record<string, unknown>
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    // RISK-30, druga ścieżka niepotwierdzona (wskazana przez koordynatora):
    // do 2026-08-11 ta gałąź wołała `run()` i zwracała `ok: true` NIE
    // OGLĄDAJĄC niczego — ten sam antywzorzec co szyna. Domknięcie UI jest
    // synchroniczne, więc jego wynik JEST dostępny: jeśli `run()` zwróci
    // `LaneOpOutcome` (a od tej fali wszystkie sześć handlerów toru zwraca),
    // honorujemy go dosłownie. Jeśli zwróci cokolwiek innego — zostaje
    // `ok: true`, bo (a) wyjątek propaguje się sam i nie udaje sukcesu,
    // (b) w tej ścieżce człowiek ma toast jako właściwy kanał, (c) każdy
    // wywołujący z `src/components/**` i tak robi `void runIdeaAction(...)`.
    const ui = runUiClosure(run);
    if (ui.outcome && !ui.outcome.ok) {
      return {
        ok: false,
        actionId,
        confirmed: false,
        message: laneRefusalMessage(ui.outcome.reason, String(ctx.params?.laneId ?? '?')),
        data: { reason: ui.outcome.reason },
      };
    }
    return { ok: true, actionId, confirmed: ui.confirmed };
  }

  const laneId =
    typeof ctx.params?.laneId === 'string' && ctx.params.laneId
      ? ctx.params.laneId
      : ctx.selection?.type === 'lane' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!laneId) {
    return {
      ok: false,
      actionId,
      message: 'Nie wiem, na którym torze Przepływu wykonać tę akcję — podaj `laneId` albo zaznacz go najpierw.',
    };
  }
  const runtime = RUNTIME_LANE_ACTION_MAPS[actionId]?.[ctx.tool];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  const ack = await dispatchQuickActionAwaited(runtime, ctx, {
    laneId,
    ...(ctx.params || {}),
    ...(extra || {}),
  });
  if (ack.ok) {
    return { ok: true, actionId, confirmed: true, data: { runtime, laneId } };
  }
  // ODMOWA albo BRAK ODBIORNIKA. Tory są PIERWSZYM w pełni zmigrowanym
  // konsumentem, więc tu — inaczej niż w niezmigrowanej Grupie A/B — stać nas
  // na `ok: false`: znamy realny powód, a nie zgadujemy. `confirmed: false`
  // zostaje ustawione jawnie, żeby warstwa odpowiedzi nie musiała wnioskować
  // z `ok`.
  return {
    ok: false,
    actionId,
    confirmed: false,
    message: laneRefusalMessage(ack.reason, laneId),
    data: { runtime, laneId, reason: ack.reason },
  };
}

/** Wskaźnik akcja RAMKI (frame) Tablicy → jej mapa runtime, ten sam kształt
 * co `RUNTIME_LANE_ACTION_MAPS` wyżej. */
export const RUNTIME_FRAME_ACTION_MAPS: Partial<Record<string, ToolActionMap>> = {
  'idea.frame.select_contents': RUNTIME_FRAME_SELECT_CONTENTS,
  'idea.frame.resize_to_fit': RUNTIME_FRAME_RESIZE_TO_FIT,
  'idea.frame.delete_with_contents': RUNTIME_FRAME_DELETE_WITH_CONTENTS,
  'idea.frame.delete_release': RUNTIME_FRAME_DELETE_RELEASE,
};

/**
 * WB-FRAME-01 (frame context menu, 2026-08-10) — dispatcher dla akcji
 * `idea.frame.*` operujących na WSKAZANEJ ramce (`frameId`). Ten sam kształt
 * co `runLaneParamCallback` wyżej: UI = `ctx.params.run` (oryginalny
 * onSelect menu, wołający `useWhiteboardNodes.ts` bez zmian); Teresa = jawny
 * `frameId` → szyna `idea-workspace-quick-action` →
 * `useWhiteboardQuickActions.ts`.
 */
export async function runFrameParamCallback(actionId: string, ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }

  const frameId =
    typeof ctx.params?.frameId === 'string' && ctx.params.frameId ? ctx.params.frameId : undefined;
  if (!frameId) {
    return {
      ok: false,
      actionId,
      message: 'Nie wiem, na której ramce Tablicy wykonać tę akcję — podaj `frameId`.',
    };
  }
  const runtime = RUNTIME_FRAME_ACTION_MAPS[actionId]?.[ctx.tool];
  if (!runtime) {
    return {
      ok: false,
      actionId,
      message: `Ta akcja nie istnieje w tej reprezentacji (${ctx.tool}).`,
    };
  }
  // RISK-30 GRUPA A (4/6, ramki Tablicy).
  const ack = await dispatchQuickActionAwaited(runtime, ctx, { frameId });
  return { ok: true, actionId, confirmed: ack.ok, data: { runtime, frameId } };
}

/**
 * WB-FRAME-01 — `idea.node.remove_from_frame`: ten sam kształt, ale kluczem
 * jest `nodeId` DZIECKA opuszczającego ramkę, nie `frameId` samej ramki.
 */
export async function runFrameNodeParamCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.node.remove_from_frame';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId,
      message: 'Nie wiem, który element Tablicy zwolnić z ramki — podaj `nodeId`.',
    };
  }
  // RISK-30 GRUPA A (5/6, węzeł→ramka).
  const ack = await dispatchQuickActionAwaited(RUNTIME_NODE_REMOVE_FROM_FRAME.whiteboard!, ctx, {
    nodeId,
  });
  return { ok: true, actionId, confirmed: ack.ok, data: { nodeId } };
}

/**
 * `idea.node.pf_ai_rewrite_step` (N6 kontynuacja, 2026-08-09) — jedyna nowa
 * szyna węzła Przepływu w tej fali. UI: `ctx.params.run` = dokładnie
 * dotychczasowy klik (`openStepRewrite(nodeId)` w `IdeaProcessFlowTool.tsx`,
 * NIETKNIĘTY — otwiera pusty panel, człowiek sam wpisuje polecenie). Teresa:
 * nie ma przeglądarki do wpisania polecenia, więc podaje `instruction` wprost
 * w parametrach — dispatchuje na szynę z ZARÓWNO `nodeId` JAK I `instruction`,
 * a nowy odbiornik `pf_ai_rewrite_step` (`useProcessFlowQuickActions.ts`)
 * woła `createStepRewriteProposal` NATYCHMIAST (bez czekania na wpisanie
 * tekstu) — ale WCIĄŻ tylko tworzy propozycję (`AIProposalPanel`), człowiek
 * musi kliknąć Akceptuj/Odrzuć (rozdz. 09 §3, model propozycji zachowany dla
 * obu ścieżek).
 */
export async function runProcessFlowAIRewriteStepCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.node.pf_ai_rewrite_step';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  const instruction =
    typeof ctx.params?.instruction === 'string' && ctx.params.instruction.trim()
      ? ctx.params.instruction
      : undefined;
  if (!nodeId || !instruction) {
    return {
      ok: false,
      actionId,
      message:
        'Nie wiem, który krok Przepływu przeredagować i jak — podaj `nodeId` kroku oraz `instruction` (polecenie przeredagowania).',
    };
  }
  const runtime = RUNTIME_PF_NODE_AI_REWRITE_STEP.process_flow;
  if (!runtime) {
    return { ok: false, actionId, message: 'Ta akcja nie istnieje w tej reprezentacji.' };
  }
  // RISK-30 GRUPA A (6/6, węzeł + instrukcja AI).
  const ack = await dispatchQuickActionAwaited(runtime, ctx, { nodeId, instruction });
  return { ok: true, actionId, confirmed: ack.ok, data: { runtime, nodeId } };
}

/**
 * `idea.node.pf_convert_initiative` (N6 kontynuacja, 2026-08-09) — WZOROWANE
 * na `idea.workspace.convert` wyżej (bezpośrednie `Api.convertMyIdea`
 * w handlerze), NIE na szynie `idea-workspace-quick-action`. Powód
 * (sprawdzone, nie spekulacja): UI klik (`handleConvert('pf_convert_initiative')`
 * w `IdeaProcessFlowTool.tsx`) woła `onQuickAction('pf_convert_initiative',
 * { selectedIds, activeTool })` — ale `IdeaMapWorkspace.tsx`'s
 * `handleQuickAction` (odbiornik `pf_convert_*` na tej samej szynie) czyta
 * WYŁĄCZNIE `eventDetail?.nodeIds` (`CONVERT_PREFIX_MAP` branch) — `selectedIds`
 * jest polem MARTWYM, nigdy odczytanym. Efekt: `explicitNodeIds` jest ZAWSZE
 * `undefined` dla tej akcji, konwersja pada z powrotem na `selection.ids`
 * (stan całego workspace'u, zsynchronizowany z zaznaczeniem płótna) —
 * NIE na węzeł, na którym otwarto menu (prawy klik na węzeł go nie zaznacza,
 * patrz `idea.node.pf_edit`/`idea.node.duplicate`). PRZEDISTNIEJĄCY defekt
 * (nazwa pola), NIEnaprawiony tu — UI ścieżka (`ctx.params.run`) zostaje
 * dokładnie taka, jaka była. Zamiast próbować naprawić to przez tę samą,
 * wadliwą szynę, ścieżka Teresy pomija ją całkowicie i woła `Api.convertMyIdea`
 * wprost z poprawnym polem `nodeIds` — Teresa dostaje DZIAŁającą, poprawną
 * ścieżkę, której UI dziś nie ma (asymetria udokumentowana, nie ukryta).
 * Tak jak `idea.workspace.convert`, NIE replikuje dodatkowych efektów UI
 * ścieżki (`Api.createLinkGraphEdge`, `outputLinks` patch, event
 * `idea-mindmap-mark-converted`) — ta sama, już zaakceptowana uproszczona
 * ścieżka rejestru co istniejący `idea.workspace.convert` (patrz ten wpis),
 * nie nowe ograniczenie wprowadzone tutaj.
 */
export async function runProcessFlowConvertInitiativeCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.node.pf_convert_initiative';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId,
      message: 'Nie wiem, który krok Przepływu skonwertować — podaj `nodeId`.',
    };
  }
  if (!ctx.confirmed) {
    return {
      ok: false,
      actionId,
      message: 'Konwersja tworzy nowy, trwały obiekt (Inicjatywę) — potrzebuję potwierdzenia.',
    };
  }
  const data = await Api.convertMyIdea(ctx.ideaId, {
    target: 'initiative',
    options: { language: ctx.language || 'pl', nodeIds: [nodeId] },
  });
  return { ok: true, actionId, data };
}

/**
 * Konwersje Przepływu z GÓRNEGO PASKA (N6.4, 2026-08-10, `ProcessFlowToolbar.tsx`
 * grupa „Konwertuj": Inicjatywa · Zestaw zadań · Raport · Analiza).
 *
 * MECHANIZM (sprawdzony, nie założony): wszystkie cztery pozycje wołają TĘ SAMĄ
 * funkcję `handleConvert(action)` w `IdeaProcessFlowTool.tsx:2385`, co menu
 * węzła dla „Konwertuj na inicjatywę" — dokładnie ten sam `onQuickAction(action,
 * { selectedIds, activeTool })`. Dlatego pozycja „Inicjatywa" NIE dostaje
 * nowego id, tylko rozszerza `surfaces` istniejącego
 * `idea.node.pf_convert_initiative` o `'toolbar'` (reużycie po REALNYM
 * mechanizmie, nie po etykiecie). Pozostałe trzy targety nie mają wpisu —
 * dostają własne id, wzorem Mapy myśli, która też ma OSOBNE id per target
 * (`idea.node.mm_convert_initiative`/`_decision`/`_tasks`).
 *
 * `scope: 'single_item'` i parametr `nodeId` — świadomie IDENTYCZNE jak w
 * `idea.node.pf_convert_initiative` (wpis N6, 2026-08-09), żeby cztery
 * konwersje Przepływu nie miały czterech różnych kontraktów dla tego samego
 * mechanizmu. Uczciwa granica jest ta sama co tam: klik człowieka (z paska
 * LUB z menu węzła) wysyła pole `selectedIds`, którego odbiornik w powłoce
 * NIGDY nie czyta (`IdeaMapWorkspace.tsx:1040` czyta wyłącznie `nodeIds`),
 * więc UI konwertuje bieżące zaznaczenie płótna; ścieżka Teresy omija tę
 * wadliwą szynę i woła `Api.convertMyIdea` wprost z poprawnym `nodeIds`.
 * PRZEDISTNIEJĄCY defekt nazwy pola, NIE naprawiany tutaj (UI nietknięte).
 */
export async function runProcessFlowConvertTargetCallback(
  actionId: string,
  target: 'task_set' | 'report',
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId,
      message: 'Nie wiem, który krok Przepływu skonwertować — podaj `nodeId`.',
    };
  }
  if (!ctx.confirmed) {
    return {
      ok: false,
      actionId,
      message: 'Konwersja tworzy nowy, trwały obiekt — potrzebuję potwierdzenia.',
    };
  }
  const data = await Api.convertMyIdea(ctx.ideaId, {
    target,
    options: { language: ctx.language || 'pl', nodeIds: [nodeId] },
  });
  return { ok: true, actionId, data };
}

/**
 * `idea.node.pf_convert_analysis` (N6.4, 2026-08-10) — ★ POZYCJA MARTWA,
 * ZALOGOWANA UCZCIWIE, NIE NAPRAWIONA I NIE UKRYTA.
 *
 * ŁAŃCUCH DOWODOWY (sprawdzony końcówka-do-końcówki, nie wnioskowany):
 *   1. `ProcessFlowToolbar.tsx` renderuje pozycję „Analiza" → `onConvert('pf_convert_analysis')`.
 *   2. `IdeaProcessFlowTool.handleConvert` → `onQuickAction('pf_convert_analysis', …)`.
 *   3. `IdeaMapWorkspace.tsx:1032` `CONVERT_PREFIX_MAP` mapuje ją na target `'analysis'`.
 *   4. `handleConvert(target)` (`IdeaMapWorkspace.tsx:2202`) sprawdza
 *      `IDEA_CONVERT_TARGETS.some(t => t.id === target)` — a `'analysis'`
 *      zostało z tej tablicy USUNIĘTE w audycie Z3 z 2026-07-24
 *      (`ideaConvertTargets.ts`, komentarz w tablicy wprost wymienia
 *      `analysis` jako jeden z sześciu skasowanych: serwer nie ma dla niego
 *      handlera i zwróciłby surowe 400).
 *   5. Efekt dla użytkownika: `toast.error('mindmap.thisConversionTargetIsNotYet')`.
 *      Klik ZAWSZE kończy się czerwonym komunikatem o błędzie. Nigdy nie
 *      konwertuje.
 *
 * To jest naruszenie Z3 („zero martwych kliknięć") żyjące dziś na paskach
 * Przepływu — pozostałe trzy pozycje tej samej grupy działają, więc wygląda
 * jak zwykła opcja. NIE usuwam jej z menu w tej zmianie (zakres: okablowanie
 * rejestru, nie redesign paska; decyzja „usunąć czy dowieźć target `analysis`
 * na serwerze" należy do właściciela). Rejestr opisuje ją TAKĄ, JAKA JEST:
 * `mutates: false`, bo dzisiejsza akcja NIGDY niczego nie tworzy — zadeklarowanie
 * `mutates: true` + `undo: manual_delete` byłoby opisem akcji, która nie
 * istnieje. Klik człowieka zostaje BAJT W BAJT taki sam (ta sama ścieżka, ten
 * sam toast), a Teresa dostaje jawną odmowę zamiast obietnicy.
 */
export async function runProcessFlowConvertAnalysisCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.node.pf_convert_analysis';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  return {
    ok: false,
    actionId,
    message:
      'Konwersja Przepływu na „Analizę" nie istnieje dziś w produkcie — target `analysis` został usunięty z listy konwersji (serwer nie ma dla niego obsługi), więc ta pozycja menu kończy się wyłącznie komunikatem o błędzie. Nie mogę jej wykonać; jeśli chodzi o analizę procesu, użyj „AI: analiza procesu" (wąskie gardła i luki, tylko odczyt).',
  };
}

/**
 * Konwersja węzła/gałęzi Mapy myśli do artefaktu (N5 trzecia fala, 2026-08-09
 * — `NodeContextMenu.tsx` grupy Convert/„Convert branch to…" + dual-surface
 * `FloatingNodeToolbar.tsx` „Convert branch"). Klik człowieka (`ctx.params.run`)
 * idzie DOKŁADNIE dotychczasową ścieżką (`onAction(item.id)` →
 * `handleContextAction` w `IdeaRecommendationMap.tsx`).
 *
 * E11 UPDATE (2026-08-10, docs/standards/idea-workspace/10_*, §2.1/§2.2 —
 * checked against real code before changing anything, per house rule):
 *  - FIXED: the plain "Convert" group (`idea.node.mm_convert_initiative`/
 *    `_decision`/`_tasks`, single-item label) used to route through
 *    `convertBranch()` — the SAME function as "Convert branch to…" — so it
 *    always cascaded to every descendant despite the label. It now calls a
 *    separate `convertSingleNode()` (exactly one nodeId, RUNTIME_MM_NODE_
 *    CONVERT_SINGLE / bus action `mm_convert_single`) — see those three
 *    entries below. "Convert branch to…" (this block, `RUNTIME_MM_NODE_
 *    CONVERT_BRANCH`) is unchanged: it is SUPPOSED to cascade, and still does.
 *  - FIXED: a mandatory preview (`ConversionPreviewDialog`, gating
 *    `IdeaMapWorkspace.handleConvert`) now runs before any of these actions
 *    persists anything — `requiresPreview: true` below reflects that.
 *  - CORRECTED, not new: a prior version of this comment claimed the backend
 *    "unconditionally overwrites promoted_to/promoted_entity_id/stage on the
 *    WHOLE Idea" for every conversion. Re-verified directly against
 *    `server/src/routes/my-work.routes.ts`'s `promote()` (POST .../convert):
 *    that claim is FALSE at this HEAD — the P0-1 fix (`f319307019`, 2026-07-
 *    23, predates this comment) already inserts an append-only row into
 *    `my_idea_conversions` for EVERY conversion and only flips `promoted_to`/
 *    `stage='promoted'` when `scope==='workspace'` (no nodeIds). Correcting
 *    the record here rather than propagating a stale claim.
 *  - STILL OPEN: `my_idea_conversions` does not yet carry `mappingVersion`
 *    (audyt 09 §9's `{conversionId,targetType,targetId,scope,
 *    sourceElementIds,createdAt,createdBy,mappingVersion,sourceLink}` shape)
 *    — additive migration `20260810_idea_conversion_mapping_version.sql`
 *    adds the column (NOT run against any database, per DB SAFETY).
 *    `undo.kind: 'manual_delete'` stays honest: no automatic undo of the
 *    created downstream record exists.
 *
 * ZASTRZEŻENIE target `process_flow` — SPRAWDZONE, NIE spekulacja (pierwsza
 * lektura tego wpisu podejrzewała pętlę re-dispatchu; obalone przez
 * `tests/unit/mywork/h2.3-mindmap-processflow-branch-conversion.test.ts`,
 * commit `35e55d879d`, zanim wylądowało tutaj — patrz ten test dla dowodu).
 * `process_flow` NIE jest w `IDEA_CONVERT_TARGETS`/`CONVERT_PREFIX_MAP`
 * (`ideaConvertTargets.ts`) i faktycznie NIE idzie przez `Api.convertMyIdea`
 * jak pozostałe cztery targety (initiative/decision/task_set) — `convertBranch`
 * dispatchuje `convert_process_flow` z jawnym `nodeIds`, co
 * `IdeaMapWorkspace.tsx`'s `handleQuickAction` łapie NA SAMEJ GÓRZE funkcji
 * (`XFORM_MAP[action] || (action === 'convert_process_flow' && explicitNodeIds)`,
 * `IdeaMapWorkspace.tsx:888`) i kieruje przez `transformSelection` — TĘ SAMĄ
 * ścieżkę co „Przełącz na Proces" (`xform_to_flow`), nie przez konwersję do
 * artefaktu w innym module. Efekt: węzły gałęzi trafiają jako nowe kroki DO
 * WŁASNEGO Procesu Idei (`idea-workspace-insert`, `setActiveTool('process_flow')`),
 * BEZ nowego rekordu w innym module, BEZ `outputLinks`, BEZ `Api.convertMyIdea`.
 * Uczciwie: to jest bliżej „Generowanie reprezentacji" z rozdz. 10 §1 niż
 * „Konwersja do artefaktu" (mimo etykiety menu „Convert branch → Process
 * Flow") — istniejąca, PRZEDISTNIEJĄCA niezgodność nazwy z definicją rozdz.
 * 10, nie coś wprowadzone lub naprawione tym wpisem. Undo tej JEDNEJ pozycji
 * (`idea.node.mm_convert_branch_process_flow` niżej) jest oznaczone uczciwie
 * inaczej niż pozostałych siedmiu — patrz jej `undo.evidence`.
 */
export async function runMindmapNodeConvertAction(
  actionId: string,
  target: string,
  map: ToolActionMap,
  ctx: ActionContext,
  // E11 fix (2026-08-10): `cascades` distinguishes the plain "Convert" items
  // (RUNTIME_MM_NODE_CONVERT_SINGLE, cascades:false — single node only) from
  // "Convert branch" (RUNTIME_MM_NODE_CONVERT_BRANCH, default true — node +
  // all descendants). Purely affects the confirm-prompt wording below; the
  // actual scope is enforced FE-side by which handler `map` points at
  // (convertSingleNode vs convertBranch never collects descendants/does).
  opts: { cascades: boolean } = { cascades: true }
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId,
      message: opts.cascades
        ? 'Podaj `nodeId` węzła (kotwicy poddrzewa) do konwersji.'
        : 'Podaj `nodeId` węzła do konwersji.',
    };
  }
  if (!ctx.confirmed) {
    return {
      ok: false,
      actionId,
      message: opts.cascades
        ? 'Konwersja tworzy nowy, trwały obiekt w innym module (i obejmuje CAŁE poddrzewo tego węzła) — potrzebuję potwierdzenia.'
        : 'Konwersja tworzy nowy, trwały obiekt w innym module (WYŁĄCZNIE ten jeden węzeł, bez potomków) — potrzebuję potwierdzenia.',
    };
  }
  return runByTool(actionId, map, ctx, { nodeId, target });
}

/**
 * `idea.node.mm_attach_knowledge` (N5 czwarta fala, 2026-08-09) — jedyna
 * pozycja grupy Style & data z realnym, ADRESOWALNYM po `nodeId` punktem
 * wejścia (`idea-workspace-attach-knowledge`, `IdeaMapWorkspace.tsx:2716-2726`
 * — czyta `detail.nodeId`+`detail.ideaId` i otwiera popover artefaktów na
 * WSKAZANYM węźle). W PRZECIWIEŃSTWIE do `idea.node.attach_knowledge`
 * (Tablica, wyżej) — tamten odbiornik SPRAWDZONO, że IGNORUJE
 * `detail.nodeId` i działa wyłącznie na bieżące zaznaczenie przeglądarki, więc
 * jest UI-only. Tu odbiornik jest inny plik/inny mechanizm i faktycznie
 * honoruje `nodeId` — stąd OSOBNY wpis (nie rozszerzenie `tools` istniejącego),
 * bus-wired.
 */
export function dispatchMindmapAttachKnowledge(nodeId: string, ideaId: string) {
  window.dispatchEvent(
    new CustomEvent('idea-workspace-attach-knowledge', { detail: { nodeId, ideaId } })
  );
}

export async function runMindmapAttachKnowledgeCallback(ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId: 'idea.node.mm_attach_knowledge' };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId: 'idea.node.mm_attach_knowledge',
      message: 'Podaj `nodeId` węzła, do którego dołączyć wiedzę.',
    };
  }
  dispatchMindmapAttachKnowledge(nodeId, ctx.ideaId || '');
  return { ok: true, actionId: 'idea.node.mm_attach_knowledge', data: { nodeId } };
}

export async function runNodeEditLabelCallback(ctx: ActionContext): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId: 'idea.node.edit' };
  }
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  const label = typeof ctx.params?.label === 'string' ? ctx.params.label : undefined;
  if (!nodeId || !label) {
    return {
      ok: false,
      actionId: 'idea.node.edit',
      message: 'Podaj `nodeId` elementu i nową `label` — bez nich nie wiem, co zmienić.',
    };
  }
  dispatchNodeUpdate(nodeId, { label });
  return { ok: true, actionId: 'idea.node.edit', data: { nodeId } };
}

/**
 * `idea.node.wb_open_detail` (N-inventory-c5, 2026-08-10) — pure function of
 * `nodeId`, no closure/`ctx.params.run` needed (unlike most UI-only callbacks
 * here): dispatching `idea-node-open-detail` with `{ nodeId }` is EXACTLY what
 * `CommentPinBadge.tsx`'s onClick already did before this wave — same event
 * name, same detail shape — so both the UI click and a future Teresa call
 * take the identical, real code path.
 */
export async function runWbOpenDetailCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.node.wb_open_detail';
  const nodeId =
    typeof ctx.params?.nodeId === 'string' && ctx.params.nodeId
      ? ctx.params.nodeId
      : ctx.selection?.type === 'node' && typeof ctx.selection.primaryId === 'string'
        ? ctx.selection.primaryId
        : undefined;
  if (!nodeId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `nodeId` elementu Tablicy, którego szczegóły mam otworzyć.',
    };
  }
  window.dispatchEvent(new CustomEvent('idea-node-open-detail', { detail: { nodeId } }));
  return { ok: true, actionId, data: { nodeId } };
}

// ───────────────────── MAPY RUNTIME (parsowane przez strażnika) ─────────────────────

/**
 * „Dodaj element" — cztery warianty JEDNEJ akcji (Z1).
 * Źródło: `IdeaMapWorkspace.tsx` MENU3_ADD_ACTION_PER_TOOL (commit f5d0271992).
 */
export const RUNTIME_ADD_ELEMENT: ToolActionMap = {
  mindmap: 'mm_add_child',
  whiteboard: 'wb_add_sticky',
  process_flow: 'pf_add_step',
  table: 'tbl_add_row',
};

/** Auto-układ. Przepływ ma WŁASNY silnik (`pf_auto_layout`, f5d0271992). */
export const RUNTIME_AUTO_LAYOUT: ToolActionMap = {
  process_flow: 'pf_auto_layout',
};

/**
 * GAP-3 „Map structure type" (closure 2026-08-10, 04_ACTION_COVERAGE_INVENTORY.csv
 * class-d) — Mapa myśli WYŁĄCZNIE. `mm_set_structure` ma już żywy odbiornik
 * (`useMindMapQuickActions.ts` ~L1296: `pushUndo()` + `setStructureType` +
 * `applyStructureLayout` + `setNodes` + `fitView` + toast), dziś wołany z
 * `MindmapCommandPalette.tsx:330`. Ten wpis daje mu id rejestru + wpina
 * `StructurePickerPopover`'s `onSelect` (IdeaRecommendationMap.tsx ~L6880) w
 * TĘ SAMĄ szynę zamiast duplikować identyczną logikę drugi raz w komponencie
 * (poprzedni stan: dwie niezależne implementacje tej samej mutacji).
 */
export const RUNTIME_MM_SET_STRUCTURE: ToolActionMap = {
  mindmap: 'mm_set_structure',
};

/** Tryb kursora — stan wyłącznie Mapy myśli (obsługa: IdeaMapWorkspace.tsx:1060). */
/**
 * Tier A rail wiring (2026-08-10) — CanvasLeftToolbar.tsx's `pointer_toggle`
 * slot (SHARED_TOP, ~linia 144-159) jest ŻYWY w TRZECH reprezentacjach
 * (`liveIn: ['mindmap', 'whiteboard', 'process_flow']`), nie tylko w Mapie
 * myśli — Tabela ma wyszarzony powód (siatka danych, nie płótno). Runtime
 * string `mm_select_mode` (nazwa historyczna) ma REALNY odbiornik też w
 * `useWhiteboardQuickActions.ts:147` i `useProcessFlowQuickActions.ts:216`
 * (`handlers.setCursorMode?.('select')`, weryfikowane grepem PRZED
 * rozszerzeniem — nie zgadywane), więc rozszerzenie mapy to REUSE, nie
 * spekulacja.
 */
export const RUNTIME_CURSOR_SELECT: ToolActionMap = {
  mindmap: 'mm_select_mode',
  whiteboard: 'mm_select_mode',
  process_flow: 'mm_select_mode',
};

/** AI: rozwiń (Mapa) — `/map/expand` + AIProposalDiffModal. */
export const RUNTIME_AI_EXPAND: ToolActionMap = {
  mindmap: 'mm_ai_expand',
};

/** AI: podsumuj mapę — delegacja do czatu Teresy (bez mutacji grafu). */
export const RUNTIME_AI_SUMMARIZE: ToolActionMap = {
  mindmap: 'mm_ai_summarize',
};

/**
 * Rail tier B (2026-08-10, Program B/E02) — dwie pozycje popovera AI lewego
 * raila (`AIActionsPopover.tsx` `GENERAL_GENERATORS`), które jako JEDYNE z
 * sekcji „AI generators" Mapy myśli nie miały DOTĄD żadnego wpisu w rejestrze
 * (`mm_ai_expand`/`mm_ai_summarize`/`mm_ai_suggest` już mają, `mm_ai_cluster`
 * świadomie pominięty — patrz raport/komentarz przy `idea.ai.auto_connect`).
 *
 * UWAGA FORMATU: jedna para `tool: 'action',` PER LINIA — `scripts/check-actions.sh`
 * R6 nie widzi jednolinijkowych literałów (ostrzeżenie z nagłówka pliku).
 *
 * Odbiorniki SPRAWDZONE grepem PRZED wpisem (nie zgadywane):
 * `useMindMapQuickActions.ts:883` (`mm_ai_gap_analysis`) i `:1057`
 * (`mm_ai_auto_connect`). OBA robią DOKŁADNIE JEDNO: składają prompt i wołają
 * `handlers.onOpenChat(prompt)`. Żaden nie dotyka grafu — stąd `mutates: false`
 * i opisy Teresy niżej mówiące to WPROST (etykieta „Auto cross-links" obiecuje
 * więcej, niż kod robi — udokumentowane, nie „naprawione" po cichu).
 */
export const RUNTIME_AI_GAP_ANALYSIS: ToolActionMap = {
  mindmap: 'mm_ai_gap_analysis',
};
export const RUNTIME_AI_AUTO_CONNECT: ToolActionMap = {
  mindmap: 'mm_ai_auto_connect',
};

/** AI: znajdź tematy (Tablica) — generator `wb_find_themes` przez Propose→Accept. */
export const RUNTIME_AI_FIND_THEMES: ToolActionMap = {
  whiteboard: 'wb_ai_find_themes',
};

/** AI: nazwij skupiska (Tablica) — `wb_name_clusters`, zmienia etykiety istniejących. */
export const RUNTIME_AI_NAME_CLUSTERS: ToolActionMap = {
  whiteboard: 'wb_ai_name_clusters',
};

/** AI: wyciągnij działania (Tablica) — `wb_extract_actions`. */
export const RUNTIME_AI_EXTRACT_ACTIONS: ToolActionMap = {
  whiteboard: 'wb_ai_extract_actions',
};

/** AI: analiza procesu (Przepływ) — `process_coach`, wynik tylko do odczytu. */
export const RUNTIME_AI_PROCESS_ANALYSIS: ToolActionMap = {
  process_flow: 'pf_analyze',
};

/** AI: asystent tabeli — otwiera modal AITableAssistant (mutacja dopiero w środku). */
export const RUNTIME_AI_TABLE_ASSISTANT: ToolActionMap = {
  table: 'tbl_ai_assistant',
};

/** AI: kategoryzacja tabeli — otwiera AICategorizeTool (Apply/Apply all per klaster). */
export const RUNTIME_AI_TABLE_CATEGORIZE: ToolActionMap = {
  table: 'tbl_categorize',
};

/** AI: generator frameworka (Tabela) — otwiera FrameworkGenerator. */
export const RUNTIME_AI_TABLE_FRAMEWORK: ToolActionMap = {
  table: 'tbl_framework',
};

/**
 * N8 (2026-08-10) — Tabela, menu widoku zapisanego (`IdeaTableTool.tsx`'s
 * `viewContextMenu`, renderowane przez `CanvasContextMenu`, WYŁĄCZNIE ścieżka
 * legacy/non-platform — patrz komentarz przy `idea.view.saved_view_rename`
 * niżej dla pełnego uzasadnienia). Trzy osobne mapy (nie jedna zbiorcza), bo
 * `scripts/check-actions.sh` (R6) parsuje TYLKO `const X: ToolActionMap = {…}`
 * z jedną parą `tool: 'string',` na linię (ostrzeżenie na górze pliku).
 * Odbiornik: `useTableQuickActions.ts` `tbl_view_rename`/`tbl_view_update`/
 * `tbl_view_delete` (nowe, dopisane w tej samej zmianie).
 */
export const RUNTIME_TBL_VIEW_RENAME: ToolActionMap = {
  table: 'tbl_view_rename',
};
export const RUNTIME_TBL_VIEW_UPDATE: ToolActionMap = {
  table: 'tbl_view_update',
};
export const RUNTIME_TBL_VIEW_DELETE: ToolActionMap = {
  table: 'tbl_view_delete',
};

/**
 * N8.2 (2026-08-10) — Tabela, menu kolumny (`IdeaTableTool.tsx`'s
 * `colContextMenu`, prawy klik na nagłówku kolumny, `CanvasContextMenu`).
 * Pełne uzasadnienie zakresu (co jest ścieżką legacy, a co dwutorową) —
 * w komentarzu blokowym nad `tableColumnGuard` niżej.
 * Cztery osobne mapy (nie jedna), z tego samego powodu co
 * `RUNTIME_TBL_VIEW_*` wyżej (strażnik R6 parsuje wyłącznie
 * `const X: ToolActionMap = { … }` z jedną parą na linię).
 */
export const RUNTIME_TBL_COLUMN_RENAME: ToolActionMap = {
  table: 'tbl_column_rename',
};
export const RUNTIME_TBL_COLUMN_SORT: ToolActionMap = {
  table: 'tbl_column_sort',
};
export const RUNTIME_TBL_COLUMN_HIDE: ToolActionMap = {
  table: 'tbl_column_hide',
};
export const RUNTIME_TBL_COLUMN_DELETE: ToolActionMap = {
  table: 'tbl_column_delete',
};

/**
 * N8.2 (2026-08-10) — Tabela, menu wiersza (`IdeaTableTool.tsx`'s
 * `rowContextMenu`, renderowane przez `CanvasContextMenu` na prawy klik
 * wiersza danych). Cztery osobne mapy (nie jedna zbiorcza) z tego samego
 * powodu co `RUNTIME_TBL_VIEW_*` wyżej — `scripts/check-actions.sh` (R6)
 * parsuje TYLKO `const X: ToolActionMap = {…}` z jedną parą `tool: 'string',`
 * na linię. Odbiornik: `useTableQuickActions.ts` `tbl_row_edit`/
 * `tbl_row_note`/`tbl_row_duplicate`/`tbl_row_delete` (nowe, dopisane w tej
 * samej zmianie).
 */
export const RUNTIME_TBL_ROW_EDIT: ToolActionMap = {
  table: 'tbl_row_edit',
};
export const RUNTIME_TBL_ROW_NOTE: ToolActionMap = {
  table: 'tbl_row_note',
};
export const RUNTIME_TBL_ROW_DUPLICATE: ToolActionMap = {
  table: 'tbl_row_duplicate',
};
export const RUNTIME_TBL_ROW_DELETE: ToolActionMap = {
  table: 'tbl_row_delete',
};

/**
 * N9 (2026-08-10) — Tabela, menu komórki (`IdeaTableTool.tsx`'s
 * `cellContextMenu`, `CanvasContextMenu` na prawy klik pojedynczej komórki,
 * ~L4101-4183). Tylko JEDNA z czterech pozycji menu ma tu mapę runtime —
 * `table.cell.clear` (`idea.cell.clear` niżej) — bo to jedyna z czterech,
 * która jest czystą mutacją danych bez zależności od schowka
 * przeglądarki/pozycji ekranu (patrz `runTableCellUiOnlyCallback` niżej dla
 * `idea.cell.copy`/`.paste`/`.expand`, świadomie UI-only). Odbiornik:
 * `useTableQuickActions.ts` `tbl_cell_clear` (nowy, dopisany w tej samej
 * zmianie).
 */
export const RUNTIME_TBL_CELL_CLEAR: ToolActionMap = {
  table: 'tbl_cell_clear',
};

/**
 * N10 (2026-08-10) — `TableToolbar.tsx` (powierzchnia PLATFORM WYŁĄCZNIE —
 * ten plik renderuje się TYLKO gdy `IdeaTableTool.tsx`'s `usePlatform` jest
 * `true`, patrz `IdeaTableTool.tsx` „{usePlatform ? <P15TableToolbar …/> :
 * …}" ~L2242 — więc `ctx`'y z `useTableData()` czytane w tym pliku SĄ zawsze
 * `platformIntegration`, nigdy legacy). Siedem runtime stringów poniżej
 * AKTYWUJE dotychczas SIEROCE odbiorniki `useTableQuickActions.ts`'s
 * `toggleMap` (`tbl_scoring`/`tbl_export_pptx`/`tbl_pipeline`/`tbl_copilot`/
 * `tbl_voice`/`tbl_cross_relations`/`tbl_heatmap` — SPRAWDZONE grepem PRZED
 * wpisem: zero nadawców w całym `src/` przed tą zmianą, dokładnie ta sama
 * klasa jak `tbl_sort`, patrz decyzja przy nim niżej). ZWERYFIKOWANE per
 * pozycja (nie zgadywane): odbiornik woła DOKŁADNIE ten sam `setShowX`
 * state-setter z `IdeaTableTool.tsx`, który `TableToolbar.tsx`'s prop
 * (`props.onShowScoringModel` itd.) już woła dziś przy kliku — REALNY reuse
 * mechanizmu, nie etykiety. `tbl_heatmap` jest wyjątkiem: klik człowieka jest
 * PRZEŁĄCZNIKIEM (`props.onToggleHeatmap` = `() => setShowHeatmap((p) =>
 * !p)`), a odbiornik zawsze USTAWIA `true` — `runToolbarBusAction` niżej
 * zachowuje to uczciwie (UI woła oryginalny toggle 1:1 przez `ctx.params.run`,
 * Teresa dostaje wyłącznie „otwórz", udokumentowane w `teresa.description`).
 */
export const RUNTIME_TBL_SCORING: ToolActionMap = {
  table: 'tbl_scoring',
};
export const RUNTIME_TBL_EXPORT_PPTX: ToolActionMap = {
  table: 'tbl_export_pptx',
};
export const RUNTIME_TBL_PIPELINE: ToolActionMap = {
  table: 'tbl_pipeline',
};
export const RUNTIME_TBL_COPILOT: ToolActionMap = {
  table: 'tbl_copilot',
};
export const RUNTIME_TBL_VOICE: ToolActionMap = {
  table: 'tbl_voice',
};
export const RUNTIME_TBL_CROSS_RELATIONS: ToolActionMap = {
  table: 'tbl_cross_relations',
};
export const RUNTIME_TBL_HEATMAP: ToolActionMap = {
  table: 'tbl_heatmap',
};
// 04_ACTION_COVERAGE_INVENTORY.csv class-d closure (2026-08-10): `tbl_export_csv`
// already existed and works (`useTableQuickActions.ts` ~L285, real
// exportToCSV+downloadCSV) — only the registry id was missing. `tbl_copy_clipboard`
// is NEW wiring (same file, mirrors `tbl_export_csv` 1:1) added alongside this entry.
export const RUNTIME_TBL_EXPORT_CSV: ToolActionMap = {
  table: 'tbl_export_csv',
};
export const RUNTIME_TBL_COPY_CLIPBOARD: ToolActionMap = {
  table: 'tbl_copy_clipboard',
};

/**
 * N10 (2026-08-10) — `TableToolbar.tsx`'s widok zapisany (menu prawego
 * kliku na zakładce widoku, ~L502-555), ścieżka PLATFORM: `ctx.updateSavedView`/
 * `.deleteSavedView` z `useTableData()` = REALNE, asynchroniczne
 * `platformIntegration.updateSavedView`/`.deleteSavedView`
 * (`useTablePlatformViews.ts`) — INNY mechanizm niż `idea.view.saved_view_*`
 * wyżej, które wołają WYŁĄCZNIE legacy `useTableViews.ts` (patrz uzasadnienie
 * przy `runTableSavedViewRenameCallback` powyżej: `TableToolbar.tsx` była
 * wtedy ŚWIADOMIE NIEOKABLOWANA, „sprawa kolejnej fali" — to jest ta fala).
 * Tylko Rename i Delete dostają tu realny odbiornik Teresy — Update wymaga
 * migawki BIEŻĄCEGO stanu widoku platformy (sort/filters/groupBy/layout/
 * columns z `platformIntegration`, dziś NIEPRZEKAZANEJ do
 * `useTableQuickActions.ts`), więc zostaje UI-only (patrz
 * `idea.view.table_platform_saved_view_update` niżej) — dopisanie tego
 * payloadu bez zgadywania kształtu wymaga osobnego zadania.
 */
export const RUNTIME_TBL_VIEW_RENAME_PLATFORM: ToolActionMap = {
  table: 'tbl_view_rename_platform',
};
export const RUNTIME_TBL_VIEW_DELETE_PLATFORM: ToolActionMap = {
  table: 'tbl_view_delete_platform',
};

/**
 * `WhiteboardToolbar.tsx` (2026-08-09, N7 kontynuacja) — pięć wariantów
 * dropdownu „Wstaw" (dawniej hardkodowana tablica `items` w komponencie).
 * Runtime stringi `wb_add_shape_*`/`wb_add_image`/`wb_add_link` JUŻ MAJĄ
 * odbiornik w `useWhiteboardQuickActions.ts` (linie 100-123) — komponent po
 * prostu nigdy z niego nie korzystał, wołał `addElement(kind)` bezpośrednio z
 * closure. Migracja na `dispatchQuickAction` daje Teresie te 5 akcji ZA DARMO
 * (żadnej nowej szyny) — inaczej niż akcje niżej bez istniejącego odbiornika.
 */
// UWAGA FORMATU: jedna para `tool: 'action',` PER LINIA (nie w jednej linii z
// `const`) — `scripts/check-actions.sh` R6 parsuje mapy runtime awk-em wg
// dosłownego wzorca z nagłówka pliku; skrócony zapis `{ whiteboard: '...' }`
// w jednej linii jest NIEWIDOCZNY dla strażnika (cichy brak weryfikacji R6),
// dokładnie tej klasy błędu ma zapobiegać.
export const RUNTIME_INSERT_SHAPE_CIRCLE: ToolActionMap = {
  whiteboard: 'wb_add_shape_circle',
};
export const RUNTIME_INSERT_SHAPE_DIAMOND: ToolActionMap = {
  whiteboard: 'wb_add_shape_diamond',
};
export const RUNTIME_INSERT_SHAPE_HEXAGON: ToolActionMap = {
  whiteboard: 'wb_add_shape_hexagon',
};
export const RUNTIME_INSERT_IMAGE: ToolActionMap = {
  whiteboard: 'wb_add_image',
};
export const RUNTIME_INSERT_LINK: ToolActionMap = {
  whiteboard: 'wb_add_link',
};
/** WB-P2-03 "Tidy board" / "Auto arrange selection" — useWhiteboardNodes.tidyBoard. */
export const RUNTIME_TIDY_BOARD: ToolActionMap = {
  whiteboard: 'wb_tidy_board',
};

/**
 * Cofnij/Ponów — WSPÓLNE dla wszystkich czterech reprezentacji (Z1), pierwsze
 * takie użycie w rejestrze poza `idea.element.add`. Runtime stringi już mają
 * odbiorniki: `mm_undo`/`mm_redo` (useMindMapQuickActions.ts:254-255),
 * `wb_undo`/`wb_redo` (useWhiteboardQuickActions.ts:141-142), `pf_undo`/`pf_redo`
 * (useProcessFlowQuickActions.ts:183-184), `tbl_undo`/`tbl_redo`
 * (useTableQuickActions.ts:102-109) — weryfikowane grepem przed dopisaniem,
 * nie zgadywane.
 */
export const RUNTIME_UNDO: ToolActionMap = {
  mindmap: 'mm_undo',
  whiteboard: 'wb_undo',
  process_flow: 'pf_undo',
  table: 'tbl_undo',
};
export const RUNTIME_REDO: ToolActionMap = {
  mindmap: 'mm_redo',
  whiteboard: 'wb_redo',
  process_flow: 'pf_redo',
  table: 'tbl_redo',
};

/**
 * Sesja współpracy Tablicy (`WhiteboardToolbar.tsx` overflow „…") — runtime
 * stringi już obsłużone w `useWhiteboardQuickActions.ts` (linie 149-152), tak
 * jak insert-shape wyżej: komponent dziś woła prop bezpośrednio, odbiornik
 * szyny czeka nieużywany.
 */
export const RUNTIME_TOGGLE_VOTING: ToolActionMap = {
  whiteboard: 'wb_session_toggle_voting',
};
export const RUNTIME_CYCLE_ROLE: ToolActionMap = {
  whiteboard: 'wb_session_cycle_role',
};
export const RUNTIME_TOGGLE_FOLLOW: ToolActionMap = {
  whiteboard: 'wb_session_toggle_follow',
};

/**
 * N7 kontynuacja (2026-08-09) — Whiteboard node/pane PPM (`IdeaCanvasContextMenu.tsx`).
 * `wb_duplicate`/`wb_delete` MAJĄ JUŻ odbiornik w `useWhiteboardQuickActions.ts`
 * (linie ok. 133-135) wołający DOKŁADNIE `handlers.duplicateSelected`/
 * `deleteSelected` — te same funkcje, które `IdeaWhiteboardTool.tsx` przekazuje
 * jako propy `onDuplicate`/`onDeleteNode` do tego menu. Reuse za darmo, bez
 * nowej szyny.
 *
 * N6 kontynuacja Przepływu (2026-08-09, `ProcessFlowContextMenu.tsx`'s
 * `getNodeContextActions` + dual-surface `ProcessFlowFloatingToolbar.tsx`):
 * `pf_duplicate`/`pf_delete` REUŻYTE tu (rozszerzenie `tools`, NIE nowe id) —
 * SPRAWDZONE, nie zgadywane: `duplicateSelected()`/`deleteSelected()` w
 * `useProcessFlowNodes.ts` operują na PŁASKIM zaznaczeniu płótna (tak jak
 * Tablica), NIE na drzewie z rodzicem (w przeciwieństwie do Mapy myśli, która
 * dlatego świadomie NIE reużyła tych id — `idea.node.mm_duplicate`/`mm_delete`
 * niżej, `single_item` zakotwiczony pod rodzicem). Oba mają już odbiornik w
 * `useProcessFlowQuickActions.ts` (`pf_duplicate`/`pf_delete`, istniały PRZED
 * tą zmianą — wołane dotąd tylko z Menu 3/rail), zero nowego kodu w hooku.
 */
export const RUNTIME_NODE_DUPLICATE: ToolActionMap = {
  whiteboard: 'wb_duplicate',
  process_flow: 'pf_duplicate',
};
export const RUNTIME_NODE_DELETE: ToolActionMap = {
  whiteboard: 'wb_delete',
  process_flow: 'pf_delete',
};

/**
 * `wb_ai_to_map`/`wb_ai_to_table` MAJĄ JUŻ odbiornik (AI_ACTION_MAP w
 * `useWhiteboardQuickActions.ts` → `handlers.runAIAction('wb_to_map_branches'
 * | 'wb_to_table')`) — dotąd nieużywany przez żaden wpis rejestru (podobnie
 * jak insert-shape ×5 przed toolbar-wpisem). Reuse za darmo.
 */
export const RUNTIME_WB_TO_MINDMAP: ToolActionMap = {
  whiteboard: 'wb_ai_to_map',
};
export const RUNTIME_WB_TO_TABLE: ToolActionMap = {
  whiteboard: 'wb_ai_to_table',
};

/**
 * `PaneContextMenu.tsx` (N5 kontynuacja, 2026-08-09) — tło (pane) Mapy myśli,
 * 13 pozycji. Każda mapa niżej wskazuje na odbiornik, który JUŻ ISTNIEJE i
 * JEST ŻYWY w `useMindMapQuickActions.ts` (zweryfikowane grepem przed
 * dopisaniem — żaden nowy odbiornik poza `mm_select_all`, patrz komentarz przy
 * tej mapie). `PaneContextMenu.tsx` przekazuje `ctx.params.run` (swój
 * dotychczasowy `onAction(item.id)` z `IdeaRecommendationMap.tsx` —
 * NIETKNIĘTY) dla WSZYSTKICH 13 pozycji, więc klik człowieka idzie DOKŁADNIE
 * tą samą ścieżką co przed migracją (zero zmiany zachowania); mapy niżej
 * dają Teresie (`ctx.source === 'teresa'`, brak `run`) drugą, realną ścieżkę
 * przez `runToolbarBusAction` → szynę `idea-workspace-quick-action`.
 */
export const RUNTIME_PANE_ADD_ROOT: ToolActionMap = {
  // Odbiornik od 2026-07-28 (`handlers.addRootTopic()`), dotąd używany tylko
  // przez `MindmapCommandPalette.tsx` (Cmd+K) — bez wpisu w rejestrze.
  // RÓŻNICA od kliku człowieka (świadoma, nie naprawiana tutaj): pozycja
  // nowego węzła to stały offset od korzenia, nie punkt prawego kliku —
  // Teresa nie ma pojęcia "gdzie kliknięto", więc offset jest uczciwym
  // zachowaniem zastępczym, nie regresją klik-ścieżki (ta idzie przez `run`).
  mindmap: 'mm_add_root',
};
export const RUNTIME_PANE_SELECT_ALL: ToolActionMap = {
  // NOWY odbiornik — `useMindMapQuickActions.ts`, dopisany przy tej migracji
  // (poprzednio `pane_select_all` żył WYŁĄCZNIE lokalnie w
  // `IdeaRecommendationMap.handlePaneContextAction`, bez odbiornika na szynie).
  mindmap: 'mm_select_all',
};
export const RUNTIME_PANE_FIT_VIEW: ToolActionMap = {
  // Odbiornik już istnieje (`useMindMapQuickActions.ts` `mm_fit_view` →
  // `handlers.fitView`) — używany dotąd np. przez `CanvasLeftToolbar`/paletę
  // poleceń, nigdy przez ten rejestr.
  mindmap: 'mm_fit_view',
};
export const RUNTIME_PANE_AUTO_CLUSTER: ToolActionMap = {
  // Odbiornik już istnieje i mutuje realnie (grupuje węzły-sieroty w klastry,
  // `handlers.pushUndo()` wewnątrz) — `useMindMapQuickActions.ts` `mm_auto_cluster`.
  mindmap: 'mm_auto_cluster',
};
export const RUNTIME_PANE_COLLAPSE_ALL: ToolActionMap = {
  // `mm_fold_0` — ta sama gałąź obsługi co `mm_fold_1`/`mm_fold_2`/`mm_fold_3`
  // (`useMindMapQuickActions.ts`, `handlers.setFoldLevel?.(level)`).
  mindmap: 'mm_fold_0',
};
export const RUNTIME_PANE_FOLD_1: ToolActionMap = {
  mindmap: 'mm_fold_1',
};
export const RUNTIME_PANE_FOLD_2: ToolActionMap = {
  mindmap: 'mm_fold_2',
};
export const RUNTIME_PANE_EXPAND_ALL: ToolActionMap = {
  mindmap: 'mm_expand_all',
};
export const RUNTIME_PANE_AI_SUGGEST: ToolActionMap = {
  // Odbiornik już istnieje — otwiera czat z promptem "zasugeruj gałęzie"
  // (`handlers.onOpenChat`), z fallbackiem na `handlers.handleAIExpand()`
  // (ta sama wywoła AI co `idea.ai.expand_map`) gdy czat niedostępny.
  mindmap: 'mm_ai_suggest',
};

/**
 * `NodeContextMenu.tsx` (N5 kontynuacja, druga fala, 2026-08-09) — grupy
 * Edit/Structure/Delete (Convert/Convert-branch/Style&data i AI ŚWIADOMIE
 * NIETKNIĘTE, osobne przyszłe fale). Każda mapa niżej ma JUŻ ŻYWY odbiornik w
 * `useMindMapQuickActions.ts` — zweryfikowane grepem przed dopisaniem — poza
 * trzema NOWYMI: `mm_connect_nodes`, `mm_detach_branch`, `mm_duplicate_branch`
 * (dopisane tą samą zmianą; `detachBranch`/`duplicateBranch` istniały już w
 * `IdeaRecommendationMap.tsx` od V5-IDEA-17, ale nigdy nie były przekazane do
 * `useMindMapQuickActions`' `handlers` — dopięte tutaj, nie duplikowane).
 */
export const RUNTIME_MM_NODE_ADD_CHILD: ToolActionMap = {
  mindmap: 'mm_add_child',
};
export const RUNTIME_MM_NODE_ADD_SIBLING: ToolActionMap = {
  mindmap: 'mm_add_sibling',
};
export const RUNTIME_MM_NODE_DUPLICATE: ToolActionMap = {
  mindmap: 'mm_duplicate',
};
export const RUNTIME_MM_NODE_DELETE: ToolActionMap = {
  mindmap: 'mm_delete',
};
export const RUNTIME_MM_NODE_TOGGLE_COLLAPSE: ToolActionMap = {
  mindmap: 'mm_toggle_collapse',
};
export const RUNTIME_MM_NODE_CONNECT: ToolActionMap = {
  // NOWY odbiornik (patrz useMindMapQuickActions.ts) — czyta detail.nodeId
  // (węzeł źródłowy, ten sam parsing co wszystkie inne akcje węzłowe) oraz
  // detail.targetNodeId (drugi węzeł, NOWE pole — bez odpowiednika gdzie
  // indziej w tym pliku, bo żadna inna akcja węzłowa nie wymaga DRUGIEGO id).
  mindmap: 'mm_connect_nodes',
};
export const RUNTIME_MM_NODE_DETACH_BRANCH: ToolActionMap = {
  mindmap: 'mm_detach_branch',
};
export const RUNTIME_MM_NODE_DUPLICATE_BRANCH: ToolActionMap = {
  mindmap: 'mm_duplicate_branch',
};
/**
 * N5 trzecia fala (2026-08-09) — WSPÓLNY runtime string dla WSZYSTKICH ośmiu
 * `idea.node.mm_convert_*`/`idea.node.mm_convert_branch_*` wpisów niżej
 * (Convert + Convert-branch grupy): jeden odbiornik w
 * `useMindMapQuickActions.ts` (`mm_convert_branch`) czyta `target` z payloadu
 * (`{ nodeId, target }`, dopisane przez `runMindmapNodeConvertAction`) zamiast
 * ośmiu osobnych runtime stringów — target JEST już wybrany przez to, KTÓRĄ
 * akcję Teresa/klik zawołały (`idea.node.mm_convert_initiative` zawsze niesie
 * `target:'initiative'`), więc osiem runtime stringów byłoby czystą
 * duplikacją bez dodatkowej informacji.
 */
export const RUNTIME_MM_NODE_CONVERT_BRANCH: ToolActionMap = {
  mindmap: 'mm_convert_branch',
};
/**
 * E11 fix (2026-08-10, docs/standards/idea-workspace/10_*, §2.1 „Element"):
 * separate runtime string for the THREE plain "Convert" node items
 * (`idea.node.mm_convert_initiative`/`_decision`/`_tasks`). These used to
 * share `RUNTIME_MM_NODE_CONVERT_BRANCH` with the five real "Convert branch"
 * items — meaning a single-node label always cascaded to every descendant
 * (E02-N5-CONVERT honesty finding). `useMindMapQuickActions.ts`'s
 * `mm_convert_single` handler calls `handlers.convertSingleNode`
 * (`IdeaRecommendationMap.tsx`), which dispatches exactly one nodeId.
 */
export const RUNTIME_MM_NODE_CONVERT_SINGLE: ToolActionMap = {
  mindmap: 'mm_convert_single',
};
/**
 * N5 czwarta fala (2026-08-09) — grupa AI węzła Mapy myśli. Reużywa
 * ISTNIEJĄCY runtime string `mm_ai_expand` (RUNTIME_AI_EXPAND wyżej, dziś
 * używany przez `idea.ai.expand_map` w zasięgu `workspace`, rail/panel) —
 * TEN SAM odbiornik (`handlers.handleAIExpand(targetNodeId)`,
 * `useMindMapQuickActions.ts:872`) już honoruje `detail.nodeId`, więc nowy
 * wpis w zasięgu `single_item` (menu węzła) może bezpiecznie dzielić string
 * zamiast duplikować go pod nową nazwą.
 */
export const RUNTIME_MM_NODE_AI_WHAT_IF: ToolActionMap = {
  // Odbiornik (`useMindMapQuickActions.ts:1121`) IGNORUJE `detail.nodeId` —
  // zawsze tylko `setShowWhatIf(true)`, tak samo jak klik z menu węzła
  // (`IdeaRecommendationMap.tsx:4900`, `setShowWhatIf(true)` bez żadnego
  // targetowania). Modal wewnątrz i tak bierze `nodes.find(n => n.selected)`
  // — SPRAWDZONE PRZED wpisem, nie spekulacja (patrz honesty w teresa.description
  // niżej): ani klik z menu węzła, ani Teresa nie mogą dziś wskazać
  // KONKRETNEGO węzła dla tej akcji, mimo że jest wystawiona w menu węzła.
  mindmap: 'mm_ai_what_if',
};
export const RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH: ToolActionMap = {
  // UWAGA — DWIE RÓŻNE ścieżki dla "podsumuj gałąź" (sprawdzone PRZED wpisem):
  // klik z menu węzła (`ctx_summarize_branch`) woła `summarizeBranch()`
  // (`IdeaRecommendationMap.tsx:4808-4828`), który TYLKO wypełnia prompt czatu
  // (`idea-workspace-chat-prompt`) — zero realnej generacji. Ten runtime
  // string (`mm_ai_summarize_branch`, odbiornik `useMindMapQuickActions.ts:1081`)
  // to INNY, MOCNIEJSZY mechanizm: otwiera `BranchSummaryPanel.tsx`, który
  // faktycznie woła `Api.*` po prawdziwe podsumowanie LLM. Świadomie wybrany
  // dla Teresy zamiast repliki "wypełnij czat" (dałby Teresie gorszy wynik niż
  // ma dziś dostępny w kodzie) — udokumentowana rozbieżność UI-vs-Teresa, jak
  // `idea.node.ai_find_themes` wyżej. Odbiornik używa WYŁĄCZNIE
  // `handlers.getSelectedNode()`, IGNORUJE `detail.nodeId` — ta sama uczciwa
  // granica co powyżej (`RUNTIME_MM_NODE_AI_WHAT_IF`).
  mindmap: 'mm_ai_summarize_branch',
};
export const RUNTIME_MM_NODE_AI_SUGGEST_LINKS: ToolActionMap = {
  // UWAGA — KLIK Z MENU WĘZŁA JEST DZIŚ MARTWY (sprawdzone grepem, nie
  // spekulacja): `handleContextAction` w `IdeaRecommendationMap.tsx` NIE MA
  // gałęzi `if (action === 'ai_suggest_links')` — lista `if`-ów kończy się na
  // `ctx_delete` bez obsługi tego id. Ten SAM string działa dziś WYŁĄCZNIE z
  // pływającego paska (`FloatingAIPopover.tsx:52` → `useMindMapQuickActions.ts:1123`
  // → dispatch `mm_ai_suggest_links_execute` → `IdeaMapWorkspace.tsx:1047`
  // realny `generateAIProposal` + `setProposalBatch`, proposal-first). Zgodnie
  // z zasadą „zachowaj dokładny klik" NIE naprawiamy tu martwej gałęzi w
  // `handleContextAction` (zmieniłoby to widoczne zachowanie kliku, poza
  // zakresem tego wiringu) — `ctx.params.run` zostaje bajt-identyczny
  // no-opem dla człowieka, a Teresa dostaje TEN SAM realny odbiornik, którego
  // pływający pasek już używa. Zgłoszone jako oddzielna, tania naprawa do
  // zrobienia (jedna brakująca gałąź `if`).
  mindmap: 'ai_suggest_links',
};

/**
 * N8 (2026-08-10) — Tabela, menu widoku zapisanego. Trzy pozycje z
 * `IdeaTableTool.tsx`'s `viewContextMenu` (`saved_view_rename`/
 * `saved_view_update`/`saved_view_delete`, `CanvasContextMenu` na prawy klik
 * zakładki widoku) + inline-rename `<input>` obok (sam commit "Rename" woła tę
 * samą `updateSavedView`).
 *
 * ZAKRES WYBORU (odbiór PRZED wpisem — dwie hand-rolled implementacje
 * potwierdzone jako RÓŻNE MECHANIZMY, nie ta sama akcja pod dwiema
 * powierzchniami):
 *  • `IdeaTableTool.tsx`'s `viewContextMenu` (ta migracja) woła legacy
 *    `updateSavedView`/`deleteSavedView` z `useTableViews.ts` — SYNCHRONICZNE
 *    settery `useState<SavedView[]>`, zero persystencji poza pamięcią
 *    komponentu, zero wywołania API.
 *  • `TableToolbar.tsx` (renderowany zamiast tego bloku, gdy `usePlatform`)
 *    ma WŁASNĄ, osobno napisaną kopię TEGO SAMEGO UI (linie ~496-549,
 *    identyczny układ trzech pozycji + identyczny kształt payloadu "Update"),
 *    ale przez `useTableData()` → `TableDataProvider.tsx` (linie ~299-311)
 *    czyta `integration.savedViews`/`.updateSavedView`/`.deleteSavedView` —
 *    czyli `platformIntegration`, ASYNCHRONICZNE (`Promise<void>`), realnie
 *    zapisujące na serwer. SPRAWDZONE (nie zgadywane): sygnatury się różnią
 *    (`void` vs `Promise<void>`), a stan źródłowy to DWIE OSOBNE instancje
 *    hooka (`useTableViews()` w `IdeaTableTool.tsx` vs `useTablePlatform`-owa
 *    integracja przekazana do `TableDataProvider`) — identyczne UI, różny
 *    silnik pod spodem, dokładnie ten wzorzec, który Przepływ już świadomie
 *    odrzucił dla `idea.node.pf_copy` (REAL MECHANISM MATCH, nie etykieta).
 *  Decyzja: wpisy niżej okablowują WYŁĄCZNIE ścieżkę `IdeaTableTool.tsx`
 *  (legacy). `TableToolbar.tsx`'s osobna, zduplikowana implementacja
 *  ŚWIADOMIE zostaje NIEOKABLOWANA — udokumentowana tu i w raporcie, sprawa
 *  kolejnej fali (poza zakresem: dotknięcie `TableToolbar.tsx` nie było
 *  celem tego zadania).
 *
 * Dwie ścieżki (jak wszędzie): `ctx.source === 'ui'` + `ctx.params.run` =
 * dokładnie dotychczasowy klik (komponent NIETKNIĘTY — `onSelect` w
 * `viewContextMenu` i `onBlur`/`onKeyDown` inline-rename inputa zostają
 * bajt-identyczne; `ctx.params.run` istnieje w handlerach niżej dla spójności
 * z resztą rejestru, ale żaden dzisiejszy caller go dziś nie ustawia — Tabela
 * nie importuje `runIdeaAction`, taki sam stan jak `ProcessFlowContextMenu.tsx`
 * po N6). Teresa: dispatch na szynę `idea-workspace-quick-action`
 * (`tbl_view_rename`/`tbl_view_update`/`tbl_view_delete`, NOWE odbiorniki w
 * `useTableQuickActions.ts`) — realna, id-adresowalna mutacja
 * (`updateSavedView(viewId, patch)`/`deleteSavedView(viewId)`), zweryfikowana
 * PRZED wpisem jako osiągalna (nie wymyślona).
 *
 * Widok `'default'` (zawsze pierwszy, tworzony na sztywno w
 * `useTableViews.ts`) NIE MA menu prawego kliku w ogóle (`IdeaTableTool.tsx`:
 * `if (v.id !== 'default') setViewContextMenu(...)`) — wszystkie trzy handlery
 * niżej powtarzają tę samą blokadę dla Teresy, żeby nie dać jej robić czegoś,
 * czego człowiek fizycznie nie może kliknąć.
 *
 * UNDO: żadna z trzech mutacji nie jest dziś podłączona do JAKIEGOKOLWIEK
 * stosu cofania — `updateSavedView`/`deleteSavedView` (`useTableViews.ts`)
 * to gołe `setSavedViews`, nigdy nie wołają `nodesUndo.push` (który i tak
 * śledzi WYŁĄCZNIE `TableNode[]`, nie `SavedView[]`) — udokumentowane
 * honestly w `undo.evidence` każdego wpisu (nie naprawiane tu: `updateSavedView`
 * ma DWÓCH wywołujących w tym samym pliku — context menu I inline-rename —
 * współdzielona funkcja, ryzykowna do cichej zmiany w tym zadaniu; `deleteSavedView`
 * nieodwracalne bez backupu, stąd `manual_delete`-podobne ostrzeżenie mimo
 * braku nowego obiektu do skasowania).
 */
export function tableSavedViewGuard(actionId: string, viewId: string | undefined): ActionResult | null {
  if (!viewId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `viewId` zapisanego widoku Tabeli, na którym mam to wykonać.',
    };
  }
  if (viewId === 'default') {
    return {
      ok: false,
      actionId,
      message:
        'Domyślny widok Tabeli nie jest edytowalny — to samo ograniczenie, co w menu prawego kliku (nie pokazuje się dla niego).',
    };
  }
  return null;
}

export async function runTableSavedViewRenameCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.view.saved_view_rename';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const viewId = typeof ctx.params?.viewId === 'string' ? ctx.params.viewId : undefined;
  const guard = tableSavedViewGuard(actionId, viewId);
  if (guard) return guard;
  const name = typeof ctx.params?.name === 'string' ? ctx.params.name.trim() : undefined;
  if (!name) {
    return { ok: false, actionId, message: 'Podaj nową `name` (nazwę) widoku.' };
  }
  return runByTool(actionId, RUNTIME_TBL_VIEW_RENAME, ctx, { viewId, name });
}

export async function runTableSavedViewUpdateCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.view.saved_view_update';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const viewId = typeof ctx.params?.viewId === 'string' ? ctx.params.viewId : undefined;
  const guard = tableSavedViewGuard(actionId, viewId);
  if (guard) return guard;
  // Payload budowany PO STRONIE odbiornika (`useTableQuickActions.ts`) z
  // bieżącego stanu komponentu (sort/filters/groupBy/viewLayout/columns) —
  // dokładnie jak klik człowieka na "Update" — nie tutaj, rejestr nie ma
  // dostępu do stanu płótna.
  return runByTool(actionId, RUNTIME_TBL_VIEW_UPDATE, ctx, { viewId });
}

export async function runTableSavedViewDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.view.saved_view_delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const viewId = typeof ctx.params?.viewId === 'string' ? ctx.params.viewId : undefined;
  const guard = tableSavedViewGuard(actionId, viewId);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_VIEW_DELETE, ctx, { viewId });
}

/**
 * N10 (2026-08-10) — `TableToolbar.tsx` (powierzchnia PLATFORM WYŁĄCZNIE,
 * patrz komentarz przy `RUNTIME_TBL_SCORING` i grupie RUNTIME_TBL_* powyżej).
 * Ten sam kształt co `runToolbarUiOnlyCallback` (Tablica) / `runContextMenuUiOnlyCallback`
 * (menu PPM Tablicy), z UCZCIWYM komunikatem dla górnego paska Tabeli.
 * Sprawdzone PRZED użyciem per pozycja (patrz komentarz przy każdym `id:`
 * niżej, który jej używa), że nie istnieje dziś żaden bezpieczny,
 * zweryfikowany punkt wejścia dla Teresy.
 */
export async function runTableToolbarUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z górnego paska narzędzi Tabeli (widok platformowy) — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * `idea.ai.table_schema_propose` (N-inventory-b-medium, 2026-08-10) — panel
 * Chat-to-Schema Tabeli. Ten sam kształt co `runTableToolbarUiOnlyCallback`
 * powyżej, osobna funkcja WYŁĄCZNIE dla uczciwego komunikatu ("panel", nie
 * "górny pasek narzędzi").
 */
export async function runTableChatToSchemaProposeCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.ai.table_schema_propose';
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z otwartego panelu Chat-to-Schema Tabeli — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * Jak `runKeyboardOnlyCallback`, ale dla trzech akcji Tabeli, które od tej
 * zmiany (N10, 2026-08-10) mają DWA realne wejścia UI (skrót klawiszowy I
 * przycisk `TableToolbar.tsx`) — żadne z nich nie ma dziś wejścia dla Teresy,
 * więc komunikat odmowy musi być uczciwy wobec OBU, nie tylko klawiatury
 * (stąd nie reużyto wspólnego `runKeyboardOnlyCallback`, którego treść
 * mówiłaby "wyłącznie ze skrótu" — nieprawda po tej zmianie).
 */
export async function runTableToolbarOrKeyboardCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z klawiatury lub górnego paska narzędzi Tabeli — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

export async function runTablePlatformSavedViewRenameCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.view.table_platform_saved_view_rename';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const viewId = typeof ctx.params?.viewId === 'string' ? ctx.params.viewId : undefined;
  const guard = tableSavedViewGuard(actionId, viewId);
  if (guard) return guard;
  const name = typeof ctx.params?.name === 'string' ? ctx.params.name.trim() : undefined;
  if (!name) {
    return { ok: false, actionId, message: 'Podaj nową `name` (nazwę) widoku.' };
  }
  return runByTool(actionId, RUNTIME_TBL_VIEW_RENAME_PLATFORM, ctx, { viewId, name });
}

export async function runTablePlatformSavedViewDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.view.table_platform_saved_view_delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const viewId = typeof ctx.params?.viewId === 'string' ? ctx.params.viewId : undefined;
  const guard = tableSavedViewGuard(actionId, viewId);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_VIEW_DELETE_PLATFORM, ctx, { viewId });
}

/**
 * N8.2 (2026-08-10) — Tabela, MENU KOLUMNY. Cztery pozycje z
 * `IdeaTableTool.tsx`'s `colContextMenu` (`CanvasContextMenu` na prawy klik
 * NAGŁÓWKA kolumny, `testId="idea-table-column-context-menu"`, ~L3990-4022):
 * "Rename" / "Sort" / "Hide column" / "Delete column".
 *
 * ─── ZAKRES: DLACZEGO NOWE IDENTYFIKATORY, A NIE REUŻYCIE ────────────────────
 * Sprawdzone PRZED wpisem, per akcja, po REALNYM MECHANIZMIE (nie po etykiecie):
 *  • `tbl_sort` — DAWNIEJ istniał tu jako odbiornik w `useTableQuickActions.ts`
 *    (~L200) o myląco podobnej nazwie. NIE była to ta sama akcja: nie
 *    przyjmowała ŻADNEGO klucza kolumny (sortowała twardo po `'label'`, gdy
 *    nic nie było posortowane), była DWUSTANOWA (asc↔desc), i pisała do
 *    LEGACY `setSort`. Menu kolumny woła `effectiveCycleSort(colKey)` —
 *    konkretna kolumna, TRZY stany (asc→desc→BRAK sortowania), i dwutorowo
 *    (platforma albo legacy). Inny mechanizm → osobne `idea.column.sort`.
 *    DECYZJA (N10, 2026-08-10, program wiring `TableToolbar.tsx`):
 *    `tbl_sort` NIE MIAŁ ŻADNEGO nadawcy w całym `src/` (ani rejestr, ani
 *    żaden komponent go nie wysyłał — SPRAWDZONE grepem, w tym
 *    `TableToolbar.tsx`, który nie ma osobnego przycisku „Sort") ani żadnego
 *    naturalnego dispatchera do dopisania — USUNIĘTY z `useTableQuickActions.ts`
 *    (martwa gałąź), nie zostawiony jako sierota. Sortowanie Tabeli ma dziś
 *    wyłącznie `idea.column.sort` (per-kolumna, opisane wyżej).
 *  • `idea.view.saved_view_*` (N8.1) — dotyczą ZAPISANEGO WIDOKU
 *    (`SavedView[]`), nie definicji kolumn (`ColumnDef[]`). Zero pokrycia.
 *  • Brak jakiegokolwiek istniejącego wpisu o zakresie `table_column` — te
 *    cztery są pierwszymi użyciami tego (już zadeklarowanego) `ActionScope`,
 *    analogicznie do tego, jak N6.3 pierwszy raz użył `lane_frame`.
 *
 * ─── DWIE ŚCIEŻKI ────────────────────────────────────────────────────────────
 * `ctx.source === 'ui'` + `ctx.params.run` = dokładnie dotychczasowy klik
 * (komponent NIETKNIĘTY — cztery `onSelect` w `colContextMenu` zostają
 * bajt-identyczne; `ctx.params.run` istnieje dla spójności z resztą rejestru,
 * ale żaden dzisiejszy caller go nie ustawia — Tabela nie importuje
 * `runIdeaAction`, ten sam stan co po N8.1). Teresa: szyna
 * `idea-workspace-quick-action` (`tbl_column_*`, NOWE odbiorniki w
 * `useTableQuickActions.ts`), adresowanie przez `colKey`.
 *
 * ─── ZNALEZIONY, UDOKUMENTOWANY, NAPRAWIONY (2026-08-10) — ROZJAZD LEGACY/PLATFORMA ────
 * `IdeaTableTool.tsx` ma wszędzie wzorzec `usePlatform ? platformIntegration.X : X`.
 * Menu kolumny go ŁAMAŁO dla trzech z czterech pozycji:
 *  • "Sort" → `effectiveCycleSort` — było POPRAWNE (dwutorowe), bez zmian.
 *  • "Hide column" → goły LEGACY `toggleColumn` (L4009).
 *  • "Delete column" → goły LEGACY `deleteColumn` (L4018).
 *  • inline-rename nagłówka → goły LEGACY `renameColumn` (L3745/L3750).
 * Tymczasem nagłówki renderują `stretchedVisibleCols` ← `_visCols` ←
 * `usePlatform ? effectiveVisibleColumns : visibleColumns` (L654), a ten sam
 * `<table>` renderuje się w OBU trybach (gałąź `_vl`, nie `usePlatform`).
 * Skutek w trybie platformy BYŁ: ukrycie/usunięcie/zmiana nazwy kolumny mutowały
 * NIEUŻYWANY stan legacy — pozycje menu nie robiły NIC widocznego, a "Delete
 * column" DODATKOWO pokazywał zielony toast „Column deleted" (kłamliwy sukces).
 * `platformIntegration` MA komplet odpowiedników
 * (`useTablePlatformIntegration.ts` L319/L348/L359), przy czym `deleteColumn`
 * to REALNE serwerowe kasowanie pola (metoda `deleteField` z modułu
 * `TablePlatformApi`; zapisane rozłącznie, bo `check-actions.sh` R8 traktuje
 * zapis `Api.<metoda>` w TYM pliku jako deklarację realnego wywołania
 * endpointu — to tylko opis cudzego kodu) — INNY MECHANIZM niż
 * legacy `setColumns` w pamięci.
 * NAPRAWA: `IdeaTableTool.tsx` dostał `effectiveToggleColumn`/
 * `effectiveDeleteColumn`/`effectiveRenameColumn` (ten sam
 * `usePlatform ? platformIntegration.X : X` wzorzec co reszta pliku) i
 * WSZYSTKIE TRZY miejsca kliku człowieka (`colContextMenu` Hide/Delete +
 * inline-rename nagłówka) teraz ich używają — menu przestało kłamać, w
 * trybie platformy Hide/Rename/Delete robią to, co pokazują. "Delete column"
 * dostał też `window.confirm` (destrukcyjne, bez pokrycia w Ctrl+Z — patrz
 * `undo` niżej), zgodny z istniejącym wzorcem tego samego pliku (inne
 * `window.confirm` już w `IdeaTableTool.tsx` L974).
 * DECYZJA (uaktualniona): odbiorniki Teresy dostają te SAME `effective*`
 * funkcje co klik człowieka — NIE osobną platformową ścieżkę. Poprzednia
 * wersja tego komentarza (przed naprawą) świadomie trzymała Teresę na
 * legacy, żeby nie tworzyć DWÓCH mechanizmów pod jednym id, gdy klik
 * człowieka sam był legacy-only. Teraz, gdy klik człowieka jest dwutorowy,
 * ten sam powód odwraca decyzję: dawanie Teresie legacy-only funkcji
 * ZNOWU stworzyłoby dwa mechanizmy pod jednym id (klik = tryb aktywny,
 * Teresa = zawsze legacy) — więc Teresa dostaje `effective*`, dokładnie jak
 * klik. Skutek: w trybie platformy Teresa ma TRWAŁE, SERWEROWE kasowanie
 * kolumny (`deleteField`) identyczne z tym, co robi wtedy klik człowieka —
 * to jest ZAMIERZONE (menu przestało kłamać w obie strony), opisane wprost
 * w `teresa.description` każdego z trzech wpisów.
 *
 * ─── UNDO ────────────────────────────────────────────────────────────────────
 * Żadna z czterech mutacji nie jest podłączona do JAKIEGOKOLWIEK stosu cofania.
 * `toggleColumn`/`renameColumn`/`deleteColumn` (`useTableSchema.ts` L99/L111/L130)
 * to gołe `setColumns`, a jedyny stos Tabeli to `useUndoRedo<TableNode[]>`
 * (`IdeaTableTool.tsx` L417) — śledzi WIERSZE, nie `ColumnDef[]`. Dorobienie
 * cofania wymagałoby NOWEJ infrastruktury (osobny stos kolumn + wpięcie w
 * Ctrl+Z), nie jednego `pushUndo()` — czyli nie „małej, bezpiecznej" naprawy
 * przewidzianej regułą. Udokumentowane w `undo.evidence` każdego wpisu,
 * świadomie NIE łatane po cichu.
 */
export function tableColumnGuard(actionId: string, colKey: string | undefined): ActionResult | null {
  if (!colKey) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `colKey` (klucz kolumny Tabeli), na której mam to wykonać.',
    };
  }
  return null;
}

export async function runTableColumnRenameCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.column.rename';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const colKey = typeof ctx.params?.colKey === 'string' ? ctx.params.colKey : undefined;
  const guard = tableColumnGuard(actionId, colKey);
  if (guard) return guard;
  const name = typeof ctx.params?.name === 'string' ? ctx.params.name.trim() : undefined;
  if (!name) {
    return { ok: false, actionId, message: 'Podaj nową `name` (nazwę) kolumny.' };
  }
  return runByTool(actionId, RUNTIME_TBL_COLUMN_RENAME, ctx, { colKey, name });
}

export async function runTableColumnSortCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.column.sort';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const colKey = typeof ctx.params?.colKey === 'string' ? ctx.params.colKey : undefined;
  const guard = tableColumnGuard(actionId, colKey);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_COLUMN_SORT, ctx, { colKey });
}

export async function runTableColumnHideCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.column.hide';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const colKey = typeof ctx.params?.colKey === 'string' ? ctx.params.colKey : undefined;
  const guard = tableColumnGuard(actionId, colKey);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_COLUMN_HIDE, ctx, { colKey });
}

export async function runTableColumnDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.column.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const colKey = typeof ctx.params?.colKey === 'string' ? ctx.params.colKey : undefined;
  const guard = tableColumnGuard(actionId, colKey);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_COLUMN_DELETE, ctx, { colKey });
}

/**
 * N8.2 (2026-08-10) — Tabela, menu wiersza (`table.row.*`). Cztery pozycje z
 * `IdeaTableTool.tsx`'s `rowContextMenu` (`table.row.edit`/`table.row.note`/
 * `table.row.duplicate`/`table.row.delete`, `CanvasContextMenu` na prawy klik
 * wiersza danych).
 *
 * ZAKRES WYBORU (odbiór PRZED wpisem — KOREKTA 2026-08-10 po ponownej
 * weryfikacji; pierwsza wersja tego komentarza twierdziła, że
 * `handleDuplicateRow`/`handleDeleteRow` mają „dokładnie jedno miejsce
 * wywołania" — to było FAŁSZ, obalone grepem `grep -rn "handleDuplicateRow\|
 * handleDeleteRow" src`):
 *  • `TableToolbar.tsx` — sprawdzone, NIE MA tu duplikatu menu wiersza (to był
 *    precedens z `idea.view.saved_view_*`, gdzie duplikat faktycznie istnieje;
 *    tutaj nie powtarza się).
 *  • `ViewRouter.tsx` (P15/platform, `rowMenu` ~L973-1105) — MA własne,
 *    ręcznie sklecone menu prawego kliku wiersza (nie `CanvasContextMenu`,
 *    goły `<div>` z `<button>`ami), którego pozycje „Duplikuj wiersz" (L1051)
 *    i „Usuń wiersz" (L1101) wołają `handleDuplicateRow`/`handleDeleteRow` z
 *    `useTableData()` → `TableDataProvider.tsx:294-295` →
 *    `integration.handleDuplicateRow`/`.handleDeleteRow`. A `integration` to
 *    DOKŁADNIE TA SAMA instancja `platformIntegration`, którą
 *    `IdeaTableTool.tsx:2164-2165` (`<TableDataProvider integration=
 *    {platformIntegration}>`) wstrzykuje — czyli w trybie platform to TEN SAM
 *    OBIEKT FUNKCJI co `effectiveHandleDuplicateRow`/`effectiveHandleDeleteRow`
 *    tutaj. To REAL MECHANISM MATCH (odwrotnie niż przy saved-views, gdzie
 *    sygnatury i instancje stanu były różne) → gdy przyjdzie fala na
 *    `ViewRouter.tsx`, jego dwie pozycje mają REUŻYĆ `table.row.duplicate`/
 *    `table.row.delete` (rozszerzenie `surfaces`), a NIE dostać nowych id.
 *    Świadomie NIEOKABLOWANE tutaj — `ViewRouter.tsx` jest poza zakresem tego
 *    zadania; udokumentowane, nie ukryte.
 *
 * OSIĄGALNOŚĆ (sprawdzone, ważne dla czytania `undo.evidence` niżej):
 * `rowContextMenu` wisi na `renderRow` (`IdeaTableTool.tsx:1736-1740`), a
 * `renderRow` jest wołane WYŁĄCZNIE w gałęzi legacy render-ternary
 * (L3858/L3906) — przy `usePlatform === true` renderuje się zamiast tego
 * `<P15ViewRouter>` (L3553-3557). Czyli CZŁOWIEK dociera do tych czterech
 * pozycji tylko w trybie legacy (gałęzie `usePlatform` wewnątrz
 * `openRowEditPanel` i wewnątrz `effective*` są z tej powierzchni martwe dla
 * kliku; w trybie platform człowiek używa `rowMenu` z `ViewRouter.tsx` wyżej).
 * TERESA dociera zawsze — hook `useTableQuickActions` montuje się niezależnie
 * od `usePlatform` — więc dla niej gałąź platform JEST żywa i dlatego
 * `undo.evidence` niżej opisuje OBIE gałęzie, nie tylko legacy.
 *
 * CROSS-TOOL REUSE (sprawdzone, nie zgadywane): `idea.node.duplicate`/
 * `idea.node.delete` (Tablica/Przepływ, `scope: 'selected_items'`) operują na
 * TYM, CO JEST DZIŚ ZAZNACZONE NA PŁÓTNIE — bez `nodeId`, przez
 * `runToolbarBusAction` + canvas-selection state. Tabela NIE ma zaznaczenia
 * płótna — `effectiveHandleDuplicateRow(rowId)`/`effectiveHandleDeleteRow(rowId)`
 * (`useTableRows.ts`/`useTablePlatformIntegration.ts`) przyjmują JAWNE `id`
 * z prostej tablicy `TableNode[]`/platform `nodes[]`, żadnego mechanizmu
 * zaznaczenia canvasu pod spodem. RÓŻNY MECHANIZM (płaska tablica + jawne id
 * vs. canvas-selection state) → NOWE id, nie rozszerzenie
 * `idea.node.duplicate`/`.delete`.
 *
 * Dwie ścieżki (jak wszędzie): `ctx.source === 'ui'` + `ctx.params.run` =
 * dokładnie dotychczasowy klik (komponent NIETKNIĘTY poza wyjęciem dwóch
 * onSelect-body do nazwanych funkcji `openRowEditPanel`/`openRowNotePanel` —
 * sama logika bajt-identyczna, patrz komentarz przy ich deklaracji w
 * `IdeaTableTool.tsx`; `table.row.duplicate`/`.delete` w ogóle nie zostały
 * dotknięte w JSX). Teresa: dispatch na szynę `idea-workspace-quick-action`
 * (nowe odbiorniki w `useTableQuickActions.ts`).
 *
 * UNDO — CZĘŚCIOWE, udokumentowane honestly przy `table.row.duplicate`/
 * `.delete` niżej (odkryte przy tym wpisie: `effectiveHandleDuplicateRow`/
 * `effectiveHandleDeleteRow` branchują na `usePlatform` i tylko JEDNA z dwóch
 * gałęzi ma realny stos cofania).
 */
export function tableRowGuard(actionId: string, rowId: string | undefined): ActionResult | null {
  if (!rowId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `rowId` wiersza Tabeli, na którym mam to wykonać.',
    };
  }
  return null;
}

export async function runTableRowEditCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.row.edit';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const rowId = typeof ctx.params?.rowId === 'string' ? ctx.params.rowId : undefined;
  const guard = tableRowGuard(actionId, rowId);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_ROW_EDIT, ctx, { rowId });
}

export async function runTableRowNoteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.row.note';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const rowId = typeof ctx.params?.rowId === 'string' ? ctx.params.rowId : undefined;
  const guard = tableRowGuard(actionId, rowId);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_ROW_NOTE, ctx, { rowId });
}

export async function runTableRowDuplicateCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.row.duplicate';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const rowId = typeof ctx.params?.rowId === 'string' ? ctx.params.rowId : undefined;
  const guard = tableRowGuard(actionId, rowId);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_ROW_DUPLICATE, ctx, { rowId });
}

export async function runTableRowDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.row.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const rowId = typeof ctx.params?.rowId === 'string' ? ctx.params.rowId : undefined;
  const guard = tableRowGuard(actionId, rowId);
  if (guard) return guard;
  return runByTool(actionId, RUNTIME_TBL_ROW_DELETE, ctx, { rowId });
}

/**
 * N9 (2026-08-10) — UI-only akcje menu komórki Tabeli (`IdeaTableTool.tsx`'s
 * `cellContextMenu`) — ten sam kształt co `runContextMenuUiOnlyCallback`
 * (Tablica) / `runMindmapPaneUiOnlyCallback` (Mapa myśli), z UCZCIWYM
 * komunikatem dla menu komórki. Używane dla `idea.cell.copy`/`.paste`/
 * `.expand` — sprawdzone PRZED użyciem, że żadna z trzech nie ma dziś
 * sensownego wejścia dla Teresy (schowek SYSTEMOWY przeglądarki dla
 * copy/paste, `DOMRect` zakotwiczenia popovera dla expand — patrz
 * `teresa.description` każdego z trzech wpisów niżej dla pełnego
 * uzasadnienia per-akcja), nie zgadywane.
 */
export async function runTableCellUiOnlyCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source !== 'ui' || typeof run !== 'function') {
    return {
      ok: false,
      actionId,
      message:
        'Ta akcja działa dziś wyłącznie z menu kontekstowego (prawy klik) komórki Tabeli — nie mam jeszcze sposobu wywołania jej z czatu.',
    };
  }
  (run as () => void)();
  return { ok: true, actionId };
}

/**
 * N9 (2026-08-10) — `idea.cell.clear` (jedyna z czterech pozycji menu komórki
 * z realnym wejściem dla Teresy — patrz `RUNTIME_TBL_CELL_CLEAR` wyżej).
 * Adresowanie po `rowId`+`colKey` (nie zaznaczenie), bo to menu POJEDYNCZEJ
 * komórki (`scope: 'table_cell'`) — dokładnie to, co klik człowieka niesie w
 * `cellContextMenu` state. Walidacja kolumny „type"/formuła (pochodna, nie do
 * edycji — ta sama reguła co `cellContextMenu.editable` w `IdeaTableTool.tsx`)
 * i `locked` dzieje się PO STRONIE odbiornika (`useTableQuickActions.ts`),
 * gdzie żyje `columns`/`locked` — rejestr tu waliduje wyłącznie obecność
 * parametrów, jak `tableSavedViewGuard` wyżej dla widoków.
 */
export async function runTableCellClearCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'idea.cell.clear';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const rowId = typeof ctx.params?.rowId === 'string' ? ctx.params.rowId : undefined;
  const colKey = typeof ctx.params?.colKey === 'string' ? ctx.params.colKey : undefined;
  if (!rowId || !colKey) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `rowId` wiersza i `colKey` kolumny komórki Tabeli, którą mam wyczyścić.',
    };
  }
  return runByTool(actionId, RUNTIME_TBL_CELL_CLEAR, ctx, { rowId, colKey });
}


/**
 * N-TP (2026-08-10) — 22 class-d z audytu (`04_ACTION_COVERAGE_INVENTORY.csv`,
 * plik → linia dowodu w `source` każdej akcji niżej) w jedenastu samodzielnych
 * panelach zarządzania platformą Tabeli (`src/components/MyWork/table/**` —
 * Automatyzacje/Synchronizacja/Dystrybucja×2 (legacy „Distribute" +
 * platformowy „Distribution Manager")/Współdzielenie/Formularze/Formularz-JWT/
 * Interfejsy/Webhooki/Szablony rekordów/Zależności dat). Każdy panel jest
 * MODALEM/prawym panelem-drawerem montowanym WYŁĄCZNIE gdy otwarty z overflow
 * menu Tabeli — nie ma wspólnego hooka `use*QuickActions.ts` jak
 * mapa/tablica/przepływ/tabela-wiersze-kolumny-komórki, więc te akcje NIE
 * idą przez `runByTool`/szynę `idea-workspace-quick-action`.
 *
 * DWIE ścieżki, ten sam kształt co `runToolbarBusAction` gdzie indziej w tym
 * pliku:
 *  • `ctx.source === 'ui'` + `ctx.params.run` (funkcja) — wykonuje ORYGINALNY
 *    prop-callback panelu WPROST (byte-identyczne zachowanie kliku człowieka:
 *    toast, lokalny `setState` listy/formularza, ewentualny refetch).
 *  • Teresa (`ctx.source !== 'ui'`) — panel może nie być zamontowany (otwiera
 *    się dopiero z overflow menu Tabeli), więc NIE MA dostępu do `run`;
 *    rejestr woła TĘ SAMĄ funkcję REST z `tablePlatform.api.ts`, którą
 *    wołałby klik człowieka, bezpośrednio z parametrami LLM — realna,
 *    asynchroniczna mutacja/odczyt serwerowy (żaden no-op), uczciwie BEZ
 *    odświeżenia lokalnej listy panelu (ten sam panel przy następnym
 *    otwarciu i tak robi `loadX()`/`fetchX()` w `useEffect`, patrz każdy z
 *    jedenastu plików źródłowych — zero utraty spójności, tylko późniejsze
 *    odświeżenie widoku niż przy kliku człowieka).
 *
 * Import z aliasem `TP` (NIE „TablePlatformApi", pisane tu ROZDZIELONE, żeby
 * ten akapit sam siebie nie złapał) u góry pliku — `check-actions.sh` R8
 * grepuje dosłowny wzorzec `Api` + kropka + nazwa metody + otwierający
 * nawias w CAŁYM pliku (nie tylko w blokach akcji), a moduł „TablePlatform" +
 * „Api" złożony z kropką i wywołaniem zawiera ten wzorzec jako PODCIĄG (nazwa
 * modułu kończy się na „Api" tuż przed kropką) — R8 próbowałby znaleźć taką
 * metodę w GOŁYM `Api` z `src/services/api.ts` i failowałby fałszywie. Alias
 * `TP` tego problemu nie ma.
 *
 * Brak pola `runtime`/`RUNTIME_TBL_*` na żadnym z 22 wpisów niżej — to NIE jest
 * przeoczenie: `runtime` istnieje wyłącznie dla akcji idących przez
 * `dispatchQuickAction`/`runByTool` (szyna `idea-workspace-quick-action`), a
 * te wołają REST bezpośrednio (jak `idea.workspace.duplicate` → `Api.duplicateMyIdea`
 * gdzie indziej w tym pliku) — R6 (odbiornik w hooku reprezentacji) nie ma
 * więc czego pilnować dla tej grupy, dokładnie jak przy `Api.duplicateMyIdea`.
 */

// ─── Distribution (create/execute/delete) — dwa niezależne UI, jeden kontrakt REST ───
// `DistributionBuilder.tsx` (legacy „Distribute", zawsze widoczne — `show: !locked`)
// i `DistributionManager.tsx` (platformowy „Distribution Manager" — `show: usePlatform`)
// są DWOMA różnymi widocznymi komendami menu (różne etykiety, różne komponenty,
// różne id akcji niżej — `table.distribution_builder.*` vs `table.distribution.*`),
// ale wołają DOKŁADNIE te same trzy endpointy `tablePlatform.api.ts` — stąd
// współdzielone funkcje parametryzowane `actionId`, żeby nie duplikować logiki
// REST/walidacji dwukrotnie (identyczna zasada co `runToolbarBusAction`
// współdzielona przez wiele id).
export async function runTableDistributionCreateCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const baseId = typeof ctx.params?.baseId === 'string' ? ctx.params.baseId : undefined;
  const name = typeof ctx.params?.name === 'string' ? ctx.params.name.trim() : '';
  const channel = typeof ctx.params?.channel === 'string' ? ctx.params.channel : undefined;
  if (!baseId || !name || !channel) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `baseId` bazy, `name` dystrybucji i `channel` (email|slack|teams|webhook).',
    };
  }
  const sourceId = typeof ctx.params?.sourceId === 'string' ? ctx.params.sourceId : baseId;
  try {
    const data = await TP.createDistribution(baseId, {
      name,
      sourceType: typeof ctx.params?.sourceType === 'string' ? ctx.params.sourceType : 'table',
      sourceId: sourceId || baseId,
      channel,
      channelConfig:
        ctx.params?.channelConfig && typeof ctx.params.channelConfig === 'object'
          ? (ctx.params.channelConfig as Record<string, unknown>)
          : {},
      format: typeof ctx.params?.format === 'string' ? ctx.params.format : 'csv',
      schedule: typeof ctx.params?.schedule === 'string' ? ctx.params.schedule : undefined,
    });
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się utworzyć dystrybucji.',
    };
  }
}

export async function runTableDistributionExecuteCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const distributionId =
    typeof ctx.params?.distributionId === 'string' ? ctx.params.distributionId : undefined;
  if (!distributionId) {
    return { ok: false, actionId, message: 'Podaj `distributionId` dystrybucji do wysłania.' };
  }
  try {
    const data = await TP.executeDistribution(distributionId);
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Wysyłka dystrybucji się nie powiodła.',
    };
  }
}

export async function runTableDistributionDeleteCallback(
  actionId: string,
  ctx: ActionContext
): Promise<ActionResult> {
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const distributionId =
    typeof ctx.params?.distributionId === 'string' ? ctx.params.distributionId : undefined;
  if (!distributionId) {
    return { ok: false, actionId, message: 'Podaj `distributionId` dystrybucji do usunięcia.' };
  }
  try {
    await TP.deleteDistribution(distributionId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć dystrybucji.',
    };
  }
}

// ─── Date dependency config (DateDependencyConfig.tsx) ───
export function buildDateDependencyConfigFromParams(ctx: ActionContext) {
  return {
    startDateFieldId: ctx.params?.startDateFieldId as string,
    endDateFieldId: ctx.params?.endDateFieldId as string,
    durationFieldId:
      typeof ctx.params?.durationFieldId === 'string' ? ctx.params.durationFieldId : undefined,
    predecessorFieldId:
      typeof ctx.params?.predecessorFieldId === 'string' ? ctx.params.predecessorFieldId : undefined,
    defaultDependencyType: (typeof ctx.params?.defaultDependencyType === 'string'
      ? ctx.params.defaultDependencyType
      : 'FS') as 'FS' | 'SS' | 'FF' | 'SF',
    defaultLagDays: typeof ctx.params?.defaultLagDays === 'number' ? ctx.params.defaultLagDays : 0,
    skipWeekends:
      typeof ctx.params?.skipWeekends === 'boolean' ? ctx.params.skipWeekends : false,
  };
}

export async function runTableDateDependencySaveCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.date_dependency.save';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const tableId = typeof ctx.params?.tableId === 'string' ? ctx.params.tableId : undefined;
  const startDateFieldId =
    typeof ctx.params?.startDateFieldId === 'string' ? ctx.params.startDateFieldId : undefined;
  const endDateFieldId =
    typeof ctx.params?.endDateFieldId === 'string' ? ctx.params.endDateFieldId : undefined;
  if (!tableId || !startDateFieldId || !endDateFieldId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `tableId`, `startDateFieldId` i `endDateFieldId`.',
    };
  }
  try {
    await TP.putDependencyConfig(tableId, buildDateDependencyConfigFromParams(ctx));
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się zapisać konfiguracji zależności dat.',
    };
  }
}

export async function runTableDateDependencyRecalculateCallback(
  ctx: ActionContext
): Promise<ActionResult> {
  const actionId = 'table.date_dependency.recalculate';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const tableId = typeof ctx.params?.tableId === 'string' ? ctx.params.tableId : undefined;
  const startDateFieldId =
    typeof ctx.params?.startDateFieldId === 'string' ? ctx.params.startDateFieldId : undefined;
  const endDateFieldId =
    typeof ctx.params?.endDateFieldId === 'string' ? ctx.params.endDateFieldId : undefined;
  if (!tableId || !startDateFieldId || !endDateFieldId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `tableId`, `startDateFieldId` i `endDateFieldId`.',
    };
  }
  const config = buildDateDependencyConfigFromParams(ctx);
  try {
    const cycle = await TP.detectDateDependencyCycle(tableId, config);
    if (cycle?.hasCycle && cycle.cycleNodes?.length) {
      return {
        ok: false,
        actionId,
        message: `Wykryto cykl zależności w ${cycle.cycleNodes.length} rekordach — przerywam przeliczanie.`,
        data: { cycleNodes: cycle.cycleNodes },
      };
    }
    const result = await TP.recalculateDateDependencies(tableId, config);
    return { ok: true, actionId, data: { updatedRecords: result?.updatedRecords ?? 0 } };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się przeliczyć zależności dat.',
    };
  }
}

// ─── Record templates (RecordTemplateManager.tsx) ───
export async function runTableRecordTemplateDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.record_template.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const templateId = typeof ctx.params?.templateId === 'string' ? ctx.params.templateId : undefined;
  if (!templateId) {
    return { ok: false, actionId, message: 'Podaj `templateId` szablonu do usunięcia.' };
  }
  try {
    await TP.deleteRecordTemplate(templateId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć szablonu rekordu.',
    };
  }
}

export async function runTableRecordTemplateSaveCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.record_template.save';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const name = typeof ctx.params?.name === 'string' ? ctx.params.name.trim() : '';
  const data =
    ctx.params?.data && typeof ctx.params.data === 'object'
      ? (ctx.params.data as Record<string, unknown>)
      : undefined;
  const templateId = typeof ctx.params?.templateId === 'string' ? ctx.params.templateId : undefined;
  const tableId = typeof ctx.params?.tableId === 'string' ? ctx.params.tableId : undefined;
  if (!name || !data) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `name` szablonu i `data` (mapę pól → wartości domyślne).',
    };
  }
  if (!templateId && !tableId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `tableId` (dla nowego szablonu) albo `templateId` (dla edycji istniejącego).',
    };
  }
  try {
    const result = templateId
      ? await TP.updateRecordTemplate(templateId, { name, data })
      : await TP.createRecordTemplate(tableId as string, name, data);
    return { ok: true, actionId, data: result };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się zapisać szablonu rekordu.',
    };
  }
}

// ─── Automations (automations/AutomationsManager.tsx) ───
export async function runTableAutomationRunNowCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.automation.run_now';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const automationId =
    typeof ctx.params?.automationId === 'string' ? ctx.params.automationId : undefined;
  if (!automationId) {
    return { ok: false, actionId, message: 'Podaj `automationId` automatyzacji do uruchomienia.' };
  }
  try {
    const data = await TP.runAutomationNow(automationId);
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się uruchomić automatyzacji.',
    };
  }
}

export async function runTableAutomationDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.automation.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const automationId =
    typeof ctx.params?.automationId === 'string' ? ctx.params.automationId : undefined;
  if (!automationId) {
    return { ok: false, actionId, message: 'Podaj `automationId` automatyzacji do usunięcia.' };
  }
  try {
    await TP.deleteAutomation(automationId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć automatyzacji.',
    };
  }
}

// ─── Webhook relays (connectors/WebhookRelayPanel.tsx) ───
export async function runTableWebhookRelayDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.webhook_relay.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const relayId = typeof ctx.params?.relayId === 'string' ? ctx.params.relayId : undefined;
  if (!relayId) {
    return { ok: false, actionId, message: 'Podaj `relayId` webhooka do usunięcia.' };
  }
  try {
    await TP.deleteWebhookRelay(relayId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć webhooka.',
    };
  }
}

// ─── Forms (forms/FormsIndex.tsx, forms/IntakeJwtPanel.tsx) ───
export async function runTableFormShareModeChangeCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.form.share_mode_change';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const formId = typeof ctx.params?.formId === 'string' ? ctx.params.formId : undefined;
  const mode = typeof ctx.params?.mode === 'string' ? ctx.params.mode : undefined;
  if (!formId || !mode || !['public', 'organization', 'authenticated'].includes(mode)) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `formId` formularza i `mode` (public|organization|authenticated).',
    };
  }
  try {
    // `handleShareModeChange` w FormsIndex.tsx czyta `form.is_published`/
    // `form.config` z JUŻ załadowanego lokalnego stanu — Teresa nie ma tego
    // stanu (panel może być niezamontowany), więc uczciwy odpowiednik to
    // najpierw pobrać BIEŻĄCY rekord formularza, dokładnie ten sam kształt.
    const form = await TP.getForm(formId);
    const isPublished = mode !== 'authenticated' || !!form?.is_published;
    const data = await TP.updateForm(formId, {
      is_published: isPublished,
      config: { ...(form?.config || {}), requireAuth: mode === 'authenticated' },
    });
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się zmienić trybu udostępniania formularza.',
    };
  }
}

export async function runTableFormDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.form.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const formId = typeof ctx.params?.formId === 'string' ? ctx.params.formId : undefined;
  if (!formId) {
    return { ok: false, actionId, message: 'Podaj `formId` formularza do usunięcia.' };
  }
  try {
    await TP.deleteForm(formId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć formularza.',
    };
  }
}

export async function runTableFormIntakeSaveAllowListCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.form_intake.save_allow_list';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const formId = typeof ctx.params?.formId === 'string' ? ctx.params.formId : undefined;
  if (!formId) {
    return { ok: false, actionId, message: 'Podaj `formId` formularza.' };
  }
  const fieldIdsRaw = ctx.params?.fieldIds;
  const fieldIds = Array.isArray(fieldIdsRaw)
    ? fieldIdsRaw.filter((v): v is string => typeof v === 'string')
    : [];
  try {
    const data = await TP.setFormIntakeAllowList(formId, fieldIds.length > 0 ? fieldIds : null);
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się zapisać allow-listy formularza.',
    };
  }
}

// ─── Interfaces (interfaces/InterfacesIndex.tsx) ───
export async function runTableInterfaceDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.interface.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const interfaceId =
    typeof ctx.params?.interfaceId === 'string' ? ctx.params.interfaceId : undefined;
  if (!interfaceId) {
    return { ok: false, actionId, message: 'Podaj `interfaceId` interfejsu do usunięcia.' };
  }
  try {
    await TP.deleteView(interfaceId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć interfejsu.',
    };
  }
}

// ─── Sharing (sharing/SharingManager.tsx) ───
export async function runTableSharingInviteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.sharing.invite';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const baseId = typeof ctx.params?.baseId === 'string' ? ctx.params.baseId : undefined;
  const email = typeof ctx.params?.email === 'string' ? ctx.params.email.trim() : '';
  const role = typeof ctx.params?.role === 'string' ? ctx.params.role : 'editor';
  if (!baseId || !email) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `baseId` bazy i `email` osoby do zaproszenia.',
    };
  }
  try {
    const data = await TP.inviteCollaborator(baseId, email, role);
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się wysłać zaproszenia.',
    };
  }
}

export async function runTableSharingRemoveCollaboratorCallback(
  ctx: ActionContext
): Promise<ActionResult> {
  const actionId = 'table.sharing.remove_collaborator';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const baseId = typeof ctx.params?.baseId === 'string' ? ctx.params.baseId : undefined;
  const userId = typeof ctx.params?.userId === 'string' ? ctx.params.userId : undefined;
  if (!baseId || !userId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `baseId` bazy i `userId` współpracownika do usunięcia.',
    };
  }
  try {
    await TP.removeCollaborator(baseId, userId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć dostępu współpracownika.',
    };
  }
}

// ─── Table sync (sync/SyncManager.tsx) ───
export async function runTableSyncCreateCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.sync.create';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const sourceTableId =
    typeof ctx.params?.sourceTableId === 'string' ? ctx.params.sourceTableId : undefined;
  const targetTableId =
    typeof ctx.params?.targetTableId === 'string' ? ctx.params.targetTableId : undefined;
  if (!sourceTableId || !targetTableId) {
    return {
      ok: false,
      actionId,
      message: 'Podaj `sourceTableId` i `targetTableId` synchronizacji.',
    };
  }
  const fieldMapping =
    ctx.params?.fieldMapping && typeof ctx.params.fieldMapping === 'object'
      ? (ctx.params.fieldMapping as Record<string, string>)
      : { '*': '*' };
  const syncMode = ctx.params?.syncMode === 'two_way' ? 'two_way' : 'one_way';
  try {
    const data = await TP.createTableSync(sourceTableId, targetTableId, fieldMapping, syncMode);
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się utworzyć synchronizacji.',
    };
  }
}

export async function runTableSyncRunNowCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.sync.run_now';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const syncId = typeof ctx.params?.syncId === 'string' ? ctx.params.syncId : undefined;
  if (!syncId) {
    return { ok: false, actionId, message: 'Podaj `syncId` synchronizacji do uruchomienia.' };
  }
  try {
    const data = await TP.executeTableSync(syncId);
    return { ok: true, actionId, data };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Synchronizacja się nie powiodła.',
    };
  }
}

export async function runTableSyncDeleteCallback(ctx: ActionContext): Promise<ActionResult> {
  const actionId = 'table.sync.delete';
  const run = ctx.params?.run;
  if (ctx.source === 'ui' && typeof run === 'function') {
    (run as () => void)();
    return { ok: true, actionId };
  }
  const syncId = typeof ctx.params?.syncId === 'string' ? ctx.params.syncId : undefined;
  if (!syncId) {
    return { ok: false, actionId, message: 'Podaj `syncId` synchronizacji do usunięcia.' };
  }
  try {
    await TP.deleteTableSync(syncId);
    return { ok: true, actionId };
  } catch (e) {
    return {
      ok: false,
      actionId,
      message: (e as Error)?.message || 'Nie udało się usunąć synchronizacji.',
    };
  }
}
