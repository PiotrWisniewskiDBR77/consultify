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
  analizujLiteralyObiektowZawartosc,
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
