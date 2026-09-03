import { describe, expect, it } from 'vitest';

import { SAMPLE_DRD_SCORES } from '../../../../../src/services/report/drdReportSampleData.js';
import {
  buildAcceptedDrdReportModel,
  evidenceLabelForStrength,
} from '../acceptedDrdReportModel.js';

describe('accepted DRD report model from MethodSession', () => {
  it('maps E0-E4 to the four accepted evidence labels with one rule', () => {
    expect(['E0', 'E1', 'E2', 'E3', 'E4'].map((strength) =>
      evidenceLabelForStrength(strength as 'E0' | 'E1' | 'E2' | 'E3' | 'E4')
    )).toEqual(['Brak dowodu', 'Deklarowany', 'Niepełny', 'Potwierdzony', 'Potwierdzony']);
  });

  it('reproduces the accepted prototype model for SAMPLE_DRD_SCORES', async () => {
    const prototype = await import('../../../../../scripts/prototypes/raport-oceny-tresc.mjs');
    const expected = {
      META: prototype.META,
      WYNIK_OGOLNY: prototype.WYNIK_OGOLNY,
      OSIE: prototype.OSIE,
      WNIOSKI_PRZEKROJOWE: prototype.WNIOSKI_PRZEKROJOWE,
      MAPA_DROGOWA: prototype.MAPA_DROGOWA,
      KOLEJNY_KROK: prototype.KOLEJNY_KROK,
      GRANICE: prototype.GRANICE,
    };

    const actual = buildAcceptedDrdReportModel({
      ...expected,
      session: {
        id: 'sample-drd-session',
        organizationId: 'sample-org',
        methodPackId: 'drd',
        methodPackVersion: 'sample-v1',
        state: 'frozen',
        version: 1,
      },
      areaScores: SAMPLE_DRD_SCORES,
    });

    expect(actual).toEqual(expected);
  });

  it('fails closed when required axis content is absent', async () => {
    const prototype = await import('../../../../../scripts/prototypes/raport-oceny-tresc.mjs');
    expect(() =>
      buildAcceptedDrdReportModel({
        META: prototype.META,
        WYNIK_OGOLNY: prototype.WYNIK_OGOLNY,
        OSIE: prototype.OSIE.slice(0, 6),
        WNIOSKI_PRZEKROJOWE: prototype.WNIOSKI_PRZEKROJOWE,
        MAPA_DROGOWA: prototype.MAPA_DROGOWA,
        KOLEJNY_KROK: prototype.KOLEJNY_KROK,
        GRANICE: prototype.GRANICE,
        session: {
          id: 'incomplete-drd-session',
          organizationId: 'sample-org',
          methodPackId: 'drd',
          methodPackVersion: 'sample-v1',
          state: 'frozen',
          version: 1,
        },
        areaScores: SAMPLE_DRD_SCORES,
      })
    ).toThrow('requires 7 axes');
  });
});
