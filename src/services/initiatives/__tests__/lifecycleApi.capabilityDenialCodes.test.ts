/**
 * E1c/F2 (10.09, po E2/E2b) — trzy nowe kody odmowy z bramki uprawnień
 * (`server/src/middleware/effectiveCapability.middleware.ts`) na zmianę
 * statusu inicjatywy (`PATCH /initiatives/:id/status`):
 *   CAPABILITY_OBJECT_OWNERSHIP_REQUIRED / _PREDICATE_MISSING / _CHECK_FAILED.
 *
 * Koperta tej bramki niesie `{error, code, required, projectId, reason}` —
 * NIGDY `rule`. `readInitiativeFailureRule` (jedyny czytnik reguły w
 * `useInitiativeLifecycle.run`) czytał wyłącznie `data.rule`, więc dla tej
 * odmowy zwracał `null`, a front pokazywał `error.message` — ogólnikowe
 * angielskie „Capability required" (bramka jezykowa J0: serwer nie tłumaczy),
 * zamiast polskiego zdania o właścicielu inicjatywy.
 *
 * Ten test broni CAŁEGO łańcucha mapowania: kod z koperty serwera ->
 * `readInitiativeFailureRule` -> `initiativeRuleMessage` -> klucz i18n
 * istniejący w REALNYCH plikach `public/locales/{pl,en}/translation.json`
 * (nie w atrapie — inaczej test mierzyłby własną fiksturę, nie to, co
 * zobaczy użytkownik).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { initiativeRuleMessage } from '@/components/Initiatives/lifecycle/initiativeLifecycleMessages';

import { readInitiativeFailureRule } from '../lifecycleApi';

const readLocale = (lng: 'pl' | 'en') =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lng}/translation.json`), 'utf8'));

const CAPABILITY_CODES = [
  'CAPABILITY_OBJECT_OWNERSHIP_REQUIRED',
  'CAPABILITY_OWNERSHIP_PREDICATE_MISSING',
  'CAPABILITY_OWNERSHIP_CHECK_FAILED',
];

describe('readInitiativeFailureRule — kody odmowy bramki uprawnień (E1c/F2)', () => {
  it.each(CAPABILITY_CODES)(
    'kod %s z koperty {code} (bez `rule`) mapuje się na regułę CAPABILITY_OBJECT_OWNERSHIP_REQUIRED',
    (kod) => {
      const error = { data: { error: 'Capability required', code: kod, projectId: 'p-1' } };
      expect(readInitiativeFailureRule(error)).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    }
  );

  it('kod nieznany (spoza trzech) nadal zwraca null — nie zgaduje reguły', () => {
    const error = { data: { error: 'Capability required', code: 'CAPABILITY_REQUIRED' } };
    expect(readInitiativeFailureRule(error)).toBeNull();
  });

  it('gdy serwer JEDNAK poda `rule`, ono wygrywa (zachowanie sprzed naprawy bez zmian)', () => {
    const error = { data: { rule: 'REASON_REQUIRED', code: 'CAPABILITY_OBJECT_OWNERSHIP_REQUIRED' } };
    expect(readInitiativeFailureRule(error)).toBe('REASON_REQUIRED');
  });

  it('brak `data` albo pusty błąd nadal zwraca null (bez zmiany zachowania)', () => {
    expect(readInitiativeFailureRule(new Error('network'))).toBeNull();
    expect(readInitiativeFailureRule(null)).toBeNull();
  });
});

describe('initiativeRuleMessage — regula CAPABILITY_OBJECT_OWNERSHIP_REQUIRED ma klucz w OBU plikach tłumaczeń', () => {
  const pl = readLocale('pl');
  const en = readLocale('en');
  const t = (key: string, fallback: string) => fallback; // sama obecnosc klucza sprawdzana ponizej

  it('klucz istnieje w public/locales/pl/translation.json i NIE jest po angielsku', () => {
    const wartosc = pl?.initiatives?.lifecycle?.blocked?.CAPABILITY_OBJECT_OWNERSHIP_REQUIRED;
    expect(typeof wartosc).toBe('string');
    expect(wartosc).toMatch(/właścicielem lub twórcą/);
  });

  it('klucz istnieje w public/locales/en/translation.json', () => {
    const wartosc = en?.initiatives?.lifecycle?.blocked?.CAPABILITY_OBJECT_OWNERSHIP_REQUIRED;
    expect(typeof wartosc).toBe('string');
    expect(wartosc).toMatch(/own or created/);
  });

  it('initiativeRuleMessage zwraca zdanie, nigdy surowy kod, dla wszystkich trzech kodów po przejściu przez readInitiativeFailureRule', () => {
    for (const kod of CAPABILITY_CODES) {
      const rule = readInitiativeFailureRule({ data: { code: kod } });
      const message = initiativeRuleMessage(rule, t);
      expect(message).not.toMatch(/CAPABILITY_/);
      expect(message).toBe('You can only change the status of initiatives you own or created.');
    }
  });
});
