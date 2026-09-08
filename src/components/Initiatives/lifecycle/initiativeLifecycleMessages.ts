/**
 * Kody reguł serwera → komunikat dla użytkownika.
 *
 * Serwer NIGDY nie wysyła zdania — wysyła `rule`. Tłumaczenie żyje wyłącznie tutaj
 * i w plikach `public/locales/*`, więc jeden komunikat nie rozjeżdża się na dwa
 * repozytoria.
 *
 * J17 (2026-09-08): pole nazywa się dalej `pl` ze względu na wołaczy, ale NIESIE
 * ANGIELSKI tekst. Powód: `src/i18n.ts` ma `fallbackLng: { en: ['en'] }` i
 * `react.useSuspense: false` — brak klucza NIE spada na plik polski, tylko na ten
 * fallback, a do czasu dojścia pliku tłumaczeń `t()` zwraca go przy KAŻDYM
 * pierwszym malowaniu. Polski fallback = polskie zdanie u użytkownika EN.
 * Polski żyje wyłącznie w `public/locales/pl/translation.json`.
 */

import { enumLabel } from '@/utils/enumLabel';

export const INITIATIVE_RULE_MESSAGE_KEYS: Record<string, { key: string; pl: string }> = {
  TITLE_AND_JUSTIFICATION_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.TITLE_AND_JUSTIFICATION_REQUIRED',
    pl: 'Add the initiative title and rationale.',
  },
  REASON_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.REASON_REQUIRED',
    pl: 'This action requires a reason.',
  },
  INITIATIVE_CARD_INCOMPLETE: {
    key: 'initiatives.lifecycle.blocked.INITIATIVE_CARD_INCOMPLETE',
    pl: 'The card is incomplete — add the description, owner and scope.',
  },
  GATE_DECISION_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.GATE_DECISION_REQUIRED',
    pl: 'A current GO decision from the committee is missing.',
  },
  HANDOFF_AND_START_DATE_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.HANDOFF_AND_START_DATE_REQUIRED',
    pl: 'An accepted handoff and an execution start date are required.',
  },
  OPEN_WORK_BLOCKS_CLOSURE: {
    key: 'initiatives.lifecycle.blocked.OPEN_WORK_BLOCKS_CLOSURE',
    pl: 'Closure is blocked by open tasks or undecided decisions.',
  },
  GATE_BLOCKED: {
    key: 'initiatives.lifecycle.blocked.GATE_BLOCKED',
    pl: 'Gate readiness not met — complete: {{items}}.',
  },
  AUTHOR_ONLY: {
    key: 'initiatives.lifecycle.blocked.AUTHOR_ONLY',
    pl: 'Only the author or an administrator can submit the draft for approval.',
  },
  INVALID_TRANSITION: {
    key: 'initiatives.lifecycle.blocked.INVALID_TRANSITION',
    pl: 'This transition does not exist for the current status.',
  },
  UNEXPECTED_CURRENT_STATUS: {
    key: 'initiatives.lifecycle.blocked.UNEXPECTED_CURRENT_STATUS',
    pl: 'The initiative status changed in the meantime — refresh the view.',
  },
  MISSING_TRANSITION_GATE: {
    key: 'initiatives.lifecycle.blocked.MISSING_TRANSITION_GATE',
    pl: 'This transition has no gate defined and cannot be performed.',
  },
  INVALID_FLAG_OPERATION: {
    key: 'initiatives.lifecycle.blocked.INVALID_FLAG_OPERATION',
    pl: 'This operation is not allowed in the current initiative state.',
  },
  UNSUPPORTED_FLAG_OPERATION: {
    key: 'initiatives.lifecycle.blocked.UNSUPPORTED_FLAG_OPERATION',
    pl: 'Unsupported lifecycle flag operation.',
  },
};

export const INITIATIVE_RULE_FALLBACK = {
  key: 'initiatives.lifecycle.blocked.UNKNOWN',
  pl: 'The action could not be completed. Refresh the view and try again.',
} as const;

export type TranslateFn = (key: string, fallback: string) => string;

/**
 * Klucze wymagań gotowości z `getBlockingReadinessItems` (serwer) → polski opis.
 * Serwer trzyma tylko angielską etykietę techniczną; użytkownik ma zobaczyć zdanie.
 */
export const INITIATIVE_READINESS_ITEM_KEYS: Record<string, { key: string; pl: string }> = {
  title: { key: 'initiatives.lifecycle.readiness.title', pl: 'title' },
  owner: { key: 'initiatives.lifecycle.readiness.owner', pl: 'owner' },
  timeline_dates: { key: 'initiatives.lifecycle.readiness.timeline_dates', pl: 'planned start and end dates' },
  schedule_milestones: { key: 'initiatives.lifecycle.readiness.schedule_milestones', pl: 'at least one milestone' },
  timeline: { key: 'initiatives.lifecycle.readiness.timeline', pl: 'baseline schedule (dates)' },
  benefits_owner: { key: 'initiatives.lifecycle.readiness.benefits_owner', pl: 'business benefits owner' },
  benefits_kpis: { key: 'initiatives.lifecycle.readiness.benefits_kpis', pl: 'KPIs' },
};

export function initiativeReadinessItemsLabel(
  items: Array<{ key: string; label: string }> | undefined,
  t: TranslateFn
): string {
  return (items || [])
    .map((item) => {
      const entry = INITIATIVE_READINESS_ITEM_KEYS[item.key];
      return entry ? t(entry.key, entry.pl) : item.label;
    })
    .filter(Boolean)
    .join(', ');
}

/** Zwraca gotowe, ludzkie zdanie dla kodu reguły — nigdy kodu i nigdy pustki. */
export function initiativeRuleMessage(
  rule: string | null | undefined,
  t: TranslateFn,
  details?: { items?: Array<{ key: string; label: string }> }
): string {
  const entry = (rule && INITIATIVE_RULE_MESSAGE_KEYS[rule]) || INITIATIVE_RULE_FALLBACK;
  const text = t(entry.key, entry.pl);
  if (rule === 'GATE_BLOCKED') {
    const items = initiativeReadinessItemsLabel(details?.items, t) || t('initiatives.lifecycle.readiness.unknown', 'the gate requirements');
    return text.replace('{{items}}', items);
  }
  return text;
}

/**
 * Etykieta akcji per bramka — słownictwo z tablicy DEC-424.
 *
 * J17: jedno źródło etykiet enumów (`src/utils/enumLabel.ts`, domena
 * `initiativeGateAction`). Nieznana bramka daje uczciwe „Unknown"/„Nieznane",
 * a nie polskie „Zmień status" pokazane użytkownikowi angielskiemu.
 */
export function initiativeGateLabel(gate: string | null | undefined, t: TranslateFn): string {
  return enumLabel('initiativeGateAction', String(gate || ''), t);
}
