/**
 * MindMapNodeResizer — ręczna zmiana rozmiaru węzła/ramki Mapy Myśli.
 *
 * PRZED (2026-07-27): Mapa Myśli NIE MIAŁA tej funkcji w ogóle — `NodeResizer`
 * z reactflow nie był tu w ogóle importowany (był tylko na Tablicy:
 * `whiteboard/nodes/FrameNode|TextBlockNode|ShapeNode`). Właściciel: „nie mogę
 * zmieniać rozmiaru okna".
 *
 * WZORZEC PRZENIESIONY Z TABLICY (nie wymyślany od nowa):
 *   1. `<NodeResizer isVisible={selected && !locked} minWidth minHeight />`
 *      renderowany jako pierwsze dziecko komponentu węzła — uchwyty widać
 *      TYLKO przy zaznaczeniu, więc nie zaśmiecają płótna.
 *   2. Rozmiar żyje w `node.style.{width,height}` — reactflow zapisuje go tam
 *      sam (zmiana `dimensions` z `updateStyle`, patrz applyNodeChanges), a
 *      warstwa zapisu Mapy (`useMindMapPersistence`) przepuszcza całe `node`
 *      przez `...rest`, więc rozmiar leci na serwer i wraca z hydratacji.
 *   3. Wnętrze węzła rozciąga się na `100%` — TYLKO gdy rozmiar jest jawny.
 *
 * RÓŻNICA vs Tablica (świadoma): na Tablicy KAŻDY węzeł ma z góry nadane
 * `style.{width,height}`, więc pudełko jest zawsze sztywne. Węzeł Mapy Myśli
 * domyślnie DOPASOWUJE SIĘ DO TREŚCI (`min-w`/`max-w`) i tego nie zmieniamy —
 * sztywne pudełko włącza się dopiero po ręcznym pociągnięciu za uchwyt.
 * Rozstrzyga o tym `useNodeHasExplicitSize` (czyta `style.width` ze store'a
 * reactflow), a nie flaga w `data` — dzięki temu stan „ręcznie zmieniony"
 * jest tym samym bytem, który się zapisuje, i nie może się z nim rozjechać.
 *
 * KOLORY: uchwyt/linia z tokenów `c-*` (`--c-focus-solid` = niebieski fokus).
 * Domyślny `#3367d9` reactflow byłby obcym kolorem spoza palety.
 */
import React from 'react';
import { NodeResizer, useStore } from 'reactflow';

/** Minimalne rozmiary — węzła nie da się zwinąć do zera. */
export const MM_MIN_NODE_WIDTH = 120;
export const MM_MIN_NODE_HEIGHT = 44;
export const MM_MIN_FRAME_WIDTH = 160;
export const MM_MIN_FRAME_HEIGHT = 120;

const HANDLE_STYLE: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 3,
  backgroundColor: 'var(--c-surface)',
  border: '2px solid var(--c-focus-solid)',
};

const LINE_STYLE: React.CSSProperties = {
  borderColor: 'var(--c-focus-solid)',
  borderWidth: 1,
};

/**
 * `true`, gdy węzeł ma JAWNY rozmiar w `node.style.width` — czyli użytkownik
 * pociągnął za uchwyt (albo rozmiar wrócił z zapisu). Selektor zwraca boolean,
 * więc subskrypcja store'a nie powoduje re-renderów przy każdym ruchu myszy.
 */
export function useNodeHasExplicitSize(nodeId: string): boolean {
  return useStore((s) => {
    const n = s.nodeInternals.get(nodeId);
    const w = (n?.style as React.CSSProperties | undefined)?.width;
    return typeof w === 'number' ? w > 0 : typeof w === 'string' && w.length > 0;
  });
}

type MindMapNodeResizerProps = {
  /** Zaznaczenie węzła — uchwyty pokazujemy tylko wtedy. */
  selected?: boolean;
  /** Węzeł zablokowany (kłódka) albo płótno read-only → bez uchwytów. */
  locked?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** Węzeł centralny jest kołem — trzymamy proporcję, żeby nie robić z niego elipsy. */
  keepAspectRatio?: boolean;
};

export const MindMapNodeResizer: React.FC<MindMapNodeResizerProps> = ({
  selected,
  locked,
  minWidth = MM_MIN_NODE_WIDTH,
  minHeight = MM_MIN_NODE_HEIGHT,
  keepAspectRatio,
}) => (
  <NodeResizer
    isVisible={Boolean(selected) && !locked}
    minWidth={minWidth}
    minHeight={minHeight}
    keepAspectRatio={keepAspectRatio}
    handleStyle={HANDLE_STYLE}
    lineStyle={LINE_STYLE}
  />
);
