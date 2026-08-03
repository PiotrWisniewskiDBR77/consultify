/**
 * edgeArrowMarkers — WSPÓLNE strzałki kierunku przepływu dla wszystkich płócien
 * z krawędziami (Mapa myśli · Tablica · Przepływ procesu).
 *
 * DLACZEGO TO ISTNIEJE (2026-07-28, zgłoszenie właściciela „strzałki by się
 * przydały i one mogłyby pokazywać kierunek przepływu linii"):
 * Przepływ procesu MIAŁ już strzałki (`FlowEdgeComponent`, pole
 * `edge.data.arrowDirection`), Mapa myśli i Tablica NIE miały ich wcale.
 * Zamiast wymyślać drugi model, bierzemy dokładnie ten z Przepływu i wynosimy
 * go tutaj, żeby wszystkie trzy narzędzia rysowały tę samą strzałkę i czytały
 * to samo pole. Spójność między narzędziami > elegancja per komponent.
 *
 * MODEL (SSOT): `edge.data.arrowDirection: 'none' | 'start' | 'end' | 'both'`.
 * Pole leży w `edge.data`, więc przechodzi tą samą drogą zapisu co reszta
 * właściwości krawędzi (`type`, `edgeStyle`, `label`) — mapa jest serializowana
 * w całości (`Api.syncMyIdeaMap` → `edges_json`), nic go nie filtruje.
 *
 * DOMYŚLNE (świadomie różne per narzędzie):
 *  - Przepływ procesu: `'end'` — diagram procesu bez strzałek jest bezużyteczny.
 *  - Mapa myśli / Tablica: `'none'` — to hierarchie i płótna warsztatowe;
 *    włączenie strzałek wszystkim istniejącym mapom byłoby masową zmianą
 *    wizualną bez akceptu właściciela (reguła #9 CLAUDE.md).
 *
 * GEOMETRIA: marker 8×8 w `userSpaceOnUse`, więc grot ma stały ~8px niezależnie
 * od grubości linii i poziomu zoomu krawędzi. `refX=7` cofa punkt odniesienia
 * tuż za grot, żeby ostrze wystawało 1px poza koniec ścieżki i nie „uciekało"
 * od linii przy krzywej Béziera ani przy łamanej ortogonalnej — marker zawsze
 * siedzi na ostatnim/pierwszym segmencie ścieżki, cokolwiek nią jest.
 *
 * KOLOR: podawany jako `style={{ fill }}`, NIE jako atrybut `fill`. Atrybut
 * prezentacyjny SVG nie parsuje `var(--c-*)` (grot wychodził czarny), a
 * właściwość CSS — tak. Cały kod płócien używa tokenów `var(--c-*)`, więc to
 * jedyna wersja, która działa i w jasnym, i w ciemnym motywie.
 */
import React from 'react';

export const EDGE_ARROW_DIRECTIONS = ['none', 'start', 'end', 'both'] as const;
export type EdgeArrowDirection = (typeof EDGE_ARROW_DIRECTIONS)[number];

/** Kolejność cyklu w menu krawędzi (jeden klik = następny stan). */
export const EDGE_ARROW_CYCLE: EdgeArrowDirection[] = ['none', 'end', 'both', 'start'];

/**
 * Odczyt pola z `edge.data` z twardą walidacją i jawnym domyślnym per narzędzie.
 * Nieznana/legacy wartość → `fallback` (nigdy nie wywala renderu krawędzi).
 */
export function resolveArrowDirection(
  raw: unknown,
  fallback: EdgeArrowDirection = 'none'
): EdgeArrowDirection {
  return (EDGE_ARROW_DIRECTIONS as readonly string[]).includes(String(raw))
    ? (raw as EdgeArrowDirection)
    : fallback;
}

/** Następny stan w cyklu (menu krawędzi Mapy myśli / Tablicy). */
export function nextArrowDirection(current: EdgeArrowDirection): EdgeArrowDirection {
  const i = EDGE_ARROW_CYCLE.indexOf(current);
  return EDGE_ARROW_CYCLE[(i + 1) % EDGE_ARROW_CYCLE.length];
}

export function arrowMarkerIds(edgeId: string): { start: string; end: string } {
  // Identyfikatory per krawędź — markery są w `<defs>` wewnątrz komponentu
  // krawędzi, więc dwie krawędzie o różnych kolorach nie mogą współdzielić id.
  const safe = String(edgeId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return { start: `edge-arrow-start-${safe}`, end: `edge-arrow-end-${safe}` };
}

export interface EdgeArrowMarkersProps {
  edgeId: string;
  direction: EdgeArrowDirection;
  /** Kolor grotu na końcu (przy celu). Token `var(--c-*)` lub literał. */
  color: string;
  /** Kolor grotu na początku (przy źródle). Domyślnie ten sam co `color`. */
  colorStart?: string;
}

/**
 * `<defs>` z grotami dla jednej krawędzi. Renderuje TYLKO te groty, które są
 * faktycznie użyte — zero martwych definicji w DOM.
 *
 * Grot startowy używa TEJ SAMEJ ścieżki co końcowy; kierunek odwraca wyłącznie
 * `orient="auto-start-reverse"`. Odwracanie ścieżki I orientacji naraz (jak
 * robił to pierwotny kod Przepływu) znosiło się nawzajem — przy `both` obie
 * strzałki pokazywały w tę samą stronę.
 */
export const EdgeArrowMarkers: React.FC<EdgeArrowMarkersProps> = ({
  edgeId,
  direction,
  color,
  colorStart,
}) => {
  const showEnd = direction === 'end' || direction === 'both';
  const showStart = direction === 'start' || direction === 'both';
  if (!showEnd && !showStart) return null;
  const ids = arrowMarkerIds(edgeId);
  return (
    <defs>
      {showEnd && (
        <marker
          id={ids.end}
          markerWidth={8}
          markerHeight={8}
          refX={7}
          refY={4}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L8,4 L0,8 Z" style={{ fill: color }} />
        </marker>
      )}
      {showStart && (
        <marker
          id={ids.start}
          markerWidth={8}
          markerHeight={8}
          refX={7}
          refY={4}
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L8,4 L0,8 Z" style={{ fill: colorStart || color }} />
        </marker>
      )}
    </defs>
  );
};

/**
 * Wartości atrybutów `markerStart` / `markerEnd` dla głównej ścieżki krawędzi.
 * `undefined` gdy dany grot jest wyłączony (React pomija atrybut).
 */
export function arrowMarkerAttrs(
  edgeId: string,
  direction: EdgeArrowDirection
): { markerStart?: string; markerEnd?: string } {
  const ids = arrowMarkerIds(edgeId);
  return {
    markerEnd: direction === 'end' || direction === 'both' ? `url(#${ids.end})` : undefined,
    markerStart: direction === 'start' || direction === 'both' ? `url(#${ids.start})` : undefined,
  };
}

export default EdgeArrowMarkers;
