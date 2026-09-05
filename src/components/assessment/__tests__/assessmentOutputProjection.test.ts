/**
 * Projekcja scalająca dwa magazyny modułu Ocena — na REALNEJ fikstórze API.
 *
 * Fikstury w `fixtures/` to nieprzerobione odpowiedzi żywego serwera
 * (stanowisko lokalne :4130, org DBR77, baza `consultify_noc`), zdjęte
 * 06.09 curl-em: `GET /api/assessments`, `GET /api/v8/assessment/:id`,
 * `GET /api/assessment-reports/:id`. Nie są ręcznie pisanym atrapowym
 * kształtem — dlatego test pada, gdy endpoint zmieni pola.
 *
 * DOWÓD MUTACYJNY (opisany, żeby dało się go powtórzyć):
 * usuń scalanie w `scalOcenyZastaneZOutputami` (np. `return kanoniczne`)
 * → asercja „lista ma 4 wiersze" spada do 0 i test PADA. Tak samo usunięcie
 * gałęzi `areas` w `odczytajPoziomyZOdpowiedzi` → 0 obszarów w macierzy.
 */
import { describe, expect, it } from 'vitest';

import listaOcen from './fixtures/lista-ocen-zastanych.json';
import ocenaZastana from './fixtures/ocena-zastana-drd.json';
import raportZastany from './fixtures/raport-zastany-drd.json';

import {
  idOcenyZWierszaZastanego,
  idWierszaZastanego,
  odczytajPoziomyZOdpowiedzi,
  projektujOceneZastanaNaOutput,
  projektujOceneZastanaNaWierszListy,
  projektujRaportZastanyNaTresc,
  scalOcenyZastaneZOutputami,
  type LegacyAssessmentDetail,
  type LegacyAssessmentListRow,
} from '../assessmentOutputProjection';

const wierszeZastane = (listaOcen as { assessments: LegacyAssessmentListRow[] }).assessments;
const ocena = (ocenaZastana as { data: { assessment: LegacyAssessmentDetail } }).data.assessment;

describe('projekcja ocen zastanych — lista Outputów', () => {
  it('realna odpowiedź /api/assessments daje 4 wiersze listy (org DBR77)', () => {
    expect(wierszeZastane.length).toBe(4);
    const wiersze = wierszeZastane.map(projektujOceneZastanaNaWierszListy);
    expect(wiersze).toHaveLength(4);
    for (const w of wiersze) {
      expect(w.module).toBe('assessment');
      expect(w.scope).toBeTruthy();
      // Nic nie udaje zamrożenia.
      expect(w.frozenAt).toBeNull();
      expect(w.contentHash).toBeNull();
    }
  });

  it('scalanie: przy PUSTYM magazynie kanonicznym lista i tak ma 4 wiersze (to jest naprawa)', () => {
    const scalone = scalOcenyZastaneZOutputami([], wierszeZastane.map(projektujOceneZastanaNaWierszListy));
    // ★ ASERCJA MUTACYJNA: `return kanoniczne` zamiast scalania → 0, test pada.
    expect(scalone).toHaveLength(4);
  });

  it('przy kolizji id wygrywa wiersz kanoniczny, zastany jest pomijany', () => {
    const zastany = projektujOceneZastanaNaWierszListy(wierszeZastane[0]);
    const kanoniczny = { ...zastany, scope: 'wersja kanoniczna', frozenAt: '2026-09-01T00:00:00Z' };
    const scalone = scalOcenyZastaneZOutputami([kanoniczny], [zastany]);
    expect(scalone).toHaveLength(1);
    expect(scalone[0].scope).toBe('wersja kanoniczna');
  });

  it('bez wierszy zastanych zwraca tę SAMĄ referencję (brak zbędnego przerysowania)', () => {
    const kanoniczne = [projektujOceneZastanaNaWierszListy(wierszeZastane[0])];
    expect(scalOcenyZastaneZOutputami(kanoniczne, [])).toBe(kanoniczne);
  });

  it('przestrzeń id jest rozłączna i odwracalna', () => {
    expect(idOcenyZWierszaZastanego(idWierszaZastanego('assess-x'))).toBe('assess-x');
    expect(idOcenyZWierszaZastanego('out-1')).toBeNull();
  });
});

describe('projekcja ocen zastanych — treść raportu', () => {
  it('realna ocena DRD daje 39 obszarów z poziomem obecnym — macierz ma z czego powstać', () => {
    const { current, target, notes } = odczytajPoziomyZOdpowiedzi(ocena.answers);
    // ★ ASERCJA MUTACYJNA: usunięcie gałęzi `areas` → 0, test pada.
    expect(Object.keys(current)).toHaveLength(39);
    expect(Object.keys(target).length).toBeGreaterThan(0);
    expect(current['1A']).toBe(3);
    expect(target['1A']).toBe(6);
    // Notatka konsultanta z poziomu OBECNEGO — realny tekst z bazy.
    expect(notes['1A']).toContain('CRM');
  });

  it('starszy kształt areaScores też jest czytany, a areas ma pierwszeństwo', () => {
    const stary = {
      drd: {
        processes: { areaScores: { '1A': [7, 0], '1B': [2, 5] } },
        areas: { '1A': { achievedLevel: 3, targetLevel: 6 } },
      },
    };
    const { current, target } = odczytajPoziomyZOdpowiedzi(stary);
    expect(current['1A']).toBe(3); // `areas` wygrywa nad `areaScores`
    expect(current['1B']).toBe(2);
    expect(target['1B']).toBe(5);
    // 0 to BRAK pomiaru, nie zmierzone zero.
    expect(target['1A']).toBe(6);
    expect(Object.prototype.hasOwnProperty.call(target, '1B')).toBe(true);
  });

  it('Output z projekcji ma luki policzone i NIE udaje zamrożonego', () => {
    const { output, notatkiObszarow } = projektujOceneZastanaNaOutput(ocena);
    expect(output.methodPackId).toBe('drd');
    expect(output.methodPackVersion).toBe('2.0.0-methodpack.1');
    expect(output.gap['1A']).toBe(3);
    expect(output.frozenAt).toBe('');
    expect(output.contentHash).toBe('');
    expect(output.aggregation).toBeNull();
    expect(output.findings).toHaveLength(0);
    expect(output.limitations.length).toBeGreaterThan(0);
    expect(Object.keys(notatkiObszarow).length).toBeGreaterThan(0);
  });

  it('obszar bez pomiaru NIE trafia do current/target (żadnych zmierzonych zer)', () => {
    const { current, target } = odczytajPoziomyZOdpowiedzi({
      drd: { areas: { '9Z': { achievedLevel: 0, targetLevel: null } } },
    });
    expect(Object.prototype.hasOwnProperty.call(current, '9Z')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(target, '9Z')).toBe(false);
  });

  it('realny raport zastany daje streszczenie i pozycje — bez wymyślania treści', () => {
    const tresc = projektujRaportZastanyNaTresc(raportZastany);
    expect(tresc).not.toBeNull();
    expect(tresc?.reportId).toBe('report-drd-test-exec');
    expect(tresc?.executiveSummary).toBeTruthy();
    expect(tresc?.recommendations.length).toBeGreaterThan(0);
  });

  it('brak raportu = null, nie pusty obiekt-wypełniacz', () => {
    expect(projektujRaportZastanyNaTresc(null)).toBeNull();
    expect(projektujRaportZastanyNaTresc({ content: {} })).toBeNull();
  });
});
