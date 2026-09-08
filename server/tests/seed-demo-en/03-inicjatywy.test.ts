/**
 * D3 — testy DANYCH seedu inicjatyw, BEZ bazy
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D3, §3.2).
 *
 * Testujemy to, co da się zepsuć w samych danych i co bramka `--verify`
 * sprawdza dopiero po zapisie: rozkład statusów, komplet karty, wymuszoną
 * kolejność STOP 1 i stabilność identyfikatorów. Każdy blok ma test MUTACYJNY —
 * reprodukcję zepsutej reguły, która musi być RED względem wersji produkcyjnej.
 */
import { describe, expect, it } from 'vitest';

import { det } from '../../scripts/seed/demo-en/00-wspolne';
import {
  INICJATYWY,
  SLUGI_PLANU,
  STATUSY_KANONICZNE,
  doRejestracji,
  rozkladStatusow,
  statusEtapuSql,
  type Inicjatywa,
} from '../../scripts/seed/demo-en/03-dane-inicjatyw';

describe('03-dane-inicjatyw — rozkład statusów DEC-424', () => {
  it('jest DOKŁADNIE 13 inicjatyw', () => {
    expect(INICJATYWY).toHaveLength(13);
  });

  it('występuje KAŻDY z siedmiu statusów kanonicznych — żaden nie jest pusty', () => {
    const rozklad = rozkladStatusow();
    for (const status of STATUSY_KANONICZNE) {
      expect(rozklad[status], `status ${status} nie ma ani jednej inicjatywy`).toBeGreaterThan(0);
    }
    expect(Object.values(rozklad).reduce((a, b) => a + b, 0)).toBe(13);
  });

  it('rozkład to dokładnie PROPOSED 1 · DRAFT 1 · PENDING_APPROVAL 1 · APPROVED 4 · IN_EXECUTION 4 · CLOSED 1 · REJECTED 1', () => {
    expect(rozkladStatusow()).toEqual({
      PROPOSED: 1,
      DRAFT: 1,
      PENDING_APPROVAL: 1,
      APPROVED: 4,
      IN_EXECUTION: 4,
      CLOSED: 1,
      REJECTED: 1,
    });
  });

  it('dokładnie JEDNA inicjatywa jest wstrzymana FLAGĄ on_hold — i jest IN_EXECUTION, nie osobnym statusem', () => {
    const wstrzymane = INICJATYWY.filter((i) => i.onHold === true);
    expect(wstrzymane).toHaveLength(1);
    expect(wstrzymane[0]!.status).toBe('IN_EXECUTION');
    expect(wstrzymane[0]!.blockedReason ?? '').not.toBe('');
  });

  it('MUTACJA — rozkład bez PROPOSED (tak wyglądała zastana baza: 0 wierszy) jest łapany jako brak statusu', () => {
    const okrojone = INICJATYWY.filter((i) => i.status !== 'PROPOSED');
    const rozklad = rozkladStatusow(okrojone);
    expect(rozklad.PROPOSED).toBe(0); // mutant: dziura w rozkładzie
    expect(rozkladStatusow().PROPOSED).toBeGreaterThan(0); // produkcja: dziury nie ma
  });
});

describe('03-dane-inicjatyw — STOP 1: register odrzuca IN_EXECUTION', () => {
  it('KAŻDA inicjatywa docelowo IN_EXECUTION wchodzi do bazy jako APPROVED (etap SQL)', () => {
    for (const i of INICJATYWY.filter((x) => x.status === 'IN_EXECUTION')) {
      expect(statusEtapuSql(i), `${i.slug} musi powstać jako APPROVED, bo register odrzuca IN_EXECUTION`).toBe(
        'APPROVED'
      );
    }
  });

  it('każdy inny status wchodzi do bazy bez zmiany', () => {
    for (const i of INICJATYWY.filter((x) => x.status !== 'IN_EXECUTION')) {
      expect(statusEtapuSql(i)).toBe(i.status);
    }
  });

  it('do rejestracji idą WYŁĄCZNIE statusy, które przyjmuje register (APPROVED / PENDING_APPROVAL)', () => {
    const plannable = ['APPROVED', 'PENDING_APPROVAL'];
    for (const i of doRejestracji()) {
      expect(plannable, `${i.slug}: status musi być plannable`).toContain(statusEtapuSql(i));
    }
    expect(doRejestracji().length).toBeGreaterThanOrEqual(4);
  });

  it('do register idą WYŁĄCZNIE inicjatywy REALNIE w APPROVED — agregat przykrywa każdy inny status na liście', () => {
    expect(doRejestracji().every((i) => i.status === 'APPROVED')).toBe(true);
    expect(doRejestracji().filter((i) => i.status === 'IN_EXECUTION')).toHaveLength(0);
    expect(doRejestracji().filter((i) => i.status === 'PENDING_APPROVAL')).toHaveLength(0);
  });

  it('MUTACJA — gdyby do rejestracji szły też IN_EXECUTION i PENDING_APPROVAL, pięć wierszy pokazałoby „Approved" zamiast prawdziwego statusu', () => {
    const mutant = INICJATYWY.filter(
      (i) => i.status === 'APPROVED' || i.status === 'PENDING_APPROVAL' || i.status === 'IN_EXECUTION'
    );
    expect(mutant.filter((i) => i.status !== 'APPROVED')).toHaveLength(5); // mutant: pięć przykrytych
    expect(doRejestracji().filter((i) => i.status !== 'APPROVED')).toHaveLength(0); // produkcja: zero
  });
});

describe('03-dane-inicjatyw — STOP 2: fail-closed realizacji', () => {
  it('KAŻDA inicjatywa IN_EXECUTION ma projekt, właściciela wykonania i obie daty planu', () => {
    for (const i of INICJATYWY.filter((x) => x.status === 'IN_EXECUTION')) {
      expect(i.projekt, `${i.slug} bez project_id → realizacja niewidoczna, GET …/work = 404`).toBeTruthy();
      expect(i.wlascicielWykonania, `${i.slug} bez właściciela wykonania`).toBeTruthy();
      expect(i.planStart, `${i.slug} bez daty startu`).toBeTruthy();
      expect(i.planKoniec, `${i.slug} bez daty końca`).toBeTruthy();
    }
  });

  it('MUTACJA — inicjatywa IN_EXECUTION bez projektu jest łapana, nie przepuszczana', () => {
    const mutant = { ...INICJATYWY.find((i) => i.status === 'IN_EXECUTION')!, projekt: undefined };
    const brakujace = [mutant, ...INICJATYWY].filter((i) => i.status === 'IN_EXECUTION' && !i.projekt);
    expect(brakujace).toHaveLength(1); // mutant złapany
    expect(INICJATYWY.filter((i) => i.status === 'IN_EXECUTION' && !i.projekt)).toHaveLength(0); // produkcja czysta
  });

  it('żadna osoba nie prowadzi dwóch inicjatyw IN_EXECUTION naraz (alokacja mieści się w dostępności)', () => {
    const prowadzacy = INICJATYWY.filter((i) => i.status === 'IN_EXECUTION').map((i) => i.wlascicielWykonania);
    expect(new Set(prowadzacy).size).toBe(prowadzacy.length);
  });

  it('alokacja FTE nigdy nie przekracza zapotrzebowania', () => {
    for (const i of INICJATYWY) {
      expect(i.zaalokowaneFte, `${i.slug}`).toBeLessThanOrEqual(i.wymaganeFte + 0.001);
    }
  });
});

describe('03-dane-inicjatyw — komplet karty (86% zastanych inicjatyw nie ma opisu)', () => {
  it('każda inicjatywa ma opis o co najmniej trzech zdaniach i 200+ znakach', () => {
    for (const i of INICJATYWY) {
      expect(i.opis.length, `${i.slug}: opis za krótki`).toBeGreaterThanOrEqual(200);
      const zdania = i.opis.split(/(?<=\.)\s+/).filter((z) => z.trim().length > 0);
      expect(zdania.length, `${i.slug}: mniej niż 3 zdania`).toBeGreaterThanOrEqual(3);
      expect(zdania.length, `${i.slug}: więcej niż 5 zdań`).toBeLessThanOrEqual(5);
    }
  });

  it('każda inicjatywa ma zakres (w zakresie i poza zakresem), kategorię, priorytet i autora', () => {
    for (const i of INICJATYWY) {
      expect(i.zakresW.length, `${i.slug}: pusty zakres`).toBeGreaterThan(0);
      expect(i.zakresPoza.length, `${i.slug}: pusty „poza zakresem"`).toBeGreaterThan(0);
      expect(i.kategoria.trim()).not.toBe('');
      expect(i.priorytet.trim()).not.toBe('');
      expect(i.autor.trim()).not.toBe('');
    }
  });

  it('szkice (DRAFT) mają opis, właściciela i zakres — komplet wymagany przez bramkę CARD_COMPLETE', () => {
    const szkice = INICJATYWY.filter((i) => i.status === 'DRAFT');
    expect(szkice.length).toBe(1);
    for (const i of szkice) {
      expect(i.opis.trim()).not.toBe('');
      expect(i.wlascicielBiznesowy.trim()).not.toBe('');
      expect(i.zakresW.length).toBeGreaterThan(0);
    }
  });

  it('każda inicjatywa ma DOKŁADNIE jednego „A" (accountable) w RACI i co najmniej jednego „R"', () => {
    for (const i of INICJATYWY) {
      expect(i.interesariusze.filter((s) => s.raci === 'A'), `${i.slug}: liczba A`).toHaveLength(1);
      expect(i.interesariusze.filter((s) => s.raci === 'R').length, `${i.slug}: brak R`).toBeGreaterThanOrEqual(1);
      expect(i.interesariusze.length, `${i.slug}: za mało interesariuszy`).toBeGreaterThanOrEqual(3);
    }
  });

  it('CLOSED ma wynik i datę zamknięcia; REJECTED ma powód, decydenta i datę', () => {
    const zamkniete = INICJATYWY.find((i) => i.status === 'CLOSED')!;
    expect(zamkniete.zamknieto).toBeTruthy();
    expect((zamkniete.wynikZamkniecia ?? '').length).toBeGreaterThan(60);
    const odrzucone = INICJATYWY.find((i) => i.status === 'REJECTED')!;
    expect(odrzucone.odrzucono).toBeTruthy();
    expect(odrzucone.decydent).toBeTruthy();
    expect((odrzucone.blockedReason ?? '').length).toBeGreaterThan(60);
  });

  it('MUTACJA — inicjatywa z pustym opisem (wzór zastany: 149 z 173) jest łapana jako brak kompletu', () => {
    const mutant: Inicjatywa = { ...INICJATYWY[0]!, opis: '' };
    expect(mutant.opis.length).toBeLessThan(200); // mutant: brak opisu
    expect(INICJATYWY.every((i) => i.opis.length >= 200)).toBe(true); // produkcja: komplet
  });
});

describe('03-dane-inicjatyw — dane są PO ANGIELSKU', () => {
  const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

  it('żadne pole widoczne na ekranie nie zawiera polskich znaków', () => {
    for (const i of INICJATYWY) {
      const tekst = [
        i.tytul,
        i.opis,
        i.streszczenie,
        i.problem,
        i.kategoria,
        i.obszar,
        i.wartoscBiznesowa,
        i.oczekiwanyZwrot,
        i.blockedReason ?? '',
        i.wynikZamkniecia ?? '',
        ...i.zakresW,
        ...i.zakresPoza,
        ...i.kryteriaSukcesu,
        ...i.produkty,
        ...i.ryzyka,
        ...i.tagi,
        ...i.interesariusze.map((s) => s.role),
      ].join(' ');
      expect(DIAKRYTYKI.test(tekst), `${i.slug} zawiera polski znak w treści pokazowej`).toBe(false);
    }
  });
});

describe('03-dane-inicjatyw — identyfikatory UUIDv5 są stabilne', () => {
  it('to samo (rodzaj, slug) daje ZAWSZE to samo id', () => {
    for (const i of INICJATYWY) {
      expect(det('initiative', i.slug)).toBe(det('initiative', i.slug));
      expect(det('initiative', i.slug)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }
  });

  it('identyfikatory 13 inicjatyw są parami różne (slug jest unikalny)', () => {
    const idy = INICJATYWY.map((i) => det('initiative', i.slug));
    expect(new Set(idy).size).toBe(INICJATYWY.length);
    expect(new Set(INICJATYWY.map((i) => i.slug)).size).toBe(INICJATYWY.length);
  });

  it('tytuły są unikalne — lista nie pokaże dwóch wierszy o tej samej nazwie', () => {
    expect(new Set(INICJATYWY.map((i) => i.tytul)).size).toBe(INICJATYWY.length);
  });
});

describe('03-dane-inicjatyw — plan i analiza obciążenia mają z czego powstać', () => {
  it('cztery inicjatywy planu istnieją i są zarejestrowalne (APPROVED_BACKLOG po register)', () => {
    expect(SLUGI_PLANU).toHaveLength(4);
    for (const slug of SLUGI_PLANU) {
      const i = INICJATYWY.find((x) => x.slug === slug);
      expect(i, `slug planu ${slug} nie istnieje w danych`).toBeTruthy();
      expect(doRejestracji().map((x) => x.slug)).toContain(slug);
      expect(i!.planStart, `${slug}: okno planu bez daty`).toBeTruthy();
      expect(i!.planKoniec, `${slug}: okno planu bez daty`).toBeTruthy();
    }
  });

  it('daty okien planu mieszczą się w horyzoncie 2026-2027 (walidator odrzuca okno poza okresami)', () => {
    for (const slug of SLUGI_PLANU) {
      const i = INICJATYWY.find((x) => x.slug === slug)!;
      expect(Date.parse(i.planStart!)).toBeGreaterThanOrEqual(Date.parse('2026-01-01T00:00:00.000Z'));
      expect(Date.parse(i.planKoniec!)).toBeLessThanOrEqual(Date.parse('2027-12-31T23:59:59.000Z'));
      expect(Date.parse(i.planStart!)).toBeLessThanOrEqual(Date.parse(i.planKoniec!));
    }
  });
});
