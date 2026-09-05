/**
 * @vitest-environment jsdom
 *
 * ODBIÓR NA ŻYWO 05.09, pakiet 05-ocena, RUNDA 3 — `assessment-report-contract`.
 *
 * Zmierzone na żywo
 * (`evidence/odbior-zywo-20260905/05-ocena/assessment-report-contract.png`):
 * szyna rozdziałów raportu pokazywała „Pr…", „Pr…", „Cy…", „Za…", „Kul…",
 * „Cy…", „Do…" — czyli PEŁNE nazwy osi ucięte w ~140 px szyny. Siedem
 * rozdziałów było nierozróżnialnych. Obraz zatwierdzony
 * (`evidence/grafika/132-noc-wywiad-ocena/assessment-report-contract__PRZED__light.png`)
 * ma „Oś 1"…„Oś 7".
 *
 * ★ DLACZEGO OSOBNY PLIK, A NIE ASERCJA W `AssessmentReportContractView.test`:
 * tamta fikstura ma `axisNamePL = "Oś N"`, więc asercja „widzę Oś 1"
 * przechodziłaby TAKŻE przed naprawą (etykieta = nazwa osi = „Oś 1").
 * Tutaj nazwa osi jest DŁUGA i różna od etykiety, więc test pada, jeśli ktoś
 * wróci do podstawiania nazwy osi jako etykiety szyny.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/method-core/api/methodCoreApi';
import { resetAssessmentReportViewFlagCache } from '@/utils/assessmentReportViewFlag';

import { AssessmentReportContractView } from '../../../src/components/assessment/report/AssessmentReportContractView';

const NAZWY_OSI = [
  'Digital Processes',
  'Digital Products',
  'Digital Business Models',
  'Data Management',
  'Transformation Culture',
  'Cybersecurity',
  'AI Maturity',
];
const NAZWY_OSI_PL = [
  'Procesy Cyfrowe',
  'Produkty Cyfrowe',
  'Cyfrowe Modele Biznesowe',
  'Zarządzanie Danymi',
  'Kultura Transformacji',
  'Cyberbezpieczeństwo',
  'Dojrzałość AI',
];

const rozdzial = (axisId: number): api.AssessmentReportChapter =>
  ({
    axisId,
    axisName: NAZWY_OSI[axisId - 1],
    axisNamePL: NAZWY_OSI_PL[axisId - 1],
    maxLevel: 5,
    introduction: { content: null, minWords: 120, maxWords: 180 },
    matrix: { caption: { content: null, minWords: 30, maxWords: 60 }, areas: [] },
    areaComments: [],
    conclusion: {
      content: null,
      minWords: 180,
      maxWords: 260,
      decisionLine: { direction: null, priority: null, horizon: null, successCondition: null },
    },
  }) as unknown as api.AssessmentReportChapter;

const kontrakt = {
  contractVersion: 'assessment-report-contract-v1',
  sessionId: 'session-1',
  outputId: null,
  revision: 0,
  generatedAt: '2026-09-05T10:00:00.000Z',
  methodVersion: 'drd-v1',
  chapters: Array.from({ length: 7 }, (_, i) => rozdzial(i + 1)),
} as unknown as api.AssessmentReportContract;

describe('05-ocena · assessment-report-contract — szyna rozdziałów rozróżnia osie', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAssessmentReportViewFlagCache();
    vi.restoreAllMocks();
  });

  it('etykieta pozycji to numer osi (Oś 1…7 / Axis 1…7), a nie ucięta nazwa osi', async () => {
    vi.spyOn(api, 'getAssessmentReportContract').mockResolvedValue(kontrakt);
    render(<AssessmentReportContractView sessionId="session-1" />);
    await screen.findByTestId('assessment-report-contract-view');

    const pozycje = Array.from(
      document.querySelectorAll<HTMLElement>('[data-nmode-section-item]')
    ).filter((el) => String(el.dataset.nmodeSectionItem || '').startsWith('axis-'));
    expect(pozycje).toHaveLength(7);

    pozycje.forEach((el, index) => {
      const tekst = (el.textContent || '').replace(/\s+/g, ' ').trim();
      // etykieta = numer osi (jedna z dwóch form językowych, bo w jsdom
      // i18next nie ma wczytanych tłumaczeń)
      expect(tekst).toMatch(new RegExp(`^(Oś|Axis) ${index + 1}$`));
      // ...i NIE jest nazwą osi — to był właśnie zarzut z odbioru
      expect(tekst).not.toContain(NAZWY_OSI[index]);
      expect(tekst).not.toContain(NAZWY_OSI_PL[index]);
      // pełna nazwa nie ginie: siedzi w dymku
      expect(el.getAttribute('title')).toMatch(
        new RegExp(`^(${NAZWY_OSI_PL[index]}|${NAZWY_OSI[index]})$`)
      );
    });
  });
});
