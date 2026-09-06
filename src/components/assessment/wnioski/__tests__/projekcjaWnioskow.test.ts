/**
 * DEC-416 — lista „Wnioski” Oceny MUSI rozdzielać WNIOSEK od ZAPISU SESJI.
 *
 * To jest test zabezpieczenia, nie scenariusza: gdyby reguła rozdziału zniknęła
 * (jedna przestrzeń id, chip liczony po tytule), wiersz „Zapis sesji” znów
 * udawałby wniosek — dokładnie stan, który właściciel zgłosił 06.09.
 */
import { describe, expect, it } from 'vitest';

import {
  czyWniosekZOceny,
  etykietaStanuWniosku,
  idWnioskuZWiersza,
  idWierszaWniosku,
  projektujWniosekNaWierszListy,
  scalWnioskiZWierszami,
  typWierszaWnioskow,
} from '../projekcjaWnioskow';

describe('projekcja wniosków Oceny', () => {
  it('rozdziela trzy typy wiersza po przestrzeni id, nie po tytule', () => {
    expect(typWierszaWnioskow('wniosek~abc')).toBe('wniosek');
    expect(typWierszaWnioskow('ocena~assess-1')).toBe('zapis-sesji');
    expect(typWierszaWnioskow('out_123')).toBe('wynik-jadra');
    // Tytuł nie może niczego przesądzać.
    expect(typWierszaWnioskow('out_wniosek-koncowy')).toBe('wynik-jadra');
  });

  it('id wniosku wraca w całości (round-trip), a obcy id nie jest wnioskiem', () => {
    const id = 'c0ffee-1234';
    expect(idWnioskuZWiersza(idWierszaWniosku(id))).toBe(id);
    expect(idWnioskuZWiersza('ocena~c0ffee-1234')).toBeNull();
    expect(idWnioskuZWiersza('out_c0ffee')).toBeNull();
  });

  it('bierze wyłącznie wnioski ze źródeł Oceny (warstwa jest org-wide)', () => {
    expect(czyWniosekZOceny({ sourceModule: 'assessment_drd' })).toBe(true);
    expect(czyWniosekZOceny({ sourceModule: 'assessment' })).toBe(true);
    expect(czyWniosekZOceny({ sourceModule: 'assessment_siri' })).toBe(true);
    expect(czyWniosekZOceny({ sourceModule: 'interview' })).toBe(false);
    expect(czyWniosekZOceny({ sourceModule: 'tool' })).toBe(false);
    expect(czyWniosekZOceny({ sourceModule: null })).toBe(false);
  });

  it('projektuje wniosek na wiersz z rodowodem do raportu i własnym stanem', () => {
    const wiersz = projektujWniosekNaWierszListy({
      id: 'w-1',
      title: 'Werdykt DRD',
      sourceModule: 'assessment_drd',
      status: 'candidate',
      createdAt: '2026-09-06T10:00:00Z',
      updatedAt: '2026-09-06T11:00:00Z',
      sourceArtifactRefs: [{ type: 'assessment_report', id: 'report-1' }],
    });
    expect(wiersz.id).toBe('wniosek~w-1');
    expect(typWierszaWnioskow(wiersz.id)).toBe('wniosek');
    expect(wiersz.scope).toBe('Werdykt DRD');
    expect(wiersz.statusWniosku).toBe('candidate');
    expect(wiersz.raportZrodlowyId).toBe('report-1');
    // Wniosek NIE jest zamrożonym wynikiem jądra — te pola muszą zostać puste.
    expect(wiersz.outputVersion).toBeNull();
    expect(wiersz.contentHash).toBeNull();
    expect(wiersz.sessionId).toBeNull();
  });

  it('tłumaczy stan wniosku, a nieznanego kodu nie zgaduje', () => {
    expect(etykietaStanuWniosku('candidate', true)).toBe('Kandydat');
    expect(etykietaStanuWniosku('needs_evidence', true)).toBe('Wymaga dowodów');
    expect(etykietaStanuWniosku('candidate', false)).toBe('Candidate');
    // Kod techniczny w UI to defekt — ale zmyślona etykieta jest gorsza.
    expect(etykietaStanuWniosku('cos_nowego', true)).toBe('cos_nowego');
    expect(etykietaStanuWniosku(null, true)).toBe('Stan nieznany');
  });

  it('scala wnioski przed zapisami sesji i nie gubi żadnego wiersza', () => {
    const wnioski = [{ id: 'wniosek~a' }, { id: 'wniosek~b' }];
    const zapisy = [{ id: 'ocena~x' }, { id: 'out_1' }];
    const scalone = scalWnioskiZWierszami(wnioski, zapisy);
    expect(scalone.map((r) => r.id)).toEqual(['wniosek~a', 'wniosek~b', 'ocena~x', 'out_1']);
    expect(scalWnioskiZWierszami([], zapisy)).toEqual(zapisy);
  });
});
