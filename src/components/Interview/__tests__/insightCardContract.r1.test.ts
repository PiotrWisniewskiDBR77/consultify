import { describe, expect, it } from 'vitest';

import {
  pilnujSekcjiZKontraktu,
  sekcjeZKontraktu,
  wymagajSekcjiZKontraktu,
} from '../../standard/contractSections';
import { INSIGHT_CARDS } from '../insightCardContract';

// R1 — DEFEKT BLOKUJĄCY (odbiór A1, 2026-09-10): otwarcie Wniosku renderowało
// puste centrum, bo `artifact-actions` (etykieta „Rezultaty") była zwracana
// jako sekcja #0 lewej nawigacji przez `sekcjeZKontraktu`, mimo że od
// 2026-07-23 nie ma case'a w centrum (treść żyje wyłącznie w prawym panelu).
// Przyczyna: kompozycja deklarowała `kolumna:'left'`, a `sekcjeZKontraktu`
// filtruje WYŁĄCZNIE `kolumna==='right'`. Naprawa: `kolumna:'right'`.
//
// Ten test pilnuje PRZYCZYNY (kompozycja), nie tylko objawu — mutacja/cofnięcie
// naprawy (przywrócenie `kolumna:'left'`) MUSI go zaczerwienić.
describe('InsightViewer — R1 (artifact-actions nie może wrócić do centrum)', () => {
  it('sekcjeZKontraktu(INSIGHT_CARDS, "insight") nie zwraca "artifact-actions"', () => {
    const sections = sekcjeZKontraktu(INSIGHT_CARDS, 'insight');
    expect(sections.some((s) => s.id === 'artifact-actions')).toBe(false);
  });

  it('pierwsza sekcja lewej kolumny Wniosku ma realny komponent centrum (nie "artifact-actions")', () => {
    const sections = sekcjeZKontraktu(INSIGHT_CARDS, 'insight');
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].id).toBe('executive-summary');
  });

  it('"artifact-actions" zostaje w katalogu kanonicznym jako rdzeń nieusuwalny (tylko chowany z centrum)', () => {
    const karta = INSIGHT_CARDS.find((k) => k.id === 'artifact-actions');
    expect(karta).toBeDefined();
    const membership = karta!.kompozycja.find((m) => m.artefakt === 'insight');
    expect(membership?.rola).toBe('rdzen');
    expect(membership?.kolumna).toBe('right');
  });
});

// W1-A (odbiór A1): `wymagajSekcjiZKontraktu`/`pilnujSekcjiZKontraktu` miały 0
// wołaczy produkcyjnych — dokładnie ta klasa bramki złapałaby R1, gdyby była
// podpięta wcześniej. Test odtwarza syntetycznie tę klasę defektu (kontrakt
// deklaruje sekcję, "ekran" jej nie renderuje) niezależnie od Insighta, żeby
// pilnować samego mechanizmu bramki, a nie jednego konkretnego bugfixa.
describe('pilnujSekcjiZKontraktu — mechanizm bramki DEC-432', () => {
  it('rzuca, gdy ekran gubi sekcję obecną w kontrakcie (klasa defektu R1)', () => {
    const kontrakt = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const ekranZDefektem = [{ id: 'a' }, { id: 'c' }]; // "b" nie ma komponentu centrum
    expect(() => wymagajSekcjiZKontraktu(ekranZDefektem, kontrakt)).toThrow('SEKCJE_POZA_KONTRAKTEM');
  });

  it('przechodzi bez rzutu, gdy ekran i kontrakt są identyczne', () => {
    const kontrakt = [{ id: 'a' }, { id: 'b' }];
    expect(() => pilnujSekcjiZKontraktu(kontrakt, kontrakt)).not.toThrow();
  });
});
