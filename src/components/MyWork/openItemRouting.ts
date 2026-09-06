/**
 * L-08 (DP-2 "global IDE-tabs doc") — routing contract for the
 * `mywork-open-item` EventBus handler in MyWorkHub.
 *
 * Light work items open IN-CONTEXT inside the My Work document overlay
 * (dynamic IDE-style tab) instead of hard-navigating the user away. Only the
 * heavy artifact types still leave My Work for their own module / Canvas.
 *
 * Keeping this as a tiny pure function lets the contract be unit-tested without
 * mounting the ~9k-line MyWorkHub component, and gives a single source of truth
 * for both the runtime handler and the test.
 */

import { UKRYTE_DEC406 } from './mojaPracaWidocznosc';

export type OpenItemRoute = 'in-context' | 'navigate';

/**
 * Heavy artifact types that still hard-navigate out of My Work:
 * - report / presentation → Canvas
 * - budget / valuation / financial_model / analysis → full module
 * - assessment / meeting / tool → own module
 */
export const NAVIGATE_ITEM_TYPES = [
  'assessment',
  'report',
  'presentation',
  'meeting',
  'financial_model',
  'budget',
  'valuation',
  'analysis',
  'tool',
] as const;

/**
 * Light work items opened in-context via the document overlay
 * (handleOpenDocument / dynamic tab) or an in-place tab switch (notebook).
 *
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397] DEC-406: `initiative` WYPADA z tej listy.
 * Do 06.09 inicjatywa otwierala sie w Mojej Pracy jako `InitiativeFullView`
 * (stary warsztat ze stepperem) — rownolegly, nieodebrany ekran obok
 * zatwierdzonej kanonicznej karty inicjatywy. Teraz inicjatywa ZAWSZE nawiguje
 * do modulu Inicjatywy (ta sama trasa, co lista -> wiersz -> Otworz).
 */
export const IN_CONTEXT_ITEM_TYPES = [
  'task',
  'decision',
  'idea',
  'notification',
  'notebook',
] as const;

/**
 * Resolve how a `mywork-open-item` type should be opened.
 * Heavy artifacts navigate; everything else opens in-context.
 *
 * DEC-406: `initiative` navigates dopoki warsztat jest ukryty
 * (`UKRYTE_DEC406.warsztatInicjatywy`) — jedno miejsce prawdy o ukryciu.
 */
export function resolveOpenItemRoute(type: string): OpenItemRoute {
  if (type === 'initiative' && UKRYTE_DEC406.warsztatInicjatywy) return 'navigate';
  return (NAVIGATE_ITEM_TYPES as readonly string[]).includes(type) ? 'navigate' : 'in-context';
}
