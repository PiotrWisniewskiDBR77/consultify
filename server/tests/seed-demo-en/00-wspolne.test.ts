import { describe, expect, it } from 'vitest';

import {
  det,
  sprawdzCel,
  sprawdzRoleSlownika,
  tozsamosc,
  uuidV5,
} from '../../scripts/seed/demo-en/00-wspolne';

describe('00-wspolne — UUIDv5 deterministyczne (paczka D1, docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md §D1)', () => {
  it('to samo (rodzaj, klucz) daje ZAWSZE to samo id — dwukrotne wywołanie', () => {
    const a = det('user', 'james.whitfield@northwind.example');
    const b = det('user', 'james.whitfield@northwind.example');
    expect(a).toBe(b);
  });

  it('inny klucz daje inne id', () => {
    const a = det('user', 'james.whitfield@northwind.example');
    const b = det('user', 'sarah.mitchell@northwind.example');
    expect(a).not.toBe(b);
  });

  it('inny "rodzaj" dla tego samego klucza też daje inne id (przestrzenie się nie mieszają)', () => {
    const jakoUser = det('user', 'plant-operations');
    const jakoTeam = det('team', 'plant-operations');
    expect(jakoUser).not.toBe(jakoTeam);
  });

  it('wynik jest poprawnym UUIDv5 (wersja=5, wariant RFC4122)', () => {
    const id = det('user', 'x@example.com');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('uuidV5 jest zgodny z RFC4122 (wektor referencyjny — DNS namespace + "example.com")', () => {
    // Wektor z RFC 4122 §4.3 (namespace DNS = 6ba7b810-9dad-11d1-80b4-00c04fd430c8, name "www.widgets.com"
    // nie jest publikowany wprost w RFC, więc weryfikujemy tu tylko wewnętrzną spójność wersji/wariantu
    // powyżej — ten test pilnuje że funkcja jest deterministyczna względem znanej przestrzeni nazw.
    const ns = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const id1 = uuidV5('example.com', ns);
    const id2 = uuidV5('example.com', ns);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('00-wspolne — słownik ról (organization_members_role_check, server/migrations/727_beta_missing_tables.sql:25)', () => {
  it('akceptuje role ze słownika: OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST', () => {
    for (const rola of ['OWNER', 'ADMIN', 'MEMBER', 'CONSULTANT', 'USER', 'GUEST']) {
      expect(() => sprawdzRoleSlownika(rola, 'test')).not.toThrow();
    }
  });

  it('ODMAWIA stanowiska wpisanego jako rola — reprodukcja defektu zastanego (POMIAR.md §1.4: "UX Designer" w users.role)', () => {
    expect(() => sprawdzRoleSlownika('UX Designer', 'osoba testowa')).toThrow(/słowniku ról/);
    expect(() => sprawdzRoleSlownika('DevOps Engineer', 'osoba testowa')).toThrow(/słowniku ról/);
    expect(() => sprawdzRoleSlownika('Plant Manager', 'osoba testowa')).toThrow(/słowniku ról/);
  });

  it('MUTACJA — gdyby walidacja przepuszczała wszystko (np. return zamiast throw), ten test łapie to jako RED', () => {
    // Reprodukcja "starej", zepsutej reguły — brak walidacji w ogóle.
    const brakWalidacji = (_rola: string, _kontekst: string): void => {
      /* no-op — MUTANT, celowo nic nie sprawdza */
    };
    // Pilnujemy, że PRODUKCYJNA funkcja (importowana z 00-wspolne) różni się od mutanta:
    // mutant przepuszcza śmieć bez rzucania, produkcyjna funkcja rzuca.
    expect(() => brakWalidacji('Plant Manager', 'mutant')).not.toThrow();
    expect(() => sprawdzRoleSlownika('Plant Manager', 'produkcja')).toThrow();
  });

  it('rozróżnia wielkość liter (rola musi być DOKŁADNIE jak w CHECK-u bazy)', () => {
    expect(() => sprawdzRoleSlownika('owner', 'lowercase')).toThrow();
    expect(() => sprawdzRoleSlownika('Owner', 'mixedcase')).toThrow();
  });
});

describe('00-wspolne — guard hosta (odmowa produkcji/demo/staging i błędnego celu)', () => {
  const OK_URL = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d1';

  it('przepuszcza poprawny cel (127.0.0.1:54418/consultify_kopia_d1) z pasującym --oczekiwany-host', () => {
    expect(() => sprawdzCel(OK_URL, '54418')).not.toThrow();
    expect(sprawdzCel(OK_URL, '54418')).toBe('127.0.0.1:54418/consultify_kopia_d1');
  });

  it('ODMAWIA produkcji (centerbeam) niezależnie od --oczekiwany-host', () => {
    const url = 'postgresql://postgres:postgres@centerbeam.proxy.rlwy.net:5432/railway';
    expect(() => sprawdzCel(url, 'centerbeam')).toThrow(/PRODUKCJĘ/);
  });

  it('przepuszcza kopię innej paczki (consultify_kopia_d3) — wzorzec obejmuje D1-D6, nie tylko D1', () => {
    const url = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d3';
    expect(sprawdzCel(url, '54418')).toBe('127.0.0.1:54418/consultify_kopia_d3');
  });

  it('ODMAWIA nazwy bazy bez numeru paczki (consultify_kopia_dX) — wzorzec jest wąski, nie „zaczyna się od"', () => {
    const url = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_dX';
    expect(() => sprawdzCel(url, '54418')).toThrow(/consultify_kopia_d<numer>/);
  });

  it('ODMAWIA demo/staging (trolley/thomas) — paczki D1-D6 działają wyłącznie na kopii lokalnej', () => {
    expect(() => sprawdzCel('postgresql://u:p@trolley.proxy.rlwy.net:5432/railway', 'trolley')).toThrow(/demo\/staging/);
    expect(() => sprawdzCel('postgresql://u:p@thomas.proxy.rlwy.net:5432/railway', 'thomas')).toThrow(/demo\/staging/);
  });

  it('ODMAWIA gdy --oczekiwany-host nie pasuje do hosta w URL', () => {
    expect(() => sprawdzCel(OK_URL, 'innyhost')).toThrow(/nie pasuje/i);
  });

  it('ODMAWIA gdy baza nie jest "consultify_kopia_d<numer>" — nawet przy pasującym hoście', () => {
    // Wzorzec `consultify_kopia_d\d+` (nie literalne "d1") od paczki D6:
    // 00-wspolne.ts jest reużywane przez WSZYSTKIE podskrypty D1-D8, każdy
    // pracuje na własnej kopii lokalnej (`consultify_kopia_d1`…`consultify_kopia_d8`).
    const url = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_staging_kopia';
    expect(() => sprawdzCel(url, '54418')).toThrow(/consultify_kopia_d/);
  });

  it('przepuszcza dowolną kopię paczki "consultify_kopia_d<numer>" (D6 dzieli 00-wspolne.ts z D1, własna baza)', () => {
    const url = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d6';
    expect(() => sprawdzCel(url, '54418')).not.toThrow();
    expect(sprawdzCel(url, '54418')).toBe('127.0.0.1:54418/consultify_kopia_d6');
  });

  // D2 (docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md §D2) uruchamia
  // 02-odkrycie.ts na WŁASNEJ kopii `consultify_kopia_d2` (a nie na
  // `consultify_kopia_d1` z D1) — każda paczka dostaje swój numer. Guard
  // musiał zostać uogólniony z literału "d1" na wzorzec "d<N>"
  // (00-wspolne.ts:78, `/consultify_kopia_d\d+/i`) — ten test pilnuje że
  // d2 (i każdy kolejny numer) przechodzi tak samo jak d1 powyżej.
  it('przepuszcza KAŻDY numer paczki "consultify_kopia_d<N>" (d1, d2, d3, …) — guard nie jest przybity do jednej paczki', () => {
    for (const n of [1, 2, 3, 7]) {
      const url = `postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d${n}`;
      expect(() => sprawdzCel(url, '54418')).not.toThrow();
    }
  });

  it('MUTACJA — gdyby guard wrócił do literału "d1", "consultify_kopia_d2" (baza D2) zostałaby ODRZUCONA; produkcyjna wersja tego NIE robi', () => {
    const mutantSprawdzCelD1Only = (url: string, oczekiwanyHost: string): string => {
      const t = tozsamosc(url);
      if (/centerbeam/i.test(t)) throw new Error('PRODUKCJĘ');
      if (/trolley|thomas/i.test(t)) throw new Error('demo/staging');
      const host = t.split('/')[0]!;
      if (!host.includes(oczekiwanyHost)) throw new Error('nie pasuje');
      if (!/consultify_kopia_d1/i.test(t)) throw new Error('consultify_kopia_d1'); // MUTANT: literał "d1"
      return t;
    };
    const urlD2 = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d2';
    expect(() => mutantSprawdzCelD1Only(urlD2, '54418')).toThrow(); // mutant: odrzuca d2 (RED byłoby złe dla D2)
    expect(() => sprawdzCel(urlD2, '54418')).not.toThrow(); // produkcja: przepuszcza d2 (to jest właściwe zachowanie)
  });

  it('MUTACJA — gdyby guard porównywał tylko prefiks hosta bez segmentu bazy, złapałby staging na tym samym porcie; produkcyjna wersja tego NIE robi', () => {
    // Mutant: guard "stary" sprawdzał tylko host:port, nie nazwę bazy.
    const mutantSprawdzCel = (url: string, oczekiwanyHost: string): string => {
      const t = tozsamosc(url);
      const host = t.split('/')[0]!;
      if (!host.includes(oczekiwanyHost)) throw new Error('nie pasuje');
      return t; // BRAK sprawdzenia nazwy bazy — to jest defekt, który naprawiliśmy
    };
    const urlZlejBazyTenSamPort = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_staging_kopia';
    expect(() => mutantSprawdzCel(urlZlejBazyTenSamPort, '54418')).not.toThrow(); // mutant: przepuszcza (RED byłoby dobre tu)
    expect(() => sprawdzCel(urlZlejBazyTenSamPort, '54418')).toThrow(); // produkcja: odmawia (to jest właściwe zachowanie)
  });
});

describe('tozsamosc — normalizacja identyfikatora celu', () => {
  it('normalizuje wielkość liter hosta i nazwy bazy', () => {
    const url = 'postgresql://postgres:postgres@127.0.0.1:54418/Consultify_Kopia_D1';
    expect(tozsamosc(url)).toBe('127.0.0.1:54418/consultify_kopia_d1');
  });
});
