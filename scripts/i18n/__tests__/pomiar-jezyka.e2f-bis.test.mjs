/**
 * @vitest-environment node
 *
 * E2f-bis: mutation-resistant examples for the weak-English detector and the
 * three new source sinks. The 30/30 language sample is copied from the three
 * modules named in W73; the negative half intentionally contains Polish UI
 * phrases with English loanwords which caused false positives in the WIP.
 */
import { describe, expect, it } from 'vitest';
import {
  analizujJsxZawartosc,
  analizujLiteralyObiektowZawartosc,
  analizujSerwerK8sZawartosc,
  analizujSerwerZawartosc,
  analizujTwLiteraleZawartosc,
  jestKodemSerwerowymK8s,
  wykryjAngielski,
} from '../pomiar-jezyka.mjs';

const TRAFIENIA = [
  // Execution
  'Team Member',
  'Overallocated',
  'Diagnosis',
  'Action Steps',
  'Missing dates',
  'Execution Workbench',
  'Data quality posture',
  'No initiatives',
  'Weekly Execution Pack',
  'Pending decisions',
  // Settings
  'Organization settings',
  'Reset to default',
  'Security overview',
  'Notification preferences',
  'Manage access',
  'Session timeout',
  'Password requirements',
  'Active devices',
  'Profile information',
  'Save changes',
  // Initiatives
  'Advance to next status',
  'Assign owners',
  'Flag for attention',
  'Effort Profile',
  'Additional context',
  'Select Intent',
  'Deliverable description',
  'Capacity Scenario Workbench',
  'Request commitment',
  'Assignee accept',
];

const POMINIECIA = [
  // Ambiguous one-word loanwords must not prove English by themselves.
  'Company',
  'Status',
  'Lead',
  'Backlog',
  'Role',
  'Most',
  'Stale',
  // Product names and Polish UI with loanwords, no Polish diacritics required.
  'Consultify',
  'Teresa DBR77',
  'Plan Komunikacji',
  'Eskalacja z preview — wymaga reakcji',
  'Spadek health score',
  'Projekt strategiczny',
  'Ustawienia organizacji',
  'Zapisz zmiany',
  'Brak danych',
  'Analiza ryzyka',
  'Portfel inicjatyw',
  'Plan realizacji',
  'Status projektu',
  'Lider zespolu',
  'Backlog produktu',
  'Rola managera',
  'Lead sprzedazowy',
  'Stale dane',
  'Most technologiczny',
  'Company Polska',
  'Program transformacji',
  'Dashboard zarzadu',
  'Monitoring realizacji',
];

const TECHNICZNE_30 = [
  '(url: string, opts?: RequestInit): Promise',
  'Array.isArray(rows) ? rows.reduce',
  'Object.keys(value).map',
  'String(value).trim',
  'Number.parseInt(value)',
  'Boolean(value)',
  'JSON.stringify(payload)',
  'Promise.resolve(value)',
  'Math.max(current, next)',
  'rows.map((row) => row.id)',
  'values.filter((value) => Boolean(value))',
  'items.reduce((sum, item) => sum + item)',
  'const result = values.filter(Boolean)',
  'let current = rows.length',
  'return items.reduce(sumRows)',
  'execution.bank.title',
  'data-quality-posture',
  'schema_version_at_creation',
  'public | authenticated',
  '/organization/settings',
  '@scope/package',
  '#component-id',
  'VALIDATION_ERROR',
  'HTTP_409_CONFLICT',
  'camelCaseIdentifier',
  'calculateScore(input)',
  'payload.items?.map(transform)',
  'result?.data ?? fallback',
  'value === expected',
  'items.length > 0 ? active : empty',
  ') : autosaveError ? (',
];

describe('E2f-bis / wykryjAngielski — próbka precyzji 30 + 30', () => {
  it.each(TRAFIENIA)('wykrywa angielski napis: %s', (tekst) => {
    expect(wykryjAngielski(tekst)).not.toBeNull();
  });

  it.each(POMINIECIA)('nie oskarża polskiego lub dwuznacznego napisu: %s', (tekst) => {
    expect(wykryjAngielski(tekst)).toBeNull();
  });

  it('jednoliterowe i firmowe skróty nie udają dowodu polskiego', async () => {
    const { wykryjPolski } = await import('../pomiar-jezyka.mjs');
    expect(wykryjPolski('I want to learn more')).toBeNull();
    expect(wykryjPolski('Phishing Simulation (Proofpoint SA)')).toBeNull();
  });
});

describe('E2f-bis / K4obj i K4objPL', () => {
  it('widzi siedem wymaganych ujść obiektowych', () => {
    const kod = [
      "const columns = [{ label: 'Team Member', title: 'Action Steps',",
      "  placeholder: 'Search initiatives', header: 'Missing dates',",
      "  description: 'Data quality posture', tooltip: 'Open settings',",
      "  emptyText: 'No results' }];",
    ].join('\n');
    expect(analizujLiteralyObiektowZawartosc(kod)).toMatchObject({ K4obj: 7, K4objPL: 0 });
  });

  it('rozróżnia polski literał i wyklucza identyfikatory techniczne', () => {
    const kod = [
      "const column = { label: 'Brak danych w tym okresie',",
      "  id: 'Human readable value', key: 'Human readable value',",
      "  value: 'Human readable value', type: 'Human readable value',",
      "  status: 'Human readable value', icon: 'Human readable value',",
      "  path: '/organization/settings', title: 'SCREAMING_CASE' };",
    ].join('\n');
    expect(analizujLiteralyObiektowZawartosc(kod)).toMatchObject({ K4obj: 0, K4objPL: 1 });
  });

  it('nie dubluje defaultValue już przechodzącego przez t()', () => {
    const kod = "const column = { label: t('execution.owner', 'Team Member') };";
    expect(analizujLiteralyObiektowZawartosc(kod)).toMatchObject({ K4obj: 0, K4objPL: 0 });
  });

  it('nie rozszerza mianownika poza siedem ujść W73', () => {
    const kod = [
      "const colors = { text: 'text-c-text-secondary dark:text-c-text-secondary' };",
      "const card = { name: 'Human readable name', message: 'Action completed',",
      "  summary: 'Quarterly progress', subtitle: 'Next actions' };",
    ].join('\n');
    expect(analizujLiteralyObiektowZawartosc(kod)).toMatchObject({ K4obj: 0, K4objPL: 0 });
  });

  it('pomija techniczne unie enumów w description', () => {
    const kod = [
      "const target = { description: 'initiative | task_set | decision | report | presentation' };",
      "const scope = { description: 'public|organization|authenticated.' };",
    ].join('\n');
    expect(analizujLiteralyObiektowZawartosc(kod)).toMatchObject({ K4obj: 0, K4objPL: 0 });
  });
});

describe('E2f-bis / K8spl i K11', () => {
  it('K8s obejmuje assessment i actionCard, nadal pomijając testy', () => {
    expect(jestKodemSerwerowymK8s('server/src/services/assessment/composer.ts')).toBe(true);
    expect(jestKodemSerwerowymK8s('server/src/services/actionCard/generator.ts')).toBe(true);
    expect(jestKodemSerwerowymK8s('server/src/services/assessment/__tests__/composer.test.ts')).toBe(false);
  });

  it('K11 widzi trzy rodzaje t() zamkniętego w literale i pomija prawdziwe wywołanie', () => {
    const kod = [
      "const a = \"{t('scope.one')}\";",
      "const b = '{t(\"scope.two\")}';",
      "const c = `{t('scope.three')}`;",
      "const ok = t('scope.four');",
    ].join('\n');
    expect(analizujTwLiteraleZawartosc(kod).K11).toBe(3);
  });
});

describe('W77 / precyzja K4en 30 trafień + 30 pominięć technicznych', () => {
  it.each(TRAFIENIA)('K4en wykrywa: %s', (tekst) => {
    expect(analizujJsxZawartosc(`<span>${tekst}</span>`).K4en).toBe(1);
  });
  it.each(TECHNICZNE_30)('K4en pomija kod: %s', (tekst) => {
    expect(analizujJsxZawartosc(`<span>${tekst}</span>`).K4en).toBe(0);
  });
});

describe('W77 / precyzja K5en 30 trafień + 30 pominięć technicznych', () => {
  it.each(TRAFIENIA)('K5en wykrywa: %s', (tekst) => {
    expect(analizujSerwerZawartosc(`const payload = { error: '${tekst}' };`).K5en).toBe(1);
  });
  it.each(TECHNICZNE_30)('K5en pomija kod: %s', (tekst) => {
    expect(analizujSerwerZawartosc(`const payload = { error: '${tekst}' };`).K5en).toBe(0);
  });
});

describe('W77 / precyzja K8sen 30 trafień + 30 pominięć technicznych', () => {
  it.each(TRAFIENIA)('K8sen wykrywa: %s', (tekst) => {
    expect(analizujSerwerK8sZawartosc(`const payload = { error: '${tekst}' };`).K8sen).toBe(1);
  });
  it.each(TECHNICZNE_30)('K8sen pomija kod: %s', (tekst) => {
    expect(analizujSerwerK8sZawartosc(`const payload = { error: '${tekst}' };`).K8sen).toBe(0);
  });
});

describe('W77 / wieloliniowe literały i tablice JS', () => {
  it('nie traktuje kodu rozlanego na linie jako K4en/K5en/K8sen', () => {
    const jsxArray = [
      'const columns: Array<',
      '  { label: string; value: string }',
      '> = [',
      "  { label: 'Owner', value: 'ownerId' },",
      '];',
    ].join('\n');
    const serverExpression = [
      "const payload = { error: 'Array.isArray(rows) ?",
      "  rows.reduce(totalRows) : emptyRows' };",
    ].join('\n');

    expect(analizujJsxZawartosc(jsxArray).K4en).toBe(0);
    expect(analizujSerwerZawartosc(serverExpression).K5en).toBe(0);
    expect(analizujSerwerK8sZawartosc(serverExpression).K8sen).toBe(0);
  });

  it('pomija dokładną generyczną sygnaturę z InterviewWorkspace', () => {
    const source =
      'const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {';
    expect(analizujJsxZawartosc(source).K4en).toBe(0);
  });

  it('pomija przecięcie typów z propsów InterviewWorkspace', () => {
    const source =
      "assignment: Partial<V8InterviewAssignment> & Pick<V8InterviewAssignment, 'id' | 'status'>";
    expect(analizujJsxZawartosc(source).K4en).toBe(0);
  });

  it('pomija dokładny literał ragLogic z tablicy ExecutionHub', () => {
    const source =
      "ragLogic: 'GREEN if no blockers and progress on-track; AMBER if overdue items >0 or progress <5% this week; RED if blockers >0',";
    expect(analizujJsxZawartosc(source).K4en).toBe(0);
  });
});
