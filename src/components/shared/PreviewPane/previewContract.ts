/**
 * previewContract — walidacja kontraktu preview poza plikiem komponentu.
 *
 * ── R03-1 (korekta) ─────────────────────────────────────────────────────────
 *
 * Walidator mieszkał najpierw w `StandardPreview.tsx`. Był poprawny, ale każdy
 * nie-komponentowy eksport z pliku komponentu dokłada ostrzeżenie
 * `react-refresh/only-export-components` i psuje Fast Refresh. Plik zawiera
 * już dwa takie eksporty w stanie zastanym (`orderPreviewActionRows`,
 * `standardPreviewShortcuts`) — dokładanie trzeciego pogarszałoby baseline,
 * więc walidator dostał własny moduł.
 *
 * DLACZEGO PRZYJMUJE GOTOWE RZĘDY, A NIE `actions`. Kolejność rzędów ustala
 * `orderPreviewActionRows`, które zostaje w `StandardPreview.tsx` (importują
 * je istniejące testy — przeniesienie zmieniłoby cudze API). Gdyby ten moduł
 * je wołał, powstałby cykl runtime helper ↔ komponent. Przyjmując rzędy już
 * uporządkowane, walidator jest czysty, bezcyklowy i sprawdza dokładnie to,
 * co użytkownik zobaczy.
 *
 * Kody naruszeń są WSPÓLNE z `validatePreviewSchema` (R00), żeby ten sam defekt
 * nazywał się tak samo niezależnie od tego, czy sprawdzamy schemat, czy propsy.
 *
 * Świadomie NIE obcina: nadmiarowa akcja to defekt kontraktu, ale ciche jej
 * porzucenie byłoby utratą funkcji biznesowej (bramka G1). Walidator raportuje.
 *
 * @module components/shared/PreviewPane/previewContract
 */

import type {
  StandardPreviewAction,
  StandardPreviewDetails,
} from '@/components/standard/StandardPreview';
import { CANON_PREVIEW_LIMIT } from '@/contracts/tableSurface/canon';
import {
  type ContractViolation,
  toResult,
  type ValidationResult,
} from '@/contracts/tableSurface/types';

export interface PreviewContractInput {
  /** Rzędy siatki akcji PO uporządkowaniu (`orderPreviewActionRows`). */
  rows: StandardPreviewAction[][];
  details?: StandardPreviewDetails;
}

/**
 * Sprawdza propsy preview względem §6 kontraktu: jeden Open, unikalne akcje,
 * limity siatki, długość etykiet, miejsce eksportu.
 */
export function validatePreviewContract(input: PreviewContractInput): ValidationResult {
  const violations: ContractViolation[] = [];
  const { rows, details } = input;
  const flat = rows.flat();

  // §6 Szczegóły — „w całym preview istnieje dokładnie jeden Open — w headerze".
  const openInGrid = flat.filter((a) => a.id === 'open' || a.id === 'open-full');
  if (openInGrid.length > 0) {
    violations.push({
      code: 'PREVIEW_OPEN_NOT_UNIQUE',
      message: `Open is rendered ${openInGrid.length}× in the action grid; the canon allows exactly one, in the header.`,
      clause: 'contract §6 Szczegóły',
      path: 'actions',
    });
  }

  // Duplikaty — wzorzec T43 (trzy zduplikowane akcje w jednym preview).
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  for (const action of flat) {
    if (seenIds.has(action.id)) {
      violations.push({
        code: 'PREVIEW_DUPLICATE_ACTION_ID',
        message: `Duplicate preview actionId "${action.id}".`,
        clause: 'contract §6 Actions',
        path: `actions[${action.id}]`,
      });
    }
    if (seenLabels.has(action.label)) {
      violations.push({
        code: 'PREVIEW_DUPLICATE_ACTION_LABEL',
        message: `Duplicate preview action label "${action.label}".`,
        clause: 'contract §6 Actions',
        path: `actions[label=${action.label}]`,
      });
    }
    seenIds.add(action.id);
    seenLabels.add(action.label);

    if (action.label.length > CANON_PREVIEW_LIMIT.actionLabelCharsMax) {
      violations.push({
        code: 'PREVIEW_ACTION_LABEL_TOO_LONG',
        message: `Label "${action.label}" exceeds ${CANON_PREVIEW_LIMIT.actionLabelCharsMax} characters.`,
        clause: 'contract §6 Actions i przyciski',
        path: `actions[${action.id}]`,
      });
    }
  }

  // Siatka: maks. 3 rzędy i maks. 6 akcji bezpośrednich (§6 Actions).
  if (rows.length > CANON_PREVIEW_LIMIT.actionGridRowsMax) {
    violations.push({
      code: 'PREVIEW_ACTION_GRID_OVERFLOW',
      message: `${rows.length} action rows; canon allows at most ${CANON_PREVIEW_LIMIT.actionGridRowsMax}.`,
      clause: 'contract §6 Actions',
      path: 'actions',
    });
  }
  if (flat.length > CANON_PREVIEW_LIMIT.actionsDirectMax) {
    violations.push({
      code: 'PREVIEW_ACTION_GRID_OVERFLOW',
      message: `${flat.length} direct actions; canon allows at most ${CANON_PREVIEW_LIMIT.actionsDirectMax}. Surplus belongs in the row kebab.`,
      clause: 'contract §6 Actions',
      path: 'actions',
    });
  }

  // §6 Details — eksporty należą do kanonicznej trójki Copy → Export → Download.
  for (const extra of details?.extraActions ?? []) {
    if (/export|download|pobierz|eksport/i.test(extra.label)) {
      violations.push({
        code: 'PREVIEW_DETAILS_ACTION_ORDER',
        message: `Extra Details action "${extra.label}" looks like an export; exports belong to the canonical Copy → Export → Download trio.`,
        clause: 'contract §6 Details',
        path: 'details.extraActions',
      });
    }
  }

  return toResult(violations);
}
