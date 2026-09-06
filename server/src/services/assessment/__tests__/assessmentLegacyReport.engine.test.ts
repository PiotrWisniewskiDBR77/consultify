/**
 * Silnik raportu/prezentacji z oceny zastanej — na realnym kształcie danych.
 *
 * Wejście odwzorowuje wiersz `assessments.answers_json` z organizacji DBR77
 * (kształt `drd.areas.<id> = { achievedLevel, targetLevel, levelNotes }`).
 * Testy pilnują trzech rzeczy, które w tym dokumencie są krytyczne:
 * brak wymyślonych danych, brak instrukcji redakcyjnych w treści dla klienta
 * i rozłączność pól na slajdzie.
 */
import { describe, expect, it } from 'vitest';

import DRD_STRUCTURE from '../../../data/drdStructure.js';
import { buildAssessmentDeckModel, DECK_GEOMETRY, takeawayRect } from '../assessmentDeckModel.js';
import { buildAssessmentDrdReportSchema } from '../assessmentDrdReportSchemaService.js';
import {
  odczytajObszaryZastane,
  zbudujFindingiZastane,
} from '../assessmentLegacyReportContractService.js';
import { composeReportContract } from '../assessmentReportContractComposer.js';

const ANSWERS = JSON.stringify({
  drd: {
    areas: {
      '1A': {
        achievedLevel: 3,
        targetLevel: 6,
        levelNotes: { '3': 'CRM wdrożony, integracja z ERP zaplanowana na Q2.' },
      },
      '1B': { achievedLevel: 4, targetLevel: 6 },
      '1C': { achievedLevel: 5, targetLevel: 6 },
      '2A': { achievedLevel: 4, targetLevel: 5 },
      '5A': { achievedLevel: 2, targetLevel: 6 },
      '7A': { achievedLevel: 1, targetLevel: 5 },
      // Poziom 0 = BRAK pomiaru, nie zmierzone zero.
      '7B': { achievedLevel: 0, targetLevel: 0 },
    },
  },
});

function zbudujKontrakt() {
  const { poziomy, notatki } = odczytajObszaryZastane(ANSWERS);
  const findings = zbudujFindingiZastane('assess-x', poziomy, '2026-09-01T10:00:00.000Z');
  return composeReportContract({
    sessionId: 'assess-x',
    outputId: null,
    revision: 0,
    generatedAt: '2026-09-01T10:00:00.000Z',
    methodVersion: 'DRD 7 osi',
    sourceKind: 'legacy',
    sessionLabel: { displayName: 'Klient Testowy', source: 'assessment', projectId: null },
    businessProfile: null,
    employment: null,
    assessmentPeriod: null,
    assessor: 'Anna Kowalska',
    clientSponsor: null,
    findings,
    limitations: ['Ocena warsztatowa — poziomy zadeklarowane bez dowodów.'],
    skipReasons: [],
    assessorNotes: notatki,
  });
}

describe('odczyt oceny zastanej', () => {
  it('poziom 0 nie tworzy findingu (brak pomiaru ≠ zmierzone zero)', () => {
    const { poziomy } = odczytajObszaryZastane(ANSWERS);
    const findings = zbudujFindingiZastane('assess-x', poziomy, '2026-09-01T10:00:00.000Z');
    expect(findings.map((f) => f.unitId)).toEqual(['1A', '1B', '1C', '2A', '5A', '7A']);
    expect(findings.find((f) => f.unitId === '7B')).toBeUndefined();
  });

  it('luka jest różnicą docelowego i obecnego — nic więcej nie jest liczone', () => {
    const { poziomy } = odczytajObszaryZastane(ANSWERS);
    const findings = zbudujFindingiZastane('assess-x', poziomy, '2026-09-01T10:00:00.000Z');
    expect(findings.find((f) => f.unitId === '5A')?.gap).toBe(4);
    expect(findings.every((f) => f.recommendation === '')).toBe(true);
  });

  it('notatka oceniającego trafia do kontraktu jako własne pole', () => {
    const kontrakt = zbudujKontrakt();
    const komentarz = kontrakt.chapters
      .flatMap((rozdzial) => rozdzial.areaComments)
      .find((c) => c.unitId === '1A');
    expect(komentarz?.assessorNote).toContain('CRM wdrożony');
    expect(komentarz?.content).toContain('Notatka oceniającego:');
  });
});

describe('dokument dla klienta', () => {
  it('nie zawiera instrukcji redakcyjnej ani placeholderów szablonu', () => {
    const schemat = buildAssessmentDrdReportSchema(zbudujKontrakt());
    const tekst = JSON.stringify(schemat);
    // DOWÓD MUTACYJNY: przywrócenie `placeholder(...)` w komórkach linii
    // decyzyjnej (assessmentDrdReportSchemaService) natychmiast czyni to
    // czerwonym — dokładnie ten napis trafiał do pliku klienta.
    expect(tekst).not.toContain('Sekcja do uzupełnienia');
    for (const zakazane of ['TODO', 'Lorem', '{{', 'undefined', 'NaN', '[object']) {
      expect(tekst).not.toContain(zakazane);
    }
  });

  it('ma załącznik metodyczny wyprowadzony ze struktury DRD', () => {
    const schemat = buildAssessmentDrdReportSchema(zbudujKontrakt());
    const zalacznik = schemat.sections.find((s) => s.sectionId === 'methodology-appendix');
    expect(zalacznik).toBeDefined();
    const tabela = zalacznik!.blocks.find((b) => b.blockId === 'methodology-axes');
    expect((tabela!.content as { rows: unknown[] }).rows).toHaveLength(DRD_STRUCTURE.length);
  });
});

describe('prezentacja', () => {
  it('ma 10–14 slajdów i tytuły nie dłuższe niż 8 słów', () => {
    const model = buildAssessmentDeckModel(zbudujKontrakt(), 'DBR77');
    expect(model.slides.length).toBeGreaterThanOrEqual(10);
    expect(model.slides.length).toBeLessThanOrEqual(14);
    for (const slajd of model.slides) {
      expect(slajd.title.trim().split(/\s+/u).length).toBeLessThanOrEqual(8);
    }
  });

  it('żadne dwa pola slajdu się nie przecinają i nic nie wychodzi poza slajd', () => {
    const model = buildAssessmentDeckModel(zbudujKontrakt(), 'DBR77');
    for (const slajd of model.slides) {
      const pola = slajd.bodies.map((body) => body.rect);
      if (slajd.takeaway) pola.push(takeawayRect());
      for (const r of pola) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(DECK_GEOMETRY.slideW + 0.001);
        expect(r.y + r.h).toBeLessThanOrEqual(DECK_GEOMETRY.slideH + 0.001);
      }
      for (let i = 0; i < pola.length; i += 1) {
        for (let j = i + 1; j < pola.length; j += 1) {
          const a = pola[i];
          const b = pola[j];
          const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          expect(dx > 0.01 && dy > 0.01).toBe(false);
        }
      }
    }
  });

  it('list punktowanych jest nie więcej niż 6 pozycji na slajd', () => {
    const model = buildAssessmentDeckModel(zbudujKontrakt(), 'DBR77');
    for (const slajd of model.slides) {
      for (const body of slajd.bodies) {
        if (body.kind === 'bullets') expect(body.items.length).toBeLessThanOrEqual(6);
      }
    }
  });
});
