/**
 * D-25 (RP1) — pluralizacja „dni" w raportach realizacji jest KONSUMOWANA.
 *
 * Dług powstał, bo jedyny istniejący tłumacz w teście modelu (`executionReportModel.test.ts:30-37`)
 * czyta klucz po ścieżce i interpoluje `{{count}}` — NIE zna form mnogich. Dlatego mutacja
 * „usuń `days_one`/`days_other` z pl, zostaw sztywne `{{count}} dni`" dawała 40/40 GREEN.
 *
 * Ten plik podpina PRAWDZIWY i18next z prawdziwymi zasobami `public/locales/{pl,en}` i woła
 * PRAWDZIWY `buildExecutionReportSnapshot`, więc asercja czyta to, co zobaczy użytkownik:
 * 1 → „1 dzień", 2/5/22 → „… dni" (PL) oraz 1 → „1 day", 5 → „5 days" (EN).
 * Usunięcie `days_one` z pl musi dać RED („1 dni").
 */
import i18next, { type i18n } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';
import {
  buildExecutionReportSnapshot,
  type ExecutionReportInputs,
  type Translator,
} from '../executionReportModel';

let instance: i18n;

const translatorFor = (lng: 'pl' | 'en'): Translator => {
  const fixed = instance.getFixedT(lng);
  return (key, fallback, options) =>
    fixed(key, { defaultValue: fallback, ...(options ?? {}) }) as string;
};

const iso = (value: string) => new Date(value).toISOString();
const asOf = iso('2026-09-06T12:00:00Z');
const period = { start: iso('2026-08-31T00:00:00Z'), end: iso('2026-09-07T00:00:00Z') };

/** Jeden dzień spóźnienia na decyzję i na zadanie — dokładnie tam, gdzie `count` = 1. */
const inputs: ExecutionReportInputs = {
  initiatives: [{ id: 'init-1', name: 'Compliance & GDPR Audit', status: 'IN_EXECUTION', progress: 72 }],
  tasks: [
    {
      id: 'task-1',
      title: 'TASK_SLIP_1',
      status: 'blocked',
      dueDate: iso('2026-09-05T12:00:00Z'),
      assignee: { firstName: 'Anna', lastName: 'K' },
    },
    {
      id: 'task-5',
      title: 'TASK_SLIP_5',
      status: 'in_progress',
      dueDate: iso('2026-09-01T12:00:00Z'),
      assignee: { firstName: 'Jan', lastName: 'N' },
    },
  ],
  decisions: [
    { id: 'dec-1', title: 'D1', status: 'PENDING', isOverdue: true, daysOverdue: 1 },
    { id: 'dec-2', title: 'D2', status: 'PENDING', isOverdue: true, daysOverdue: 2 },
    { id: 'dec-5', title: 'D5', status: 'PENDING', isOverdue: true, daysOverdue: 5 },
    { id: 'dec-22', title: 'D22', status: 'PENDING', isOverdue: true, daysOverdue: 22 },
  ],
  raid: [],
  signals: [],
  unavailable: [],
};

const build = (definitionKey: string, t: Translator) =>
  buildExecutionReportSnapshot({ definitionKey, definitionName: 'Report', period, asOf, inputs, t });

const cell = (
  snapshot: ReturnType<typeof buildExecutionReportSnapshot>,
  sectionId: string,
  rowTitle: string,
  columnId: string
): string | undefined =>
  snapshot.sections
    .find((section) => section.id === sectionId)
    ?.table?.rows.find((row: Record<string, unknown>) => row.title === rowTitle)?.[columnId] as
    | string
    | undefined;

beforeAll(async () => {
  instance = i18next.createInstance();
  await instance.init({
    lng: 'pl',
    fallbackLng: false,
    resources: {
      pl: { translation: plTranslation },
      en: { translation: enTranslation },
    },
    interpolation: { escapeValue: false },
  });
});

describe('D-25 — decydująca tabela decyzji liczy dni po polsku (forma mnoga z pl)', () => {
  it('1 dzień spóźnienia → „1 dzień", nie „1 dni"', () => {
    const snapshot = build('weekly-exec', translatorFor('pl'));
    expect(cell(snapshot, 'decisions', 'D1', 'overdue')).toBe('1 dzień');
  });

  it('2 / 5 / 22 dni spóźnienia → „… dni" (kategorie few i many opadają na days_other)', () => {
    const snapshot = build('weekly-exec', translatorFor('pl'));
    expect(cell(snapshot, 'decisions', 'D2', 'overdue')).toBe('2 dni');
    expect(cell(snapshot, 'decisions', 'D5', 'overdue')).toBe('5 dni');
    expect(cell(snapshot, 'decisions', 'D22', 'overdue')).toBe('22 dni');
  });

  it('EN trzyma własną formę mnogą: „1 day" i „5 days"', () => {
    const snapshot = build('weekly-exec', translatorFor('en'));
    expect(cell(snapshot, 'decisions', 'D1', 'overdue')).toBe('1 day');
    expect(cell(snapshot, 'decisions', 'D5', 'overdue')).toBe('5 days');
  });
});

describe('D-25 — kolumna poślizgu zadania idzie tym samym kluczem', () => {
  it('PL: „1 dzień" i „5 dni" w sekcji overdue karty inicjatywy', () => {
    const snapshot = build('initiative-card', translatorFor('pl'));
    expect(cell(snapshot, 'overdue', 'TASK_SLIP_1', 'slip')).toBe('1 dzień');
    expect(cell(snapshot, 'overdue', 'TASK_SLIP_5', 'slip')).toBe('5 dni');
  });

  it('EN: „1 day" i „5 days" w tej samej kolumnie', () => {
    const snapshot = build('initiative-card', translatorFor('en'));
    expect(cell(snapshot, 'overdue', 'TASK_SLIP_1', 'slip')).toBe('1 day');
    expect(cell(snapshot, 'overdue', 'TASK_SLIP_5', 'slip')).toBe('5 days');
  });
});
