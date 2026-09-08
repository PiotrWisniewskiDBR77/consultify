/**
 * Kody reguł serwera → polski (i angielski) komunikat dla użytkownika.
 *
 * Serwer NIGDY nie wysyła zdania po polsku — wysyła `rule`. Tłumaczenie żyje wyłącznie
 * tutaj i w plikach `public/locales/*`, więc jeden komunikat nie rozjeżdża się na dwa
 * repozytoria. Fallback (drugi argument `t`) jest po polsku, bo to język właściciela
 * produktu i bez tłumaczeń ma się wyświetlić zdanie, a nie klucz.
 */

export const INITIATIVE_RULE_MESSAGE_KEYS: Record<string, { key: string; pl: string }> = {
  TITLE_AND_JUSTIFICATION_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.TITLE_AND_JUSTIFICATION_REQUIRED',
    pl: 'Uzupełnij tytuł i uzasadnienie inicjatywy.',
  },
  REASON_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.REASON_REQUIRED',
    pl: 'To działanie wymaga podania powodu.',
  },
  INITIATIVE_CARD_INCOMPLETE: {
    key: 'initiatives.lifecycle.blocked.INITIATIVE_CARD_INCOMPLETE',
    pl: 'Karta jest niekompletna — uzupełnij opis, właściciela i zakres.',
  },
  GATE_DECISION_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.GATE_DECISION_REQUIRED',
    pl: 'Brakuje aktualnej decyzji GO komitetu.',
  },
  HANDOFF_AND_START_DATE_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.HANDOFF_AND_START_DATE_REQUIRED',
    pl: 'Wymagany przyjęty handoff i termin startu realizacji.',
  },
  OPEN_WORK_BLOCKS_CLOSURE: {
    key: 'initiatives.lifecycle.blocked.OPEN_WORK_BLOCKS_CLOSURE',
    pl: 'Zamknięcie blokują otwarte zadania lub nierozstrzygnięte decyzje.',
  },
  GATE_BLOCKED: {
    key: 'initiatives.lifecycle.blocked.GATE_BLOCKED',
    pl: 'Bramka gotowości niespełniona — uzupełnij: {{items}}.',
  },
  AUTHOR_ONLY: {
    key: 'initiatives.lifecycle.blocked.AUTHOR_ONLY',
    pl: 'Tylko autor lub administrator może przesłać szkic do zatwierdzenia.',
  },
  INVALID_TRANSITION: {
    key: 'initiatives.lifecycle.blocked.INVALID_TRANSITION',
    pl: 'To przejście nie istnieje dla bieżącego statusu.',
  },
  UNEXPECTED_CURRENT_STATUS: {
    key: 'initiatives.lifecycle.blocked.UNEXPECTED_CURRENT_STATUS',
    pl: 'Status inicjatywy zmienił się w międzyczasie — odśwież widok.',
  },
  MISSING_TRANSITION_GATE: {
    key: 'initiatives.lifecycle.blocked.MISSING_TRANSITION_GATE',
    pl: 'To przejście nie ma zdefiniowanej bramki i nie może zostać wykonane.',
  },
  INVALID_FLAG_OPERATION: {
    key: 'initiatives.lifecycle.blocked.INVALID_FLAG_OPERATION',
    pl: 'Ta operacja nie jest dozwolona w bieżącym stanie inicjatywy.',
  },
  UNSUPPORTED_FLAG_OPERATION: {
    key: 'initiatives.lifecycle.blocked.UNSUPPORTED_FLAG_OPERATION',
    pl: 'Nieobsługiwana operacja flagi cyklu życia.',
  },
};

export const INITIATIVE_RULE_FALLBACK = {
  key: 'initiatives.lifecycle.blocked.UNKNOWN',
  pl: 'Nie udało się wykonać działania. Odśwież widok i spróbuj ponownie.',
} as const;

export type TranslateFn = (key: string, fallback: string) => string;

/**
 * Klucze wymagań gotowości z `getBlockingReadinessItems` (serwer) → polski opis.
 * Serwer trzyma tylko angielską etykietę techniczną; użytkownik ma zobaczyć zdanie.
 */
export const INITIATIVE_READINESS_ITEM_KEYS: Record<string, { key: string; pl: string }> = {
  title: { key: 'initiatives.lifecycle.readiness.title', pl: 'tytuł' },
  owner: { key: 'initiatives.lifecycle.readiness.owner', pl: 'właściciel' },
  timeline_dates: { key: 'initiatives.lifecycle.readiness.timeline_dates', pl: 'planowane daty startu i końca' },
  schedule_milestones: { key: 'initiatives.lifecycle.readiness.schedule_milestones', pl: 'co najmniej jeden kamień milowy' },
  timeline: { key: 'initiatives.lifecycle.readiness.timeline', pl: 'harmonogram bazowy (daty)' },
  benefits_owner: { key: 'initiatives.lifecycle.readiness.benefits_owner', pl: 'właściciel biznesowy korzyści' },
  benefits_kpis: { key: 'initiatives.lifecycle.readiness.benefits_kpis', pl: 'wskaźniki KPI' },
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
    const items = initiativeReadinessItemsLabel(details?.items, t) || t('initiatives.lifecycle.readiness.unknown', 'wymagania bramki');
    return text.replace('{{items}}', items);
  }
  return text;
}

/** Etykieta akcji per bramka — słownictwo z tablicy DEC-424. */
export const INITIATIVE_GATE_LABELS: Record<string, string> = {
  CREATE_DRAFT: 'Utwórz szkic',
  SUBMIT_FOR_REVIEW: 'Prześlij do zatwierdzenia',
  APPROVE: 'Zatwierdź inicjatywę',
  SEND_BACK: 'Zwróć do szkicu',
  REJECT: 'Odrzuć inicjatywę',
  START: 'Rozpocznij realizację',
  COMPLETE: 'Zamknij inicjatywę',
  CANCEL: 'Anuluj inicjatywę',
  BLOCK: 'Wstrzymaj realizację',
  UNBLOCK: 'Wznów realizację',
  ARCHIVE: 'Zarchiwizuj',
};

export function initiativeGateLabel(gate: string | null | undefined, t: TranslateFn): string {
  const code = String(gate || '');
  return t(`initiatives.lifecycle.action.${code}`, INITIATIVE_GATE_LABELS[code] || 'Zmień status');
}
