/**
 * Mapa `id → nazwisko` musi trafiać w KSZTAŁT, KTÓRY SERWER NAPRAWDĘ ODDAJE.
 *
 * ZMIERZONY DEFEKT (odbiór na żywo 2026-09-05, `results-vnext-okr-registry`,
 * `execution-tab-work`, `finance-comments-panel`): kolumna „Właściciel" i autor
 * komentarza pokazywały surowy UUID. Przyczyna NIE była po stronie danych —
 * `GET /api/organizations/:orgId/members` (`organizationController.getMembers`
 * → `organizationService.getActiveMembers`) zwraca surowe wiersze SQL:
 *   SELECT m.id, m.user_id, m.role, m.status, m.created_at,
 *          u.first_name, u.last_name, u.email
 * a WSZYSTKIE cztery kopie resolvera czytały `m.userId` i `m.name`, których
 * w tej odpowiedzi nie ma. Klucz mapy wychodził `undefined`, więc żadne
 * wyszukanie nie mogło się udać.
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): zamiana `readMemberId` z powrotem na
 * samo `member.userId` → pierwszy test pada („snake_case" nie mapuje się).
 * Zamiana `readMemberLabel` na samo `member.name` → drugi test pada. Mutacja
 * celuje w SAM MECHANIZM czytania kształtu odpowiedzi, nie w scenariusz.
 */
import { describe, expect, it } from 'vitest';

import {
  buildMemberNameMap,
  memberNameOrUnknown,
  readMemberId,
  readMemberLabel,
} from '../useOrganizationMemberNames';

/** Dokładnie to, co zwraca `getActiveMembers` (kolumny SELECT-a, snake_case). */
const SERWEROWY_WIERSZ = {
  id: 'membership-1',
  user_id: 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2',
  role: 'OWNER',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00.000Z',
  first_name: 'Piotr',
  last_name: 'Wiśniewski',
  email: 'piotr.wisniewski@dbr77.com',
};

describe('useOrganizationMemberNames — kształt odpowiedzi serwera', () => {
  it('mapuje wiersz snake_case po `user_id`, NIE po `id` członkostwa', () => {
    const map = buildMemberNameMap([SERWEROWY_WIERSZ]);
    expect(map['d2b6a316-08c5-47cf-9bf7-4ba50311d5a2']).toBe('Piotr Wiśniewski');
    expect(map['membership-1']).toBeUndefined();
    expect(readMemberId(SERWEROWY_WIERSZ)).toBe('d2b6a316-08c5-47cf-9bf7-4ba50311d5a2');
  });

  it('składa etykietę z `first_name`+`last_name`, gdy nie ma pola `name`', () => {
    expect(readMemberLabel(SERWEROWY_WIERSZ)).toBe('Piotr Wiśniewski');
  });

  it('spada na e-mail, gdy konto nie ma imienia ani nazwiska', () => {
    expect(readMemberLabel({ user_id: 'u2', email: 'analityk.dbr77@example.test' })).toBe(
      'analityk.dbr77@example.test'
    );
  });

  it('nadal obsługuje kontrakt camelCase (`OrganizationMember` z typów domeny)', () => {
    const map = buildMemberNameMap([{ userId: 'u3', name: 'Anna Kowalska', email: 'a@x.test' }]);
    expect(map.u3).toBe('Anna Kowalska');
  });

  it('nie tworzy wpisu bez identyfikatora ani bez etykiety', () => {
    expect(buildMemberNameMap([{ first_name: 'Bez', last_name: 'Id' }])).toEqual({});
    expect(buildMemberNameMap([{ user_id: 'u4' }])).toEqual({});
    expect(buildMemberNameMap(null)).toEqual({});
  });
});

describe('memberNameOrUnknown — UUID nigdy nie wychodzi na ekran jako nazwisko', () => {
  const resolver = (id: string) => (id === 'u1' ? 'Marek Nowak' : null);

  it('zwraca nazwisko, gdy katalog je zna', () => {
    expect(memberNameOrUnknown(resolver, 'u1', true)).toBe('Marek Nowak');
  });

  it('zwraca „Nieznany użytkownik", a NIE identyfikator, gdy katalog go nie zna', () => {
    const wynik = memberNameOrUnknown(resolver, 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2', true);
    expect(wynik).toBe('Nieznany użytkownik');
    expect(wynik).not.toContain('d2b6a316');
  });

  it('rozróżnia „brak przypisania" od „nieznany człowiek"', () => {
    expect(memberNameOrUnknown(resolver, null, true)).toBe('Nieprzypisany');
    expect(memberNameOrUnknown(resolver, '', true)).toBe('Nieprzypisany');
  });

  it('ma angielskie odpowiedniki', () => {
    expect(memberNameOrUnknown(resolver, 'nieznany-id', false)).toBe('Unknown user');
    expect(memberNameOrUnknown(resolver, null, false)).toBe('Unassigned');
  });
});
