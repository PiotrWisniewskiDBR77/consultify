/**
 * H1e task 2 — kod odmowy `CLOSURE_WORK_INCOMPLETE` (COMPLETE za flagą
 * `ENABLE_LIFECYCLE_GO_GATE`, H1d) nie miał wpisu w
 * `INITIATIVE_RULE_MESSAGE_KEYS` — użytkownik widziałby surowy angielski
 * komunikat serwera zamiast przetłumaczonego zdania.
 *
 * MUTACJA: usuń klucz `CLOSURE_WORK_INCOMPLETE` z `INITIATIVE_RULE_MESSAGE_KEYS`
 * albo z jednego z dwóch plików `public/locales/*` → ten plik ma zaświecić się
 * na czerwono.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  INITIATIVE_RULE_MESSAGE_KEYS,
  initiativeRuleMessage,
} from '../initiativeLifecycleMessages';

const identityT = (key: string, fallback: string) => fallback;

describe('CLOSURE_WORK_INCOMPLETE — słownik komunikatów', () => {
  it('ma wpis w INITIATIVE_RULE_MESSAGE_KEYS z kluczem i18n', () => {
    const entry = INITIATIVE_RULE_MESSAGE_KEYS.CLOSURE_WORK_INCOMPLETE;
    expect(entry).toBeDefined();
    expect(entry.key).toBe('initiatives.lifecycle.blocked.CLOSURE_WORK_INCOMPLETE');
    expect(entry.pl).toMatch(/remaining tasks and milestones/i);
  });

  it('initiativeRuleMessage zwraca zdanie, nie kod, dla nieznanego t()', () => {
    const message = initiativeRuleMessage('CLOSURE_WORK_INCOMPLETE', identityT);
    expect(message).not.toBe('CLOSURE_WORK_INCOMPLETE');
    expect(message.length).toBeGreaterThan(0);
  });
});

describe('CLOSURE_WORK_INCOMPLETE — pliki tłumaczeń EN/PL', () => {
  const load = (locale: 'en' | 'pl') =>
    JSON.parse(
      readFileSync(resolve(__dirname, `../../../../../public/locales/${locale}/translation.json`), 'utf8')
    );

  it('public/locales/en/translation.json niesie klucz z angielskim zdaniem', () => {
    const en = load('en');
    const value = en?.initiatives?.lifecycle?.blocked?.CLOSURE_WORK_INCOMPLETE;
    expect(value).toBe('Close the remaining tasks and milestones before completing the initiative.');
  });

  it('public/locales/pl/translation.json niesie klucz z polskim zdaniem', () => {
    const pl = load('pl');
    const value = pl?.initiatives?.lifecycle?.blocked?.CLOSURE_WORK_INCOMPLETE;
    expect(value).toBe('Zamknij pozostałe zadania i kamienie milowe, zanim zakończysz inicjatywę.');
  });
});
